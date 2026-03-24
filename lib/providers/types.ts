import type { ModelOption } from '../constants';

// ---------------------------------------------------------------------------
// Provider Identification
// ---------------------------------------------------------------------------

/** Supported CLI provider identifiers */
export type ProviderId = 'cursor' | 'claude-code';

// ---------------------------------------------------------------------------
// Agent Spawn Options
// ---------------------------------------------------------------------------

/** Options passed to `spawnAgent()`. Provider-specific fields are ignored by providers that don't support them. */
export interface AgentSpawnOptions {
  model?: string;
  /** Claude Code only — reasoning effort level */
  effort?: 'low' | 'medium' | 'high' | 'max';
  /** Claude Code only — maximum dollar spend before stopping */
  maxBudgetUsd?: number;
  /** Claude Code only — maximum number of agentic turns */
  maxTurns?: number;
}

// ---------------------------------------------------------------------------
// Provider Configuration
// ---------------------------------------------------------------------------

/** Static configuration for a CLI provider. Pure data + pure functions — no side effects. */
export interface ProviderConfig {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly binary: string;
  readonly versionFlag: string;
  readonly notFoundMessage: string;
  readonly fallbackModels: ModelOption[];
  readonly defaultEnabledModels: string[];

  /** Build CLI args for agent (non-interactive) mode. */
  buildAgentArgs(opts: AgentSpawnOptions): string[];

  /** Args to list available models, or `null` if the provider doesn't support dynamic model listing. */
  buildModelListArgs(): string[] | null;

  /** Parse CLI model-list stdout into `ModelOption[]`. Only required when `buildModelListArgs()` is non-null. */
  parseModelOutput?(stdout: string): ModelOption[];
}

// ---------------------------------------------------------------------------
// Claude Code-Specific Options (persisted in the client store)
// ---------------------------------------------------------------------------

export interface ClaudeCodeOptions {
  effort: 'low' | 'medium' | 'high' | 'max';
  maxBudgetUsd: number | null;
  maxTurns: number | null;
}

export const DEFAULT_CLAUDE_CODE_OPTIONS: ClaudeCodeOptions = {
  effort: 'high',
  maxBudgetUsd: null,
  maxTurns: null,
};
