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
import { spawnAgent, getProviderNotFoundMessage, getProviderDisplayName } from '../../lib/providers';
import { readDesignMd, buildSystemPromptAddon } from '../../lib/design-md-helpers';

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
const ITERATIONS_DIR = path.join(process.cwd(), 'src/app/playground/iterations');

// Maximum generation duration (10 minutes)
const GENERATION_TIMEOUT_MS = 10 * 60 * 1000;

// Global state for managing the running generation
let currentProcess: ChildProcess | null = null;
let currentChatLogPath: string | null = null;
let currentLogStream: fs.WriteStream | null = null;
let isGenerating = false;
let generationTimer: NodeJS.Timeout | null = null;

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
    const canvasDir = path.join(process.cwd(), 'src/app/playground/canvas-components');
    let jsxDebounceTimer: NodeJS.Timeout | null = null;
    try {
      jsxFileWatcher = fs.watch(canvasDir, (_eventType, filename) => {
        if (filename && CANVAS_ITERATION_FILENAME_PATTERN.test(filename)) {
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

/**
 * Append assistant `text_delta` chunks from complete JSONL lines (Claude Code stream-json).
 * Also scans event payloads for session/chat identifiers that can be surfaced to callers.
 */
function appendAssistantTextFromJsonlLines(
  lines: string[],
  assistantPreview: { value: string },
): { textChanged: boolean; sessionId: string | null } {
  let changed = false;
  let discoveredSessionId: string | null = null;

  const readString = (value: unknown): string | null => {
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
      readString(obj.session_id) ??
      readString(obj.sessionId) ??
      readString(obj.conversation_id) ??
      readString(obj.conversationId) ??
      readString(obj.thread_id) ??
      readString(obj.threadId) ??
      readString(obj.chat_id) ??
      readString(obj.chatId);
    if (direct) return direct;

    const messageObj = obj.message;
    if (messageObj && typeof messageObj === 'object' && !Array.isArray(messageObj)) {
      const messageId = readString((messageObj as Record<string, unknown>).id);
      if (messageId) return messageId;
    }

    for (const nestedValue of Object.values(obj)) {
      const nested = findSessionId(nestedValue, depth + 1);
      if (nested) return nested;
    }
    return null;
  };

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
  if (assistantPreview.value.length > AGENT_PREVIEW_MAX_CHARS) {
    assistantPreview.value = assistantPreview.value.slice(-AGENT_PREVIEW_MAX_CHARS);
  }
  return { textChanged: changed, sessionId: discoveredSessionId };
}

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
      htmlFolder?: string;
      jsxFile?: string;
    } | null;

    if (!body || !body.prompt || !body.componentId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields. Ensure `prompt` and `componentId` are provided.' },
        { status: 400 }
      );
    }

    let { prompt } = body;
    const { model } = body;

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
    const providerId: ProviderId = body.provider ?? 'cursor';
    const streamJsonForPreview =
      providerId === 'claude-code' && body.claudeDetailedStdout !== false;
    /** Same string the client sends (e.g. `html:checkout`) — must match presence bubbles / SSE consumers. */
    const clientComponentId = String(body.componentId).slice(0, 400);
    // Sanitize for file paths / lockfile only (colon and other chars → `_`)
    const componentId = clientComponentId.replace(/[^A-Za-z0-9-_]/g, '_').slice(0, 200) || 'component';
    const timestamp = Date.now();
    const generationId = `${componentId}-${timestamp}`;

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
        }, process.cwd());

        // Write lockfile so we can recover from HMR
        if (currentProcess.pid) {
          writeLockfile(currentProcess.pid, componentId);
        }

        // Start watching iterations directory for progressive detection
        startFileWatcher(body.htmlFolder, body.jsxFile);

        // Start generation timeout watchdog
        startGenerationTimer();

        let stderr = '';

        const assistantPreview = { value: '' };
        let claudeSessionId: string | null = null;
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
          const parsed = appendAssistantTextFromJsonlLines(parts, assistantPreview);
          if (!claudeSessionId && parsed.sessionId) {
            claudeSessionId = parsed.sessionId;
            currentLogStream?.write(`\nClaude Session ID: ${claudeSessionId}\n`);
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
            const parsed = appendAssistantTextFromJsonlLines([stdoutLineBuf], assistantPreview);
            if (!claudeSessionId && parsed.sessionId) {
              claudeSessionId = parsed.sessionId;
              currentLogStream?.write(`\nClaude Session ID: ${claudeSessionId}\n`);
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

          isGenerating = false;
          currentProcess = null;

          if (code === 0) {
            resolve(NextResponse.json({
              success: true,
              generationId,
              claudeSessionId,
              message: 'Generation completed successfully',
            }));
          } else {
            resolve(NextResponse.json(
              {
                success: false,
                error: stderr || `${providerName} agent exited with code ${code}`,
                generationId,
                claudeSessionId,
              },
              { status: 500 }
            ));
          }
        });

        // Handle process errors
        currentProcess.on('error', (error) => {
          clearGenerationTimer();
          if (streamJsonForPreview && stdoutLineBuf.trim().length > 0) {
            const parsed = appendAssistantTextFromJsonlLines([stdoutLineBuf], assistantPreview);
            if (!claudeSessionId && parsed.sessionId) {
              claudeSessionId = parsed.sessionId;
              currentLogStream?.write(`\nClaude Session ID: ${claudeSessionId}\n`);
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
