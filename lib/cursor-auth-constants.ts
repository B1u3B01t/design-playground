/** Shared Cursor auth messages and error detection (no Node or client APIs). */

export const CURSOR_AUTH_ERROR_PATTERN =
  /not\s+logged\s+in|unauthorized|authentication|auth\s+required|invalid\s+api\s+key|cursor is not connected/i;

export const CURSOR_AUTH_USER_MESSAGE =
  'Connect Cursor to generate AI variations.';
