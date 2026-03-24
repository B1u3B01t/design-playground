import type { ProviderId, ProviderConfig } from './types';
import { cursorProvider } from './cursor';
import { claudeCodeProvider } from './claude-code';

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

const PROVIDERS = new Map<ProviderId, ProviderConfig>([
  [cursorProvider.id, cursorProvider],
  [claudeCodeProvider.id, claudeCodeProvider],
]);

export const DEFAULT_PROVIDER_ID: ProviderId = 'cursor';

/** Get a provider config by ID. Throws if the ID is not registered. */
export function getProvider(id: ProviderId): ProviderConfig {
  const config = PROVIDERS.get(id);
  if (!config) {
    throw new Error(`Unknown provider: ${id}`);
  }
  return config;
}

/** Get all registered provider configs. */
export function getAllProviders(): ProviderConfig[] {
  return Array.from(PROVIDERS.values());
}

/** Get all registered provider IDs. */
export function getAllProviderIds(): ProviderId[] {
  return Array.from(PROVIDERS.keys());
}
