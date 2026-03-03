import { useState, useCallback, useEffect, useRef } from 'react';

type ShareState = 'idle' | 'connecting' | 'copied' | 'error';

// ── Module-level flag: only register the beforeunload handler once ───────────
// (every node mounts its own hook instance; we don't want N listeners)
let unloadRegistered = false;

function ensureUnloadCleanup() {
  if (unloadRegistered) return;
  unloadRegistered = true;

  // sendBeacon is the only reliable way to fire a request on tab close —
  // fetch() is cancelled by the browser before it completes.
  // We POST to a dedicated teardown endpoint with beacon (no body needed).
  window.addEventListener('beforeunload', () => {
    // Prefer sendBeacon (fire-and-forget, browser guarantees delivery)
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/playground/api/tunnel/beacon');
    } else {
      // Synchronous XHR fallback — only works in some browsers on unload
      const xhr = new XMLHttpRequest();
      xhr.open('DELETE', '/playground/api/tunnel', false /* sync */);
      xhr.send();
    }
  });
}

/**
 * Hook that manages the localhost.run tunnel and copies a public shareable
 * link for a specific component/iteration path.
 *
 * `componentPath` is the slug used by the /playground/iterations/[slug] page
 * — same value you'd pass to `window.open(...)` in "Open in new tab".
 */
export function useTunnelShare(componentPath: string) {
  const [state, setState] = useState<ShareState>('idle');
  // Track in-flight timeouts so we can clear them if the component unmounts
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Register the tab-close cleanup once, globally
  useEffect(() => {
    ensureUnloadCleanup();
  }, []);

  // Clean up any pending state-reset timers on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const share = useCallback(async () => {
    if (state === 'connecting') return;

    setState('connecting');

    try {
      // Derive the port from the current browser URL
      const port = Number(window.location.port) || (window.location.protocol === 'https:' ? 443 : 80);

      // 1. Check if tunnel is already running
      const checkRes = await fetch('/playground/api/tunnel');
      const checkData = await checkRes.json();

      let tunnelBaseUrl: string;

      if (checkData.url && checkData.port === port) {
        tunnelBaseUrl = checkData.url;
      } else {
        // 2. Start a new tunnel
        const startRes = await fetch('/playground/api/tunnel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ port }),
        });
        const startData = await startRes.json();

        if (!startRes.ok || !startData.url) {
          console.error('[useTunnelShare] Tunnel error:', startData.error);
          setState('error');
          timeoutRef.current = setTimeout(() => setState('idle'), 2000);
          return;
        }
        tunnelBaseUrl = startData.url;
      }

      // 3. Build the full shareable URL
      const shareUrl = `${tunnelBaseUrl}/playground/iterations/${componentPath}`;

      // 4. Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      setState('copied');
      timeoutRef.current = setTimeout(() => setState('idle'), 2000);
    } catch (err) {
      console.error('[useTunnelShare] Failed:', err);
      setState('error');
      timeoutRef.current = setTimeout(() => setState('idle'), 2000);
    }
  }, [componentPath, state]);

  return { share, state };
}
