import type { ProviderConfig, AgentSpawnOptions } from './types';
import { CLAUDE_FALLBACK_MODELS, CLAUDE_FEATURED_MODEL_IDS } from '../model-catalog';

function buildAgentArgs(opts: AgentSpawnOptions): string[] {
  const args = ['-p', '--dangerously-skip-permissions', '--verbose'];
  if (opts.claudeDetailedStdout) {
    args.push('--output-format', 'stream-json', '--include-partial-messages');
  } else {
    args.push('--output-format', 'text');
  }
  if (opts.model)        args.push('--model', opts.model);
  if (opts.effort)       args.push('--effort', opts.effort);
  if (opts.maxBudgetUsd) args.push('--max-budget-usd', String(opts.maxBudgetUsd));
  if (opts.maxTurns)     args.push('--max-turns', String(opts.maxTurns));
  return args;
}

export const claudeCodeProvider: ProviderConfig = {
  id: 'claude-code',
  displayName: 'Claude Code',
  binary: 'claude',
  versionFlag: '--version',
  notFoundMessage:
    'Claude Code CLI not found. Install via: npm install -g @anthropic-ai/claude-code',

  // Claude Code has no `models` list subcommand — catalog from official docs.
  fallbackModels: CLAUDE_FALLBACK_MODELS,

  defaultEnabledModels: [...CLAUDE_FEATURED_MODEL_IDS],

  buildAgentArgs,

  // No CLI model listing — /playground/api/models serves fallbackModels.
  buildModelListArgs: () => null,
};
