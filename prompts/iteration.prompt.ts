/**
 * @name: iteration-prompt
 * @description: Prompt used to generate new component iterations from the original source component in the playground
 * @variables :
 *   skillSection: Optional skill context block to prepend to the prompt, usually derived from a SKILL.md file.
 *   componentName: Human-readable component name without qualifiers, e.g. "Pricing Card".
 *   sourcePath: Relative path to the original source component file.
 *   iterationCount: Number of iterations the agent should generate.
 *   depthLabel: Human-readable description of the iteration depth (e.g. "Shell only").
 *   childrenSection: Optional formatted list of child components that should remain stable.
 *   propsInterface: The TypeScript props interface for the component, rendered as text.
 *   cleanComponentName: PascalCase component name derived from registry ID, used in iteration filenames (must match default export name).
 *   componentId: Registry ID for the component, used as the parent in the tree manifest.
 *   customInstructionsSection: Optional custom instructions block provided by the user.
 */
import { fillTemplate } from './utility';
import { FILE_REGISTRATION_INSTRUCTIONS, PROPS_CONSTRAINT } from './shared-sections';

const prompt = `
{{skillSection}}
ITERATION REQUEST
═════════════════

Component: {{componentName}}
Source: {{sourcePath}}
Iterations requested: {{iterationCount}}
Depth: {{depthLabel}}
{{childrenSection}}
Props interface (DO NOT MODIFY):
{{propsInterface}}
{{screenshotSection}}
{{referenceNodesSection}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCTIONS

1. Read the generation guide: src/app/playground/docs/ITERATION-GUIDE.md
2. Read the source component at the path above
3. Understand its structure, props interface, and current design
4. Generate {{iterationCount}} **compatible** variations numbered {{iterationNumbersList}} (you may change both layout and visual design)
5. Process iterations ONE AT A TIME in the order listed below. For each iteration, complete ALL of the following steps before moving to the next:
   a. Create and save the iteration file
   b. Include metadata comment with @iteration, @parent, and @description
   c. Immediately register that file in src/app/playground/iterations/index.ts (map key MUST include ".tsx")
   d. Immediately add a matching entry to src/app/playground/iterations/tree.json with parent set to "{{componentId}}"
   e. Only then start the next iteration

   This sequential approach ensures each iteration is visible on the canvas as soon as it's done.

Files to create (in this order):
{{iterationSavesBlock}}

IMPORTANT
- Iteration numbers MUST be {{iterationNumbersList}} — do NOT reuse existing iteration numbers
{{customInstructionsSection}}
CRITICAL REQUIREMENTS
${PROPS_CONSTRAINT}

if iterationCount > 1 then:
  CREATIVE LAYOUT & THEME FREEDOM
  - Explore bold, unconventional layouts: asymmetric grids, overlapping elements, unusual spacing, and creative alignments.
  - {{stylingConstraint}}
  - Each iteration must be structurally and/or visually distinct from the original and from other iterations.

{{qualityChecklist}}
- [ ] Layout and/or visual design is meaningfully different and creatively structured
- [ ] Iteration is distinct from all other iterations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate the iterations now.`;

export interface IterationPromptVars {
  skillSection?: string;
  componentName: string;
  sourcePath: string;
  iterationCount: string;
  depthLabel: string;
  childrenSection?: string;
  propsInterface: string;
  cleanComponentName: string;
  componentId: string;
  customInstructionsSection?: string;
  stylingConstraint: string;
  qualityChecklist: string;
  iterationNumbersList: string;
  iterationSavesBlock: string;
  screenshotSection?: string;
  referenceNodesSection?: string;
}

export function iterationPrompt(vars: IterationPromptVars): string {
  return fillTemplate(prompt, vars as unknown as Record<string, string>);
}

