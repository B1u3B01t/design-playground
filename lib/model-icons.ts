// ---------------------------------------------------------------------------
// Model Icon Mapping
// ---------------------------------------------------------------------------

import cursorIcon from '../assets/cursor-icon.svg';
import claudeIcon from '../assets/claude-icon.svg';
import openaiIcon from '../assets/openai-icon.svg';
import geminiIcon from '../assets/gemini-icon.svg';

const MODEL_ICONS = {
  // Generic / fallback
  cursor: (cursorIcon as unknown as { src?: string }).src ?? (cursorIcon as unknown as string),

  // Families
  claude: (claudeIcon as unknown as { src?: string }).src ?? (claudeIcon as unknown as string),
  openai: (openaiIcon as unknown as { src?: string }).src ?? (openaiIcon as unknown as string),
  gemini: (geminiIcon as unknown as { src?: string }).src ?? (geminiIcon as unknown as string),
} as Record<string, string>;

/**
 * Returns the icon URL for a given model value string.
 * Matches against known model families; falls back to Cursor icon.
 */
export function getModelIcon(modelValue: string): string {
  const v = modelValue.toLowerCase();

  // Auto or unknown → generic Cursor icon
  if (v === 'auto') return MODEL_ICONS.cursor;

  // Claude family
  if (
    v.includes('claude') ||
    v.includes('opus') ||
    v.includes('sonnet') ||
    v.includes('haiku')
  ) {
    return MODEL_ICONS.claude;
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
    return MODEL_ICONS.openai;
  }

  // Gemini family
  if (v.includes('gemini')) return MODEL_ICONS.gemini;

  // Anything else → generic Cursor icon
  return MODEL_ICONS.cursor;
}
