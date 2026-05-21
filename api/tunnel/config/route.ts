import { NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';

type Source = 'agent' | 'env' | 'none';

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
      process.kill(parsed.pid, 0); // existence check
    } catch {
      return null; // owner is dead
    }
    return parsed as Rendezvous;
  } catch {
    return null;
  }
}

export async function GET() {
  if (readRendezvous()) {
    return NextResponse.json({ hasToken: true, source: 'agent' satisfies Source });
  }
  if (process.env.NGROK_AUTHTOKEN) {
    return NextResponse.json({ hasToken: true, source: 'env' satisfies Source });
  }
  return NextResponse.json({ hasToken: false, source: 'none' satisfies Source });
}
