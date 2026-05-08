// ---------------------------------------------------------------------------
// Skill icon helpers
//
// Skills can optionally provide a custom icon URL (e.g. via SKILL.md
// frontmatter). When no icon is supplied, we render a colored pastel circle
// derived from the skill's id, with subtle inner shadows to give it a 3D look
// (matching the cursor-bubble face style in playground-global.css).
// ---------------------------------------------------------------------------

import type { CSSProperties } from 'react';

/** Pastel palette used to color default skill bubbles. */
const PASTEL_COLORS: readonly string[] = [
  '#FFB5A7', // coral
  '#FFD4A8', // peach
  '#FFE5A8', // butter
  '#C8EBC0', // mint
  '#A8DADC', // seafoam
  '#A8C5FF', // sky
  '#C8B8FF', // lavender
  '#F5C6E0', // blush
  '#FFCAD4', // rose
  '#B5EAD7', // tea green
];

/** Stable hash → palette index. */
function hashToIndex(input: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % modulo;
}

/** Returns a deterministic pastel color for a given skill id. */
export function getSkillBubbleColor(skillId: string): string {
  return PASTEL_COLORS[hashToIndex(skillId, PASTEL_COLORS.length)];
}

/**
 * Inline style for a small "3D" skill bubble — uses inner shadows to mimic
 * the cursor-chat bubble-face treatment in playground-global.css.
 */
export function getSkillBubbleStyle(skillId: string, size = 24): CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: '50%',
    background: getSkillBubbleColor(skillId),
    boxShadow: [
      '0 1px 3px rgba(0, 0, 0, 0.12)',
      'inset 0 -3px 4px 0 rgba(0, 0, 0, 0.08)',
      'inset 0 3px 3px 0 rgba(255, 255, 255, 0.45)',
    ].join(', '),
    flexShrink: 0,
  };
}
