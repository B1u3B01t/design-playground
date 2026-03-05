import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { ApiRequest, ApiResponse } from './types';

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
    process.kill(pid, 0);
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

// On module load: recover URL from files if the process is still alive
(function recoverOnModuleLoad() {
  const pid = readPidFile();
  if (pid && isProcessAlive(pid)) {
    tunnelUrl = readUrlFile();
    tunnelPort = readPortFile();
  } else {
    clearPidFiles();
  }
})();

// Graceful shutdown
function registerShutdownOnce() {
  const handler = () => {
    killOrphan();
    if (tunnelProcess && !tunnelProcess.killed) tunnelProcess.kill('SIGTERM');
    process.exit(0);
  };
  process.once('SIGTERM', handler);
  process.once('SIGINT', handler);
}
registerShutdownOnce();

// ── Handlers ────────────────────────────────────────────────────────────────

export async function handleTunnelGet(_req: ApiRequest, res: ApiResponse) {
  const pid = readPidFile();
  if (pid && !isProcessAlive(pid)) {
    clearPidFiles();
    tunnelProcess = null;
    tunnelUrl = null;
    tunnelPort = null;
  }
  res.json({ url: tunnelUrl, port: tunnelPort });
}

export async function handleTunnelPost(req: ApiRequest, res: ApiResponse) {
  const { port } = (await req.json()) as { port: number };

  const alivePid = readPidFile();
  if (tunnelUrl && tunnelPort === port && alivePid && isProcessAlive(alivePid)) {
    return res.json({ url: tunnelUrl, port });
  }

  killOrphan();
  if (tunnelProcess && !tunnelProcess.killed) {
    tunnelProcess.kill('SIGTERM');
  }
  tunnelProcess = null;
  tunnelUrl = null;
  tunnelPort = null;

  return new Promise<void>((resolve) => {
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
        if (proc.pid) writePidFiles(proc.pid, tunnelUrl, port);
        res.json({ url: tunnelUrl, port });
        resolve();
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
        res.json({ error: `Failed to start tunnel: ${err.message}` }, 500);
        resolve();
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        res.json({ error: 'Tunnel connection timed out (15 s)' }, 504);
        resolve();
      }
    }, 15_000);
  });
}

export async function handleTunnelDelete(_req: ApiRequest, res: ApiResponse) {
  killOrphan();
  if (tunnelProcess && !tunnelProcess.killed) {
    tunnelProcess.kill('SIGTERM');
  }
  tunnelProcess = null;
  tunnelUrl = null;
  tunnelPort = null;
  res.json({ ok: true });
}
