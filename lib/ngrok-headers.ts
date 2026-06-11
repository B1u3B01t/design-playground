const TUNNEL_BYPASS_HEADERS = {
  "ngrok-skip-browser-warning": "true",
} as const;

/** True when not served from loopback — covers ngrok, localhost.run, LAN IPs, custom tunnel domains. */
export function isTunnelHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]";
}

/** @deprecated Use isTunnelHost — kept for call sites that referenced the old name. */
export function isNgrokHost(): boolean {
  return isTunnelHost();
}

/** Request headers that skip ngrok's free-tier browser interstitial. */
export function ngrokRequestHeaders(): Record<string, string> {
  return isTunnelHost() ? { ...TUNNEL_BYPASS_HEADERS } : {};
}

let fetchPatched = false;

function isSameOriginRequest(input: RequestInfo | URL): boolean {
  if (typeof window === "undefined") return false;
  const href =
    input instanceof Request
      ? input.url
      : input instanceof URL
        ? input.href
        : input;
  if (href.startsWith("/")) return true;
  try {
    return new URL(href, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

function applyTunnelBypassHeaders(headers: Headers): void {
  for (const [key, value] of Object.entries(TUNNEL_BYPASS_HEADERS)) {
    headers.set(key, value);
  }
}

/**
 * Patch global fetch so same-origin requests include tunnel-bypass headers.
 * Must run synchronously at module load — Liveblocks auth fires on first render.
 */
export function installNgrokFetchPatch(): void {
  if (typeof window === "undefined" || fetchPatched || !isTunnelHost()) return;
  // beforeInteractive script in playground/layout.tsx may have patched already.
  if ((window as Window & { __playgroundTunnelFetchPatched?: boolean }).__playgroundTunnelFetchPatched) {
    fetchPatched = true;
    return;
  }
  fetchPatched = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isSameOriginRequest(input)) return originalFetch(input, init);

    if (input instanceof Request) {
      const headers = new Headers(input.headers);
      applyTunnelBypassHeaders(headers);
      return originalFetch(new Request(input, { headers }), init);
    }

    const headers = new Headers(init?.headers);
    applyTunnelBypassHeaders(headers);
    return originalFetch(input, { ...init, headers });
  };
}

// Install before React renders or Liveblocks authenticates.
if (typeof window !== "undefined") {
  installNgrokFetchPatch();
}
