"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { LIVEBLOCKS_AUTH_ENDPOINT } from "../liveblocks.config";
import { ngrokRequestHeaders } from "./ngrok-headers";

export const LIVEBLOCKS_SETUP_TOAST_ID = "liveblocks-setup";

const SETUP_MESSAGE_ELECTRON =
  "Multiplayer needs a Liveblocks secret key. " +
  "Get one from liveblocks.io/dashboard, then add it in Playground → Settings → Multiplayer.";

const SETUP_MESSAGE_STANDALONE =
  "Multiplayer needs LIVEBLOCKS_SECRET_KEY in .env.local. " +
  "Get a secret key from liveblocks.io/dashboard, add LIVEBLOCKS_SECRET_KEY=sk_…, then restart npm run dev.";

function isElectronContext(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { electron?: unknown };
  if (w.electron) return true;
  return /Electron|Playground/i.test(navigator.userAgent || "");
}

function setupMessage(): string {
  return isElectronContext() ? SETUP_MESSAGE_ELECTRON : SETUP_MESSAGE_STANDALONE;
}

/** Show a deduped setup toast (safe to call multiple times). */
export function showLiveblocksSetupToast(): void {
  toast.error(setupMessage(), {
    id: LIVEBLOCKS_SETUP_TOAST_ID,
    duration: 12_000,
  });
}

/** True when the auth route reports the server secret is missing. */
export function isLiveblocksSetupError(payload: unknown): boolean {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { error?: string }).error === "missing_secret_key"
  );
}

/** Probe the local auth route once when entering a multiplayer session. */
export async function checkLiveblocksConfigured(): Promise<boolean> {
  try {
    const res = await fetch(LIVEBLOCKS_AUTH_ENDPOINT, {
      method: "GET",
      headers: ngrokRequestHeaders(),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { configured?: boolean };
    return !!data.configured;
  } catch {
    return false;
  }
}

/** Mount inside PlaygroundClient when `roomId` is set — surfaces missing config early. */
export function LiveblocksSetupGuard(): null {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const configured = await checkLiveblocksConfigured();
      if (!cancelled && !configured) showLiveblocksSetupToast();
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
