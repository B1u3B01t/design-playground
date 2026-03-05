/**
 * Playground path resolution utilities.
 *
 * Auto-detects where the playground directory lives relative to the project
 * root. Works with any layout:
 *   - src/app/playground  (Next.js App Router with src/)
 *   - app/playground      (Next.js App Router without src/)
 *   - src/playground      (Vite / general)
 *   - playground          (flat layout)
 *
 * Detection is marker-based: we look for a directory that contains our own
 * `api-handlers/` subfolder, which is a reliable fingerprint.
 *
 * Results are cached after first resolution.
 */

import path from 'path';
import fs from 'fs';

let cachedRoot: string | null = null;

/** Marker file/folder that uniquely identifies a playground directory. */
const MARKER = 'api-handlers';

/**
 * Auto-detect the playground's relative path from the project root.
 * Checks common layouts (marker-verified) and caches the result.
 *
 * @returns Relative path like `src/app/playground`, `app/playground`, etc.
 */
export function resolvePlaygroundRoot(): string {
  if (cachedRoot) return cachedRoot;

  const root = process.cwd();

  // Well-known candidates, checked in priority order.
  // We verify each candidate actually contains our marker to avoid
  // false positives from stale or unrelated directories.
  const candidates = [
    'src/app/playground', // Next.js App Router (with src/)
    'app/playground',     // Next.js App Router (without src/)
    'src/playground',     // Vite / general
    'playground',         // Flat layout
  ];

  for (const candidate of candidates) {
    const abs = path.join(root, candidate);
    if (fs.existsSync(path.join(abs, MARKER))) {
      cachedRoot = candidate;
      return cachedRoot;
    }
  }

  // Broader scan: walk one level inside common base directories and
  // look for any folder named "playground" that contains the marker.
  const bases = ['src/app', 'app', 'src', '.'];
  for (const base of bases) {
    const baseDir = path.join(root, base);
    if (!fs.existsSync(baseDir)) continue;

    try {
      for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const candidate = path.join(baseDir, entry.name);
        if (fs.existsSync(path.join(candidate, MARKER))) {
          cachedRoot = path.relative(root, candidate);
          return cachedRoot;
        }
      }
    } catch {
      // Permission errors etc. — skip this base
    }
  }

  // Last resort: default to src/app/playground
  cachedRoot = 'src/app/playground';
  return cachedRoot;
}

/**
 * Absolute path to the playground directory.
 */
export function resolvePlaygroundAbsolute(): string {
  return path.join(process.cwd(), resolvePlaygroundRoot());
}
