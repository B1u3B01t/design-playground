import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  ITERATIONS_DIR_RELATIVE,
  ITERATIONS_INDEX_FILENAME,
  ITERATION_FILENAME_PATTERN,
  ITERATION_FILENAME_PARSE_PATTERN,
  TREE_MANIFEST_FILENAME,
} from '../../lib/constants';

const ITERATIONS_DIR = path.join(process.cwd(), ITERATIONS_DIR_RELATIVE);
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
  /** The iteration filename this was derived from, or null if from the original component */
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

/**
 * Rebuild tree.json from scratch by scanning all iteration files for @sourceIteration metadata.
 * Falls back to parentId (registry ID) for iterations without @sourceIteration.
 */
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

/**
 * Find all descendants of a given filename in the tree.
 */
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
  // Match pattern: ComponentName.iteration-N.tsx
  const match = filename.match(ITERATION_FILENAME_PARSE_PATTERN);
  if (!match) return null;

  const componentName = match[1];
  const iterationNumber = parseInt(match[2], 10);

  // Try to read metadata from file
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

  // Map component name to registry ID
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
export const iterationComponents: Record<string, ComponentType<Record<string, unknown>>> = {};

export function getIterationComponent(filename: string): ComponentType<Record<string, unknown>> | undefined {
  return iterationComponents[filename];
}
`;
  }

  // Group by component name for organized imports
  const byComponent = new Map<string, IterationFile[]>();
  for (const iter of iterations) {
    const existing = byComponent.get(iter.componentName) || [];
    existing.push(iter);
    byComponent.set(iter.componentName, existing);
  }

  // Generate import statements
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

  // Generate map entries
  const mapEntries: string[] = [];
  for (const [, iters] of byComponent) {
    for (const iter of iters.sort((a, b) => a.iterationNumber - b.iterationNumber)) {
      const importName = `${iter.componentName}Iteration${iter.iterationNumber}`;
      mapEntries.push(`  '${iter.filename}': ${importName} as ComponentType<Record<string, unknown>>,`);
    }
  }

  return `// Auto-generated index for iteration components
// This file maps iteration filenames to their components

import { ComponentType } from 'react';

${imports.join('\n')}
// Map of filename to component
export const iterationComponents: Record<string, ComponentType<Record<string, unknown>>> = {
${mapEntries.join('\n')}
};

export function getIterationComponent(filename: string): ComponentType<Record<string, unknown>> | undefined {
  return iterationComponents[filename];
}
`;
}

// Regenerate the index.ts file based on current iteration files
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
// GET - Scan iterations folder
// ---------------------------------------------------------------------------

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    if (!fs.existsSync(ITERATIONS_DIR)) {
      return NextResponse.json({ iterations: [] });
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

    // Merge with tree manifest for any sourceIteration data not in file metadata
    const manifest = readTreeManifest();
    for (const iter of iterations) {
      if (!iter.sourceIteration && manifest.entries[iter.filename]) {
        const parentValue = manifest.entries[iter.filename].parent;
        // If the parent in manifest looks like a filename (contains .tsx), it's a sourceIteration
        if (parentValue.endsWith('.tsx')) {
          iter.sourceIteration = parentValue;
        }
      }
    }

    // Sort by component name and iteration number
    iterations.sort((a, b) => {
      if (a.componentName !== b.componentName) {
        return a.componentName.localeCompare(b.componentName);
      }
      return a.iterationNumber - b.iterationNumber;
    });

    return NextResponse.json({ iterations });
  } catch (error) {
    console.error('Error scanning iterations:', error);
    return NextResponse.json({ error: 'Failed to scan iterations' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE - Delete iteration(s) with cascade or reparent mode
// ---------------------------------------------------------------------------

export async function DELETE(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { filename, mode } = body as { filename: string; mode?: 'cascade' | 'reparent' };

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'Filename required' }, { status: 400 });
    }

    if (!ITERATION_FILENAME_PATTERN.test(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const filePath = path.join(ITERATIONS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const manifest = readTreeManifest();
    const deletedFiles: string[] = [filename];

    if (mode === 'cascade') {
      // Find and delete all descendants
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
      // Find the deleted node's parent, then reparent its children to that parent
      const deletedParent = manifest.entries[filename]?.parent || '';
      for (const [child, entry] of Object.entries(manifest.entries)) {
        if (entry.parent === filename) {
          manifest.entries[child] = { parent: deletedParent };
        }
      }
    }

    // Delete the target file and remove from manifest
    fs.unlinkSync(filePath);
    delete manifest.entries[filename];

    // Write updated manifest
    writeTreeManifest(manifest);

    // Regenerate index.ts
    regenerateIndex();

    return NextResponse.json({ success: true, deletedFiles });
  } catch (error) {
    console.error('Error deleting iteration:', error);
    return NextResponse.json({ error: 'Failed to delete iteration' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST - Regenerate index and optionally rebuild tree manifest
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    let rebuildTree = false;
    try {
      const body = await request.json();
      rebuildTree = body?.rebuildTree === true;
    } catch {
      // No body or invalid JSON — just regenerate index
    }

    regenerateIndex();

    if (rebuildTree) {
      // Scan all files and rebuild tree.json from @sourceIteration metadata
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error regenerating index:', error);
    return NextResponse.json({ error: 'Failed to regenerate index' }, { status: 500 });
  }
}
