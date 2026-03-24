import type { ModelOption } from '../constants';
import type { ProviderConfig, AgentSpawnOptions } from './types';

/**
 * Parse the output of `cursor agent models`.
 *
 * Expected format:
 *   Available models
 *
 *   auto - Auto
 *   opus-4.6-thinking - Claude 4.6 Opus (Thinking)  (default)
 *   grok - Grok
 *
 *   Tip: use --model <id> ...
 */
function parseModelOutput(stdout: string): ModelOption[] {
  const models: ModelOption[] = [{ value: '', label: 'Auto (Default)' }];

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(\S+)\s+-\s+(.+?)(?:\s+\((default|current)\))*\s*$/);
    if (match) {
      const [, value, rawLabel] = match;
      models.push({ value, label: rawLabel.trim() });
    }
  }

  return models;
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
    'Cursor CLI not found. Make sure `cursor` is installed and in your PATH. Run `cursor agent login` if needed.',

  fallbackModels: [
    { value: 'auto', label: 'Auto (Default)' },
    { value: 'opus-4.6-thinking', label: 'Claude 4.6 Opus (Thinking)' },
    { value: 'opus-4.6', label: 'Claude 4.6 Opus' },
    { value: 'sonnet-4.5', label: 'Claude 4.5 Sonnet' },
    { value: 'gpt-5.2', label: 'GPT-5.2' },
    { value: 'gpt-5.2-codex', label: 'GPT-5.2 Codex' },
    { value: 'gemini-3-pro', label: 'Gemini 3 Pro' },
    { value: 'grok', label: 'Grok' },
  ],

  defaultEnabledModels: [
    'auto',
    'composer-1.5',
    'gpt-5.2',
    'gpt-5.3-codex',
    'sonnet-4.6',
    'sonnet-4.6-thinking',
    'opus-4.6',
    'gemini-3-pro',
    'gemini-3-flash',
  ],

  buildAgentArgs,
  buildModelListArgs: () => ['agent', 'models'],
  parseModelOutput,
};
