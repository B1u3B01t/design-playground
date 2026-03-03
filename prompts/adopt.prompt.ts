/**
 * @name: adopt-iteration-prompt
 * @description: Prompt used to adopt an iteration's layout and styling into the original source component without breaking its public API.
 * @variables :
 *   originalPath: Relative path to the original source component file.
 *   iterationPath: Relative path to the iteration file being adopted.
 */
import { fillTemplate } from './utility';

const prompt = `
ADOPT ITERATION
═══════════════

Original Component: {{originalPath}}
Iteration to Adopt: {{iterationPath}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TASK

Replace the UI implementation of the original component with the layout/styling from the iteration, while ensuring ZERO breaking changes.

INSTRUCTIONS

1. Read both files:
   - Original: {{originalPath}}
   - Iteration: {{iterationPath}}

2. In the ORIGINAL component file:
   - Replace the JSX/render logic with the iteration's layout
   - Keep ALL existing imports that are still needed
   - Keep the EXACT same props interface and types
   - Keep ALL existing function logic (handlers, effects, computed values)
   - Keep the same export (default/named) as before

3. Do NOT:
   - Change the props interface in any way
   - Remove any existing functionality
   - Change the component's public API
   - Rename the component
   - Move the file

VERIFICATION CHECKLIST

Before saving, verify:
- [ ] Props interface is IDENTICAL to before
- [ ] All existing imports still resolve
- [ ] No TypeScript errors
- [ ] Component name unchanged
- [ ] Export style unchanged (default/named)
- [ ] All event handlers preserved
- [ ] All hooks/effects preserved
- [ ] File location unchanged

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Adopt the iteration now. Only modify the original component file.`;

export interface AdoptIterationPromptVars {
  originalPath: string;
  iterationPath: string;
}

export function adoptIterationPrompt(vars: AdoptIterationPromptVars): string {
  return fillTemplate(prompt, vars as unknown as Record<string, string>);
}

