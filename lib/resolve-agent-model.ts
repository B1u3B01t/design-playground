import type { ProviderId } from './providers/types';
import { getProvider } from './providers/registry';

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

  if (providerId === 'claude-code') {
    if (!trimmed || trimmed === 'auto') {
      return config.defaultEnabledModels[0];
    }
    return trimmed;
  }

  // Cursor — `auto` is valid
  if (!trimmed) return 'auto';
  return trimmed;
}
