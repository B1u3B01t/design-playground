/** Client-safe Cursor auth messages and error detection (no Node APIs). */

import {
  CURSOR_AUTH_ERROR_PATTERN,
  CURSOR_AUTH_USER_MESSAGE,
} from './cursor-auth-constants';

export { CURSOR_AUTH_ERROR_PATTERN, CURSOR_AUTH_USER_MESSAGE };

export const CURSOR_AUTH_API = '/playground/api/providers/cursor/auth';

export interface CursorAuthStatusResponse {
  success: boolean;
  cliInstalled: boolean;
  authenticated: boolean;
  email: string | null;
  error?: string;
}

export async function fetchCursorAuthStatus(): Promise<CursorAuthStatusResponse> {
  const res = await fetch(CURSOR_AUTH_API);
  const data = (await res.json()) as CursorAuthStatusResponse;
  return data;
}

export async function postCursorLogin(): Promise<{
  success: boolean;
  started?: boolean;
  alreadyInProgress?: boolean;
  error?: string;
}> {
  const res = await fetch(CURSOR_AUTH_API, { method: 'POST' });
  return (await res.json()) as {
    success: boolean;
    started?: boolean;
    alreadyInProgress?: boolean;
    error?: string;
  };
}

export function isCursorAuthError(message: string): boolean {
  return CURSOR_AUTH_ERROR_PATTERN.test(message);
}
