import type { ModelOption } from '../constants';

// ---------------------------------------------------------------------------
// Provider Identification
// ---------------------------------------------------------------------------

/** Supported CLI provider identifiers */
export type ProviderId = 'cursor' | 'claude-code' | 'codex';

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
  /**
   * Claude Code only — when true, use `--output-format stream-json` with
   * `--include-partial-messages` for live UI parsing (not written to chat `.txt`).
   * When false/omitted, use `text` and log stdout to the chat file.
   */
  claudeDetailedStdout?: boolean;
  /** Codex only — sandbox policy for `codex exec -s` */
  codexSandbox?: 'workspace-write' | 'danger-full-access';
  /** Codex only — reasoning effort via `-c model_reasoning_effort=...` */
  codexReasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
  /**
   * Codex only — when true, use `codex exec --json` for live UI parsing.
   * When false/omitted, plain stdout is logged to the chat file.
   */
  codexDetailedStdout?: boolean;
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
  /** When true, stream-json for live tooltip; chat download omits raw stream. When false, plain text in chat log. */
  detailedStdout: boolean;
}

export const DEFAULT_CLAUDE_CODE_OPTIONS: ClaudeCodeOptions = {
  effort: 'high',
  maxBudgetUsd: null,
  maxTurns: null,
  detailedStdout: true,
};

// ---------------------------------------------------------------------------
// Codex-Specific Options (persisted in the client store)
// ---------------------------------------------------------------------------

export interface CodexOptions {
  sandbox: 'workspace-write' | 'danger-full-access';
  reasoningEffort: 'low' | 'medium' | 'high' | 'xhigh';
  /** When true, `--json` for live tooltip; chat download omits raw JSONL. */
  detailedStdout: boolean;
}

export const DEFAULT_CODEX_OPTIONS: CodexOptions = {
  sandbox: 'workspace-write',
  reasoningEffort: 'high',
  detailedStdout: true,
};
