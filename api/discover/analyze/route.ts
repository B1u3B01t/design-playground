import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ComponentType } from 'react';
import {
  DISCOVERY_MANIFEST_FILENAME,
  DISCOVERED_DIR_NAME,
  DISCOVERED_INDEX_FILENAME,
} from '../../../lib/constants';
import { discoveryAnalyzePrompt } from '../../../prompts/discovery-analyze.prompt';

/**
 * Discovery Analyze API — prepares a single discovered component
 * for the playground by running the Cursor agent CLI.
 *
 * POST: Analyze a component, create wrapper file, update discovery.json
 * DELETE: Remove a discovered component wrapper and reset its status
 */

const LOG_PREFIX = '[Playground][analyze]';

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

function resolvePlaygroundDir(): string {
  const root = process.cwd();
  const candidates = [
    path.join(root, 'src', 'app', 'playground'),
    path.join(root, 'app', 'playground'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}

const PLAYGROUND_DIR = resolvePlaygroundDir();
const DISCOVERY_JSON_PATH = path.join(PLAYGROUND_DIR, DISCOVERY_MANIFEST_FILENAME);
const DISCOVERED_DIR = path.join(PLAYGROUND_DIR, DISCOVERED_DIR_NAME);
const DISCOVERED_INDEX_PATH = path.join(DISCOVERED_DIR, DISCOVERED_INDEX_FILENAME);

// Track in-progress analyses to prevent duplicates
const analyzingIds = new Set<string>();

// ---------------------------------------------------------------------------
// Index regeneration (mirrors iterations/route.ts pattern)
// ---------------------------------------------------------------------------

interface DiscoveryEntry {
  id: string;
  name: string;
  path: string;
  type: 'page' | 'component';
  status: string;
  analysis?: {
    discoveredFilename?: string;
    componentName?: string;
    [key: string]: unknown;
  };
}

function regenerateDiscoveredIndex(): void {
  console.log(`${LOG_PREFIX} Regenerating discovered/index.ts...`);

  if (!fs.existsSync(DISCOVERED_DIR)) {
    fs.mkdirSync(DISCOVERED_DIR, { recursive: true });
    console.log(`${LOG_PREFIX} Created discovered directory: ${DISCOVERED_DIR}`);
  }

  let entries: DiscoveryEntry[] = [];
  try {
    if (fs.existsSync(DISCOVERY_JSON_PATH)) {
      const data = JSON.parse(fs.readFileSync(DISCOVERY_JSON_PATH, 'utf-8'));
      entries = (data.entries || []).filter(
        (e: DiscoveryEntry) => e.status === 'added' && e.analysis?.discoveredFilename,
      );
    }
  } catch { /* ignore parse errors */ }

  // Filter to entries whose wrapper file actually exists
  const validEntries = entries.filter((e) => {
    const exists = fs.existsSync(path.join(DISCOVERED_DIR, e.analysis!.discoveredFilename!));
    if (!exists) {
      console.warn(`${LOG_PREFIX} Wrapper file missing for "${e.id}": ${e.analysis!.discoveredFilename}`);
    }
    return exists;
  });

  console.log(`${LOG_PREFIX} Found ${validEntries.length} valid discovered components`);

  if (validEntries.length === 0) {
    const content = `// Auto-generated index for discovered components
import { ComponentType } from 'react';
import dynamic from 'next/dynamic';

export const discoveredComponents: Record<string, ComponentType<any>> = {};

export function getDiscoveredComponent(id: string): ComponentType<any> | undefined {
  return discoveredComponents[id];
}
`;
    fs.writeFileSync(DISCOVERED_INDEX_PATH, content, 'utf-8');
    console.log(`${LOG_PREFIX} Wrote empty discovered/index.ts`);
    return;
  }

  const mapEntries: string[] = [];

  for (const entry of validEntries) {
    const filename = entry.analysis!.discoveredFilename!;
    const moduleName = filename.replace('.tsx', '');
    mapEntries.push(`  '${entry.id}': dynamic(() => import('./${moduleName}')),`);
    console.log(`${LOG_PREFIX}   Registered: '${entry.id}' → ${filename}`);
  }

  const content = `// Auto-generated index for discovered components
// This file maps discovery entry IDs to their wrapper components

import { ComponentType } from 'react';
import dynamic from 'next/dynamic';

export const discoveredComponents: Record<string, ComponentType<any>> = {
${mapEntries.join('\n')}
};

export function getDiscoveredComponent(id: string): ComponentType<any> | undefined {
  return discoveredComponents[id];
}
`;

  fs.writeFileSync(DISCOVERED_INDEX_PATH, content, 'utf-8');
  console.log(`${LOG_PREFIX} Wrote discovered/index.ts with ${validEntries.length} entries`);
}

// ---------------------------------------------------------------------------
// POST — analyze a specific component
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  let body: { id?: string; path?: string; name?: string; type?: 'page' | 'component'; model?: string } | null = null;

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

  const { id, name, type, model } = body;
  const componentPath = body.path;

  console.log(`${LOG_PREFIX} POST — analyzing component "${name}" (id=${id}, type=${type})`);
  console.log(`${LOG_PREFIX}   Source: ${componentPath}`);

  if (analyzingIds.has(id)) {
    console.warn(`${LOG_PREFIX} Analysis already in progress for "${name}" — rejecting`);
    return NextResponse.json(
      { success: false, error: `Analysis already in progress for "${name}"` },
      { status: 409 },
    );
  }

  // Ensure discovered directory exists
  if (!fs.existsSync(DISCOVERED_DIR)) {
    fs.mkdirSync(DISCOVERED_DIR, { recursive: true });
    console.log(`${LOG_PREFIX} Created discovered directory`);
  }

  const playgroundRelPath = path.relative(process.cwd(), PLAYGROUND_DIR).replace(/\\/g, '/');

  const prompt = discoveryAnalyzePrompt({
    id,
    name,
    componentPath,
    type,
    playgroundDir: playgroundRelPath,
  });

  console.log(`${LOG_PREFIX} Generated analysis prompt (${prompt.length} chars)`);

  analyzingIds.add(id);

  const args = ['agent', '--print', '--force'];
  if (model) {
    args.push('--model', model);
    console.log(`${LOG_PREFIX} Using model: ${model}`);
  }

  const startTime = Date.now();
  console.log(`${LOG_PREFIX} Spawning: cursor ${args.join(' ')}`);

  return new Promise<NextResponse>((resolve) => {
    try {
      const agentProcess = spawn('cursor', args, {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      console.log(`${LOG_PREFIX} Agent process started — PID=${agentProcess.pid}`);

      let stdout = '';
      let stderr = '';

      agentProcess.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        const lines = chunk.trim().split('\n');
        for (const line of lines) {
          if (line.trim()) console.log(`${LOG_PREFIX} [stdout] ${line}`);
        }
      });

      agentProcess.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        const lines = chunk.trim().split('\n');
        for (const line of lines) {
          if (line.trim()) console.log(`${LOG_PREFIX} [stderr] ${line}`);
        }
      });

      agentProcess.stdin?.write(prompt);
      agentProcess.stdin?.end();
      console.log(`${LOG_PREFIX} Prompt written to stdin and closed`);

      agentProcess.on('close', (code) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`${LOG_PREFIX} Agent exited — code=${code}, elapsed=${elapsed}s`);
        console.log(`${LOG_PREFIX}   stdout: ${stdout.length} chars, stderr: ${stderr.length} chars`);

        analyzingIds.delete(id);

        if (code === 0) {
          // Check if wrapper file was created
          const cleanName = name.replace(/\s+/g, '');
          const expectedFile = path.join(DISCOVERED_DIR, `${cleanName}.discovered.tsx`);
          const wrapperExists = fs.existsSync(expectedFile);
          console.log(`${LOG_PREFIX} Expected wrapper: ${expectedFile} — exists=${wrapperExists}`);

          // List all files in discovered dir
          if (fs.existsSync(DISCOVERED_DIR)) {
            const files = fs.readdirSync(DISCOVERED_DIR);
            console.log(`${LOG_PREFIX} Discovered dir contents: [${files.join(', ')}]`);
          }

          // Regenerate discovered/index.ts
          try {
            regenerateDiscoveredIndex();
          } catch (e) {
            console.error(`${LOG_PREFIX} Error regenerating index:`, e);
          }

          // Read updated discovery.json to return the entry
          try {
            const data = JSON.parse(fs.readFileSync(DISCOVERY_JSON_PATH, 'utf-8'));
            const entry = (data.entries || []).find((e: DiscoveryEntry) => e.id === id);

            if (entry) {
              console.log(`${LOG_PREFIX} Updated entry for "${name}" — status=${entry.status}, analysis=${JSON.stringify(entry.analysis || {})}`);
            } else {
              console.warn(`${LOG_PREFIX} Entry "${id}" not found in discovery.json after analysis`);
            }

            resolve(NextResponse.json({
              success: true,
              entry: entry || null,
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
  console.log(`${LOG_PREFIX} DELETE — removing discovered component "${id}"`);

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

    // Delete wrapper file if it exists
    if (entry.analysis?.discoveredFilename) {
      const wrapperPath = path.join(DISCOVERED_DIR, entry.analysis.discoveredFilename);
      if (fs.existsSync(wrapperPath)) {
        fs.unlinkSync(wrapperPath);
        console.log(`${LOG_PREFIX} Deleted wrapper file: ${entry.analysis.discoveredFilename}`);
      }
    }

    // Reset entry status
    entry.status = 'discovered';
    delete entry.analysis;

    fs.writeFileSync(DISCOVERY_JSON_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    console.log(`${LOG_PREFIX} Reset entry "${id}" to discovered`);

    regenerateDiscoveredIndex();

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove component';
    console.error(`${LOG_PREFIX} Error removing component:`, message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
