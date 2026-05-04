import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { resolvePlaygroundDir } from '../../lib/resolve-playground-dir';

const REGISTRY_FILE = path.join(resolvePlaygroundDir(), 'registry.tsx');
const APP_DIR = path.join(process.cwd(), 'src/app');

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

interface PagesGroupBounds {
  groupOpen: number;
  childrenOpen: number;
  childrenClose: number;
}

function locatePagesGroup(source: string): PagesGroupBounds | null {
  const groupMatch = /id:\s*['"]pages['"][\s\S]*?children:\s*\[/.exec(source);
  if (!groupMatch) return null;
  const groupOpen = groupMatch.index;
  const childrenOpen = groupMatch.index + groupMatch[0].length;

  let depth = 1;
  let pos = childrenOpen;
  while (pos < source.length && depth > 0) {
    const ch = source[pos];
    if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) break;
    }
    pos++;
  }
  if (depth !== 0) return null;
  return { groupOpen, childrenOpen, childrenClose: pos };
}

function findLeafBounds(source: string, slug: string, bounds: PagesGroupBounds): [number, number] | null {
  const childrenSlice = source.slice(bounds.childrenOpen, bounds.childrenClose);
  const idRegex = new RegExp(`id:\\s*['"]${slug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}['"]`);
  const idMatch = idRegex.exec(childrenSlice);
  if (!idMatch) return null;
  const idPos = bounds.childrenOpen + idMatch.index;

  // Walk back to find the leaf's opening '{'
  let openPos = idPos;
  let openDepth = 0;
  while (openPos > bounds.childrenOpen) {
    openPos--;
    const ch = source[openPos];
    if (ch === '}') openDepth++;
    else if (ch === '{') {
      if (openDepth === 0) break;
      openDepth--;
    }
  }
  if (source[openPos] !== '{') return null;

  // Walk forward to find matching '}'
  let closePos = openPos;
  let closeDepth = 0;
  while (closePos < bounds.childrenClose) {
    const ch = source[closePos];
    if (ch === '{') closeDepth++;
    else if (ch === '}') {
      closeDepth--;
      if (closeDepth === 0) break;
    }
    closePos++;
  }
  if (source[closePos] !== '}') return null;

  // Expand to include trailing comma + whitespace + newline
  let endPos = closePos + 1;
  while (endPos < source.length && (source[endPos] === ',' || source[endPos] === ' ' || source[endPos] === '\t')) endPos++;
  if (source[endPos] === '\n') endPos++;

  // Include leading indent
  let startPos = openPos;
  while (startPos > 0 && (source[startPos - 1] === ' ' || source[startPos - 1] === '\t')) startPos--;

  return [startPos, endPos];
}

function removeDynamicImportLine(source: string, slug: string): string {
  const escaped = slug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const importRegex = new RegExp(
    `^[ \\t]*const\\s+\\w+\\s*=\\s*dynamic\\(\\s*\\(\\)\\s*=>\\s*import\\(\\s*['"]@/app/${escaped}/page['"]\\s*\\)[\\s\\S]*?;\\s*\\n`,
    'gm',
  );
  return source.replace(importRegex, '');
}

export async function DELETE(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const slug = (url.searchParams.get('slug') || '').trim();

  if (!slug || !SLUG_PATTERN.test(slug)) {
    return NextResponse.json({ success: false, error: 'Invalid slug' }, { status: 400 });
  }

  if (!fs.existsSync(REGISTRY_FILE)) {
    return NextResponse.json({ success: false, error: 'Registry file not found' }, { status: 500 });
  }

  const source = fs.readFileSync(REGISTRY_FILE, 'utf-8');
  const bounds = locatePagesGroup(source);
  if (!bounds) {
    return NextResponse.json({ success: false, error: 'Pages group not found in registry' }, { status: 500 });
  }

  const leafBounds = findLeafBounds(source, slug, bounds);
  if (!leafBounds) {
    return NextResponse.json(
      { success: false, error: `Slug '${slug}' not found in Pages group — refusing to delete` },
      { status: 404 },
    );
  }

  const withoutLeaf = source.slice(0, leafBounds[0]) + source.slice(leafBounds[1]);
  const finalSource = removeDynamicImportLine(withoutLeaf, slug);
  fs.writeFileSync(REGISTRY_FILE, finalSource, 'utf-8');

  const pageDir = path.join(APP_DIR, slug);
  if (fs.existsSync(pageDir)) {
    try {
      fs.rmSync(pageDir, { recursive: true, force: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove page directory';
      return NextResponse.json(
        { success: false, error: `Registry updated but failed to remove ${pageDir}: ${message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: true, slug });
}
