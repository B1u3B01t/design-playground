import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { DISCOVERY_MANIFEST_FILENAME } from '../../../lib/constants';
import { resolvePlaygroundDir } from '../../../lib/resolve-playground-dir';
import { discoveryAnalyzePrompt } from '../../../prompts/discovery-analyze.prompt';
import { fetchPropsSnapshot } from '../../../lib/props-fetchers.server';

/**
 * Discovery Analyze API — prepares a single discovered component
 * for the playground by running the Cursor agent CLI.
 *
 * POST: Analyze a component, create wrapper file, update discovery.json
 * DELETE: Remove a discovered component wrapper and reset its status
 */

const LOG_PREFIX = '[Playground][analyze]';
const DEBUG = process.env.NODE_ENV !== 'production';
const log = (...args: unknown[]) => { if (DEBUG) console.log(LOG_PREFIX, ...args); };

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

const PLAYGROUND_DIR = resolvePlaygroundDir();
const DISCOVERY_JSON_PATH = path.join(PLAYGROUND_DIR, DISCOVERY_MANIFEST_FILENAME);
const DATA_DIR = path.join(PLAYGROUND_DIR, 'data');

// Track in-progress analyses to prevent duplicates
const analyzingIds = new Set<string>();

interface DiscoveryEntry {
  id: string;
  name: string;
  path: string;
  type: 'page' | 'component';
  status: string;
  parentId?: string;
  childComponents?: { name: string; path: string }[];
  analysis?: {
    discoveredFilename?: string;
    componentName?: string;
    [key: string]: unknown;
  };
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// POST — analyze a specific component
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  let body: { id?: string; path?: string; name?: string; type?: 'page' | 'component'; model?: string; parentId?: string } | null = null;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body?.id || !body?.path || !body?.name || !body?.type) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: id, path, name, type' },
      { status: 400 },
    );
  }

  const { id, name, type, model, parentId } = body;
  const componentPath = body.path;

  log(` POST — analyzing component "${name}" (id=${id}, type=${type})`);
  log(`   Source: ${componentPath}`);

  if (analyzingIds.has(id)) {
    console.warn(`${LOG_PREFIX} Analysis already in progress for "${name}" — rejecting`);
    return NextResponse.json(
      { success: false, error: `Analysis already in progress for "${name}"` },
      { status: 409 },
    );
  }

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    log(` Created data directory`);
  }

  const playgroundRelPath = path.relative(process.cwd(), PLAYGROUND_DIR).replace(/\\/g, '/');

  // Try to fetch a real-data snapshot so the agent can use live values for mock props.
  let propsSnapshot: Record<string, unknown> | undefined;
  try {
    const snapshot = await fetchPropsSnapshot(id);
    if (snapshot) {
      propsSnapshot = snapshot;
      log(` Got real props snapshot for "${id}" — injecting into prompt`);
    }
  } catch (e) {
    console.warn(`${LOG_PREFIX} Props snapshot fetch failed for "${id}" — continuing without it:`, e);
  }

  const prompt = discoveryAnalyzePrompt({
    id,
    name,
    componentPath,
    type,
    playgroundDir: playgroundRelPath,
    propsSnapshot,
    parentId,
  });

  log(` Generated analysis prompt (${prompt.length} chars)`);

  analyzingIds.add(id);

  const args = ['agent', '--print', '--force'];
  if (model) {
    args.push('--model', model);
    log(` Using model: ${model}`);
  }

  const startTime = Date.now();
  log(` Spawning: cursor ${args.join(' ')}`);

  return new Promise<NextResponse>((resolve) => {
    try {
      const agentProcess = spawn('cursor', args, {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      log(` Agent process started — PID=${agentProcess.pid}`);

      let stdout = '';
      let stderr = '';

      agentProcess.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        const lines = chunk.trim().split('\n');
        for (const line of lines) {
          if (line.trim()) log(` [stdout] ${line}`);
        }
      });

      agentProcess.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        const lines = chunk.trim().split('\n');
        for (const line of lines) {
          if (line.trim()) log(` [stderr] ${line}`);
        }
      });

      agentProcess.stdin?.write(prompt);
      agentProcess.stdin?.end();
      log(` Prompt written to stdin and closed`);

      agentProcess.on('close', (code) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log(` Agent exited — code=${code}, elapsed=${elapsed}s`);
        log(`   stdout: ${stdout.length} chars, stderr: ${stderr.length} chars`);

        analyzingIds.delete(id);

        if (code === 0) {
          // Check if the mock data file was created
          const cleanName = name.replace(/\s+/g, '');
          const expectedDataFile = path.join(DATA_DIR, `${cleanName}.mockData.ts`);
          const mockDataExists = fs.existsSync(expectedDataFile);
          log(` Expected mock data file: ${expectedDataFile} — exists=${mockDataExists}`);

          // List all files in data dir
          if (fs.existsSync(DATA_DIR)) {
            const files = fs.readdirSync(DATA_DIR);
            log(` Data dir contents: [${files.join(', ')}]`);
          }

          // Read updated discovery.json to return the entry
          try {
            const data = JSON.parse(fs.readFileSync(DISCOVERY_JSON_PATH, 'utf-8'));
            const entry = (data.entries || []).find((e: DiscoveryEntry) => e.id === id);

            if (entry) {
              log(` Updated entry for "${name}" — status=${entry.status}, analysis=${JSON.stringify(entry.analysis || {})}`);
            } else {
              console.warn(`${LOG_PREFIX} Entry "${id}" not found in discovery.json after analysis`);
            }

            // Promote child components to top-level entries
            let childEntries: DiscoveryEntry[] = [];
            if (entry?.childComponents && entry.childComponents.length > 0) {
              const existingIds = new Set((data.entries || []).map((e: DiscoveryEntry) => e.id));
              for (const child of entry.childComponents) {
                const childId = `${id}--${toKebabCase(child.name)}`;
                if (!existingIds.has(childId)) {
                  const childEntry: DiscoveryEntry = {
                    id: childId,
                    name: child.name,
                    path: child.path,
                    type: 'component',
                    parentId: id,
                    status: 'discovered',
                  };
                  data.entries.push(childEntry);
                  childEntries.push(childEntry);
                  existingIds.add(childId);
                  log(` Promoted child component "${child.name}" as "${childId}"`);
                }
              }
              if (childEntries.length > 0) {
                fs.writeFileSync(DISCOVERY_JSON_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
                log(` Wrote ${childEntries.length} child entries to discovery.json`);
              }
            }

            resolve(NextResponse.json({
              success: true,
              entry: entry || null,
              childEntries,
            }));
          } catch (e) {
            console.error(`${LOG_PREFIX} Error reading discovery.json after analysis:`, e);
            resolve(NextResponse.json({
              success: true,
              entry: null,
              message: 'Analysis completed but could not read updated entry',
            }));
          }
        } else {
          console.error(`${LOG_PREFIX} Analysis failed for "${name}" — code=${code}`);
          if (stderr) console.error(`${LOG_PREFIX} stderr: ${stderr.slice(0, 1000)}`);
          resolve(NextResponse.json(
            { success: false, error: stderr || `Cursor agent exited with code ${code}` },
            { status: 500 },
          ));
        }
      });

      agentProcess.on('error', (error) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.error(`${LOG_PREFIX} Agent process error after ${elapsed}s:`, error.message);

        analyzingIds.delete(id);
        const message = error.message.includes('ENOENT')
          ? 'Cursor CLI not found. Install it and ensure `cursor` is in your PATH.'
          : error.message;
        resolve(NextResponse.json({ success: false, error: message }, { status: 500 }));
      });
    } catch (spawnError) {
      console.error(`${LOG_PREFIX} Failed to spawn agent:`, spawnError);
      analyzingIds.delete(id);
      const message = spawnError instanceof Error ? spawnError.message : 'Failed to spawn cursor agent';
      resolve(NextResponse.json({ success: false, error: message }, { status: 500 }));
    }
  });
}

// ---------------------------------------------------------------------------
// DELETE — remove a discovered component
// ---------------------------------------------------------------------------

export async function DELETE(req: Request) {
  let body: { id?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body?.id) {
    return NextResponse.json({ success: false, error: 'Missing required field: id' }, { status: 400 });
  }

  const { id } = body;
  log(` DELETE — removing discovered component "${id}"`);

  try {
    if (!fs.existsSync(DISCOVERY_JSON_PATH)) {
      return NextResponse.json({ success: false, error: 'discovery.json not found' }, { status: 404 });
    }

    const data = JSON.parse(fs.readFileSync(DISCOVERY_JSON_PATH, 'utf-8'));
    const entry = (data.entries || []).find((e: DiscoveryEntry) => e.id === id);

    if (!entry) {
      console.warn(`${LOG_PREFIX} Entry "${id}" not found for deletion`);
      return NextResponse.json({ success: false, error: `Entry "${id}" not found` }, { status: 404 });
    }

    // Delete mock data file if it exists
    const cleanName = (entry.name as string).replace(/\s+/g, '');
    const mockDataPath = path.join(DATA_DIR, `${cleanName}.mockData.ts`);
    if (fs.existsSync(mockDataPath)) {
      fs.unlinkSync(mockDataPath);
      log(` Deleted mock data file: ${cleanName}.mockData.ts`);
    }

    // Reset entry status
    entry.status = 'discovered';
    delete entry.analysis;

    fs.writeFileSync(DISCOVERY_JSON_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    log(` Reset entry "${id}" to discovered`);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove component';
    console.error(`${LOG_PREFIX} Error removing component:`, message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
