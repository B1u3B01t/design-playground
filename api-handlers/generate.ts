import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { TEMP_DIR_RELATIVE, GENERATION_LOCKFILE_FILENAME } from '../lib/constants';
import type { ApiRequest, ApiResponse } from './types';

const TEMP_DIR = path.join(process.cwd(), TEMP_DIR_RELATIVE);
const LOCKFILE_PATH = path.join(TEMP_DIR, GENERATION_LOCKFILE_FILENAME);

// Global state for managing the running generation
let currentProcess: ChildProcess | null = null;
let currentChatLogPath: string | null = null;
let currentLogStream: fs.WriteStream | null = null;
let isGenerating = false;

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

    try {
      process.kill(data.pid, 0);
      console.warn(`[Playground][generate] Killing orphaned generation process PID=${data.pid} (component: ${data.componentId})`);
      process.kill(data.pid, 'SIGTERM');
      setTimeout(() => {
        try { process.kill(data.pid, 'SIGKILL'); } catch { /* already dead */ }
      }, 2000);
    } catch {
      // Process is already dead
    }

    removeLockfile();
  } catch (e) {
    console.error('[Playground][generate] Error cleaning up orphaned process:', e);
    removeLockfile();
  }
}

// Run cleanup on module load (handles HMR restarts)
cleanupOrphanedProcess();

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

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleGeneratePost(req: ApiRequest, res: ApiResponse) {
  if (isGenerating) {
    return res.json(
      { success: false, error: 'A generation is already in progress. Cancel it first or wait for completion.' },
      409
    );
  }

  try {
    const body = await req.json().catch(() => null) as {
      prompt?: string;
      componentId?: string;
      iterationCount?: number;
      model?: string;
    } | null;

    if (!body || !body.prompt || !body.componentId) {
      return res.json(
        { success: false, error: 'Missing required fields. Ensure `prompt` and `componentId` are provided.' },
        400
      );
    }

    const { prompt, model } = body;
    const componentId = String(body.componentId).replace(/[^A-Za-z0-9-_]/g, '_').slice(0, 200) || 'component';
    const timestamp = Date.now();
    const generationId = `${componentId}-${timestamp}`;

    ensureTempDir();
    currentChatLogPath = path.join(TEMP_DIR, `chat-${componentId}-${timestamp}.txt`);

    const header = [
      `=== Generation started at ${new Date().toISOString()} ===`,
      `Component: ${componentId}`,
      ...(model ? [`Model: ${model}`] : []),
      ``,
      `=== Prompt ===`,
      prompt,
      ``,
      `=== Agent Output ===`,
      ``,
    ].join('\n');

    fs.writeFileSync(currentChatLogPath, header);
    currentLogStream = openLogStream(currentChatLogPath);

    isGenerating = true;

    const args = ['agent', '--print', '--force'];
    if (model) {
      args.push('--model', model);
    }

    return new Promise<void>((resolve) => {
      try {
        currentProcess = spawn('cursor', args, {
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
        });

        if (currentProcess.pid) {
          writeLockfile(currentProcess.pid, componentId);
        }

        let stderr = '';

        currentProcess.stdout?.on('data', (data: Buffer) => {
          currentLogStream?.write(data);
        });

        currentProcess.stderr?.on('data', (data: Buffer) => {
          const text = data.toString();
          stderr += text;
          currentLogStream?.write(`[STDERR] ${text}`);
        });

        currentProcess.stdin?.write(prompt);
        currentProcess.stdin?.end();

        currentProcess.on('close', (code) => {
          currentLogStream?.write(`\n=== Generation ended with code ${code} at ${new Date().toISOString()} ===\n`);
          closeLogStream();
          removeLockfile();

          isGenerating = false;
          currentProcess = null;

          if (code === 0) {
            res.json({ success: true, generationId, message: 'Generation completed successfully' });
          } else {
            res.json(
              { success: false, error: stderr || `Cursor agent exited with code ${code}`, generationId },
              500
            );
          }
          resolve();
        });

        currentProcess.on('error', (error) => {
          const errorMessage = error.message.includes('ENOENT')
            ? 'Cursor CLI not found. Make sure `cursor` is installed and in your PATH. Run `cursor agent login` if needed.'
            : error.message;

          currentLogStream?.write(`\n=== Error: ${errorMessage} ===\n`);
          closeLogStream();
          removeLockfile();

          isGenerating = false;
          currentProcess = null;

          res.json({ success: false, error: errorMessage }, 500);
          resolve();
        });

      } catch (spawnError) {
        closeLogStream();
        removeLockfile();
        isGenerating = false;
        currentProcess = null;

        const message = spawnError instanceof Error ? spawnError.message : 'Failed to spawn cursor agent';
        res.json({ success: false, error: message }, 500);
        resolve();
      }
    });

  } catch (error) {
    closeLogStream();
    removeLockfile();
    isGenerating = false;
    const message = error instanceof Error ? error.message : 'Unknown error in generate route';
    console.error('[Playground][generate] POST error:', error);
    res.json({ success: false, error: message }, 500);
  }
}

export async function handleGenerateDelete(_req: ApiRequest, res: ApiResponse) {
  if (!isGenerating || !currentProcess) {
    return res.json({ success: false, error: 'No generation currently running' }, 400);
  }

  try {
    currentProcess.kill('SIGTERM');

    setTimeout(() => {
      if (currentProcess && !currentProcess.killed) {
        currentProcess.kill('SIGKILL');
      }
    }, 2000);

    currentLogStream?.write(`\n=== Cancelled by user at ${new Date().toISOString()} ===\n`);

    res.json({ success: true, message: 'Generation cancelled' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel generation';
    res.json({ success: false, error: message }, 500);
  }
}

export async function handleGenerateGet(req: ApiRequest, res: ApiResponse) {
  const action = req.searchParams.get('action');

  if (action === 'download-chat') {
    if (!fs.existsSync(TEMP_DIR)) {
      return res.json({ success: false, error: 'No chat logs available' }, 404);
    }

    const files = fs.readdirSync(TEMP_DIR)
      .filter(f => f.startsWith('chat-') && f.endsWith('.txt'))
      .sort()
      .reverse();

    if (files.length === 0) {
      return res.json({ success: false, error: 'No chat logs available' }, 404);
    }

    const latestLog = path.join(TEMP_DIR, files[0]);
    const content = fs.readFileSync(latestLog, 'utf-8');

    return res.text(content, {
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="${files[0]}"`,
    });
  }

  if (action === 'status') {
    return res.json({
      success: true,
      isGenerating,
      hasProcess: currentProcess !== null,
    });
  }

  res.json(
    { success: false, error: 'Unsupported action. Use ?action=download-chat or ?action=status' },
    400
  );
}
