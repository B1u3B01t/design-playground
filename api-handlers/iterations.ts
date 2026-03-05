import fs from 'fs';
import path from 'path';
import {
  ITERATIONS_INDEX_FILENAME,
  ITERATION_FILENAME_PATTERN,
  ITERATION_FILENAME_PARSE_PATTERN,
  TREE_MANIFEST_FILENAME,
} from '../lib/constants';
import type { ApiRequest, ApiResponse } from './types';

/**
 * Auto-discover the playground iterations directory.
 * Tries common layouts so the path works regardless of where
 * the user places the playground folder.
 */
function resolveIterationsDir(): string {
  const root = process.cwd();

  const candidates = [
    path.join(root, 'src', 'app', 'playground', 'iterations'),
    path.join(root, 'src', 'playground', 'iterations'),
    path.join(root, 'app', 'playground', 'iterations'),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }

  // Fallback: scan for a playground/iterations with an index.ts
  for (const base of [path.join(root, 'src'), root]) {
    // Check app/*/iterations (Next.js layout)
    const appDir = path.join(base, 'app');
    if (fs.existsSync(appDir)) {
      for (const entry of fs.readdirSync(appDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const iterDir = path.join(appDir, entry.name, 'iterations');
          if (fs.existsSync(path.join(iterDir, ITERATIONS_INDEX_FILENAME))) {
            return iterDir;
          }
        }
      }
    }
    // Check playground/iterations directly (Vite layout)
    const directIterDir = path.join(base, 'playground', 'iterations');
    if (fs.existsSync(path.join(directIterDir, ITERATIONS_INDEX_FILENAME))) {
      return directIterDir;
    }
  }

  return candidates[0];
}

const ITERATIONS_DIR = resolveIterationsDir();
const INDEX_FILE = path.join(ITERATIONS_DIR, ITERATIONS_INDEX_FILENAME);
const TREE_FILE = path.join(ITERATIONS_DIR, TREE_MANIFEST_FILENAME);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IterationFile {
  filename: string;
  componentName: string;
  iterationNumber: number;
  parentId: string;
  description: string;
  sourceIteration: string | null;
}

interface TreeManifest {
  version: number;
  entries: Record<string, { parent: string }>;
}

// ---------------------------------------------------------------------------
// Tree manifest helpers
// ---------------------------------------------------------------------------

function readTreeManifest(): TreeManifest {
  try {
    if (fs.existsSync(TREE_FILE)) {
      const content = fs.readFileSync(TREE_FILE, 'utf-8');
      const data = JSON.parse(content) as TreeManifest;
      if (data && typeof data.entries === 'object') {
        return data;
      }
    }
  } catch (e) {
    console.error('[iterations] Error reading tree.json:', e);
  }
  return { version: 1, entries: {} };
}

function writeTreeManifest(manifest: TreeManifest): void {
  try {
    fs.writeFileSync(TREE_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  } catch (e) {
    console.error('[iterations] Error writing tree.json:', e);
  }
}

function rebuildTreeManifest(iterations: IterationFile[]): TreeManifest {
  const manifest: TreeManifest = { version: 1, entries: {} };
  for (const iter of iterations) {
    manifest.entries[iter.filename] = {
      parent: iter.sourceIteration || iter.parentId,
    };
  }
  writeTreeManifest(manifest);
  return manifest;
}

function findDescendants(manifest: TreeManifest, filename: string): string[] {
  const descendants: string[] = [];
  const queue = [filename];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const [child, entry] of Object.entries(manifest.entries)) {
      if (entry.parent === current && !descendants.includes(child)) {
        descendants.push(child);
        queue.push(child);
      }
    }
  }
  return descendants;
}

// ---------------------------------------------------------------------------
// File parsing
// ---------------------------------------------------------------------------

function parseIterationFile(filename: string): IterationFile | null {
  const match = filename.match(ITERATION_FILENAME_PARSE_PATTERN);
  if (!match) return null;

  const componentName = match[1];
  const iterationNumber = parseInt(match[2], 10);

  let description = '';
  let sourceIteration: string | null = null;

  try {
    const filePath = path.join(ITERATIONS_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf-8');

    const descMatch = content.match(/@description\s+(.+)/);
    if (descMatch) {
      description = descMatch[1].trim();
    }

    const sourceMatch = content.match(/@sourceIteration\s+(\S+)/);
    if (sourceMatch) {
      sourceIteration = sourceMatch[1].trim();
    }
  } catch {
    // Ignore read errors
  }

  const parentId = componentName
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '')
    .replace(/\s+/g, '-');

  return {
    filename,
    componentName,
    iterationNumber,
    parentId,
    description,
    sourceIteration,
  };
}

// ---------------------------------------------------------------------------
// Index generation
// ---------------------------------------------------------------------------

function generateIndexContent(iterations: IterationFile[]): string {
  if (iterations.length === 0) {
    return `// Auto-generated index for iteration components
// This file maps iteration filenames to their components

import { ComponentType } from 'react';

// No iterations currently registered

// Map of filename to component
export const iterationComponents: Record<string, ComponentType<any>> = {};

export function getIterationComponent(filename: string): ComponentType<any> | undefined {
  return iterationComponents[filename];
}
`;
  }

  const byComponent = new Map<string, IterationFile[]>();
  for (const iter of iterations) {
    const existing = byComponent.get(iter.componentName) || [];
    existing.push(iter);
    byComponent.set(iter.componentName, existing);
  }

  const imports: string[] = [];
  for (const [componentName, iters] of byComponent) {
    imports.push(`// Import all ${componentName} iterations`);
    for (const iter of iters.sort((a, b) => a.iterationNumber - b.iterationNumber)) {
      const importName = `${componentName}Iteration${iter.iterationNumber}`;
      const moduleName = iter.filename.replace('.tsx', '');
      imports.push(`import ${importName} from './${moduleName}';`);
    }
    imports.push('');
  }

  const mapEntries: string[] = [];
  for (const [, iters] of byComponent) {
    for (const iter of iters.sort((a, b) => a.iterationNumber - b.iterationNumber)) {
      const importName = `${iter.componentName}Iteration${iter.iterationNumber}`;
      mapEntries.push(`  '${iter.filename}': ${importName} as ComponentType<any>,`);
    }
  }

  return `// Auto-generated index for iteration components
// This file maps iteration filenames to their components

import { ComponentType } from 'react';

${imports.join('\n')}
// Map of filename to component
export const iterationComponents: Record<string, ComponentType<any>> = {
${mapEntries.join('\n')}
};

export function getIterationComponent(filename: string): ComponentType<any> | undefined {
  return iterationComponents[filename];
}
`;
}

function regenerateIndex(): void {
  const files = fs.readdirSync(ITERATIONS_DIR);
  const iterations: IterationFile[] = [];

  for (const file of files) {
    if (file === 'index.ts' || file === TREE_MANIFEST_FILENAME) continue;

    if (file.endsWith('.tsx')) {
      const parsed = parseIterationFile(file);
      if (parsed) {
        iterations.push(parsed);
      }
    }
  }

  iterations.sort((a, b) => {
    if (a.componentName !== b.componentName) {
      return a.componentName.localeCompare(b.componentName);
    }
    return a.iterationNumber - b.iterationNumber;
  });

  const indexContent = generateIndexContent(iterations);
  fs.writeFileSync(INDEX_FILE, indexContent, 'utf-8');
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleIterationsGet(_req: ApiRequest, res: ApiResponse) {
  try {
    if (!fs.existsSync(ITERATIONS_DIR)) {
      return res.json({ iterations: [] });
    }

    const files = fs.readdirSync(ITERATIONS_DIR);
    const iterations: IterationFile[] = [];

    for (const file of files) {
      if (file === 'index.ts' || file === TREE_MANIFEST_FILENAME) continue;

      if (file.endsWith('.tsx')) {
        const parsed = parseIterationFile(file);
        if (parsed) {
          iterations.push(parsed);
        }
      }
    }

    const manifest = readTreeManifest();
    for (const iter of iterations) {
      if (!iter.sourceIteration && manifest.entries[iter.filename]) {
        const parentValue = manifest.entries[iter.filename].parent;
        if (parentValue.endsWith('.tsx')) {
          iter.sourceIteration = parentValue;
        }
      }
    }

    iterations.sort((a, b) => {
      if (a.componentName !== b.componentName) {
        return a.componentName.localeCompare(b.componentName);
      }
      return a.iterationNumber - b.iterationNumber;
    });

    res.json({ iterations });
  } catch (error) {
    console.error('Error scanning iterations:', error);
    res.json({ error: 'Failed to scan iterations' }, 500);
  }
}

export async function handleIterationsDelete(req: ApiRequest, res: ApiResponse) {
  try {
    const body = await req.json();
    const { filename, mode } = body as { filename: string; mode?: 'cascade' | 'reparent' };

    if (!filename || typeof filename !== 'string') {
      return res.json({ error: 'Filename required' }, 400);
    }

    if (!ITERATION_FILENAME_PATTERN.test(filename)) {
      return res.json({ error: 'Invalid filename' }, 400);
    }

    const filePath = path.join(ITERATIONS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.json({ error: 'File not found' }, 404);
    }

    const manifest = readTreeManifest();
    const deletedFiles: string[] = [filename];

    if (mode === 'cascade') {
      const descendants = findDescendants(manifest, filename);
      for (const desc of descendants) {
        const descPath = path.join(ITERATIONS_DIR, desc);
        if (fs.existsSync(descPath)) {
          fs.unlinkSync(descPath);
          deletedFiles.push(desc);
        }
        delete manifest.entries[desc];
      }
    } else if (mode === 'reparent') {
      const deletedParent = manifest.entries[filename]?.parent || '';
      for (const [child, entry] of Object.entries(manifest.entries)) {
        if (entry.parent === filename) {
          manifest.entries[child] = { parent: deletedParent };
        }
      }
    }

    fs.unlinkSync(filePath);
    delete manifest.entries[filename];

    writeTreeManifest(manifest);
    regenerateIndex();

    res.json({ success: true, deletedFiles });
  } catch (error) {
    console.error('Error deleting iteration:', error);
    res.json({ error: 'Failed to delete iteration' }, 500);
  }
}

export async function handleIterationsPost(req: ApiRequest, res: ApiResponse) {
  try {
    let rebuildTree = false;
    try {
      const body = await req.json();
      rebuildTree = body?.rebuildTree === true;
    } catch {
      // No body or invalid JSON — just regenerate index
    }

    regenerateIndex();

    if (rebuildTree) {
      const files = fs.readdirSync(ITERATIONS_DIR);
      const iterations: IterationFile[] = [];
      for (const file of files) {
        if (file === 'index.ts' || file === TREE_MANIFEST_FILENAME) continue;
        if (file.endsWith('.tsx')) {
          const parsed = parseIterationFile(file);
          if (parsed) iterations.push(parsed);
        }
      }
      rebuildTreeManifest(iterations);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error regenerating index:', error);
    res.json({ error: 'Failed to regenerate index' }, 500);
  }
}
