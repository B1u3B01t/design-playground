/**
 * @name: iteration-from-iteration-prompt
 * @description: Prompt used to generate new component iterations derived from an existing iteration file in the playground.
 * @variables :
 *   skillSection: Optional skill context block to prepend to the prompt, usually derived from a SKILL.md file.
 *   componentName: Human-readable component name without qualifiers, e.g. "Pricing Card".
 *   sourcePath: Relative path to the original source component file.
 *   iterationSourcePath: Relative path to the base iteration file used as a starting point.
 *   iterationCount: Number of new iterations the agent should generate.
 *   startNumber: First iteration number to use for the new files.
 *   endNumber: Last iteration number to use for the new files.
 *   depthLabel: Human-readable description of the iteration depth (e.g. "Shell only").
 *   childrenSection: Optional formatted list of child components that should remain stable.
 *   propsInterface: The TypeScript props interface for the component, rendered as text.
 *   iterationSavesBlock: Preformatted bullet list of the save paths for each new iteration file.
 *   treeParent: Parent identifier to use in tree.json for the new iterations, usually the source iteration filename.
 *   customInstructionsSection: Optional custom instructions block provided by the user.
 *   iterationNumbersList: Comma-separated list of iteration numbers to generate (e.g. "3, 4, 5").
 *   sourceIterationFilename: Filename of the base iteration, used in @sourceIteration metadata.
 *
 */
import { fillTemplate } from './utility';

const prompt = `
{{skillSection}}
ITERATION REQUEST (from existing iteration)
═════════════════════════════════════════════

Component: {{componentName}}
Original source: {{sourcePath}}
Base iteration: {{iterationSourcePath}}
Iterations requested: {{iterationCount}} (numbered {{startNumber}}–{{endNumber}})
Depth: {{depthLabel}}
{{childrenSection}}
Props interface (DO NOT MODIFY):
{{propsInterface}}
{{screenshotSection}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCTIONS

1. Read the generation guide: src/app/playground/docs/ITERATION-GUIDE.md
2. Read the BASE ITERATION at: {{iterationSourcePath}}
3. Also read the ORIGINAL component for context: {{sourcePath}}
4. Generate {{iterationCount}} new variations based on the base iteration
5. For EACH new variation you create:
{{iterationSavesBlock}}
   - Immediately register that file in: src/app/playground/iterations/index.ts
   - Immediately add a matching entry to: src/app/playground/iterations/tree.json with parent set to "{{treeParent}}"
{{customInstructionsSection}}
IMPORTANT
- Use the BASE ITERATION as your starting point, NOT the original component
- Each new variation should diverge from the base iteration in meaningful ways
- Iteration numbers MUST be {{iterationNumbersList}} (continuing from existing iterations)
- Include @sourceIteration {{sourceIterationFilename}} in each file's metadata comment

CONSTRAINTS
- Keep props interface identical
- {{stylingConstraint}}
- Include metadata comment in each file (with correct @iteration number AND @sourceIteration)
- Make each iteration meaningfully different from the base and from each other

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate the iterations now.`;

export interface IterationFromIterationPromptVars {
  skillSection?: string;
  componentName: string;
  sourcePath: string;
  iterationSourcePath: string;
  iterationCount: string;
  startNumber: string;
  endNumber: string;
  depthLabel: string;
  childrenSection?: string;
  propsInterface: string;
  iterationSavesBlock: string;
  treeParent: string;
  customInstructionsSection?: string;
  iterationNumbersList: string;
  sourceIterationFilename: string;
  stylingConstraint: string;
  screenshotSection?: string;
}

export function iterationFromIterationPrompt(
  vars: IterationFromIterationPromptVars,
): string {
  return fillTemplate(prompt, vars as unknown as Record<string, string>);
}

