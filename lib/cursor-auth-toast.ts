'use client';

import { toast } from 'sonner';
import { useCursorAuthStore } from '../hooks/useCursorAuth';

export const CURSOR_AUTH_TOAST_ID = 'cursor-auth-required';

/** Persistent toast prompting Cursor sign-in — stays until dismissed or auth succeeds. */
export function showCursorAuthToast(message?: string): void {
  toast(message ?? 'Connect Cursor to generate AI variations.', {
    id: CURSOR_AUTH_TOAST_ID,
    duration: Infinity,
    closeButton: true,
    dismissible: true,
    action: {
      label: 'Sign in with Cursor',
      onClick: () => void useCursorAuthStore.getState().startLogin(),
    },
  });
}

export function dismissCursorAuthToast(): void {
  toast.dismiss(CURSOR_AUTH_TOAST_ID);
}
