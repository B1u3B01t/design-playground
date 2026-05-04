/**
 * Walks the repo to build a "ground truth" file inventory the judge can
 * use for coverage scoring. Mirrors the discovery prompt's INCLUDE/SKIP rules.
 */

import fs from 'fs';
import path from 'path';

const SPECIAL_FILES = new Set([
  'layout.tsx',
  'loading.tsx',
  'error.tsx',
  'not-found.tsx',
  'template.tsx',
  'global-error.tsx',
]);

const MIN_LINES = 10;

export interface FileInventory {
  pages: string[];
  components: string[];
  skipped: string[];
}

export function buildFileInventory(cwd: string, playgroundRel: string): FileInventory {
  const pages: string[] = [];
  const components: string[] = [];
  const skipped: string[] = [];

  const appDirCandidates = [path.join(cwd, 'src', 'app'), path.join(cwd, 'app')];
  for (const dir of appDirCandidates) {
    if (fs.existsSync(dir)) walkApp(dir, cwd, playgroundRel, pages, skipped);
  }

  const compDirCandidates = [path.join(cwd, 'src', 'components'), path.join(cwd, 'components')];
  for (const dir of compDirCandidates) {
    if (fs.existsSync(dir)) walkComponents(dir, cwd, components, skipped);
  }

  return { pages, components, skipped };
}

function rel(cwd: string, abs: string): string {
  return path.relative(cwd, abs).replace(/\\/g, '/');
}

function lineCount(abs: string): number {
  try {
    return fs.readFileSync(abs, 'utf-8').split('\n').length;
  } catch {
    return 0;
  }
}

function walkApp(
  dir: string,
  cwd: string,
  playgroundRel: string,
  pages: string[],
  skipped: string[],
) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    const r = rel(cwd, abs);
    if (e.isDirectory()) {
      if (r === playgroundRel) continue;
      if (/(^|\/)api$/.test(r)) continue;
      walkApp(abs, cwd, playgroundRel, pages, skipped);
    } else if (e.isFile() && e.name === 'page.tsx') {
      if (lineCount(abs) < MIN_LINES) {
        skipped.push(`${r} (under ${MIN_LINES} lines)`);
        continue;
      }
      pages.push(r);
    } else if (e.isFile() && SPECIAL_FILES.has(e.name)) {
      skipped.push(`${r} (Next.js special file)`);
    }
  }
}

function walkComponents(
  dir: string,
  cwd: string,
  components: string[],
  skipped: string[],
) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    const r = rel(cwd, abs);
    if (e.isDirectory()) {
      walkComponents(abs, cwd, components, skipped);
    } else if (e.isFile() && e.name.endsWith('.tsx')) {
      if (lineCount(abs) < MIN_LINES) {
        skipped.push(`${r} (under ${MIN_LINES} lines)`);
        continue;
      }
      components.push(r);
    }
  }
}
