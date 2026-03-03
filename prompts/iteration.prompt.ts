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
 *   cleanComponentName: Component name with spaces removed, used in iteration filenames.
 *   componentId: Registry ID for the component, used as the parent in the tree manifest.
 *   customInstructionsSection: Optional custom instructions block provided by the user.
 */
import { fillTemplate } from './utility';

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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCTIONS

1. Read the generation guide: src/app/playground/docs/ITERATION-GUIDE.md
2. Read the source component at the path above
3. Understand its structure, props interface, and current design
4. Generate {{iterationCount}} **compatible** variations (you may change both layout and visual design)
5. For EACH variation you create:
   - Save it as: src/app/playground/iterations/{{cleanComponentName}}.iteration-{n}.tsx
   - Include the required metadata comment block with @iteration, @parent, optional @sourceIteration, and @description
   - Immediately register that file in: src/app/playground/iterations/index.ts (map key MUST include ".tsx")
   - Immediately add a matching entry to: src/app/playground/iterations/tree.json with parent set to "{{componentId}}"

{{customInstructionsSection}}CRITICAL REQUIREMENTS
- **Props interface**: Keep it IDENTICAL to the original component (no added/removed/renamed props, no type changes).
- **Iteration depth**: Follow the requested depth (Shell only, 1 level deep, or All levels).
- **Tree manifest**: Update src/app/playground/iterations/tree.json for every new iteration file.
- **Registry index**: Register every iteration in src/app/playground/iterations/index.ts with a ".tsx" map key.

CREATIVE LAYOUT & THEME FREEDOM
- Explore bold, unconventional layouts: asymmetric grids, overlapping elements, unusual spacing, and creative alignments.
- Feel free to iterate on visual design (colors, typography, spacing, badges, backgrounds) while staying within the existing Tailwind configuration.
- Each iteration must be structurally and/or visually distinct from the original and from other iterations.

QUALITY CHECKLIST (FOR EACH ITERATION)
- [ ] Props interface unchanged from original
- [ ] All imports resolve correctly with no TypeScript errors
- [ ] Metadata comment included with correct @iteration/@parent (and @sourceIteration when applicable)
- [ ] File named correctly: ComponentName.iteration-{n}.tsx
- [ ] Uses only allowed Tailwind classes already present in the codebase
- [ ] Layout and/or visual design is meaningfully different and creatively structured
- [ ] Iteration is distinct from all other iterations
- [ ] Registered in iterations/index.ts with a ".tsx" key
- [ ] Entry added/updated in iterations/tree.json with correct parent
- [ ] @sourceIteration set when derived from another iteration

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
}

export function iterationPrompt(vars: IterationPromptVars): string {
  return fillTemplate(prompt, vars as unknown as Record<string, string>);
}

