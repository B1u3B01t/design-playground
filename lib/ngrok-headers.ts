/** True when the playground is being served through an ngrok tunnel. */
export function isNgrokHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    /\.ngrok-free\.(dev|app)$/i.test(host) ||
    /\.ngrok\.(io|app)$/i.test(host)
  );
}

/** Request headers that skip ngrok's free-tier browser interstitial. */
export function ngrokRequestHeaders(): Record<string, string> {
  return isNgrokHost() ? { "ngrok-skip-browser-warning": "true" } : {};
}
