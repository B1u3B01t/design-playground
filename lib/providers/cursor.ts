import type { ModelOption } from '../constants';
import type { ProviderConfig, AgentSpawnOptions } from './types';
import {
  CURSOR_FEATURED_MODEL_IDS,
  CURSOR_FALLBACK_MODELS,
  dedupeAutoInModelList,
} from '../model-catalog';

/**
 * Parse the output of `cursor agent models`.
 *
 * Expected format:
 *   Available models
 *
 *   auto - Auto
 *   composer-2.5-fast - Composer 2.5 Fast  (default)
 *   grok-4.3 - Grok 4.3 1M
 *
 *   Tip: use --model <id> ...
 */
function parseModelOutput(stdout: string): ModelOption[] {
  const models: ModelOption[] = [];

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(\S+)\s+-\s+(.+?)(?:\s+\((default|current)\))*\s*$/);
    if (match) {
      const [, value, rawLabel] = match;
      models.push({ value, label: rawLabel.trim() });
    }
  }

  return dedupeAutoInModelList(models);
}

function buildAgentArgs(opts: AgentSpawnOptions): string[] {
  const args = ['agent', '--print', '--force'];
  if (opts.model) args.push('--model', opts.model);
  return args;
}

export const cursorProvider: ProviderConfig = {
  id: 'cursor',
  displayName: 'Cursor',
  binary: 'cursor',
  versionFlag: '--version',
  notFoundMessage:
    'Cursor CLI not found. Install it from cursor.com/docs/cli/installation, then connect in Model Settings.',

  fallbackModels: CURSOR_FALLBACK_MODELS,

  defaultEnabledModels: [...CURSOR_FEATURED_MODEL_IDS],

  buildAgentArgs,
  buildModelListArgs: () => ['agent', 'models'],
  parseModelOutput,
};
