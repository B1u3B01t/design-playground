import { NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Listener } from '@ngrok/ngrok';

// ── Persisted state file (HMR + cross-restart URL recovery) ─────────────────
const STATE_FILE = path.join(os.tmpdir(), 'aiverse-tunnel.json');

interface PersistedState {
  pid: number;
  url: string;
  port: number;
  source: 'shared' | 'self';
}

function readState(): PersistedState | null {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as PersistedState;
  } catch { return null; }
}

function writeState(s: PersistedState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s), 'utf8');
}

function clearStateFile() {
  try { fs.unlinkSync(STATE_FILE); } catch { /* already gone */ }
}

// ── Module singleton — pinned to globalThis so HMR doesn't drop the Listener ─
interface CachedTunnel {
  url: string;
  port: number;
  source: 'shared' | 'self';
  /** null when source === 'shared' (the agent owns the listener). */
  listener: Listener | null;
}

const G = globalThis as unknown as { __aiverseTunnel?: CachedTunnel };

function getCached(): CachedTunnel | null { return G.__aiverseTunnel ?? null; }
function setCached(t: CachedTunnel | null) {
  if (t) G.__aiverseTunnel = t;
  else delete G.__aiverseTunnel;
}

// Drop any state file left by a previous Node process — the ngrok session
// from that process is dead, so its URL is meaningless to us now.
(function reconcileOnLoad() {
  const s = readState();
  if (s && s.pid !== process.pid) clearStateFile();
})();

// ── Host-agent rendezvous (the Playground Electron app writes this file) ───
// The @ngrok/ngrok Node SDK ignores `name` and `web_addr`, so the standard
// :4040 inspector isn't available. The host instead drops a JSON file with
// its tunnel URL + pid; we read it and verify the owner is alive.
const RENDEZVOUS_FILE = path.join(os.tmpdir(), 'playground-app-tunnel.json');

interface Rendezvous {
  agent: 'playground-app';
  pid: number;
  port: number;
  url: string;
}

function readRendezvous(): Rendezvous | null {
  try {
    const raw = fs.readFileSync(RENDEZVOUS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<Rendezvous>;
    if (
      parsed.agent !== 'playground-app' ||
      typeof parsed.pid !== 'number' ||
      typeof parsed.port !== 'number' ||
      typeof parsed.url !== 'string'
    ) {
      return null;
    }
    try {
      process.kill(parsed.pid, 0);
    } catch {
      return null;
    }
    return parsed as Rendezvous;
  } catch {
    return null;
  }
}

// ── Self-spawn via the SDK ─────────────────────────────────────────────────
async function startSelfTunnel(port: number): Promise<{ url: string; listener: Listener }> {
  const ngrok = await import('@ngrok/ngrok');
  const listener = await ngrok.forward({
    addr: port,
    authtoken: process.env.NGROK_AUTHTOKEN!,
  });
  const url = listener.url();
  if (!url) {
    await listener.close().catch(() => {});
    throw new Error('ngrok did not return a URL');
  }
  return { url, listener };
}

// ── GET — current cached tunnel (or null) ──────────────────────────────────
export async function GET() {
  const c = getCached();
  if (c) return NextResponse.json({ url: c.url, port: c.port, source: c.source });
  return NextResponse.json({ url: null, port: null, source: null });
}

// ── POST { port } — open or reuse a tunnel ─────────────────────────────────
export async function POST(req: Request) {
  const { port } = (await req.json()) as { port: number };

  // Cached hit on same port → reuse (covers both shared and self).
  const cached = getCached();
  if (cached && cached.port === port) {
    return NextResponse.json({ url: cached.url, port, source: cached.source });
  }

  // 1) Host Playground app's tunnel, advertised via rendezvous file
  const rendezvous = readRendezvous();
  if (rendezvous && rendezvous.port === port) {
    // If we had a self-tunnel, close it — the host's covers us now.
    if (cached?.source === 'self' && cached.listener) {
      await cached.listener.close().catch(() => {});
    }
    const next: CachedTunnel = {
      url: rendezvous.url,
      port,
      source: 'shared',
      listener: null,
    };
    setCached(next);
    writeState({ pid: process.pid, url: next.url, port, source: 'shared' });
    return NextResponse.json({ url: next.url, port, source: 'shared' });
  }

  // 2) Self-spawn if we have a token
  if (!process.env.NGROK_AUTHTOKEN) {
    return NextResponse.json({ error: 'no_token' }, { status: 400 });
  }

  // Different port? Close the stale self-listener first.
  if (cached?.source === 'self' && cached.listener) {
    await cached.listener.close().catch(() => {});
  }
  setCached(null);
  clearStateFile();

  try {
    const { url, listener } = await startSelfTunnel(port);
    const next: CachedTunnel = { url, port, source: 'self', listener };
    setCached(next);
    writeState({ pid: process.pid, url, port, source: 'self' });
    return NextResponse.json({ url, port, source: 'self' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to start ngrok tunnel';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── DELETE — tear down our own listener; shared agent is left alone ────────
export async function DELETE() {
  const cached = getCached();
  if (cached?.source === 'self' && cached.listener) {
    await cached.listener.close().catch(() => {});
  }
  setCached(null);
  clearStateFile();
  return NextResponse.json({ ok: true });
}

// ── Close our listener if the dev server exits cleanly ─────────────────────
function registerShutdownOnce() {
  const handler = () => {
    const c = getCached();
    if (c?.source === 'self' && c.listener) {
      c.listener.close().catch(() => {});
    }
    clearStateFile();
    process.exit(0);
  };
  process.once('SIGTERM', handler);
  process.once('SIGINT', handler);
}
registerShutdownOnce();
