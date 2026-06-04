import { useState, useCallback, useEffect, useRef } from 'react';

export type ShareState = 'idle' | 'connecting' | 'copied' | 'error' | 'disabled';

interface TunnelConfig {
  hasToken: boolean;
  source: 'agent' | 'env' | 'none';
}

const TOOLTIP_ELECTRON =
  'Sharing is disabled. Add your ngrok auth token in Playground → Settings → Sharing.';
const TOOLTIP_STANDALONE =
  'Sharing is disabled. Set NGROK_AUTHTOKEN in your environment to enable.';

function isElectronContext(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { electron?: unknown };
  if (w.electron) return true;
  return /Electron|Playground/i.test(navigator.userAgent || '');
}

/**
 * Manages the ngrok tunnel and copies a public link for a component/iteration.
 *
 * `sharePath` can be:
 * - a registry/iteration slug (e.g. "pricing-card") → /playground/iterations/[slug]
 * - an absolute app path starting with "/" (e.g. "/landing/index.html") → used as-is
 */
export function useTunnelShare(sharePath: string) {
  const [state, setState] = useState<ShareState>('idle');
  const [disabledTooltip, setDisabledTooltip] = useState<string>(TOOLTIP_STANDALONE);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch /config on mount and on window focus so the button reflects current
  // token availability without a full reload.
  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const res = await fetch('/playground/api/tunnel/config');
        const cfg = (await res.json()) as TunnelConfig;
        if (cancelled) return;
        if (cfg.source === 'none') {
          setDisabledTooltip(isElectronContext() ? TOOLTIP_ELECTRON : TOOLTIP_STANDALONE);
          setState((prev) => (prev === 'idle' || prev === 'disabled' ? 'disabled' : prev));
        } else {
          setState((prev) => (prev === 'disabled' ? 'idle' : prev));
        }
      } catch {
        // If config probe fails, leave state alone — the user can still try.
      }
    };

    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const share = useCallback(async () => {
    if (state === 'connecting' || state === 'disabled') return;

    setState('connecting');

    try {
      const port = Number(window.location.port) || (window.location.protocol === 'https:' ? 443 : 80);

      const startRes = await fetch('/playground/api/tunnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port }),
      });
      const startData = await startRes.json();

      if (startRes.status === 400 && startData.error === 'no_token') {
        setDisabledTooltip(isElectronContext() ? TOOLTIP_ELECTRON : TOOLTIP_STANDALONE);
        setState('disabled');
        return;
      }

      if (!startRes.ok || !startData.url) {
        console.error('[useTunnelShare] Tunnel error:', startData.error);
        setState('error');
        timeoutRef.current = setTimeout(() => setState('idle'), 2000);
        return;
      }

      const normalizedBase = (startData.url as string).replace(/\/$/, '');
      const shareUrl = sharePath.startsWith('/')
        ? `${normalizedBase}${sharePath}`
        : `${normalizedBase}/playground/iterations/${sharePath}`;

      await navigator.clipboard.writeText(shareUrl);
      setState('copied');
      timeoutRef.current = setTimeout(() => setState('idle'), 2000);
    } catch (err) {
      console.error('[useTunnelShare] Failed:', err);
      setState('error');
      timeoutRef.current = setTimeout(() => setState('idle'), 2000);
    }
  }, [sharePath, state]);

  return { share, state, disabledTooltip };
}
