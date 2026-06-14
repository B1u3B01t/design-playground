import type { ModelOption } from './constants';
import type { ProviderId } from './providers/types';

// ---------------------------------------------------------------------------
// Featured defaults (middle-tier slugs verified against `cursor agent models`)
// ---------------------------------------------------------------------------

export const CURSOR_FEATURED_MODEL_IDS = [
  'auto',
  'composer-2.5-fast',
  'gpt-5.3-codex',
  'claude-opus-4-8-medium',
  'claude-4.6-sonnet-medium',
  'gpt-5.5-medium',
  'gemini-3.1-pro',
  'gemini-3.5-flash',
] as const;

export const CURSOR_FALLBACK_MODELS: ModelOption[] = [
  { value: 'auto', label: 'Auto (Default)' },
  { value: 'composer-2.5-fast', label: 'Composer 2.5 Fast' },
  { value: 'gpt-5.3-codex', label: 'Codex 5.3' },
  { value: 'claude-opus-4-8-medium', label: 'Opus 4.8 1M Medium' },
  { value: 'claude-4.6-sonnet-medium', label: 'Sonnet 4.6 1M' },
  { value: 'gpt-5.5-medium', label: 'GPT-5.5 1M' },
  { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro' },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
];

// ---------------------------------------------------------------------------
// Claude Code static catalog (no CLI list command — docs-verified slugs)
// ---------------------------------------------------------------------------

/** Alias models shown by default; always track Anthropic's latest for each tier. */
export const CLAUDE_FEATURED_MODEL_IDS = [
  'sonnet',
  'opus',
  'haiku',
  'fable',
] as const;

/**
 * Full Claude Code model catalog from https://code.claude.com/docs/en/model-config
 * Aliases auto-update; pinned `claude-*` ids lock a specific version.
 */
export const CLAUDE_FALLBACK_MODELS: ModelOption[] = [
  { value: 'sonnet', label: 'Sonnet (latest)' },
  { value: 'opus', label: 'Opus (latest)' },
  { value: 'haiku', label: 'Haiku (fast)' },
  { value: 'fable', label: 'Fable 5' },
  { value: 'claude-opus-4-8', label: 'Opus 4.8' },
  { value: 'claude-opus-4-8[1m]', label: 'Opus 4.8 (1M context)' },
  { value: 'claude-opus-4-7', label: 'Opus 4.7' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { value: 'sonnet[1m]', label: 'Sonnet (1M context)' },
  { value: 'opus[1m]', label: 'Opus (1M context)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
  { value: 'claude-fable-5', label: 'Fable 5 (pinned)' },
  { value: 'best', label: 'Best available' },
  { value: 'opusplan', label: 'Opus plan + Sonnet execute' },
];

/** Minimum Claude Code versions for newer models (for UI hints). */
export const CLAUDE_MIN_VERSIONS = {
  opus48: '2.1.154',
  fable5: '2.1.170',
} as const;

// ---------------------------------------------------------------------------
// Legacy slug migration
// ---------------------------------------------------------------------------

const CURSOR_LEGACY_ALIASES: Record<string, string> = {
  'composer-1.5': 'composer-2.5-fast',
  'composer-2': 'composer-2.5-fast',
  'opus-4.6': 'claude-opus-4-8-medium',
  'opus-4.6-thinking': 'claude-opus-4-8-medium',
  'opus-4.5': 'claude-opus-4-8-medium',
  'sonnet-4.6': 'claude-4.6-sonnet-medium',
  'sonnet-4.6-thinking': 'claude-4.6-sonnet-medium-thinking',
  'sonnet-4.5': 'claude-4.5-sonnet',
  'gpt-5.2': 'gpt-5.5-medium',
  'gpt-5.2-codex': 'gpt-5.3-codex',
  'gpt-5.1': 'gpt-5.5-medium',
  'gpt-5.1-codex-max': 'gpt-5.3-codex',
  'gemini-3-pro': 'gemini-3.1-pro',
  'gemini-3-flash': 'gemini-3.5-flash',
  grok: 'grok-4.3',
};

const CLAUDE_LEGACY_ALIASES: Record<string, string> = {
  'claude-opus-4-6': 'claude-opus-4-8',
  'claude-sonnet-4-5': 'claude-sonnet-4-6',
  'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
};

/** Combined map for telemetry sanitization. */
export const LEGACY_MODEL_ALIASES: Record<string, string> = {
  ...CURSOR_LEGACY_ALIASES,
  ...CLAUDE_LEGACY_ALIASES,
};

function legacyAliasesFor(providerId: ProviderId): Record<string, string> {
  if (providerId === 'claude-code') return CLAUDE_LEGACY_ALIASES;
  if (providerId === 'cursor') return CURSOR_LEGACY_ALIASES;
  return {};
}

/** Regex patterns for deprecated model generations hidden from the UI. */
const DEPRECATED_MODEL_PATTERNS: RegExp[] = [
  /^composer-1/,
  /^gpt-5\.1/,
  /^gpt-5\.2/,
  /^opus-4\./,
  /^sonnet-4\./,
  /^claude-4-sonnet$/,
  /^claude-4-sonnet-thinking$/,
  /^claude-4\.5-/,
  /^claude-4\.6-opus/,
  /^kimi-/,
];

const FEATURED_ID_SET = new Set<string>(CURSOR_FEATURED_MODEL_IDS);

/** Normalize auto sentinel values to a single canonical form. */
export function normalizeAutoModelId(model: string): string {
  return model === '' ? 'auto' : model;
}

export function isDeprecatedCursorModel(modelId: string): boolean {
  const id = normalizeAutoModelId(modelId);
  if (!id || id === 'auto') return false;
  return DEPRECATED_MODEL_PATTERNS.some((re) => re.test(id));
}

export function isCursorFeaturedModel(modelId: string): boolean {
  return FEATURED_ID_SET.has(normalizeAutoModelId(modelId));
}

/**
 * Map a possibly-stale model id to its current equivalent for the given provider.
 * Returns the input unchanged when no migration applies.
 */
export function migrateModelId(providerId: ProviderId, model: string): string {
  const trimmed = model.trim();
  if (!trimmed) return trimmed;

  const canonical = normalizeAutoModelId(trimmed);
  const aliases = legacyAliasesFor(providerId);
  const migrated = aliases[canonical] ?? aliases[trimmed];
  if (migrated) return migrated;

  if (providerId === 'cursor' && isDeprecatedCursorModel(canonical)) {
    // Best-effort family mapping for unrecognized deprecated slugs
    if (/gpt-5\.[12]/.test(canonical) || /codex/.test(canonical)) return 'gpt-5.3-codex';
    if (/opus|claude.*opus/i.test(canonical)) return 'claude-opus-4-8-medium';
    if (/sonnet/i.test(canonical)) return 'claude-4.6-sonnet-medium';
    if (/composer/.test(canonical)) return 'composer-2.5-fast';
    if (/gemini/.test(canonical)) return 'gemini-3.1-pro';
    if (/grok/.test(canonical)) return 'grok-4.3';
    if (/gpt/.test(canonical)) return 'gpt-5.5-medium';
  }

  return trimmed;
}

/** Migrate and dedupe a list of enabled model ids, falling back to defaults when empty. */
export function migrateEnabledModels(
  providerId: ProviderId,
  ids: string[],
  defaultIds: readonly string[],
): string[] {
  const migrated = ids
    .map((id) => migrateModelId(providerId, id))
    .map((id) => (providerId === 'cursor' ? normalizeAutoModelId(id) : id))
    .filter((id) => id !== '' || providerId === 'codex');

  const unique = [...new Set(migrated)];

  if (unique.length === 0) return [...defaultIds];

  if (providerId === 'cursor') {
    const filtered = unique.filter((id) => !isDeprecatedCursorModel(id));
    return filtered.length > 0 ? filtered : [...defaultIds];
  }

  return unique;
}

// ---------------------------------------------------------------------------
// Cursor model partitioning (featured vs advanced tier variants)
// ---------------------------------------------------------------------------

export interface CursorModelPartition {
  featured: ModelOption[];
  advanced: ModelOption[];
}

function buildFeaturedList(allModels: ModelOption[]): ModelOption[] {
  const byId = new Map(allModels.map((m) => [normalizeAutoModelId(m.value), m]));
  const featured: ModelOption[] = [];

  for (const id of CURSOR_FEATURED_MODEL_IDS) {
    const found = byId.get(id);
    if (found) {
      featured.push({ ...found, value: id });
    } else {
      const fallback = CURSOR_FALLBACK_MODELS.find((m) => m.value === id);
      if (fallback) featured.push(fallback);
    }
  }

  return featured;
}

/**
 * Split Cursor models into featured (middle-tier defaults) and advanced (tier variants).
 * Deprecated generations are excluded entirely.
 */
export function partitionCursorModels(allModels: ModelOption[]): CursorModelPartition {
  const featuredIds = new Set<string>(CURSOR_FEATURED_MODEL_IDS);

  const currentGen = allModels.filter((m) => {
    const id = normalizeAutoModelId(m.value);
    return !isDeprecatedCursorModel(id);
  });

  const featured = buildFeaturedList(currentGen);

  const advanced = currentGen.filter((m) => {
    const id = normalizeAutoModelId(m.value);
    return !featuredIds.has(id);
  });

  return { featured, advanced };
}

/** Check whether two model ids refer to the same selection for a provider. */
export function modelsMatch(providerId: ProviderId, a: string, b: string): boolean {
  if (providerId === 'cursor') {
    return normalizeAutoModelId(a) === normalizeAutoModelId(b);
  }
  return a === b;
}

export function isModelEnabled(
  providerId: ProviderId,
  modelValue: string,
  enabledIds: readonly string[],
): boolean {
  return enabledIds.some((id) => modelsMatch(providerId, id, modelValue));
}

export function mergeCursorPartition(partition: CursorModelPartition): ModelOption[] {
  const seen = new Set<string>();
  const merged: ModelOption[] = [];

  for (const m of [...partition.featured, ...partition.advanced]) {
    const id = normalizeAutoModelId(m.value);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push({ ...m, value: id === 'auto' ? m.value : m.value });
  }

  return merged;
}

/** Filter CLI model list: drop deprecated generations, dedupe auto. */
export function filterCursorModelsFromCli(allModels: ModelOption[]): ModelOption[] {
  const partition = partitionCursorModels(allModels);
  return mergeCursorPartition(partition);
}

/** Dedupe auto entry from parsed CLI output (`auto` vs empty string). */
export function dedupeAutoInModelList(models: ModelOption[]): ModelOption[] {
  const result: ModelOption[] = [];
  let hasAuto = false;

  for (const m of models) {
    const id = normalizeAutoModelId(m.value);
    if (id === 'auto') {
      if (hasAuto) continue;
      hasAuto = true;
      result.push({ value: 'auto', label: m.label || 'Auto (Default)' });
    } else {
      result.push(m);
    }
  }

  if (!hasAuto) {
    result.unshift({ value: 'auto', label: 'Auto (Default)' });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Claude Code model partitioning (aliases vs pinned full names)
// ---------------------------------------------------------------------------

export type ModelPartition = CursorModelPartition;

function buildClaudeFeaturedList(allModels: ModelOption[]): ModelOption[] {
  const byId = new Map(allModels.map((m) => [m.value, m]));
  const featured: ModelOption[] = [];

  for (const id of CLAUDE_FEATURED_MODEL_IDS) {
    const found = byId.get(id);
    if (found) {
      featured.push(found);
    } else {
      const fallback = CLAUDE_FALLBACK_MODELS.find((m) => m.value === id);
      if (fallback) featured.push(fallback);
    }
  }

  return featured;
}

/** Split Claude models into featured aliases and advanced pinned ids. */
export function partitionClaudeModels(allModels: ModelOption[]): ModelPartition {
  const featuredIds = new Set<string>(CLAUDE_FEATURED_MODEL_IDS);
  const featured = buildClaudeFeaturedList(allModels);
  const advanced = allModels.filter((m) => !featuredIds.has(m.value));
  return { featured, advanced };
}
