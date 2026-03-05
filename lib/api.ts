/**
 * Playground API helper.
 *
 * Provides a `playgroundFetch()` wrapper that prepends the correct API base URL.
 *
 * - Next.js / Vite plugin: base is '' (same-origin, default)
 * - Standalone server: set `window.__PLAYGROUND_API_BASE = 'http://localhost:4800'`
 */

declare global {
  interface Window {
    __PLAYGROUND_API_BASE?: string;
  }
}

function getApiBase(): string {
  if (typeof window !== 'undefined' && window.__PLAYGROUND_API_BASE) {
    return window.__PLAYGROUND_API_BASE;
  }
  return '';
}

/**
 * Fetch wrapper that prepends the playground API base URL.
 * Drop-in replacement for `fetch('/playground/api/...')`.
 */
export function playgroundFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${getApiBase()}${path}`, init);
}

/**
 * Returns the full URL for a playground API path.
 * Use for `window.open()`, `sendBeacon()`, etc.
 */
export function playgroundApiUrl(path: string): string {
  return `${getApiBase()}${path}`;
}
