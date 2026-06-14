import type { ProviderConfig, AgentSpawnOptions } from './types';

function buildAgentArgs(opts: AgentSpawnOptions): string[] {
  const sandbox = opts.codexSandbox ?? 'workspace-write';
  const args = ['exec', '--skip-git-repo-check', '-s', sandbox];

  // Like Claude's claudeDetailedStdout: only emit JSONL when explicitly requested,
  // so callers that omit the flag (discover, design, evals) get plain text.
  if (opts.codexDetailedStdout) {
    args.push('--json');
  }

  if (opts.model) {
    args.push('-m', opts.model);
  }

  if (opts.codexReasoningEffort) {
    args.push('-c', `model_reasoning_effort="${opts.codexReasoningEffort}"`);
  }

  if (sandbox === 'workspace-write') {
    args.push('-c', 'sandbox_workspace_write.network_access=true');
  }

  return args;
}

export const codexProvider: ProviderConfig = {
  id: 'codex',
  displayName: 'Codex',
  binary: 'codex',
  versionFlag: '--version',
  notFoundMessage:
    'Codex CLI not found. Install via: npm install -g @openai/codex — then run `codex login`.',

  // Verified against `~/.codex/models_cache.json` — ChatGPT-account users only
  // get these slugs (e.g. `gpt-5.5-codex` is rejected with a 400).
  fallbackModels: [
    { value: '', label: 'Default (CLI config)' },
    { value: 'gpt-5.5', label: 'GPT-5.5' },
    { value: 'gpt-5.4', label: 'GPT-5.4' },
    { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
  ],

  defaultEnabledModels: ['', 'gpt-5.5', 'gpt-5.4'],

  buildAgentArgs,

  // Codex has no `models` subcommand — return null to use fallbackModels.
  buildModelListArgs: () => null,
};
