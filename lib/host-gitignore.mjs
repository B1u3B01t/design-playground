/**
 * Host-project .gitignore management for Design Playground.
 *
 * Marker strings are duplicated in lib/constants.ts — keep in sync on change.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';

// Keep in sync with lib/constants.ts GITIGNORE_* / HTML_TREE_* / TEMP_DIR_RELATIVE
export const MARKERS = {
  staticStart: '# BEGIN design-playground',
  staticEnd: '# END design-playground',
  framesStart: '# BEGIN design-playground-public-frames',
  framesEnd: '# END design-playground-public-frames',
};

const HTML_TREE_DIR = '.playground';
const HTML_TREE_FILENAME = 'html-tree.json';
const TEMP_DIR_RELATIVE = '.playground-temp';

const PLAYGROUND_DIRS = ['src/app/playground', 'app/playground'];

/**
 * @param {string} scriptDir - Absolute path to the playground folder (setup.mjs dir)
 * @param {string} root - Host project root
 */
export function getPlaygroundRelPathFromScriptDir(scriptDir, root) {
  return relative(root, scriptDir).split('\\').join('/');
}

/**
 * @param {{ includePdfWorker?: boolean }} [opts]
 * @returns {string[]}
 */
export function getStaticIgnoreLines(opts = {}) {
  const lines = [
    '# Design Playground — local dev tool; installed via setup.mjs',
    '/src/app/playground/',
    '/app/playground/',
    `/${TEMP_DIR_RELATIVE}/`,
    '/skills-lock.json',
    '/.claude/skills/',
    `/public/${HTML_TREE_DIR}/`,
    '/public/untitled-*/',
  ];
  if (opts.includePdfWorker) {
    lines.push('/public/pdf.worker.min.mjs');
  }
  return lines;
}

/**
 * @param {string} root
 * @returns {Set<string>}
 */
export function parseHtmlTreeSlugs(root) {
  const slugs = new Set();
  const treePath = join(root, 'public', HTML_TREE_DIR, HTML_TREE_FILENAME);
  if (!existsSync(treePath)) return slugs;

  try {
    const data = JSON.parse(readFileSync(treePath, 'utf-8'));
    const entries = data?.entries ?? {};
    for (const key of Object.keys(entries)) {
      const slash = key.indexOf('/');
      if (slash > 0) {
        slugs.add(key.slice(0, slash));
      } else if (key && !key.includes('..')) {
        slugs.add(key);
      }
    }
    for (const value of Object.values(entries)) {
      const parent = value?.parent;
      if (typeof parent === 'string' && parent.startsWith('html:')) {
        const slug = parent.slice(5);
        if (slug && !slug.includes('..')) slugs.add(slug);
      }
    }
  } catch {
    /* corrupt manifest — skip */
  }
  return slugs;
}

/**
 * Scan public/ for HTML frame folders (index.html at root of slug dir).
 * @param {string} root
 * @returns {Set<string>}
 */
export function scanPublicFrameSlugs(root) {
  const slugs = new Set();
  const publicDir = join(root, 'public');
  if (!existsSync(publicDir)) return slugs;

  let entries;
  try {
    entries = readdirSync(publicDir, { withFileTypes: true });
  } catch {
    return slugs;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === HTML_TREE_DIR || entry.name.startsWith('.')) continue;
    if (entry.name.includes('..')) continue;
    const indexPath = join(publicDir, entry.name, 'index.html');
    if (existsSync(indexPath)) {
      slugs.add(entry.name);
    }
  }
  return slugs;
}

/**
 * @param {string} root
 * @returns {Set<string>}
 */
export function getAllFrameSlugs(root) {
  const slugs = new Set();
  for (const s of parseHtmlTreeSlugs(root)) slugs.add(s);
  for (const s of scanPublicFrameSlugs(root)) slugs.add(s);
  return slugs;
}

/**
 * @param {string} root
 * @returns {string[]}
 */
export function getDynamicFrameIgnoreLines(root) {
  const lines = [
    '# Auto-managed — do not edit; synced from public/.playground/html-tree.json',
  ];
  const sorted = [...getAllFrameSlugs(root)].sort();
  for (const slug of sorted) {
    lines.push(`/public/${slug}/`);
  }
  return lines;
}

/**
 * @param {string} root
 * @param {string} markerStart
 * @param {string} markerEnd
 * @param {string[]} innerLines
 */
export function upsertGitignoreBlock(root, markerStart, markerEnd, innerLines) {
  const gitignorePath = join(root, '.gitignore');
  const blockContent = [markerStart, ...innerLines, markerEnd].join('\n');

  let content = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf-8') : '';
  const startIdx = content.indexOf(markerStart);
  const endIdx = content.indexOf(markerEnd);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = content.slice(0, startIdx);
    const after = content.slice(endIdx + markerEnd.length);
    content = `${before}${blockContent}${after}`;
  } else {
    if (content.length > 0 && !content.endsWith('\n')) content += '\n';
    if (content.length > 0) content += '\n';
    content += `${blockContent}\n`;
  }

  content = content.replace(/\n{3,}/g, '\n\n');
  if (!content.endsWith('\n')) content += '\n';
  writeFileSync(gitignorePath, content, 'utf-8');
}

/**
 * @param {string} root
 */
export function syncPublicFrameGitignore(root) {
  upsertGitignoreBlock(
    root,
    MARKERS.framesStart,
    MARKERS.framesEnd,
    getDynamicFrameIgnoreLines(root),
  );
}

/**
 * @param {string} root
 * @param {{ includePdfWorker?: boolean }} [opts]
 * @returns {string[]}
 */
function getAllIgnoredPaths(root, opts = {}) {
  /** @type {string[]} */
  const paths = [
    ...PLAYGROUND_DIRS,
    TEMP_DIR_RELATIVE,
    'skills-lock.json',
    '.claude/skills',
    `public/${HTML_TREE_DIR}`,
  ];
  for (const slug of getAllFrameSlugs(root)) {
    paths.push(`public/${slug}`);
  }
  if (opts.includePdfWorker) {
    paths.push('public/pdf.worker.min.mjs');
  }
  return paths;
}

/**
 * @param {string} root
 * @param {{ includePdfWorker?: boolean }} [opts]
 */
export function untrackIgnoredPaths(root, opts = {}) {
  if (!existsSync(join(root, '.git'))) return;
  try {
    execSync('git --version', { stdio: 'ignore' });
  } catch {
    return;
  }

  for (const p of getAllIgnoredPaths(root, opts)) {
    try {
      execSync(`git rm -r --cached --ignore-unmatch -- "${p}"`, {
        cwd: root,
        stdio: 'pipe',
      });
    } catch {
      /* best-effort */
    }
  }
}

/**
 * @param {string} root
 * @param {{ includePdfWorker?: boolean }} [opts]
 * @returns {boolean}
 */
export function hasTrackedIgnoredPaths(root, opts = {}) {
  if (!existsSync(join(root, '.git'))) return false;
  try {
    execSync('git --version', { stdio: 'ignore' });
  } catch {
    return false;
  }

  for (const p of getAllIgnoredPaths(root, opts)) {
    try {
      const out = execSync(`git ls-files -- "${p}"`, {
        cwd: root,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      if (out.trim().length > 0) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/**
 * @param {string} root
 * @param {{ untrack?: boolean, includePdfWorker?: boolean }} [opts]
 * @returns {{ untracked: boolean, trackedWarning: boolean }}
 */
export function ensureHostGitignore(root, opts = {}) {
  const { untrack = false, includePdfWorker = false } = opts;

  upsertGitignoreBlock(
    root,
    MARKERS.staticStart,
    MARKERS.staticEnd,
    getStaticIgnoreLines({ includePdfWorker }),
  );
  syncPublicFrameGitignore(root);

  if (untrack) {
    untrackIgnoredPaths(root, { includePdfWorker });
    return { untracked: true, trackedWarning: false };
  }

  return {
    untracked: false,
    trackedWarning: hasTrackedIgnoredPaths(root, { includePdfWorker }),
  };
}
