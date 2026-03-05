/**
 * Frontend playground root path resolution.
 *
 * Fetches the playground's relative path from the server once and caches it.
 * Used by prompt generators and import path construction to emit correct
 * file paths regardless of whether the project uses `src/app/playground/`
 * (Next.js) or `src/playground/` (Vite).
 */

import { playgroundFetch } from './api';

let cachedRoot: string | null = null;
let fetchPromise: Promise<string> | null = null;

/**
 * Get the playground's relative path from the project root.
 * Returns the cached value if available, or a default fallback.
 *
 * Call `fetchPlaygroundRoot()` during app init to prime the cache.
 */
export function getPlaygroundRoot(): string {
  return cachedRoot ?? 'src/app/playground';
}

/**
 * Fetch the playground root from the server and cache it.
 * Safe to call multiple times — deduplicates concurrent requests.
 */
export async function fetchPlaygroundRoot(): Promise<string> {
  if (cachedRoot) return cachedRoot;
  if (fetchPromise) return fetchPromise;

  fetchPromise = playgroundFetch('/playground/api/config')
    .then((res) => res.json())
    .then((data: { playgroundRoot: string }) => {
      cachedRoot = data.playgroundRoot;
      return cachedRoot;
    })
    .catch(() => {
      // Fallback if config endpoint is unavailable (e.g. older server)
      cachedRoot = 'src/app/playground';
      return cachedRoot;
    });

  return fetchPromise;
}
