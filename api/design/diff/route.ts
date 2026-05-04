import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { designMdExists, DESIGN_MD_FILENAME } from '../../../lib/design-md-helpers';
import { runDesignMdCli } from '../../../lib/run-design-md-cli';

export const runtime = 'nodejs';

function gitShowHead(): Promise<{ ok: boolean; content: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn('git', ['show', `HEAD:${DESIGN_MD_FILENAME}`], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b: Buffer) => { stdout += b.toString('utf8'); });
    child.stderr.on('data', (b: Buffer) => { stderr += b.toString('utf8'); });
    child.on('error', (err) => resolve({ ok: false, content: '', error: err.message }));
    child.on('close', (code) => {
      if (code === 0) resolve({ ok: true, content: stdout });
      else resolve({ ok: false, content: '', error: stderr.trim() || `git exited with code ${code}` });
    });
  });
}

export async function POST() {
  if (!designMdExists()) {
    return NextResponse.json({ ok: false, error: 'DESIGN.md not found.' }, { status: 404 });
  }
  const head = await gitShowHead();
  if (!head.ok) {
    return NextResponse.json(
      { ok: false, error: `Could not read DESIGN.md from git HEAD: ${head.error}` },
      { status: 200 },
    );
  }
  // Write HEAD content to a temp file and run diff against the working copy.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-md-diff-'));
  const tmpFile = path.join(tmpDir, 'HEAD-DESIGN.md');
  try {
    fs.writeFileSync(tmpFile, head.content, 'utf8');
    const result = await runDesignMdCli(['diff', tmpFile, DESIGN_MD_FILENAME]);
    return NextResponse.json(result);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
