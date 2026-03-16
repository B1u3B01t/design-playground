// ---------------------------------------------------------------------------
// Shared Prompt Sections
// ---------------------------------------------------------------------------
// Reusable prompt content shared across iteration templates.
// ---------------------------------------------------------------------------

import type { StylingMode } from '../lib/constants';

// ---------------------------------------------------------------------------
// Styling constraint resolvers
// ---------------------------------------------------------------------------

/** Returns the styling constraint instruction for a given mode */
export function getStylingConstraint(mode: StylingMode): string {
  if (mode === 'inline-css') {
    return 'You may use inline style={{}} for any CSS property. Do NOT use Tailwind utility classes for visual styling. Use inline styles for maximum creative expressiveness.';
  }
  return 'Use only existing Tailwind classes already present in the codebase. Do not use inline style={{}}.';
}

/** Returns the quality checklist line item for styling */
export function getStylingQualityItem(mode: StylingMode): string {
  if (mode === 'inline-css') {
    return 'Uses inline style={{}} for styling (no Tailwind utility classes)';
  }
  return 'Uses only allowed Tailwind classes already present in the codebase';
}

/** Returns the full quality checklist with the appropriate styling line */
export function getQualityChecklist(mode: StylingMode = 'tailwind'): string {
  return `QUALITY CHECKLIST (FOR EACH ITERATION)
- [ ] Props interface unchanged from original
- [ ] All imports resolve correctly with no TypeScript errors
- [ ] Metadata comment included with correct @iteration/@parent (and @sourceIteration when applicable)
- [ ] File named correctly: ComponentName.iteration-{n}.tsx
- [ ] ${getStylingQualityItem(mode)}
- [ ] Registered in iterations/index.ts with a ".tsx" key
- [ ] Entry added/updated in iterations/tree.json with correct parent
- [ ] @sourceIteration set when derived from another iteration`;
}

/** Common quality checklist (Tailwind default) — kept for backward compatibility */
export const QUALITY_CHECKLIST = getQualityChecklist('tailwind');

/** File registration instructions shared across templates */
export const FILE_REGISTRATION_INSTRUCTIONS = `   - Include the required metadata comment block with @iteration, @parent, optional @sourceIteration, and @description
   - Immediately register that file in: src/app/playground/iterations/index.ts (map key MUST include ".tsx")
   - Immediately add a matching entry to: src/app/playground/iterations/tree.json with parent set to "{{componentId}}"`;

/** Props constraint block shared across templates */
export const PROPS_CONSTRAINT = `- **Props interface**: Keep it IDENTICAL to the original component (no added/removed/renamed props, no type changes).
- **Iteration depth**: Follow the requested depth (Shell only, 1 level deep, or All levels).
- **Tree manifest**: Update src/app/playground/iterations/tree.json for every new iteration file.
- **Registry index**: Register every iteration in src/app/playground/iterations/index.ts with a ".tsx" map key.`;
