'use client';

import { create } from 'zustand';
import {
  fetchCursorAuthStatus,
  postCursorLogin,
  type CursorAuthStatusResponse,
} from '../lib/cursor-auth-client';
import { dismissCursorAuthToast, showCursorAuthToast } from '../lib/cursor-auth-toast';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

interface CursorAuthStore {
  authenticated: boolean | null;
  email: string | null;
  cliInstalled: boolean;
  isConnecting: boolean;
  connectTimedOut: boolean;
  lastError: string | null;
  refresh: () => Promise<CursorAuthStatusResponse>;
  startLogin: () => Promise<void>;
  /** Returns true when Cursor auth is satisfied. */
  requireAuth: () => Promise<boolean>;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollStartedAt = 0;

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function applyStatus(
  set: (partial: Partial<CursorAuthStore>) => void,
  data: CursorAuthStatusResponse,
) {
  set({
    authenticated: data.authenticated,
    email: data.email,
    cliInstalled: data.cliInstalled,
    lastError: data.error ?? null,
  });
}

export const useCursorAuthStore = create<CursorAuthStore>((set, get) => ({
  authenticated: null,
  email: null,
  cliInstalled: false,
  isConnecting: false,
  connectTimedOut: false,
  lastError: null,

  refresh: async () => {
    const data = await fetchCursorAuthStatus();
    applyStatus(set, data);
    if (data.authenticated) {
      set({ isConnecting: false, connectTimedOut: false });
      dismissCursorAuthToast();
      stopPolling();
    }
    return data;
  },

  startLogin: async () => {
    set({ isConnecting: true, connectTimedOut: false, lastError: null });
    stopPolling();

    const result = await postCursorLogin();
    if (!result.success && !result.alreadyInProgress) {
      set({
        isConnecting: false,
        lastError: result.error ?? 'Could not start sign-in.',
      });
      showCursorAuthToast(result.error ?? 'Could not start sign-in. Try again.');
      return;
    }

    showCursorAuthToast('Complete sign-in in the browser tab that just opened.');

    pollStartedAt = Date.now();
    await get().refresh();

    pollTimer = setInterval(async () => {
      const data = await get().refresh();
      if (data.authenticated) {
        stopPolling();
        return;
      }
      if (Date.now() - pollStartedAt >= POLL_TIMEOUT_MS) {
        stopPolling();
        set({ isConnecting: false, connectTimedOut: true });
        showCursorAuthToast('Sign-in timed out. Open Model Settings to try again.');
      }
    }, POLL_INTERVAL_MS);
  },

  requireAuth: async () => {
    const data = await get().refresh();
    if (data.authenticated) return true;
    showCursorAuthToast();
    return false;
  },
}));

/** Stop login polling without clearing timeout/error state. */
export function cancelCursorAuthPolling(): void {
  const wasPolling = pollTimer !== null;
  stopPolling();
  if (wasPolling) {
    useCursorAuthStore.setState({ isConnecting: false });
  }
}

/** Hook wrapper for components that need reactive auth state. */
export function useCursorAuth() {
  const authenticated = useCursorAuthStore((s) => s.authenticated);
  const email = useCursorAuthStore((s) => s.email);
  const cliInstalled = useCursorAuthStore((s) => s.cliInstalled);
  const isConnecting = useCursorAuthStore((s) => s.isConnecting);
  const connectTimedOut = useCursorAuthStore((s) => s.connectTimedOut);
  const lastError = useCursorAuthStore((s) => s.lastError);
  const refresh = useCursorAuthStore((s) => s.refresh);
  const startLogin = useCursorAuthStore((s) => s.startLogin);
  const requireAuth = useCursorAuthStore((s) => s.requireAuth);

  return {
    authenticated,
    email,
    cliInstalled,
    isConnecting,
    connectTimedOut,
    lastError,
    refresh,
    startLogin,
    requireAuth,
  };
}
