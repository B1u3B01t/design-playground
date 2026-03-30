/**
 * Prompt template for generating JSX iterations from an existing JSX iteration.
 */
import { fillTemplate } from './utility';

const prompt = `
{{skillSection}}
JSX COMPONENT ITERATION REQUEST (FROM ITERATION)
═════════════════════════════════════════════════

Component: {{componentName}}
Source iteration: src/app/playground/canvas-components/{{sourceFilename}}
Iterations requested: {{iterationCount}}
{{screenshotSection}}

INSTRUCTIONS

1. Read the source iteration at src/app/playground/canvas-components/{{sourceFilename}}
2. Understand its structure, layout, visual design, and behavior
3. Generate {{iterationCount}} variations numbered {{iterationNumbersList}}
4. For each iteration N, save as: src/app/playground/canvas-components/{{baseName}}.iteration-N.tsx
5. Complete each iteration fully before starting the next

CRITICAL REQUIREMENTS
- Each file MUST start with 'use client';
- Each file MUST have a default export (export default function ComponentName() { ... })
- Components MUST be fully self-contained units:
  • Use ONLY inline styles or style objects — NO external CSS imports, NO Tailwind, NO CSS modules
  • The ONLY allowed import is 'react' (e.g. import React, { useState } from 'react')
  • Do NOT import any UI library: no shadcn/ui, no @radix-ui, no lucide-react, no @/components, no next/image, no next/link, no framer-motion, no any other package
  • Do NOT import anything from the playground codebase — these components render inside the playground and must not affect its UI
  • All icons, images, and assets must be inline SVG or CSS-based
- Preserve the component's core functionality and structure
- Each variation should be a complete, working React component
{{customInstructionsSection}}

CREATIVE LAYOUT & THEME FREEDOM (when iterationCount > 1)
- Explore bold layouts: asymmetric grids, overlapping elements, creative spacing
- Vary color schemes, typography, and visual hierarchy
- Each iteration must be structurally and/or visually distinct from the source and other iterations

QUALITY CHECKLIST
- [ ] File starts with 'use client';
- [ ] Has a default export
- [ ] Only imports from 'react' — zero other packages
- [ ] Self-contained styles (inline/style objects only, no Tailwind, no CSS imports)
- [ ] No UI library imports (no shadcn, radix, lucide, next/*, @/components, etc.)
- [ ] Renders without errors
- [ ] Visually distinct from source and other iterations`;

export interface JsxIterationFromIterationPromptVars {
  skillSection?: string;
  componentName: string;
  baseFilename: string;
  baseName: string;
  sourceFilename: string;
  iterationCount: string;
  iterationNumbersList: string;
  screenshotSection?: string;
  customInstructionsSection?: string;
}

export function jsxIterationFromIterationPrompt(vars: JsxIterationFromIterationPromptVars): string {
  return fillTemplate(prompt, vars as unknown as Record<string, string>);
}
