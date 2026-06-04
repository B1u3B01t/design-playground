import { NextResponse } from 'next/server';
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ── PID file — survives HMR module reloads ──────────────────────────────────
const PID_FILE = path.join(os.tmpdir(), 'aiverse-tunnel.pid');
const URL_FILE = path.join(os.tmpdir(), 'aiverse-tunnel.url');
const PORT_FILE = path.join(os.tmpdir(), 'aiverse-tunnel.port');

function readPidFile(): number | null {
  try {
    const raw = fs.readFileSync(PID_FILE, 'utf8').trim();
    const pid = parseInt(raw, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // signal 0 = existence check, no actual signal
    return true;
  } catch {
    return false;
  }
}

function readUrlFile(): string | null {
  try { return fs.readFileSync(URL_FILE, 'utf8').trim() || null; } catch { return null; }
}

function readPortFile(): number | null {
  try {
    const raw = fs.readFileSync(PORT_FILE, 'utf8').trim();
    const p = parseInt(raw, 10);
    return isNaN(p) ? null : p;
  } catch { return null; }
}

function writePidFiles(pid: number, url: string, port: number) {
  fs.writeFileSync(PID_FILE, String(pid), 'utf8');
  fs.writeFileSync(URL_FILE, url, 'utf8');
  fs.writeFileSync(PORT_FILE, String(port), 'utf8');
}

function clearPidFiles() {
  for (const f of [PID_FILE, URL_FILE, PORT_FILE]) {
    try { fs.unlinkSync(f); } catch { /* already gone */ }
  }
}

// ── Kill an orphaned SSH process by PID ────────────────────────────────────
function killOrphan() {
  const pid = readPidFile();
  if (pid && isProcessAlive(pid)) {
    try { process.kill(pid, 'SIGTERM'); } catch { /* already dead */ }
  }
  clearPidFiles();
}

// ── In-memory singleton (valid for current module lifetime) ─────────────────
let tunnelProcess: ChildProcess | null = null;
let tunnelUrl: string | null = null;
let tunnelPort: number | null = null;

// On module load: recover URL from files if the process is still alive,
// otherwise clean up any stale files left by a previous hot-reload.
(function recoverOnModuleLoad() {
  const pid = readPidFile();
  if (pid && isProcessAlive(pid)) {
    tunnelUrl = readUrlFile();
    tunnelPort = readPortFile();
    // We don't have the ChildProcess handle but we have the PID — enough to kill it.
    // Represent it as a thin wrapper so killOrphan() can use process.kill(pid).
  } else {
    clearPidFiles();
  }
})();

// ── Graceful shutdown on SIGTERM / SIGINT (dev server stop) ─────────────────
function registerShutdownOnce() {
  const handler = () => {
    killOrphan();
    if (tunnelProcess && !tunnelProcess.killed) tunnelProcess.kill('SIGTERM');
    process.exit(0);
  };
  // Use once so we don't stack listeners across HMR reloads
  process.once('SIGTERM', handler);
  process.once('SIGINT',  handler);
}
registerShutdownOnce();

// ── GET  → return current tunnel URL (or null) ─────────────────────────────
export async function GET() {
  // Re-check that the process is still alive (could have died silently)
  const pid = readPidFile();
  if (pid && !isProcessAlive(pid)) {
    clearPidFiles();
    tunnelProcess = null;
    tunnelUrl = null;
    tunnelPort = null;
  }
  return NextResponse.json({ url: tunnelUrl, port: tunnelPort });
}

// ── POST { port } → start tunnel if not already running ─────────────────────
export async function POST(req: Request) {
  const { port } = (await req.json()) as { port: number };

  // Already running for the same port → return immediately
  const alivePid = readPidFile();
  if (tunnelUrl && tunnelPort === port && alivePid && isProcessAlive(alivePid)) {
    return NextResponse.json({ url: tunnelUrl, port });
  }

  // Kill any stale process (different port or dead)
  killOrphan();
  if (tunnelProcess && !tunnelProcess.killed) {
    tunnelProcess.kill('SIGTERM');
  }
  tunnelProcess = null;
  tunnelUrl = null;
  tunnelPort = null;

  // Start a new localhost.run tunnel via SSH
  return new Promise<Response>((resolve) => {
    const proc = spawn('ssh', [
      '-tt',
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ServerAliveInterval=60',
      '-R', `80:localhost:${port}`,
      'nokey@localhost.run',
    ]);

    tunnelProcess = proc;
    tunnelPort = port;

    let resolved = false;

    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      const match = text.match(/(https:\/\/[a-zA-Z0-9-]+\.lhr\.life)/);
      if (match && !resolved) {
        resolved = true;
        tunnelUrl = match[1];
        // Persist PID + URL so they survive HMR
        if (proc.pid) writePidFiles(proc.pid, tunnelUrl, port);
        resolve(NextResponse.json({ url: tunnelUrl, port }));
      }
    };

    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);

    proc.on('close', () => {
      tunnelProcess = null;
      tunnelUrl = null;
      tunnelPort = null;
      clearPidFiles();
    });

    proc.on('error', (err) => {
      tunnelProcess = null;
      tunnelUrl = null;
      tunnelPort = null;
      clearPidFiles();
      if (!resolved) {
        resolved = true;
        resolve(NextResponse.json(
          { error: `Failed to start tunnel: ${err.message}` },
          { status: 500 },
        ));
      }
    });

    // Timeout after 15 s
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(NextResponse.json(
          { error: 'Tunnel connection timed out (15 s)' },
          { status: 504 },
        ));
      }
    }, 15_000);
  });
}

// ── DELETE → tear down the tunnel ───────────────────────────────────────────
export async function DELETE() {
  killOrphan();
  if (tunnelProcess && !tunnelProcess.killed) {
    tunnelProcess.kill('SIGTERM');
  }
  tunnelProcess = null;
  tunnelUrl = null;
  tunnelPort = null;
  return NextResponse.json({ ok: true });
}
