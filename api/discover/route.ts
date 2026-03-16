import { NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  TEMP_DIR_RELATIVE,
  DISCOVERY_LOCKFILE_FILENAME,
  DISCOVERY_MANIFEST_FILENAME,
} from '../../lib/constants';
import { resolvePlaygroundDir } from '../../lib/resolve-playground-dir';
import { discoveryPrompt } from '../../prompts/discovery.prompt';

/**
 * Discovery API — scans the project for visual components and pages
 * using the Cursor agent CLI.
 *
 * GET:  Returns cached discovery.json or {status: "not_scanned"}
 * POST: Spawns cursor agent to scan the project and write discovery.json
 */

const LOG_PREFIX = '[Playground][discover]';
const DEBUG = process.env.NODE_ENV !== 'production';
const log = (...args: unknown[]) => { if (DEBUG) console.log(LOG_PREFIX, ...args); };

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

const PLAYGROUND_DIR = resolvePlaygroundDir();
const DISCOVERY_JSON_PATH = path.join(PLAYGROUND_DIR, DISCOVERY_MANIFEST_FILENAME);
const TEMP_DIR = path.join(process.cwd(), TEMP_DIR_RELATIVE);
const LOCKFILE_PATH = path.join(TEMP_DIR, DISCOVERY_LOCKFILE_FILENAME);

log(` Playground dir resolved to: ${PLAYGROUND_DIR}`);
log(` Discovery JSON path: ${DISCOVERY_JSON_PATH}`);

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------

let currentProcess: ChildProcess | null = null;
let isScanning = false;

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
  startTime: number;
}

function writeLockfile(pid: number) {
  ensureTempDir();
  const data: LockfileData = { pid, startTime: Date.now() };
  fs.writeFileSync(LOCKFILE_PATH, JSON.stringify(data), 'utf-8');
  log(` Wrote lockfile for PID=${pid}`);
}

function removeLockfile() {
  try {
    if (fs.existsSync(LOCKFILE_PATH)) {
      fs.unlinkSync(LOCKFILE_PATH);
      log(` Removed lockfile`);
    }
  } catch { /* ignore */ }
}

function cleanupOrphanedProcess() {
  try {
    if (!fs.existsSync(LOCKFILE_PATH)) return;
    const data: LockfileData = JSON.parse(fs.readFileSync(LOCKFILE_PATH, 'utf-8'));
    try {
      process.kill(data.pid, 0);
      console.warn(`${LOG_PREFIX} Killing orphaned scan process PID=${data.pid} (started at ${new Date(data.startTime).toISOString()})`);
      process.kill(data.pid, 'SIGTERM');
      setTimeout(() => {
        try { process.kill(data.pid, 'SIGKILL'); } catch { /* already dead */ }
      }, 2000);
    } catch {
      log(` Orphaned process PID=${data.pid} already dead, cleaning up lockfile`);
    }
    removeLockfile();
  } catch {
    removeLockfile();
  }
}

// Only run at dev-server startup, not during build
if (typeof globalThis !== 'undefined' && process.env.NODE_ENV !== 'production') {
  cleanupOrphanedProcess();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readDiscoveryJson(): Record<string, unknown> | null {
  try {
    if (fs.existsSync(DISCOVERY_JSON_PATH)) {
      const raw = fs.readFileSync(DISCOVERY_JSON_PATH, 'utf-8');
      const data = JSON.parse(raw);
      const entryCount = Array.isArray(data?.entries) ? data.entries.length : 0;
      log(` Read discovery.json — ${entryCount} entries, scanned at ${data?.scannedAt || 'unknown'}`);
      return data;
    }
  } catch (e) {
    console.error(`${LOG_PREFIX} Error reading discovery.json:`, e);
  }
  return null;
}

function getPlaygroundRelativePath(): string {
  const root = process.cwd();
  return path.relative(root, PLAYGROUND_DIR).replace(/\\/g, '/');
}

// ---------------------------------------------------------------------------
// GET — return cached discovery or "not_scanned"
// ---------------------------------------------------------------------------

export async function GET() {
  log(` GET request — isScanning=${isScanning}, discoveryExists=${fs.existsSync(DISCOVERY_JSON_PATH)}`);

  if (isScanning) {
    log(` Returning status=scanning`);
    return NextResponse.json({ status: 'scanning' });
  }

  const data = readDiscoveryJson();
  if (data) {
    log(` Returning cached discovery`);
    return NextResponse.json({ status: 'complete', ...data });
  }

  log(` No discovery.json found — returning not_scanned`);
  return NextResponse.json({ status: 'not_scanned' });
}

// ---------------------------------------------------------------------------
// POST — run AI discovery scan
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  log(` POST request — starting discovery scan`);

  if (isScanning) {
    console.warn(`${LOG_PREFIX} Scan already in progress — rejecting`);
    return NextResponse.json(
      { success: false, error: 'A discovery scan is already in progress.' },
      { status: 409 },
    );
  }

  let model: string | undefined;
  try {
    const body = await req.json().catch(() => null);
    model = body?.model;
  } catch { /* no body */ }

  // Collect IDs of already-added entries to preserve them during re-scan
  const existing = readDiscoveryJson() as { entries?: { id: string; status: string }[] } | null;
  const preserveIds = (existing?.entries ?? [])
    .filter((e) => e.status === 'added')
    .map((e) => e.id);

  if (preserveIds.length > 0) {
    log(` Preserving ${preserveIds.length} already-added entries: ${preserveIds.join(', ')}`);
  }

  const playgroundRelPath = getPlaygroundRelativePath();
  const prompt = discoveryPrompt({
    playgroundDir: playgroundRelPath,
    existingEntryIds: preserveIds.length > 0 ? preserveIds : undefined,
  });

  log(` Generated discovery prompt (${prompt.length} chars)`);
  log(` Playground relative path: ${playgroundRelPath}`);

  isScanning = true;

  const args = ['agent', '--print', '--force'];
  if (model) {
    args.push('--model', model);
    log(` Using model: ${model}`);
  }

  const startTime = Date.now();
  log(` Spawning: cursor ${args.join(' ')}`);

  return new Promise<NextResponse>((resolve) => {
    try {
      currentProcess = spawn('cursor', args, {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      if (currentProcess.pid) {
        writeLockfile(currentProcess.pid);
        log(` Agent process started — PID=${currentProcess.pid}`);
      }

      let stdout = '';
      let stderr = '';

      currentProcess.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        const lines = chunk.trim().split('\n');
        for (const line of lines) {
          if (line.trim()) log(` [stdout] ${line}`);
        }
      });

      currentProcess.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        const lines = chunk.trim().split('\n');
        for (const line of lines) {
          if (line.trim()) log(` [stderr] ${line}`);
        }
      });

      currentProcess.stdin?.write(prompt);
      currentProcess.stdin?.end();
      log(` Prompt written to stdin and closed`);

      currentProcess.on('close', (code) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log(` Agent exited — code=${code}, elapsed=${elapsed}s, stdout=${stdout.length} chars, stderr=${stderr.length} chars`);

        removeLockfile();
        isScanning = false;
        currentProcess = null;

        if (code === 0) {
          const data = readDiscoveryJson();
          if (data) {
            const entries = (data as { entries?: unknown[] }).entries;
            log(` Scan complete — ${Array.isArray(entries) ? entries.length : 0} entries discovered`);
            resolve(NextResponse.json({ success: true, status: 'complete', ...data }));
          } else {
            console.error(`${LOG_PREFIX} Agent completed but discovery.json was not created`);
            resolve(NextResponse.json(
              { success: false, error: 'Agent completed but discovery.json was not created.' },
              { status: 500 },
            ));
          }
        } else {
          console.error(`${LOG_PREFIX} Agent failed — code=${code}, stderr: ${stderr.slice(0, 500)}`);
          resolve(NextResponse.json(
            { success: false, error: stderr || `Cursor agent exited with code ${code}` },
            { status: 500 },
          ));
        }
      });

      currentProcess.on('error', (error) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.error(`${LOG_PREFIX} Agent process error after ${elapsed}s:`, error.message);

        removeLockfile();
        isScanning = false;
        currentProcess = null;

        const message = error.message.includes('ENOENT')
          ? 'Cursor CLI not found. Install it and ensure `cursor` is in your PATH.'
          : error.message;

        resolve(NextResponse.json({ success: false, error: message }, { status: 500 }));
      });
    } catch (spawnError) {
      console.error(`${LOG_PREFIX} Failed to spawn agent:`, spawnError);
      removeLockfile();
      isScanning = false;
      currentProcess = null;
      const message = spawnError instanceof Error ? spawnError.message : 'Failed to spawn cursor agent';
      resolve(NextResponse.json({ success: false, error: message }, { status: 500 }));
    }
  });
}

// ---------------------------------------------------------------------------
// DELETE — cancel running scan
// ---------------------------------------------------------------------------

export async function DELETE() {
  log(` DELETE request — cancelling scan`);

  if (!isScanning || !currentProcess) {
    console.warn(`${LOG_PREFIX} No scan running to cancel`);
    return NextResponse.json(
      { success: false, error: 'No scan currently running' },
      { status: 400 },
    );
  }

  try {
    log(` Sending SIGTERM to PID=${currentProcess.pid}`);
    currentProcess.kill('SIGTERM');
    setTimeout(() => {
      if (currentProcess && !currentProcess.killed) {
        log(` Force killing PID=${currentProcess.pid}`);
        currentProcess.kill('SIGKILL');
      }
    }, 2000);

    return NextResponse.json({ success: true, message: 'Scan cancelled' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel scan';
    console.error(`${LOG_PREFIX} Error cancelling:`, message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
