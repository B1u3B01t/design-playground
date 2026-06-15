import { useModelSettingsStore } from './model-settings-store';
import { useCursorAuthStore } from '../hooks/useCursorAuth';

/** When Cursor is the active provider, ensure the CLI is authenticated. */
export async function requireCursorAuthIfNeeded(): Promise<boolean> {
  const provider = useModelSettingsStore.getState().activeProvider;
  if (provider !== 'cursor') return true;
  return useCursorAuthStore.getState().requireAuth();
}

/** Optional explicit provider check (discover passes provider in body). */
export async function requireCursorAuthForProvider(provider?: unknown): Promise<boolean> {
  const resolved =
    typeof provider === 'string'
      ? provider
      : useModelSettingsStore.getState().activeProvider;
  if (resolved !== 'cursor') return true;
  return useCursorAuthStore.getState().requireAuth();
}
