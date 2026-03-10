import type { Segment } from '../ui/inline-reference';
import type { PlaygroundSkill } from '../skills';
import { DEFAULT_EMPTY_ITERATION_INSTRUCTIONS } from './constants';

const DEFAULT_SKILL_IDS = ['design-variations', 'frontend-design'] as const;

/**
 * Get the default skill prompt from the skill map (used when no explicit skills are selected).
 */
export function getDefaultSkillPrompt(
  skillsById: Map<string, PlaygroundSkill>,
): string | undefined {
  if (skillsById.size === 0) return undefined;
  const parts: string[] = [];
  for (const id of DEFAULT_SKILL_IDS) {
    const skill = skillsById.get(id);
    const body = skill?.systemPrompt?.trim();
    if (body) parts.push(body);
  }
  if (!parts.length) return undefined;
  return parts.join('\n\n');
}

/**
 * Derive freeform instructions + skill prompt from inline reference segments.
 * Shared between IterateDialog and CursorChat.
 */
export function derivePromptParts(
  segments: Segment[] | undefined,
  skillsById: Map<string, PlaygroundSkill>,
): { customInstructionsText: string | undefined; skillPrompt: string | undefined } {
  const hasSegments = !!segments && segments.length > 0;

  const textParts: string[] = [];
  const skillSections: string[] = [];

  if (hasSegments) {
    for (const segment of segments!) {
      if (segment.type === 'text') {
        const trimmed = segment.value.trim();
        if (trimmed) textParts.push(trimmed);
      } else if (segment.type === 'reference') {
        const skill = skillsById.get(segment.value);
        if (skill?.systemPrompt) {
          skillSections.push(skill.systemPrompt);
        }
      }
    }
  }

  let customInstructionsText = textParts.join('\n').trim() || undefined;
  let skillPrompt = skillSections.join('\n\n').trim() || undefined;

  // When the inline reference area is empty (no text, no explicit skills),
  // automatically apply the default design skills.
  if (!hasSegments && !skillPrompt) {
    skillPrompt = getDefaultSkillPrompt(skillsById);
  }

  // When the inline reference is completely empty, also add a default
  // instruction line at the end of the prompt.
  if (!hasSegments && !customInstructionsText) {
    customInstructionsText = DEFAULT_EMPTY_ITERATION_INSTRUCTIONS;
  }

  return { customInstructionsText, skillPrompt };
}

/**
 * Format element context for inclusion in customInstructions.
 */
export function formatElementContext(elementContext?: string): string {
  if (!elementContext?.trim()) return '';
  return `\n\nELEMENT CONTEXT (iterate on this specific element, keep the rest the same):\n${elementContext.trim()}\n`;
}
