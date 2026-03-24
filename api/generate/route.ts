import { NextResponse } from 'next/server';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { TEMP_DIR_RELATIVE, GENERATION_LOCKFILE_FILENAME } from '../../lib/constants';
import type { ProviderId } from '../../lib/providers';
import { spawnAgent, getProviderNotFoundMessage, getProviderDisplayName } from '../../lib/providers';

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

// Global state for managing the running generation
let currentProcess: ChildProcess | null = null;
let currentChatLogPath: string | null = null;
let currentLogStream: fs.WriteStream | null = null;
let isGenerating = false;

// ---------------------------------------------------------------------------
// File-watching event emitter for progressive iteration detection
// ---------------------------------------------------------------------------
// When the cursor agent writes tree.json (the last step per iteration),
// a debounced event is emitted so SSE clients can trigger a scan immediately.
const generationEvents = new EventEmitter();
let fileWatcher: fs.FSWatcher | null = null;

function startFileWatcher() {
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
}

function stopFileWatcher() {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
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
    } | null;

    if (!body || !body.prompt || !body.componentId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields. Ensure `prompt` and `componentId` are provided.' },
        { status: 400 }
      );
    }

    const { prompt, model } = body;
    const providerId: ProviderId = body.provider ?? 'cursor';
    // Sanitize componentId for use in file paths (prevent path traversal)
    const componentId = String(body.componentId).replace(/[^A-Za-z0-9-_]/g, '_').slice(0, 200) || 'component';
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

    // Spawn agent process via provider abstraction
    return new Promise<NextResponse>((resolve) => {
      try {
        currentProcess = spawnAgent(providerId, {
          model,
          effort: body.effort as 'low' | 'medium' | 'high' | 'max' | undefined,
          maxBudgetUsd: body.maxBudgetUsd,
          maxTurns: body.maxTurns,
        }, process.cwd());

        // Write lockfile so we can recover from HMR
        if (currentProcess.pid) {
          writeLockfile(currentProcess.pid, componentId);
        }

        // Start watching iterations directory for progressive detection
        startFileWatcher();

        let stderr = '';

        // Stream stdout to log file (non-blocking)
        currentProcess.stdout?.on('data', (data: Buffer) => {
          currentLogStream?.write(data);
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
              message: 'Generation completed successfully',
            }));
          } else {
            resolve(NextResponse.json(
              {
                success: false,
                error: stderr || `${providerName} agent exited with code ${code}`,
                generationId,
              },
              { status: 500 }
            ));
          }
        });

        // Handle process errors
        currentProcess.on('error', (error) => {
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
        // If no generation is active, send done immediately and close.
        if (!isGenerating) {
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

        const cleanup = () => {
          generationEvents.removeListener('iteration-added', onIteration);
          generationEvents.removeListener('done', onDone);
        };

        generationEvents.on('iteration-added', onIteration);
        generationEvents.on('done', onDone);
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
    return NextResponse.json({
      success: true,
      isGenerating,
      hasProcess: currentProcess !== null,
    });
  }

  return NextResponse.json(
    { success: false, error: 'Unsupported action. Use ?action=download-chat, ?action=events, or ?action=status' },
    { status: 400 }
  );
}
