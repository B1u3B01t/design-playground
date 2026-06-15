'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { cancelCursorAuthPolling, useCursorAuth } from './hooks/useCursorAuth';

const CURSOR_CLI_INSTALL_URL = 'https://cursor.com/docs/cli/installation';

interface ConnectCursorPanelProps {
  /** When true, refresh auth status on mount. */
  active?: boolean;
  compact?: boolean;
}

export default function ConnectCursorPanel({ active = true, compact = false }: ConnectCursorPanelProps) {
  const {
    authenticated,
    cliInstalled,
    isConnecting,
    connectTimedOut,
    lastError,
    refresh,
    startLogin,
  } = useCursorAuth();

  useEffect(() => {
    if (active) void refresh();
    return () => {
      cancelCursorAuthPolling();
    };
  }, [active, refresh]);

  if (!active) return null;

  if (authenticated) return null;

  const statusLabel = (() => {
    if (authenticated === null) return 'Checking connection…';
    if (isConnecting) return 'Waiting for sign-in…';
    if (connectTimedOut) return 'Sign-in timed out';
    return 'Not connected';
  })();

  const statusClass = isConnecting
    ? 'bg-amber-50 text-amber-800 border-amber-200'
    : 'bg-stone-50 text-stone-600 border-stone-200';

  return (
    <div
      className={`rounded-lg border border-stone-200 bg-stone-50/80 ${compact ? 'p-2.5' : 'p-3'} space-y-2`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-stone-700">Cursor account</span>
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusClass}`}
        >
          {statusLabel}
        </span>
      </div>

      {!cliInstalled && (
        <p className="text-[11px] text-stone-500 leading-relaxed">
          Cursor CLI is not installed.{' '}
          <a
            href={CURSOR_CLI_INSTALL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-700 underline underline-offset-2 hover:text-stone-900"
          >
            Install Cursor CLI
          </a>{' '}
          then return here to sign in.
        </p>
      )}

      {cliInstalled && !authenticated && (
        <>
          {isConnecting ? (
            <p className="text-[11px] text-stone-500 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
              Complete sign-in in the browser tab that just opened.
            </p>
          ) : connectTimedOut ? (
            <p className="text-[11px] text-stone-500">
              Didn&apos;t finish? Click below to try again.
            </p>
          ) : (
            <p className="text-[11px] text-stone-500">
              Sign in once to generate variations with Cursor.
            </p>
          )}

          <button
            type="button"
            onClick={() => void startLogin()}
            disabled={isConnecting}
            className="w-full px-3 py-2 text-xs font-medium text-white bg-stone-800 hover:bg-stone-900 disabled:opacity-60 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            {isConnecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isConnecting ? 'Signing in…' : 'Sign in with Cursor'}
          </button>
        </>
      )}

      {lastError && (
        <p className="text-[11px] text-red-600/90">{lastError}</p>
      )}

      {authenticated === null && (
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-[11px] text-stone-500 hover:text-stone-700 underline underline-offset-2"
        >
          Refresh status
        </button>
      )}
    </div>
  );
}
