import { NextResponse } from 'next/server';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import {
  TEMP_DIR_RELATIVE,
  GENERATION_LOCKFILE_FILENAME,
  HTML_TREE_DIR,
  HTML_TREE_FILENAME,
  CANVAS_ITERATION_FILENAME_PATTERN,
} from '../../lib/constants';
import type { ProviderId } from '../../lib/providers';
import {
  spawnAgent,
  getProviderNotFoundMessage,
  getProviderDisplayName,
  resolveAgentModel,
} from '../../lib/providers';
import { readDesignMd, buildSystemPromptAddon } from '../../lib/design-md-helpers';
import { NO_BROWSER_INSTRUCTIONS } from '../../prompts/shared-sections';
import {
  capture,
  diffTotalsDelta,
  getGitDiffTotals,
  isLocalRequest,
  isTelemetryEnabled,
} from '../../lib/telemetry/server';
import { safeModel, safeSkills } from '../../lib/telemetry/schema';
import type { GenerationSource } from '../../lib/telemetry/constants';
import {
  CURSOR_AUTH_ERROR_PATTERN,
  CURSOR_AUTH_USER_MESSAGE,
} from '../../lib/cursor-auth-constants';
import {
  resolvePlaygroundDir,
  resolvePlaygroundDirRelative,
} from '../../lib/resolve-playground-dir';

/**
 * Playground generation API - Agent CLI Integration
 *
 * POST: Start generation (spawns agent CLI, waits for completion)
 * DELETE: Cancel running generation
 * GET?action=download-chat: Download agent output log
 * GET?action=events: SSE stream for progressive iteration detection
 * GET?action=status: Check generation status
 */

const TEMP_DIR = path.join(process.cwd(), TEMP_DIR_RELATIVE);
const LOCKFILE_PATH = path.join(TEMP_DIR, GENERATION_LOCKFILE_FILENAME);
const ITERATIONS_DIR = path.join(resolvePlaygroundDir(), 'iterations');

// Maximum generation duration (10 minutes)
const GENERATION_TIMEOUT_MS = 10 * 60 * 1000;

// Global state for managing the running generation
let currentProcess: ChildProcess | null = null;
let currentChatLogPath: string | null = null;
let currentLogStream: fs.WriteStream | null = null;
let isGenerating = false;
let generationTimer: NodeJS.Timeout | null = null;

// Telemetry lifecycle flags for the (single) running generation. Only event
// metadata (durations, counts, enum categories) is recorded — never prompts,
// code, or file contents. See TELEMETRY.md.
let wasCancelled = false;
let timedOut = false;
let genFirstIterationAt: number | null = null;
const currentIterationFiles = new Set<string>();

// ---------------------------------------------------------------------------
// File-watching event emitter for progressive iteration detection
// ---------------------------------------------------------------------------
// When the cursor agent writes tree.json (the last step per iteration),
// a debounced event is emitted so SSE clients can trigger a scan immediately.
const generationEvents = new EventEmitter();
let fileWatcher: fs.FSWatcher | null = null;
let htmlFileWatcher: fs.FSWatcher | null = null;
let htmlTreeWatcher: fs.FSWatcher | null = null;
let jsxFileWatcher: fs.FSWatcher | null = null;

function startFileWatcher(htmlPageFolder?: string, jsxFile?: string) {
  stopFileWatcher();
  let debounceTimer: NodeJS.Timeout | null = null;
  try {
    fileWatcher = fs.watch(ITERATIONS_DIR, (eventType, filename) => {
      if (filename === 'tree.json' || (filename && filename.endsWith('.tsx'))) {
        if (filename && filename.endsWith('.tsx')) {
          currentIterationFiles.add(path.join(ITERATIONS_DIR, filename));
        }
        // Debounce: the OS may fire multiple events for a single write
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          generationEvents.emit('iteration-added');
        }, 500);
      }
    });
    fileWatcher.on('error', () => {
      // iterations dir might not exist yet — ignore
    });
  } catch {
    // iterations dir might not exist yet
  }

  // Watch HTML page directory for iteration changes
  if (htmlPageFolder) {
    const htmlDir = path.join(process.cwd(), 'public', htmlPageFolder);
    let htmlDebounceTimer: NodeJS.Timeout | null = null;
    try {
      htmlFileWatcher = fs.watch(htmlDir, { recursive: true }, (_eventType, filename) => {
        if (!filename) return;
        const norm = filename.replace(/\\/g, '/');
        if (!norm.endsWith('.html')) return;
        if (!/iteration-\d+/.test(norm)) return;
        currentIterationFiles.add(path.join(htmlDir, norm));
        if (htmlDebounceTimer) clearTimeout(htmlDebounceTimer);
        htmlDebounceTimer = setTimeout(() => {
          generationEvents.emit('iteration-added');
        }, 500);
      });
      htmlFileWatcher.on('error', () => {
        // dir might not exist yet — ignore
      });
    } catch {
      // dir might not exist yet
    }

    // HTML iterations also update public/.playground/html-tree.json — watch so SSE
    // fires when the manifest changes (OS-specific fs.watch filename quirks).
    const treeDir = path.join(process.cwd(), 'public', HTML_TREE_DIR);
    let treeDebounceTimer: NodeJS.Timeout | null = null;
    try {
      htmlTreeWatcher = fs.watch(treeDir, (_eventType, filename) => {
        if (!filename) return;
        const base = path.basename(filename.replace(/\\/g, '/'));
        if (base !== HTML_TREE_FILENAME) return;
        if (treeDebounceTimer) clearTimeout(treeDebounceTimer);
        treeDebounceTimer = setTimeout(() => {
          generationEvents.emit('iteration-added');
        }, 500);
      });
      htmlTreeWatcher.on('error', () => {
        // .playground dir might not exist yet
      });
    } catch {
      // tree dir might not exist yet
    }
  }

  // Watch canvas-components directory for JSX iteration changes
  if (jsxFile) {
    const canvasDir = path.join(resolvePlaygroundDir(), 'canvas-components');
    let jsxDebounceTimer: NodeJS.Timeout | null = null;
    try {
      jsxFileWatcher = fs.watch(canvasDir, (_eventType, filename) => {
        if (filename && CANVAS_ITERATION_FILENAME_PATTERN.test(filename)) {
          currentIterationFiles.add(path.join(canvasDir, filename));
          if (jsxDebounceTimer) clearTimeout(jsxDebounceTimer);
          jsxDebounceTimer = setTimeout(() => {
            generationEvents.emit('iteration-added');
          }, 500);
        }
      });
      jsxFileWatcher.on('error', () => {
        // dir might not exist yet — ignore
      });
    } catch {
      // dir might not exist yet
    }
  }
}

function stopFileWatcher() {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
  if (htmlFileWatcher) {
    htmlFileWatcher.close();
    htmlFileWatcher = null;
  }
  if (htmlTreeWatcher) {
    htmlTreeWatcher.close();
    htmlTreeWatcher = null;
  }
  if (jsxFileWatcher) {
    jsxFileWatcher.close();
    jsxFileWatcher = null;
  }
}

// Ensure temp directory exists
function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Lockfile-based process recovery (survives HMR)
// ---------------------------------------------------------------------------

interface LockfileData {
  pid: number;
  componentId: string;
  startTime: number;
}

interface LockfileStatus {
  lockfilePresent: boolean;
  lockPid: number | null;
  lockPidAlive: boolean;
}

function writeLockfile(pid: number, componentId: string) {
  ensureTempDir();
  const data: LockfileData = { pid, componentId, startTime: Date.now() };
  fs.writeFileSync(LOCKFILE_PATH, JSON.stringify(data), 'utf-8');
}

function removeLockfile() {
  try {
    if (fs.existsSync(LOCKFILE_PATH)) {
      fs.unlinkSync(LOCKFILE_PATH);
    }
  } catch {
    // ignore
  }
}

function cleanupOrphanedProcess() {
  try {
    if (!fs.existsSync(LOCKFILE_PATH)) return;

    const raw = fs.readFileSync(LOCKFILE_PATH, 'utf-8');
    const data: LockfileData = JSON.parse(raw);

    // Check if the process is still running
    try {
      process.kill(data.pid, 0); // signal 0 = check if alive
      // Process is alive — kill it
      console.warn(`[Playground][generate] Killing orphaned generation process PID=${data.pid} (component: ${data.componentId})`);
      process.kill(data.pid, 'SIGTERM');
      setTimeout(() => {
        try { process.kill(data.pid, 'SIGKILL'); } catch { /* already dead */ }
      }, 2000);
    } catch {
      // Process is already dead, just clean up lockfile
    }

    removeLockfile();
  } catch (e) {
    console.error('[Playground][generate] Error cleaning up orphaned process:', e);
    removeLockfile();
  }
}

// Run cleanup on module load (handles HMR restarts)
cleanupOrphanedProcess();

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getLockfileStatus(): LockfileStatus {
  if (!fs.existsSync(LOCKFILE_PATH)) {
    return {
      lockfilePresent: false,
      lockPid: null,
      lockPidAlive: false,
    };
  }

  try {
    const raw = fs.readFileSync(LOCKFILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<LockfileData>;
    const pid = typeof parsed.pid === 'number' && Number.isFinite(parsed.pid) ? parsed.pid : null;
    const alive = pid !== null ? isPidAlive(pid) : false;
    return {
      lockfilePresent: true,
      lockPid: pid,
      lockPidAlive: alive,
    };
  } catch {
    return {
      lockfilePresent: true,
      lockPid: null,
      lockPidAlive: false,
    };
  }
}

/**
 * Single source of truth for "is a generation running?" on this Node process.
 * Note: in serverless or multi-worker setups, in-memory state and even the
 * lockfile may not be visible across instances — use shared storage if you deploy that way.
 */
function getGenerationStatus() {
  const lock = getLockfileStatus();
  const hasProcess = currentProcess !== null;
  const generationActive = isGenerating || hasProcess || (lock.lockfilePresent && lock.lockPidAlive);

  // Stale lockfile cleanup: if no in-memory generation state and lock PID is dead,
  // remove the lockfile so status stays truthful after HMR and crashes.
  if (!generationActive && lock.lockfilePresent) {
    removeLockfile();
    return {
      success: true,
      isGenerating,
      hasProcess,
      lockfilePresent: false,
      lockPid: lock.lockPid,
      lockPidAlive: false,
      generationActive: false,
    };
  }

  return {
    success: true,
    isGenerating,
    hasProcess,
    lockfilePresent: lock.lockfilePresent,
    lockPid: lock.lockPid,
    lockPidAlive: lock.lockPidAlive,
    generationActive,
  };
}

// ---------------------------------------------------------------------------
// Log stream helpers
// ---------------------------------------------------------------------------

function openLogStream(logPath: string): fs.WriteStream {
  return fs.createWriteStream(logPath, { flags: 'a' });
}

function closeLogStream() {
  if (currentLogStream) {
    currentLogStream.end();
    currentLogStream = null;
  }
}

function clearGenerationTimer() {
  if (generationTimer) {
    clearTimeout(generationTimer);
    generationTimer = null;
  }
}

function startGenerationTimer() {
  clearGenerationTimer();
  generationTimer = setTimeout(() => {
    if (currentProcess && !currentProcess.killed) {
      timedOut = true;
      currentLogStream?.write(`\n=== Generation timed out after ${GENERATION_TIMEOUT_MS / 60000} minutes at ${new Date().toISOString()} ===\n`);
      currentProcess.kill('SIGTERM');
      setTimeout(() => {
        if (currentProcess && !currentProcess.killed) {
          currentProcess.kill('SIGKILL');
        }
      }, 2000);
    }
  }, GENERATION_TIMEOUT_MS);
}

/** Max assistant preview string length (tail kept) — caps SSE payload size. */
const AGENT_PREVIEW_MAX_CHARS = 14_000;
/** Ignore absurdly long JSONL lines (e.g. system init) when scanning for text deltas. */
const JSONL_PARSE_MAX_LINE_CHARS = 512_000;

type StreamJsonProvider = 'claude-code' | 'codex';

function shouldStreamJsonForPreview(
  providerId: ProviderId,
  body: {
    claudeDetailedStdout?: boolean;
    codexDetailedStdout?: boolean;
  },
): StreamJsonProvider | null {
  if (providerId === 'claude-code' && body.claudeDetailedStdout !== false) {
    return 'claude-code';
  }
  if (providerId === 'codex' && body.codexDetailedStdout !== false) {
    return 'codex';
  }
  return null;
}

const readJsonString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const findSessionId = (value: unknown, depth = 0): string | null => {
  if (depth > 4 || value == null) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findSessionId(item, depth + 1);
      if (nested) return nested;
    }
    return null;
  }
  if (typeof value !== 'object') return null;

  const obj = value as Record<string, unknown>;
  const direct =
    readJsonString(obj.session_id) ??
    readJsonString(obj.sessionId) ??
    readJsonString(obj.conversation_id) ??
    readJsonString(obj.conversationId) ??
    readJsonString(obj.thread_id) ??
    readJsonString(obj.threadId) ??
    readJsonString(obj.chat_id) ??
    readJsonString(obj.chatId);
  if (direct) return direct;

  const messageObj = obj.message;
  if (messageObj && typeof messageObj === 'object' && !Array.isArray(messageObj)) {
    const messageId = readJsonString((messageObj as Record<string, unknown>).id);
    if (messageId) return messageId;
  }

  for (const nestedValue of Object.values(obj)) {
    const nested = findSessionId(nestedValue, depth + 1);
    if (nested) return nested;
  }
  return null;
};

function trimAssistantPreview(assistantPreview: { value: string }): void {
  if (assistantPreview.value.length > AGENT_PREVIEW_MAX_CHARS) {
    assistantPreview.value = assistantPreview.value.slice(-AGENT_PREVIEW_MAX_CHARS);
  }
}

/**
 * Append assistant text from Codex `codex exec --json` JSONL lines.
 * Events: thread.started, item.completed (agent_message / reasoning).
 */
function appendAssistantTextFromCodexJsonlLines(
  lines: string[],
  assistantPreview: { value: string },
): { textChanged: boolean; sessionId: string | null } {
  let changed = false;
  let discoveredSessionId: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || !trimmed.startsWith('{')) continue;
    if (trimmed.length > JSONL_PARSE_MAX_LINE_CHARS) continue;
    try {
      const obj = JSON.parse(trimmed) as {
        type?: string;
        thread_id?: string;
        item?: { type?: string; text?: string };
        message?: string;
        error?: string | { message?: string };
      };

      if (obj.type === 'item.completed' && obj.item) {
        const itemType = obj.item.type;
        if (
          (itemType === 'agent_message' || itemType === 'reasoning') &&
          typeof obj.item.text === 'string' &&
          obj.item.text.length > 0
        ) {
          // Codex emits complete items (not deltas) — separate them for readability.
          if (assistantPreview.value.length > 0) {
            assistantPreview.value += '\n\n';
          }
          assistantPreview.value += obj.item.text;
          changed = true;
        }
      }

      if (!discoveredSessionId) {
        if (obj.type === 'thread.started' && obj.thread_id) {
          discoveredSessionId = obj.thread_id;
        } else {
          discoveredSessionId = findSessionId(obj);
        }
      }
    } catch {
      /* ignore non-JSON or unexpected shape */
    }
  }

  trimAssistantPreview(assistantPreview);
  return { textChanged: changed, sessionId: discoveredSessionId };
}

/**
 * Append assistant `text_delta` chunks from complete JSONL lines (Claude Code stream-json).
 * Also scans event payloads for session/chat identifiers that can be surfaced to callers.
 */
function appendAssistantTextFromClaudeJsonlLines(
  lines: string[],
  assistantPreview: { value: string },
): { textChanged: boolean; sessionId: string | null } {
  let changed = false;
  let discoveredSessionId: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || !trimmed.startsWith('{')) continue;
    if (trimmed.length > JSONL_PARSE_MAX_LINE_CHARS) continue;
    try {
      const obj = JSON.parse(trimmed) as {
        type?: string;
        event?: {
          type?: string;
          delta?: { type?: string; text?: string };
        };
      };
      if (
        obj.type === 'stream_event' &&
        obj.event?.type === 'content_block_delta' &&
        obj.event.delta?.type === 'text_delta' &&
        typeof obj.event.delta.text === 'string'
      ) {
        assistantPreview.value += obj.event.delta.text;
        changed = true;
      }
      if (!discoveredSessionId) {
        discoveredSessionId = findSessionId(obj);
      }
    } catch {
      /* ignore non-JSON or unexpected shape */
    }
  }
  trimAssistantPreview(assistantPreview);
  return { textChanged: changed, sessionId: discoveredSessionId };
}

function appendAssistantTextFromJsonlLines(
  lines: string[],
  assistantPreview: { value: string },
  provider: StreamJsonProvider,
): { textChanged: boolean; sessionId: string | null } {
  if (provider === 'codex') {
    return appendAssistantTextFromCodexJsonlLines(lines, assistantPreview);
  }
  return appendAssistantTextFromClaudeJsonlLines(lines, assistantPreview);
}

/** Pull a user-facing error from JSONL stdout when stderr is empty. */
function extractStreamJsonError(
  lines: string[],
  provider: StreamJsonProvider,
): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i]?.trim();
    if (!trimmed?.startsWith('{')) continue;
    try {
      const obj = JSON.parse(trimmed) as {
        type?: string;
        is_error?: boolean;
        result?: string;
        error?: string | { message?: string };
        message?: string | { content?: Array<{ type?: string; text?: string }> };
      };

      if (provider === 'codex' && obj.type === 'error') {
        if (typeof obj.message === 'string' && obj.message.trim()) {
          return obj.message.trim();
        }
        if (typeof obj.error === 'string' && obj.error.trim()) {
          return obj.error.trim();
        }
        if (obj.error && typeof obj.error === 'object' && typeof obj.error.message === 'string') {
          return obj.error.message.trim() || null;
        }
      }

      if (obj.type === 'result' && obj.is_error && typeof obj.result === 'string') {
        return obj.result.trim() || null;
      }
      if (obj.type === 'assistant' && obj.error && obj.message && typeof obj.message === 'object' && Array.isArray(obj.message.content)) {
        const text = obj.message.content
          .filter((c) => c.type === 'text' && typeof c.text === 'string')
          .map((c) => c.text)
          .join('')
          .trim();
        if (text) return text;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Codex stderr always contains "Reading prompt from stdin..." plus raw
 * timestamped log lines — strip the noise so real errors surface cleanly.
 */
function cleanCodexStderr(stderr: string): string {
  return stderr
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (trimmed.startsWith('Reading prompt from stdin')) return false;
      return true;
    })
    .join('\n')
    .trim();
}

/** Build a user-facing error, appending Codex auth guidance when login failures are detected. */
function formatAgentErrorMessage(
  providerId: ProviderId,
  stderr: string,
  streamError: string | null,
  previewError: string,
  exitCode: number | null,
  providerName: string,
): string {
  const fallback = `${providerName} agent exited with code ${exitCode}`;

  let base: string;
  if (providerId === 'codex') {
    // Prefer the structured JSONL error — Codex stderr is noisy log output.
    base = streamError || cleanCodexStderr(stderr) || previewError || fallback;
    const authPattern = /not\s+logged\s+in|login|unauthorized|authentication|auth\s+required|invalid\s+api\s+key/i;
    if (authPattern.test(base) || authPattern.test(stderr)) {
      return `${base}\n\nRun \`codex login\` to authenticate the Codex CLI.`;
    }
    return base;
  }

  if (providerId === 'cursor') {
    base = stderr.trim() || streamError || previewError || fallback;
    if (CURSOR_AUTH_ERROR_PATTERN.test(base) || CURSOR_AUTH_ERROR_PATTERN.test(stderr)) {
      return CURSOR_AUTH_USER_MESSAGE;
    }
    return base;
  }

  return stderr.trim() || streamError || previewError || fallback;
}

/**
 * Line/file totals of iteration files this generation wrote (numbers only —
 * the paths never leave this function). New files are untracked, so they are
 * invisible to `git diff --numstat`; this covers that gap.
 */
function readNewFileLineTotals(paths: Set<string>): { lines: number; files: number } {
  let lines = 0;
  let files = 0;
  for (const filePath of paths) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      files += 1;
      lines += content.split('\n').length;
    } catch {
      // moved/deleted mid-read — skip
    }
  }
  return { lines, files };
}

/** Sum a numstat delta with new-file additions (null only if neither exists). */
function combineLineStat(deltaValue: number | null, extra: number): number | null {
  if (deltaValue === null && extra === 0) return null;
  return (deltaValue ?? 0) + extra;
}

const GENERATION_SOURCE_VALUES: GenerationSource[] = [
  'dialog', 'drag', 'chat', 'chat_edit', 'chat_freeform', 'new_page', 'adopt',
];

// ---------------------------------------------------------------------------
// API handlers
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // Check if already generating
  if (isGenerating) {
    return NextResponse.json(
      { success: false, error: 'A generation is already in progress. Cancel it first or wait for completion.' },
      { status: 409 }
    );
  }

  try {
    const body = (await req.json().catch(() => null)) as {
      prompt?: string;
      componentId?: string;
      iterationCount?: number;
      model?: string;
      provider?: ProviderId;
      effort?: string;
      maxBudgetUsd?: number;
      maxTurns?: number;
      /** Claude Code: when not `false`, use stream-json JSONL stdout (default true). */
      claudeDetailedStdout?: boolean;
      /** Codex: sandbox policy for `codex exec -s`. */
      codexSandbox?: 'workspace-write' | 'danger-full-access';
      /** Codex: reasoning effort via config override. */
      codexReasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
      /** Codex: when not `false`, use `--json` JSONL stdout (default true). */
      codexDetailedStdout?: boolean;
      htmlFolder?: string;
      jsxFile?: string;
      /** Telemetry-only: how this generation was initiated (see TELEMETRY.md). */
      source?: string;
      /** Telemetry-only: skill ids in use (reported as builtin id or 'custom'). */
      skillIds?: string[];
    } | null;

    if (!body || !body.prompt || !body.componentId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields. Ensure `prompt` and `componentId` are provided.' },
        { status: 400 }
      );
    }

    let { prompt } = body;

    // Prompts (and client-built file paths embedded in them) hardcode the
    // conventional `src/app/playground/...` save location. When this host uses
    // a different layout (e.g. `app/playground`), rewrite those paths to the
    // real playground directory so generated files land there instead of
    // spawning a sparse, duplicate `src/app/playground` tree. No-op on the
    // common `src/app/` layout. This is the single chokepoint that corrects
    // every prompt path regardless of which builder produced it.
    const playgroundRelativeDir = resolvePlaygroundDirRelative();
    if (prompt && playgroundRelativeDir !== 'src/app/playground') {
      prompt = prompt.split('src/app/playground/').join(`${playgroundRelativeDir}/`);
    }

    const providerId: ProviderId = body.provider ?? 'cursor';
    const model = resolveAgentModel(providerId, body.model);

    // If the user has enabled "Use tokens in generation" in the Design System
    // modal, prepend the parsed DESIGN.md as a system-prompt addon. The toggle
    // state is mirrored into a `pg-design-inject` cookie by the modal.
    const cookieHeader = req.headers.get('cookie') ?? '';
    const designInjectEnabled = /(?:^|;\s*)pg-design-inject=1(?:;|$)/.test(cookieHeader);
    if (designInjectEnabled) {
      const md = readDesignMd();
      if (md) {
        prompt = buildSystemPromptAddon(md) + '\n' + prompt;
      }
    }
    if (providerId === 'codex') {
      prompt = `${prompt}\n\n${NO_BROWSER_INSTRUCTIONS}`;
    }
    const streamJsonProvider = shouldStreamJsonForPreview(providerId, body);
    const streamJsonForPreview = streamJsonProvider !== null;
    /** Same string the client sends (e.g. `html:checkout`) — must match presence bubbles / SSE consumers. */
    const clientComponentId = String(body.componentId).slice(0, 400);
    // Sanitize for file paths / lockfile only (colon and other chars → `_`)
    const componentId = clientComponentId.replace(/[^A-Za-z0-9-_]/g, '_').slice(0, 200) || 'component';
    const timestamp = Date.now();
    const generationId = `${componentId}-${timestamp}`;

    // -- Telemetry (anonymous, content-free; never recorded for tunnel/guest
    //    requests). Snapshot working-tree numstat totals so the completion
    //    event can attribute the churn of THIS generation's writes.
    const telemetryActive = isLocalRequest(req) && isTelemetryEnabled();
    wasCancelled = false;
    timedOut = false;
    genFirstIterationAt = null;
    currentIterationFiles.clear();
    const diffBefore = telemetryActive ? await getGitDiffTotals() : null;
    const genSource: GenerationSource = GENERATION_SOURCE_VALUES.includes(
      body.source as GenerationSource,
    )
      ? (body.source as GenerationSource)
      : 'unknown';
    const genBaseProps = {
      provider: providerId,
      model: safeModel(model),
      iteration_count: typeof body.iterationCount === 'number' ? body.iterationCount : 0,
      source: genSource,
      skills: safeSkills(body.skillIds),
      render_mode: body.htmlFolder ? 'html' : body.jsxFile ? 'jsx' : 'react',
      effort:
        (providerId === 'codex' ? body.codexReasoningEffort : body.effort) || 'default',
    };

    // Create chat log file
    ensureTempDir();
    currentChatLogPath = path.join(TEMP_DIR, `chat-${componentId}-${timestamp}.txt`);

    // Initialize log file with header
    const providerName = getProviderDisplayName(providerId);
    const header = [
      `=== Generation started at ${new Date().toISOString()} ===`,
      `Provider: ${providerName}`,
      `Component: ${clientComponentId}`,
      ...(model ? [`Model: ${model}`] : []),
      ``,
      `=== Prompt ===`,
      prompt,
      ``,
      `=== Agent Output ===`,
      ...(streamJsonForPreview
        ? [
            '(Raw stream-json is not written to this file. Live assistant text appears in the presence-bubble tooltip.)',
            '',
          ]
        : ['']),
    ].join('\n');
    
    fs.writeFileSync(currentChatLogPath, header);
    currentLogStream = openLogStream(currentChatLogPath);

    isGenerating = true;

    // Spawn agent process via provider abstraction
    return new Promise<NextResponse>((resolve) => {
      try {
        currentProcess = spawnAgent(providerId, {
          model,
          effort: body.effort as 'low' | 'medium' | 'high' | 'max' | undefined,
          maxBudgetUsd: body.maxBudgetUsd,
          maxTurns: body.maxTurns,
          ...(providerId === 'claude-code'
            ? { claudeDetailedStdout: body.claudeDetailedStdout !== false }
            : {}),
          ...(providerId === 'codex'
            ? {
                codexSandbox: body.codexSandbox,
                codexReasoningEffort: body.codexReasoningEffort,
                codexDetailedStdout: body.codexDetailedStdout !== false,
              }
            : {}),
        }, process.cwd());

        // Write lockfile so we can recover from HMR
        if (currentProcess.pid) {
          writeLockfile(currentProcess.pid, componentId);
        }

        // Start watching iterations directory for progressive detection
        startFileWatcher(body.htmlFolder, body.jsxFile);

        // Start generation timeout watchdog
        startGenerationTimer();

        const onTelemetryIteration = () => {
          if (genFirstIterationAt === null) genFirstIterationAt = Date.now();
        };
        if (telemetryActive) {
          generationEvents.on('iteration-added', onTelemetryIteration);
          capture('generation_started', genBaseProps);
        }

        let stderr = '';
        const stdoutLinesForErrors: string[] = [];

        const assistantPreview = { value: '' };
        let agentSessionId: string | null = null;
        let stdoutLineBuf = '';
        let previewThrottleTimer: ReturnType<typeof setTimeout> | null = null;

        const flushAgentPreview = () => {
          generationEvents.emit('agent-preview', {
            componentId: clientComponentId,
            text: assistantPreview.value,
          });
        };

        const scheduleAgentPreview = () => {
          if (previewThrottleTimer) return;
          previewThrottleTimer = setTimeout(() => {
            previewThrottleTimer = null;
            flushAgentPreview();
          }, 80);
        };

        // Stream stdout: plain text goes to chat log; stream-json is parsed for UI only (not logged).
        currentProcess.stdout?.on('data', (data: Buffer) => {
          const chunk = data.toString('utf8');
          if (!streamJsonForPreview) {
            currentLogStream?.write(data);
            return;
          }
          stdoutLineBuf += chunk;
          const parts = stdoutLineBuf.split('\n');
          stdoutLineBuf = parts.pop() ?? '';
          for (const part of parts) {
            if (part.trim()) stdoutLinesForErrors.push(part);
          }
          const parsed = appendAssistantTextFromJsonlLines(
            parts,
            assistantPreview,
            streamJsonProvider!,
          );
          if (!agentSessionId && parsed.sessionId) {
            agentSessionId = parsed.sessionId;
            const sessionLabel =
              streamJsonProvider === 'codex' ? 'Codex Thread ID' : 'Claude Session ID';
            currentLogStream?.write(`\n${sessionLabel}: ${agentSessionId}\n`);
          }
          if (parsed.textChanged) {
            scheduleAgentPreview();
          }
        });

        // Stream stderr to log file (non-blocking)
        currentProcess.stderr?.on('data', (data: Buffer) => {
          const text = data.toString();
          stderr += text;
          currentLogStream?.write(`[STDERR] ${text}`);
        });

        // Send prompt to stdin and close
        currentProcess.stdin?.write(prompt);
        currentProcess.stdin?.end();

        // Handle process exit
        currentProcess.on('close', (code) => {
          clearGenerationTimer();
          if (streamJsonForPreview && stdoutLineBuf.trim().length > 0) {
            stdoutLinesForErrors.push(stdoutLineBuf);
            const parsed = appendAssistantTextFromJsonlLines(
              [stdoutLineBuf],
              assistantPreview,
              streamJsonProvider!,
            );
            if (!agentSessionId && parsed.sessionId) {
              agentSessionId = parsed.sessionId;
              const sessionLabel =
                streamJsonProvider === 'codex' ? 'Codex Thread ID' : 'Claude Session ID';
              currentLogStream?.write(`\n${sessionLabel}: ${agentSessionId}\n`);
            }
            stdoutLineBuf = '';
          }
          if (previewThrottleTimer) {
            clearTimeout(previewThrottleTimer);
            previewThrottleTimer = null;
          }
          if (streamJsonForPreview) {
            flushAgentPreview();
          }

          currentLogStream?.write(`\n=== Generation ended with code ${code} at ${new Date().toISOString()} ===\n`);
          closeLogStream();
          removeLockfile();
          stopFileWatcher();
          generationEvents.emit('done');
          generationEvents.removeListener('iteration-added', onTelemetryIteration);

          isGenerating = false;
          currentProcess = null;

          if (code === 0) {
            if (telemetryActive) {
              const firstIterationAt = genFirstIterationAt;
              const newFiles = new Set(currentIterationFiles);
              void (async () => {
                const delta = diffTotalsDelta(diffBefore, await getGitDiffTotals());
                const fileTotals = readNewFileLineTotals(newFiles);
                const diffProps = {
                  lines_added: combineLineStat(delta.lines_added, fileTotals.lines),
                  lines_removed: delta.lines_removed,
                  files_changed: combineLineStat(delta.files_changed, fileTotals.files),
                };
                capture('generation_completed', {
                  ...genBaseProps,
                  duration_ms: Date.now() - timestamp,
                  time_to_first_iteration_ms: firstIterationAt
                    ? firstIterationAt - timestamp
                    : null,
                  iterations_detected: newFiles.size,
                  ...diffProps,
                });
                if (genSource === 'adopt') {
                  capture('code_adopted', { kind: 'iteration', ...diffProps });
                }
              })();
            }
            resolve(NextResponse.json({
              success: true,
              generationId,
              claudeSessionId: agentSessionId,
              message: 'Generation completed successfully',
            }));
          } else {
            const streamError = streamJsonForPreview
              ? extractStreamJsonError(stdoutLinesForErrors, streamJsonProvider!)
              : null;
            const previewError = assistantPreview.value.trim();
            const errorMessage = formatAgentErrorMessage(
              providerId,
              stderr,
              streamError,
              previewError,
              code,
              providerName,
            );
            if (telemetryActive) {
              const authPattern =
                /not\s+logged\s+in|unauthorized|authentication|auth\s+required|invalid\s+api\s+key|login/i;
              capture('generation_failed', {
                ...genBaseProps,
                duration_ms: Date.now() - timestamp,
                error_category: wasCancelled
                  ? 'cancelled'
                  : timedOut
                    ? 'timeout'
                    : authPattern.test(stderr) || authPattern.test(streamError ?? '')
                      ? 'auth_error'
                      : 'exit_nonzero',
              });
            }
            resolve(NextResponse.json(
              {
                success: false,
                error: errorMessage,
                generationId,
                claudeSessionId: agentSessionId,
              },
              { status: 500 }
            ));
          }
        });

        // Handle process errors
        currentProcess.on('error', (error) => {
          clearGenerationTimer();
          if (streamJsonForPreview && stdoutLineBuf.trim().length > 0) {
            const parsed = appendAssistantTextFromJsonlLines(
              [stdoutLineBuf],
              assistantPreview,
              streamJsonProvider!,
            );
            if (!agentSessionId && parsed.sessionId) {
              agentSessionId = parsed.sessionId;
              const sessionLabel =
                streamJsonProvider === 'codex' ? 'Codex Thread ID' : 'Claude Session ID';
              currentLogStream?.write(`\n${sessionLabel}: ${agentSessionId}\n`);
            }
            stdoutLineBuf = '';
          }
          if (previewThrottleTimer) {
            clearTimeout(previewThrottleTimer);
            previewThrottleTimer = null;
          }
          if (streamJsonForPreview) {
            flushAgentPreview();
          }

          const errorMessage = error.message.includes('ENOENT')
            ? getProviderNotFoundMessage(providerId)
            : error.message;

          currentLogStream?.write(`\n=== Error: ${errorMessage} ===\n`);
          closeLogStream();
          removeLockfile();
          stopFileWatcher();
          generationEvents.emit('done');
          generationEvents.removeListener('iteration-added', onTelemetryIteration);

          if (telemetryActive) {
            capture('generation_failed', {
              ...genBaseProps,
              duration_ms: Date.now() - timestamp,
              error_category: error.message.includes('ENOENT')
                ? 'cli_not_found'
                : 'spawn_error',
            });
          }

          isGenerating = false;
          currentProcess = null;

          resolve(NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
          ));
        });

      } catch (spawnError) {
        clearGenerationTimer();
        closeLogStream();
        removeLockfile();
        isGenerating = false;
        currentProcess = null;

        if (telemetryActive) {
          capture('generation_failed', {
            ...genBaseProps,
            duration_ms: Date.now() - timestamp,
            error_category: 'spawn_error',
          });
        }

        const message = spawnError instanceof Error ? spawnError.message : `Failed to spawn ${providerName} agent`;
        resolve(NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        ));
      }
    });

  } catch (error) {
    clearGenerationTimer();
    closeLogStream();
    removeLockfile();
    isGenerating = false;
    const message = error instanceof Error ? error.message : 'Unknown error in generate route';
    console.error('[Playground][generate] POST error:', error);
    if (isLocalRequest(req)) {
      capture('error_occurred', { area: 'generate_route', category: 'route_exception' });
    }
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  if (!isGenerating || !currentProcess) {
    return NextResponse.json(
      { success: false, error: 'No generation currently running' },
      { status: 400 }
    );
  }

  try {
    // Mark for telemetry so the close handler reports 'cancelled', not failure.
    wasCancelled = true;
    // Send SIGTERM to gracefully terminate
    currentProcess.kill('SIGTERM');
    
    // Give it a moment, then force kill if still running
    setTimeout(() => {
      if (currentProcess && !currentProcess.killed) {
        currentProcess.kill('SIGKILL');
      }
    }, 2000);

    currentLogStream?.write(`\n=== Cancelled by user at ${new Date().toISOString()} ===\n`);

    return NextResponse.json({
      success: true,
      message: 'Generation cancelled',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel generation';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  if (action === 'download-chat') {
    // Find the most recent chat log
    if (!fs.existsSync(TEMP_DIR)) {
      return NextResponse.json(
        { success: false, error: 'No chat logs available' },
        { status: 404 }
      );
    }

    const files = fs.readdirSync(TEMP_DIR)
      .filter(f => f.startsWith('chat-') && f.endsWith('.txt'))
      .sort()
      .reverse();

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No chat logs available' },
        { status: 404 }
      );
    }

    const latestLog = path.join(TEMP_DIR, files[0]);
    const content = fs.readFileSync(latestLog, 'utf-8');

    // Return as downloadable text file
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="${files[0]}"`,
      },
    });
  }

  if (action === 'events') {
    // SSE stream for progressive iteration detection.
    // The client connects when generation starts and receives events
    // each time tree.json changes (i.e. a new iteration was registered).
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // If no generation is active (including lockfile/PID recovery signal),
        // send done immediately and close.
        const status = getGenerationStatus();
        if (!status.generationActive) {
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
          return;
        }

        const onIteration = () => {
          try {
            controller.enqueue(encoder.encode('data: {"type":"iteration-added"}\n\n'));
          } catch { /* stream may already be closed */ }
        };

        const onDone = () => {
          try {
            controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
            controller.close();
          } catch { /* stream may already be closed */ }
          cleanup();
        };

        const onAgentPreview = (payload: { componentId: string; text: string }) => {
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'agent-preview',
                  componentId: payload.componentId,
                  text: payload.text,
                })}\n\n`,
              ),
            );
          } catch { /* stream may already be closed */ }
        };

        const cleanup = () => {
          generationEvents.removeListener('iteration-added', onIteration);
          generationEvents.removeListener('done', onDone);
          generationEvents.removeListener('agent-preview', onAgentPreview);
        };

        generationEvents.on('iteration-added', onIteration);
        generationEvents.on('done', onDone);
        generationEvents.on('agent-preview', onAgentPreview);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  if (action === 'status') {
    return NextResponse.json(getGenerationStatus());
  }

  return NextResponse.json(
    { success: false, error: 'Unsupported action. Use ?action=download-chat, ?action=events, or ?action=status' },
    { status: 400 }
  );
}
