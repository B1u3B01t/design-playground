// ============================================================================
// Telemetry Event Schema + Sanitizer (isomorphic, pure — no Node/browser APIs)
//
// This is THE privacy boundary: every event passes through sanitizeEvent()
// before it can leave the machine (enforced at the API route ingress AND
// again inside the server module). Only the events and properties declared
// here can ever be sent, and no free-form string can pass — strings must
// match a declared enum (or, for the few "pattern" props, a strict regex).
// Prompts, code, file paths, component names, room ids, and error messages
// are structurally impossible to transmit.
// ============================================================================

import type { TelemetryEventName } from './constants';

type PropSpec =
  | { kind: 'boolean' }
  | { kind: 'number'; min: number; max: number; integer?: boolean; nullable?: boolean }
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'enum-array'; values: readonly string[]; maxLen: number }
  | { kind: 'pattern'; pattern: RegExp; maxLen: number };

export type SanitizedProps = Record<
  string,
  string | number | boolean | string[] | null
>;

// ---------------------------------------------------------------------------
// Allowed values
// ---------------------------------------------------------------------------

const PROVIDERS = ['cursor', 'claude-code', 'codex'] as const;

/**
 * Known model ids across providers (cursor fallback/default lists, Claude Code
 * static models, Codex static models). Anything not in this list is reported
 * as 'custom' — model strings can be user-typed, so they are never forwarded
 * verbatim. Extend when providers add models; unknown ids degrade gracefully.
 */
export const KNOWN_MODELS = [
  'auto',
  'default',
  // cursor
  'opus-4.6-thinking',
  'opus-4.6',
  'sonnet-4.5',
  'sonnet-4.6',
  'sonnet-4.6-thinking',
  'composer-1.5',
  'gpt-5.2',
  'gpt-5.2-codex',
  'gpt-5.3-codex',
  'gemini-3-pro',
  'gemini-3-flash',
  'grok',
  // claude-code
  'sonnet',
  'opus',
  'haiku',
  'opusplan',
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  // codex
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
] as const;

const MODEL_VALUES = [...KNOWN_MODELS, 'custom'] as const;

/** Builtin skill ids (directories in skills/). Custom/user skills → 'custom'. */
export const BUILTIN_SKILLS = [
  'design-variations',
  'frontend-design',
  'make-interfaces-feel-better',
  'no-bound-explore',
  'nothing-design',
  'stick-to-design-system',
  'ux-variation-designer',
] as const;

const SKILL_VALUES = [...BUILTIN_SKILLS, 'custom'] as const;

const GENERATION_SOURCES = [
  'dialog',
  'drag',
  'chat',
  'chat_edit',
  'chat_freeform',
  'new_page',
  'adopt',
  'unknown',
] as const;

const EFFORT_VALUES = ['low', 'medium', 'high', 'max', 'xhigh', 'default'] as const;

const RENDER_MODES = ['react', 'html', 'jsx'] as const;

const FEATURES = [
  'pdf_import',
  'draw',
  'flow_simulator_play',
  'prompt_copied',
  'tunnel_started',
  'multiplayer_session_started',
  'design_system_generated',
] as const;

export type TelemetryFeature = (typeof FEATURES)[number];

const ERROR_CATEGORIES = [
  'cli_not_found',
  'auth_error',
  'timeout',
  'cancelled',
  'exit_nonzero',
  'spawn_error',
] as const;

export type GenerationErrorCategory = (typeof ERROR_CATEGORIES)[number];

const DISCOVERY_OUTCOMES = [
  'success',
  'agent_error',
  'spawn_error',
  'manifest_missing',
  'cancelled',
] as const;

// ---------------------------------------------------------------------------
// Event schema (the allowlist)
// ---------------------------------------------------------------------------

const GENERATION_BASE_PROPS: Record<string, PropSpec> = {
  provider: { kind: 'enum', values: PROVIDERS },
  model: { kind: 'enum', values: MODEL_VALUES },
  iteration_count: { kind: 'number', min: 0, max: 8, integer: true },
  source: { kind: 'enum', values: GENERATION_SOURCES },
  skills: { kind: 'enum-array', values: SKILL_VALUES, maxLen: 5 },
  render_mode: { kind: 'enum', values: RENDER_MODES },
  effort: { kind: 'enum', values: EFFORT_VALUES },
};

export const EVENT_SCHEMA: Record<TelemetryEventName, Record<string, PropSpec>> = {
  setup_completed: {
    provider_cursor: { kind: 'boolean' },
    provider_claude_code: { kind: 'boolean' },
    provider_codex: { kind: 'boolean' },
  },
  session_started: {
    multiplayer_enabled: { kind: 'boolean' },
    multiplayer_configured: { kind: 'boolean' },
    provider_cursor: { kind: 'boolean' },
    provider_claude_code: { kind: 'boolean' },
    provider_codex: { kind: 'boolean' },
    // Salted sha256(anonymousId + projectId) prefix — server-computed only.
    project_hash: { kind: 'pattern', pattern: /^[0-9a-f]{16}$/, maxLen: 16 },
  },
  time_summary: {
    active_seconds: { kind: 'number', min: 0, max: 600, integer: true },
    passive_seconds: { kind: 'number', min: 0, max: 600, integer: true },
    generation_seconds: { kind: 'number', min: 0, max: 600, integer: true },
    window_seconds: { kind: 'number', min: 0, max: 600, integer: true },
    nodes_added_component: { kind: 'number', min: 0, max: 500, integer: true },
    nodes_added_iteration: { kind: 'number', min: 0, max: 500, integer: true },
    nodes_added_image: { kind: 'number', min: 0, max: 500, integer: true },
    nodes_added_pdf: { kind: 'number', min: 0, max: 500, integer: true },
    nodes_added_text: { kind: 'number', min: 0, max: 500, integer: true },
    nodes_added_stage: { kind: 'number', min: 0, max: 500, integer: true },
  },
  discovery_run: {
    duration_ms: { kind: 'number', min: 0, max: 3_600_000, integer: true },
    outcome: { kind: 'enum', values: DISCOVERY_OUTCOMES },
    components_found: { kind: 'number', min: 0, max: 10_000, integer: true },
    pages_found: { kind: 'number', min: 0, max: 10_000, integer: true },
  },
  generation_started: { ...GENERATION_BASE_PROPS },
  generation_completed: {
    ...GENERATION_BASE_PROPS,
    duration_ms: { kind: 'number', min: 0, max: 660_000, integer: true },
    time_to_first_iteration_ms: {
      kind: 'number', min: 0, max: 660_000, integer: true, nullable: true,
    },
    iterations_detected: { kind: 'number', min: 0, max: 50, integer: true },
    lines_added: { kind: 'number', min: 0, max: 100_000, integer: true, nullable: true },
    lines_removed: { kind: 'number', min: 0, max: 100_000, integer: true, nullable: true },
    files_changed: { kind: 'number', min: 0, max: 200, integer: true, nullable: true },
  },
  generation_failed: {
    ...GENERATION_BASE_PROPS,
    duration_ms: { kind: 'number', min: 0, max: 660_000, integer: true },
    error_category: { kind: 'enum', values: ERROR_CATEGORIES },
  },
  code_adopted: {
    kind: { kind: 'enum', values: ['flow', 'iteration'] },
    lines_added: { kind: 'number', min: 0, max: 100_000, integer: true, nullable: true },
    lines_removed: { kind: 'number', min: 0, max: 100_000, integer: true, nullable: true },
    files_changed: { kind: 'number', min: 0, max: 200, integer: true, nullable: true },
  },
  feature_used: {
    feature: { kind: 'enum', values: FEATURES },
    page_count: { kind: 'number', min: 1, max: 500, integer: true, nullable: true },
  },
  error_occurred: {
    area: {
      kind: 'enum',
      values: [
        'component_render',
        'generate_route',
        'discover_route',
        'design_route',
        'telemetry_internal',
      ],
    },
    category: { kind: 'enum', values: ['render_error', 'route_exception'] },
  },
  telemetry_opt_out: {
    method: { kind: 'enum', values: ['ui'] },
  },
};

/**
 * Events the local API route accepts from the browser. Everything else
 * (generation/discovery stats, opt-out) is server-originated only, so a
 * malicious page script can't inject fake product stats.
 */
export const CLIENT_ALLOWED_EVENTS: readonly TelemetryEventName[] = [
  'session_started',
  'time_summary',
  'feature_used',
  'error_occurred',
];

// ---------------------------------------------------------------------------
// Sanitizer
// ---------------------------------------------------------------------------

function isEventName(name: string): name is TelemetryEventName {
  return Object.prototype.hasOwnProperty.call(EVENT_SCHEMA, name);
}

function sanitizeValue(spec: PropSpec, value: unknown): SanitizedProps[string] | undefined {
  switch (spec.kind) {
    case 'boolean':
      return typeof value === 'boolean' ? value : undefined;
    case 'number': {
      if (value === null && spec.nullable) return null;
      if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
      const clamped = Math.min(spec.max, Math.max(spec.min, value));
      return spec.integer ? Math.round(clamped) : clamped;
    }
    case 'enum':
      return typeof value === 'string' && spec.values.includes(value) ? value : undefined;
    case 'enum-array': {
      if (!Array.isArray(value)) return undefined;
      const filtered = value
        .filter((v): v is string => typeof v === 'string' && spec.values.includes(v))
        .slice(0, spec.maxLen);
      return [...new Set(filtered)].sort();
    }
    case 'pattern':
      return typeof value === 'string' &&
        value.length <= spec.maxLen &&
        spec.pattern.test(value)
        ? value
        : undefined;
  }
}

/**
 * Validate an event against the allowlist. Returns null for unknown event
 * names; silently drops unknown/invalid properties. The returned object is
 * freshly constructed — nothing from the input is passed through unchecked.
 */
export function sanitizeEvent(
  name: string,
  props: unknown,
): { name: TelemetryEventName; props: SanitizedProps } | null {
  if (!isEventName(name)) return null;
  const schema = EVENT_SCHEMA[name];
  const out: SanitizedProps = {};
  if (props && typeof props === 'object' && !Array.isArray(props)) {
    for (const [key, spec] of Object.entries(schema)) {
      const value = (props as Record<string, unknown>)[key];
      if (value === undefined) continue;
      const sanitized = sanitizeValue(spec, value);
      if (sanitized !== undefined) out[key] = sanitized;
    }
  }
  return { name, props: out };
}

/** Map an arbitrary model string to a schema-safe value. */
export function safeModel(model: string | undefined | null): string {
  if (!model) return 'default';
  return (KNOWN_MODELS as readonly string[]).includes(model) ? model : 'custom';
}

/** Map arbitrary skill ids to schema-safe values (builtin id or 'custom'). */
export function safeSkills(skillIds: readonly string[] | undefined | null): string[] {
  if (!skillIds?.length) return [];
  const safe = skillIds.map((id) =>
    (BUILTIN_SKILLS as readonly string[]).includes(id) ? id : 'custom',
  );
  return [...new Set(safe)].sort().slice(0, 5);
}

// ---------------------------------------------------------------------------
// Self-test vectors (run via GET /playground/api/telemetry?action=selftest —
// the host app has no test runner, so the sanitizer carries its own tests)
// ---------------------------------------------------------------------------

export const SANITIZER_TEST_VECTORS: {
  desc: string;
  in: { name: string; props: unknown };
  expect: { name: string; props: SanitizedProps } | null;
}[] = [
  {
    desc: 'unknown event name is rejected',
    in: { name: 'totally_made_up', props: {} },
    expect: null,
  },
  {
    desc: 'unknown props are dropped',
    in: {
      name: 'feature_used',
      props: { feature: 'draw', prompt: 'SECRET PROMPT', filePath: '/Users/x/app.tsx' },
    },
    expect: { name: 'feature_used', props: { feature: 'draw' } },
  },
  {
    desc: 'free-form string in enum prop is dropped',
    in: { name: 'feature_used', props: { feature: 'my-component-name.tsx' } },
    expect: { name: 'feature_used', props: {} },
  },
  {
    desc: 'out-of-range numbers are clamped',
    in: {
      name: 'time_summary',
      props: { active_seconds: 99_999, passive_seconds: -5, window_seconds: 600 },
    },
    expect: {
      name: 'time_summary',
      props: { active_seconds: 600, passive_seconds: 0, window_seconds: 600 },
    },
  },
  {
    desc: 'non-numeric value for number prop is dropped',
    in: { name: 'time_summary', props: { active_seconds: '/etc/passwd' } },
    expect: { name: 'time_summary', props: {} },
  },
  {
    desc: 'unknown model would be rejected at enum level (callers use safeModel)',
    in: {
      name: 'generation_started',
      props: { provider: 'cursor', model: 'my-secret-finetune' },
    },
    expect: { name: 'generation_started', props: { provider: 'cursor' } },
  },
  {
    desc: 'oversized skills array is filtered to builtin/custom and capped',
    in: {
      name: 'generation_started',
      props: {
        provider: 'codex',
        skills: [
          'frontend-design', 'acme-internal-skill', 'nothing-design',
          'x1', 'x2', 'x3', 'x4', 'x5',
        ],
      },
    },
    expect: {
      name: 'generation_started',
      props: { provider: 'codex', skills: ['frontend-design', 'nothing-design'] },
    },
  },
  {
    desc: 'project_hash must match the 16-hex pattern',
    in: { name: 'session_started', props: { project_hash: 'my-startup-app-x1' } },
    expect: { name: 'session_started', props: {} },
  },
  {
    desc: 'valid project_hash passes',
    in: { name: 'session_started', props: { project_hash: 'a1b2c3d4e5f60718' } },
    expect: { name: 'session_started', props: { project_hash: 'a1b2c3d4e5f60718' } },
  },
  {
    desc: 'nullable numbers accept null',
    in: {
      name: 'code_adopted',
      props: { kind: 'flow', lines_added: null, lines_removed: 12, files_changed: 2 },
    },
    expect: {
      name: 'code_adopted',
      props: { kind: 'flow', lines_added: null, lines_removed: 12, files_changed: 2 },
    },
  },
  {
    desc: 'array injection into scalar prop is dropped',
    in: { name: 'feature_used', props: { feature: ['draw', 'pdf_import'] } },
    expect: { name: 'feature_used', props: {} },
  },
];

/** Run all self-test vectors; returns failures (empty array = all pass). */
export function runSanitizerSelfTest(): { desc: string; got: unknown; want: unknown }[] {
  const failures: { desc: string; got: unknown; want: unknown }[] = [];
  for (const vector of SANITIZER_TEST_VECTORS) {
    const got = sanitizeEvent(vector.in.name, vector.in.props);
    if (JSON.stringify(got) !== JSON.stringify(vector.expect)) {
      failures.push({ desc: vector.desc, got, want: vector.expect });
    }
  }
  return failures;
}
