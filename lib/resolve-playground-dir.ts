import fs from 'fs';
import path from 'path';

/**
 * Candidate playground locations, in preference order, relative to the host
 * project root. The playground submodule may be installed under either a
 * `src/app/` or an `app/` Next.js layout.
 */
const CANDIDATE_RELATIVE_DIRS = [
  path.join('src', 'app', 'playground'),
  path.join('app', 'playground'),
];

/**
 * Files that only exist in a *real* playground install (the app shell), never
 * in a sparse directory that an agent may have created just to drop a single
 * generated artifact. Used to disambiguate when more than one candidate exists.
 */
const APP_SHELL_SENTINELS = ['PlaygroundClient.tsx', 'registry.tsx'];

function hasAppShell(dir: string): boolean {
  return APP_SHELL_SENTINELS.some((f) => fs.existsSync(path.join(dir, f)));
}

/**
 * Resolve the playground directory, handling both `src/app/playground` and
 * `app/playground` Next.js layouts.
 *
 * Prefers the candidate that actually contains the playground app shell (so a
 * sparse, generated-artifacts-only directory never wins over the real one),
 * then falls back to the first existing candidate, then to the first candidate.
 */
export function resolvePlaygroundDir(): string {
  const root = process.cwd();
  const candidates = CANDIDATE_RELATIVE_DIRS.map((d) => path.join(root, d));

  // 1. Prefer a candidate that contains the real playground app shell.
  for (const dir of candidates) {
    if (fs.existsSync(dir) && hasAppShell(dir)) return dir;
  }
  // 2. Otherwise the first candidate that exists at all.
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  // 3. Otherwise the conventional default.
  return candidates[0];
}

/**
 * The resolved playground directory as a POSIX path relative to the host
 * project root (e.g. `"src/app/playground"` or `"app/playground"`).
 *
 * Use this anywhere a path needs to be embedded in a string handed to the
 * coding agent (prompts) or to the browser, so generated files land in the
 * real playground directory regardless of the host layout.
 */
export function resolvePlaygroundDirRelative(): string {
  const rel = path.relative(process.cwd(), resolvePlaygroundDir());
  return rel.split(path.sep).join('/');
}

/**
 * Every candidate playground directory that currently exists on disk, with the
 * resolved (canonical) directory first. Useful for defensive scanning so that
 * files stranded in a sparse directory from a prior buggy run still surface.
 */
export function listPlaygroundDirs(): string[] {
  const root = process.cwd();
  const resolved = resolvePlaygroundDir();
  const existing = CANDIDATE_RELATIVE_DIRS.map((d) => path.join(root, d)).filter((dir) =>
    fs.existsSync(dir),
  );
  // Resolved dir first, then the rest, deduped.
  return [resolved, ...existing.filter((dir) => dir !== resolved)];
}
