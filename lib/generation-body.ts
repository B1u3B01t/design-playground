import { useModelSettingsStore } from './model-settings-store';

/**
 * Build the request body fields for provider-aware generation API calls.
 * Reads the active provider and Claude Code options from the model settings store.
 *
 * Usage: `{ ...basePayload, ...getProviderFields() }`
 */
export function getProviderFields(): Record<string, unknown> {
  const state = useModelSettingsStore.getState();
  const { activeProvider, claudeCodeOptions } = state;

  const fields: Record<string, unknown> = { provider: activeProvider };

  if (activeProvider === 'claude-code') {
    if (claudeCodeOptions.effort) fields.effort = claudeCodeOptions.effort;
    if (claudeCodeOptions.maxBudgetUsd != null) fields.maxBudgetUsd = claudeCodeOptions.maxBudgetUsd;
    if (claudeCodeOptions.maxTurns != null) fields.maxTurns = claudeCodeOptions.maxTurns;
  }

  return fields;
}
