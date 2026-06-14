import type { ProviderId } from './providers/types';
import { getProvider } from './providers/registry';
import { migrateModelId, normalizeAutoModelId } from './model-catalog';

/**
 * Map client model selection to a value the active provider CLI accepts.
 * Cursor supports `auto`; Claude Code does not — omit or use a real model id.
 */
export function resolveAgentModel(
  providerId: ProviderId,
  model?: string | null,
): string | undefined {
  const trimmed = model?.trim();
  const config = getProvider(providerId);
  const migrated = trimmed ? migrateModelId(providerId, trimmed) : trimmed;

  if (providerId === 'claude-code') {
    if (!migrated || migrated === 'auto') {
      return config.defaultEnabledModels[0];
    }
    return migrated;
  }

  if (providerId === 'codex') {
    // Empty string = CLI default; omit `-m`.
    if (!migrated || migrated === 'auto') return undefined;
    return migrated;
  }

  // Cursor — `auto` is valid
  if (!migrated) return 'auto';
  return normalizeAutoModelId(migrated);
}
