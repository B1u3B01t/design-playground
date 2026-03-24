import { spawn, type ChildProcess } from 'child_process';
import type { ProviderId, AgentSpawnOptions } from './types';
import { getProvider } from './registry';

/**
 * Spawn an agent process for the given provider.
 *
 * This is a thin wrapper — it only handles provider-specific argument construction.
 * Process lifecycle management (lockfiles, log streams, event emitters) is the
 * caller's responsibility, since it varies by route.
 */
export function spawnAgent(
  providerId: ProviderId,
  opts: AgentSpawnOptions,
  cwd: string,
): ChildProcess {
  const config = getProvider(providerId);
  const args = config.buildAgentArgs(opts);

  return spawn(config.binary, args, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });
}

/** Get the user-facing error message for when a provider CLI is not found (ENOENT). */
export function getProviderNotFoundMessage(providerId: ProviderId): string {
  return getProvider(providerId).notFoundMessage;
}

/** Get the human-readable display name for a provider (e.g. "Cursor", "Claude Code"). */
export function getProviderDisplayName(providerId: ProviderId): string {
  return getProvider(providerId).displayName;
}
