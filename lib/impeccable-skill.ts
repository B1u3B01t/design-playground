import type { Segment } from '../ui/inline-reference';
import type { InlineReferenceItemData } from '../ui/inline-reference';

/** Stable ID for the parent impeccable item in the skills picker. */
export const IMPECCABLE_ITEM_ID = 'impeccable';

export interface ImpeccableCommand {
  id: string;
  label: string;
  description: string;
  category: 'Create' | 'Evaluate' | 'Refine' | 'Simplify' | 'Harden';
}

/** Most-used commands first — matches the IterateDialog reference UI. */
export const IMPECCABLE_COMMANDS: ImpeccableCommand[] = [
  { id: 'polish',    label: 'polish',    category: 'Harden',   description: 'Full pass — alignment, type, spacing, states' },
  { id: 'critique',  label: 'critique',  category: 'Evaluate', description: 'Design review with scoring & persona tests' },
  { id: 'audit',     label: 'audit',     category: 'Evaluate', description: 'Accessibility, perf, theming & responsive checks' },
  { id: 'craft',     label: 'craft',     category: 'Create',   description: 'Shape-then-build for a brand-new feature' },
  { id: 'delight',   label: 'delight',   category: 'Refine',   description: 'Add micro-interactions & polish details' },
  { id: 'animate',   label: 'animate',   category: 'Refine',   description: 'Add or improve motion' },
  { id: 'bolder',    label: 'bolder',    category: 'Refine',   description: 'Push hierarchy and contrast further' },
  { id: 'colorize',  label: 'colorize',  category: 'Refine',   description: 'Improve color application' },
  { id: 'layout',    label: 'layout',    category: 'Refine',   description: 'Fix and improve structural layout' },
  { id: 'typeset',   label: 'typeset',   category: 'Refine',   description: 'Improve typography' },
  { id: 'overdrive', label: 'overdrive', category: 'Refine',   description: 'Creative risk-taking pass' },
  { id: 'quieter',   label: 'quieter',   category: 'Refine',   description: 'Reduce visual tension' },
  { id: 'adapt',     label: 'adapt',     category: 'Simplify', description: 'Adapt for a different context or device' },
  { id: 'clarify',   label: 'clarify',   category: 'Simplify', description: 'Remove visual noise and simplify' },
  { id: 'distill',   label: 'distill',   category: 'Simplify', description: 'Strip to essential elements' },
  { id: 'harden',    label: 'harden',    category: 'Harden',   description: 'Fix edge cases and error states' },
  { id: 'optimize',  label: 'optimize',  category: 'Harden',   description: 'Performance and bundle optimisation' },
  { id: 'onboard',   label: 'onboard',   category: 'Harden',   description: 'Improve onboarding flow' },
  { id: 'shape',     label: 'shape',     category: 'Create',   description: 'Sketch multiple layout directions' },
];

/** Skill prompt injected into the generation prompt when an impeccable command is selected. */
export function buildImpeccableSkillPrompt(command: string): string {
  return `IMPECCABLE SKILL
After creating each iteration file, run the following impeccable command on it:
  /impeccable ${command}
Apply all suggestions from the command output directly to the iteration file before moving to the next one.`;
}

/** Synthetic InlineReferenceItemData for the parent impeccable picker entry. */
export const IMPECCABLE_PARENT_ITEM: InlineReferenceItemData = {
  id: IMPECCABLE_ITEM_ID,
  label: 'impeccable',
  description: 'Design tool — polish, audit, craft and more',
  isImpeccable: true,
};

/** Synthetic items shown in the commands sub-menu, keyed by "impeccable:<command>". */
export function buildImpeccableCommandItems(query: string): InlineReferenceItemData[] {
  const q = query.toLowerCase();
  return IMPECCABLE_COMMANDS
    .filter((c) => !q || c.id.includes(q) || c.description.toLowerCase().includes(q))
    .map((c) => ({
      id: `${IMPECCABLE_ITEM_ID}:${c.id}`,
      label: c.id,
      description: c.description,
      impeccableCategory: c.category,
    }));
}

/** Extract impeccable skill prompt text from a reference segment, if applicable. */
export function impeccablePromptFromSegment(segment: Segment): string | undefined {
  if (segment.type !== 'reference') return undefined;
  const impeccableCmd = (segment.data as Record<string, unknown> | undefined)
    ?.impeccableCommand as string | undefined;
  return impeccableCmd ? buildImpeccableSkillPrompt(impeccableCmd) : undefined;
}
