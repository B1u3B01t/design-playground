import { NextResponse } from 'next/server';
import path from 'path';
import { execFile } from 'child_process';

type OpenInTarget = 'finder' | 'cursor' | 'antigravity' | 'codex' | 'github-desktop';

interface OpenInBody {
  target?: OpenInTarget;
}

const PROJECT_PATH = process.cwd();
const PROJECT_NAME = path.basename(PROJECT_PATH);

function unsupportedPlatformResponse() {
  return NextResponse.json(
    { success: false, error: 'Open In menu is only supported on macOS.' },
    { status: 400 },
  );
}

function runOpen(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    execFile('open', args, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function getOpenArgs(target: OpenInTarget): string[] {
  switch (target) {
    case 'finder':
      return ['-R', PROJECT_PATH];
    case 'cursor':
      return ['-a', 'Cursor', PROJECT_PATH];
    case 'antigravity':
      return ['-a', 'Antigravity', PROJECT_PATH];
    case 'codex':
      // `open -a Codex <path>` no longer selects the workspace; the documented
      // deep link is codex://threads/new?path=<encoded-absolute-path>.
      return ['-a', 'Codex', `codex://threads/new?path=${encodeURIComponent(PROJECT_PATH)}`];
    case 'github-desktop':
      return ['-a', 'GitHub Desktop', PROJECT_PATH];
    default:
      return [];
  }
}

export async function GET() {
  return NextResponse.json({
    projectName: PROJECT_NAME,
    projectPath: PROJECT_PATH,
    platform: process.platform,
  });
}

export async function POST(req: Request) {
  if (process.platform !== 'darwin') {
    return unsupportedPlatformResponse();
  }

  let body: OpenInBody | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const target = body?.target;
  if (
    target !== 'finder' &&
    target !== 'cursor' &&
    target !== 'antigravity' &&
    target !== 'codex' &&
    target !== 'github-desktop'
  ) {
    return NextResponse.json(
      { success: false, error: 'Invalid target. Expected finder, cursor, antigravity, codex, or github-desktop.' },
      { status: 400 },
    );
  }

  try {
    await runOpen(getOpenArgs(target));
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : `Failed to open ${target}`;
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
