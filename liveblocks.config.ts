// Liveblocks global types + client auth/identity helpers for multiplayer Playground.
//
// The canvas (nodes/edges) lives in Liveblocks Storage under the "flow" key, which is
// managed entirely by `useLiveblocksFlow` from @liveblocks/react-flow — so we intentionally
// do NOT declare a `Storage` shape here. We only type the things we touch directly:
// Presence, UserMeta, room broadcast events, and comment thread metadata.

export type FlowCursor = { x: number; y: number };

declare global {
  interface Liveblocks {
    Presence: {
      /** Cursor position in React Flow canvas space (managed by <Cursors>). */
      cursor: FlowCursor | null;
      /** Ids of nodes this user currently has selected. */
      selection: string[];
      /** True while this user (the host) is running a generation. */
      generating: boolean;
    };
    UserMeta: {
      id: string;
      info: {
        name: string;
        color: string;
        avatar?: string;
        /** Whether this participant is the session host (runs the dev server + agent). */
        isHost?: boolean;
      };
    };
    RoomEvent:
      | { type: "generation-started"; label: string }
      | { type: "generation-done" };
    ThreadMetadata: {
      nodeId?: string;
      filename?: string;
    };
  }
}

// ---------------------------------------------------------------------------
// Auth endpoint — the Liveblocks secret stays server-side; the browser only POSTs here.
// Fixed path in this app (no env var — the route always lives next to other playground APIs).
// ---------------------------------------------------------------------------
import "./lib/ngrok-headers";
import { ngrokRequestHeaders } from "./lib/ngrok-headers";

export const LIVEBLOCKS_AUTH_ENDPOINT = "/playground/api/liveblocks-auth";

const USER_ID_KEY = "playground-liveblocks-user-id";
const USER_NAME_KEY = "playground-liveblocks-user-name";

/** Stable per-browser id so a user keeps one identity (and presence color) across reconnects. */
export function getStableUserId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = `u_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

export function getDisplayName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(USER_NAME_KEY) || "";
}

export function setDisplayName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_NAME_KEY, name);
}

/**
 * Host detection (MVP): the Playground desktop app appends `?host=1` to the dev-server
 * iframe it controls; the shareable guest link omits it. This only gates UI affordances —
 * the host's machine still has final say over whether to honor a guest's generate request.
 */
export function isSessionHost(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("host") === "1";
}

/** Liveblocks `authEndpoint` callback — passes our identity in the request body. */
export async function liveblocksAuth(room?: string): Promise<{ token: string }> {
  const res = await fetch(LIVEBLOCKS_AUTH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ngrokRequestHeaders() },
    body: JSON.stringify({
      room,
      userId: getStableUserId(),
      name: getDisplayName(),
      isHost: isSessionHost(),
    }),
  });

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = (await res.json()) as { token?: string; error?: string };
    if (!res.ok) {
      // Import lazily so liveblocks.config stays usable without pulling in sonner on the server.
      const { isLiveblocksSetupError, showLiveblocksSetupToast } = await import(
        "./lib/liveblocks-setup"
      );
      if (isLiveblocksSetupError(data)) showLiveblocksSetupToast();
      throw new Error(data.error ?? `Liveblocks auth failed (${res.status})`);
    }
    if (!data.token) throw new Error("Liveblocks auth returned no token");
    return { token: data.token };
  }

  const body = await res.text();
  const isNgrokInterstitial =
    body.includes("ngrok") &&
    (body.includes("browser-warning") || body.includes("You are about to visit"));
  const detail = res.redirected ? ` (redirected to ${res.url})` : "";
  throw new Error(
    isNgrokInterstitial
      ? "Liveblocks auth hit ngrok's browser warning page. Click 'Visit Site' on the ngrok interstitial, then reload this page."
      : `Liveblocks auth failed: ${res.status} from ${LIVEBLOCKS_AUTH_ENDPOINT}${detail}. ` +
          `Expected JSON but got ${res.headers.get("content-type") ?? "unknown content-type"}.`,
  );
}
