import type { ProviderConfig, AgentSpawnOptions } from './types';

function buildAgentArgs(opts: AgentSpawnOptions): string[] {
  const args = [
    '-p',
    '--dangerously-skip-permissions',
    '--output-format', 'text',
    '--verbose',
  ];
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

  fallbackModels: [
    { value: 'sonnet', label: 'Claude Sonnet (Latest)' },
    { value: 'opus', label: 'Claude Opus (Latest)' },
    { value: 'haiku', label: 'Claude Haiku (Fast)' },
    { value: 'opusplan', label: 'Opus Plan + Sonnet Execute' },
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  ],

  defaultEnabledModels: ['sonnet', 'opus', 'haiku'],

  buildAgentArgs,

  // Claude Code has no `models` subcommand — return null to use fallbackModels.
  buildModelListArgs: () => null,
};
