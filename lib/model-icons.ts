// ---------------------------------------------------------------------------
// Model Icon Mapping
// ---------------------------------------------------------------------------

import cursorIcon from '../assets/cursor-icon.svg';
import claudeIcon from '../assets/claude-icon-white.svg';
import openaiIcon from '../assets/openai-icon.svg';
import geminiIcon from '../assets/gemini-icon.svg';

const ICON_SRC = (icon: unknown) =>
  (icon as { src?: string }).src ?? (icon as string);

export interface ModelIconConfig {
  src: string;
  /** Background color for the bubble face (e.g. #1c1917) */
  bg: string;
}

const MODEL_ICON_CONFIGS: Record<string, ModelIconConfig> = {
  cursor: { src: ICON_SRC(cursorIcon), bg: '#1c1917' },
  claude: { src: ICON_SRC(claudeIcon), bg: '#D77655' },
  openai: { src: ICON_SRC(openaiIcon), bg: '#1c1917' },
  gemini: { src: ICON_SRC(geminiIcon), bg: '#ffffff' },
};

/** Resolve the brand icon for empty/auto model values from the provider. */
function providerFallbackIcon(providerId?: string): ModelIconConfig {
  if (providerId === 'claude-code') return MODEL_ICON_CONFIGS.claude;
  if (providerId === 'codex') return MODEL_ICON_CONFIGS.openai;
  return MODEL_ICON_CONFIGS.cursor;
}

/**
 * Returns the icon URL for a given model value string.
 * Matches against known model families; falls back to Cursor icon.
 */
export function getModelIcon(modelValue: string, providerId?: string): string {
  return getModelIconConfig(modelValue, providerId).src;
}

/**
 * Returns icon URL and background color for the bubble face.
 * Use this when rendering the bubble so bg can change per model.
 * Pass `providerId` so empty/'auto' values resolve to the provider's brand icon.
 */
export function getModelIconConfig(modelValue: string, providerId?: string): ModelIconConfig {
  const v = modelValue.toLowerCase();

  // Auto or empty → provider brand icon (Cursor when unknown)
  if (!v || v === 'auto') return providerFallbackIcon(providerId);

  // Claude family
  if (
    v.includes('claude') ||
    v.includes('opus') ||
    v.includes('sonnet') ||
    v.includes('haiku') ||
    v.includes('fable') ||
    v === 'best' ||
    v === 'opusplan'
  ) {
    return MODEL_ICON_CONFIGS.claude;
  }

  // OpenAI / GPT family
  if (
    v.includes('gpt') ||
    v.includes('openai') ||
    v.includes('codex') ||
    v.includes('o1') ||
    v.includes('o3') ||
    v.includes('o4')
  ) {
    return MODEL_ICON_CONFIGS.openai;
  }

  // Gemini family
  if (v.includes('gemini')) return MODEL_ICON_CONFIGS.gemini;

  // Unrecognized slug — use the active provider's brand icon
  if (providerId === 'claude-code') return MODEL_ICON_CONFIGS.claude;
  if (providerId === 'codex') return MODEL_ICON_CONFIGS.openai;

  // Anything else → generic Cursor icon
  return MODEL_ICON_CONFIGS.cursor;
}
