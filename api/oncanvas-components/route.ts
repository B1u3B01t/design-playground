import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  CANVAS_COMPONENT_FILENAME_PATTERN,
  CANVAS_ITERATION_FILENAME_PATTERN,
  CANVAS_ITERATION_PARSE_PATTERN,
  JSX_ID_PREFIX,
  type JsxComponentInfo,
  type JsxIterationInfo,
} from '../../lib/constants';
import { resolvePlaygroundDir } from '../../lib/resolve-playground-dir';

const CANVAS_COMPONENTS_DIR = path.join(resolvePlaygroundDir(), 'canvas-components');
const INDEX_FILE = path.join(CANVAS_COMPONENTS_DIR, 'index.ts');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPascalCase(s: string): string {
  return s.split(/[-.]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

function buildIterationInfo(filename: string): JsxIterationInfo | null {
  const match = filename.match(CANVAS_ITERATION_PARSE_PATTERN);
  if (!match) return null;
  const baseName = match[1]; // "frame-5"
  const iterationNumber = parseInt(match[2], 10);
  const label = filename.replace('.tsx', '');
  return {
    id: `${JSX_ID_PREFIX}${label}`,
    label,
    filename,
    baseFilename: `${baseName}.tsx`,
    iterationNumber,
  };
}

function buildComponentInfo(filename: string, iterations: JsxIterationInfo[]): JsxComponentInfo {
  const label = filename.replace('.tsx', '');
  return { id: `${JSX_ID_PREFIX}${label}`, label, filename, iterations };
}

function scanBaseFiles(): string[] {
  if (!fs.existsSync(CANVAS_COMPONENTS_DIR)) return [];
  return fs.readdirSync(CANVAS_COMPONENTS_DIR)
    .filter(f => CANVAS_COMPONENT_FILENAME_PATTERN.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/(\d+)/)?.[1] ?? '0', 10);
      const nb = parseInt(b.match(/(\d+)/)?.[1] ?? '0', 10);
      return na - nb;
    });
}

function scanIterationFiles(): string[] {
  if (!fs.existsSync(CANVAS_COMPONENTS_DIR)) return [];
  return fs.readdirSync(CANVAS_COMPONENTS_DIR)
    .filter(f => CANVAS_ITERATION_FILENAME_PATTERN.test(f))
    .sort((a, b) => {
      const parseA = a.match(CANVAS_ITERATION_PARSE_PATTERN);
      const parseB = b.match(CANVAS_ITERATION_PARSE_PATTERN);
      const baseA = parseA?.[1] ?? '';
      const baseB = parseB?.[1] ?? '';
      if (baseA !== baseB) return baseA.localeCompare(baseB);
      return parseInt(parseA?.[2] ?? '0', 10) - parseInt(parseB?.[2] ?? '0', 10);
    });
}

/** All importable files: base components + iterations */
function scanAllFiles(): string[] {
  return [...scanBaseFiles(), ...scanIterationFiles()];
}

const EMPTY_INDEX = `// Auto-generated — do not edit manually
'use client';
import { ComponentType } from 'react';

export const canvasComponents: Record<string, ComponentType<any>> = {};

export function getOnCanvasComponent(filename: string): ComponentType<any> | undefined {
  return canvasComponents[filename];
}
`;

function regenerateIndex(): void {
  fs.mkdirSync(CANVAS_COMPONENTS_DIR, { recursive: true });
  const files = scanAllFiles();

  if (files.length === 0) {
    fs.writeFileSync(INDEX_FILE, EMPTY_INDEX, 'utf-8');
    return;
  }

  const importLines = files.map(f => {
    const name = f.replace('.tsx', '');
    const varName = toPascalCase(name);
    return `import ${varName} from './${name}';`;
  });

  const mapEntries = files.map(f => {
    const name = f.replace('.tsx', '');
    const varName = toPascalCase(name);
    return `  '${f}': ${varName} as ComponentType<any>,`;
  });

  const content = `// Auto-generated — do not edit manually
'use client';
import { ComponentType } from 'react';

${importLines.join('\n')}

export const canvasComponents: Record<string, ComponentType<any>> = {
${mapEntries.join('\n')}
};

export function getOnCanvasComponent(filename: string): ComponentType<any> | undefined {
  return canvasComponents[filename];
}
`;
  fs.writeFileSync(INDEX_FILE, content, 'utf-8');
}

// ---------------------------------------------------------------------------
// GET — list all on-canvas components with their iterations
// ---------------------------------------------------------------------------

export async function GET(): Promise<Response> {
  // Seed index.ts if missing (first time setup)
  if (!fs.existsSync(INDEX_FILE)) {
    regenerateIndex();
  }

  const baseFiles = scanBaseFiles();
  const iterFiles = scanIterationFiles();

  // Group iterations by base component
  const iterByBase = new Map<string, JsxIterationInfo[]>();
  for (const f of iterFiles) {
    const info = buildIterationInfo(f);
    if (!info) continue;
    const list = iterByBase.get(info.baseFilename) || [];
    list.push(info);
    iterByBase.set(info.baseFilename, list);
  }

  const components: JsxComponentInfo[] = baseFiles.map(f =>
    buildComponentInfo(f, iterByBase.get(f) || [])
  );

  return NextResponse.json({ components });
}

// ---------------------------------------------------------------------------
// POST — regenerate barrel index (call after agent writes files directly)
// ---------------------------------------------------------------------------

export async function POST(): Promise<Response> {
  regenerateIndex();
  return NextResponse.json({ success: true });
}

// ---------------------------------------------------------------------------
// PUT — write a new component or iteration file
// ---------------------------------------------------------------------------

export async function PUT(req: Request): Promise<Response> {
  let body: { filename?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { filename, content } = body;

  const isBase = filename && CANVAS_COMPONENT_FILENAME_PATTERN.test(filename);
  const isIteration = filename && CANVAS_ITERATION_FILENAME_PATTERN.test(filename);

  if (!filename || (!isBase && !isIteration)) {
    return NextResponse.json({ error: 'Invalid filename — must match frame-N.tsx or frame-N.iteration-M.tsx' }, { status: 400 });
  }
  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  fs.mkdirSync(CANVAS_COMPONENTS_DIR, { recursive: true });

  const filePath = path.join(CANVAS_COMPONENTS_DIR, filename);
  if (fs.existsSync(filePath)) {
    return NextResponse.json({ error: `Component "${filename}" already exists` }, { status: 409 });
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  regenerateIndex();

  if (isIteration) {
    const info = buildIterationInfo(filename);
    return NextResponse.json({ success: true, iteration: info });
  }

  const component = buildComponentInfo(filename, []);
  return NextResponse.json({ success: true, component });
}

// ---------------------------------------------------------------------------
// DELETE — remove a component or iteration file
// ---------------------------------------------------------------------------

export async function DELETE(req: Request): Promise<Response> {
  let body: { filename?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { filename } = body;

  const isBase = filename && CANVAS_COMPONENT_FILENAME_PATTERN.test(filename);
  const isIteration = filename && CANVAS_ITERATION_FILENAME_PATTERN.test(filename);

  if (!filename || (!isBase && !isIteration)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const filePath = path.join(CANVAS_COMPONENTS_DIR, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // When deleting a base component, also remove all its iterations
  if (isBase) {
    const baseName = filename.replace('.tsx', '');
    const iterFiles = scanIterationFiles().filter(f => f.startsWith(`${baseName}.iteration-`));
    for (const f of iterFiles) {
      const iterPath = path.join(CANVAS_COMPONENTS_DIR, f);
      if (fs.existsSync(iterPath)) fs.unlinkSync(iterPath);
    }
  }

  regenerateIndex();
  return NextResponse.json({ success: true });
}
