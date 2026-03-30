/**
 * @name: element-iteration-prompt
 * @description: Prompt used to generate targeted element iterations — the AI copies the component
 *   verbatim and only modifies the specific elements the user selected via Alt+click.
 * @variables :
 *   skillSection: Optional skill context block to prepend to the prompt.
 *   componentName: Human-readable component name, e.g. "Pricing Card".
 *   sourcePath: Relative path to the original source component file.
 *   depthLabel: Human-readable description of the iteration depth.
 *   childrenSection: Optional formatted list of child components that should remain stable.
 *   propsInterface: The TypeScript props interface for the component.
 *   cleanComponentName: PascalCase component name derived from registry ID, used in iteration filenames (must match default export name).
 *   componentId: Registry ID for the component, used as the parent in tree.json.
 *   customInstructionsSection: Optional custom instructions from the user.
 *   elementSelectionsSection: Formatted block describing the targeted DOM elements.
 *   iterationCount: The number of iterations to generate.
 *   iterationNumbersList: Comma-separated list of iteration numbers to generate.
 *   iterationSavesBlock: Formatted save-as instructions for each iteration file.
 */
import { fillTemplate } from './utility';

const prompt = `
{{skillSection}}
ELEMENT-TARGETED ITERATION REQUEST
════════════════════════════════════

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

{{elementSelectionsSection}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCTIONS

1. Read the generation guide: src/app/playground/docs/ITERATION-GUIDE.md
2. Read the source component at the path above
3. **Copy the component file verbatim** into each iteration file
4. **Only modify the targeted elements** described above — everything else must remain pixel-identical
5. Generate {{iterationCount}} variations numbered {{iterationNumbersList}}. Process iterations ONE AT A TIME in the order listed below. For each iteration, complete ALL of the following steps before moving to the next:
   a. Create and save the iteration file
   b. Include the required metadata comment block with @iteration, @parent, and @description
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
- **Copy first, edit second**: Start from an exact copy of the source component. Only then apply changes to the targeted elements.
- **Surgical edits only**: Do NOT redesign the layout, restructure the component, or restyle non-targeted elements.
- **Props interface**: Keep it IDENTICAL to the original component (no added/removed/renamed props, no type changes).
- **Tree manifest**: Update src/app/playground/iterations/tree.json for each new iteration file.
- **Registry index**: Register each iteration in src/app/playground/iterations/index.ts with a ".tsx" key.
- Each iteration must modify the targeted elements differently — they should be visually distinct from each other.

QUALITY CHECKLIST (apply to EACH iteration)
- [ ] Props interface unchanged from original
- [ ] All non-targeted elements are pixel-identical to source
- [ ] Only the targeted elements have been modified
- [ ] All imports resolve correctly with no TypeScript errors
- [ ] Metadata comment included with correct @iteration/@parent
- [ ] File named correctly: {{cleanComponentName}}.iteration-{N}.tsx (filename prefix matches the default export function name)
- [ ] {{stylingQualityItem}}
- [ ] Registered in iterations/index.ts with a ".tsx" key
- [ ] Entry added/updated in iterations/tree.json with correct parent

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate all {{iterationCount}} iterations now.`;

export interface ElementIterationPromptVars {
  skillSection?: string;
  componentName: string;
  sourcePath: string;
  depthLabel: string;
  childrenSection?: string;
  propsInterface: string;
  cleanComponentName: string;
  componentId: string;
  customInstructionsSection?: string;
  elementSelectionsSection: string;
  iterationCount: string;
  iterationNumbersList: string;
  iterationSavesBlock: string;
  stylingQualityItem: string;
  screenshotSection?: string;
  referenceNodesSection?: string;
}

export function elementIterationPrompt(vars: ElementIterationPromptVars): string {
  return fillTemplate(prompt, vars as unknown as Record<string, string>);
}

// ---------------------------------------------------------------------------
// Iteration-from-iteration variant for element targeting
// ---------------------------------------------------------------------------

const fromIterationPrompt = `
{{skillSection}}
ELEMENT-TARGETED ITERATION REQUEST (from existing iteration)
══════════════════════════════════════════════════════════════

Component: {{componentName}}
Original source: {{sourcePath}}
Base iteration: {{iterationSourcePath}}
Iterations requested: {{iterationCount}}
Depth: {{depthLabel}}
{{childrenSection}}
Props interface (DO NOT MODIFY):
{{propsInterface}}
{{screenshotSection}}
{{referenceNodesSection}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{elementSelectionsSection}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCTIONS

1. Read the generation guide: src/app/playground/docs/ITERATION-GUIDE.md
2. Read the BASE ITERATION at: {{iterationSourcePath}}
3. Also read the ORIGINAL component for context: {{sourcePath}}
4. **Copy the base iteration file verbatim** into each new iteration file
5. **Only modify the targeted elements** described above — everything else must remain pixel-identical
6. Generate {{iterationCount}} variations numbered {{iterationNumbersList}}. Process iterations ONE AT A TIME in the order listed below. For each iteration, complete ALL of the following steps before moving to the next:
   a. Create and save the iteration file
   b. Include metadata with @iteration, @parent, @sourceIteration {{sourceIterationFilename}}, and @description
   c. Immediately register that file in src/app/playground/iterations/index.ts (map key MUST include ".tsx")
   d. Immediately add a matching entry to src/app/playground/iterations/tree.json with parent set to "{{treeParent}}"
   e. Only then start the next iteration

   This sequential approach ensures each iteration is visible on the canvas as soon as it's done.

Files to create (in this order):
{{iterationSavesBlock}}

IMPORTANT
- Iteration numbers MUST be {{iterationNumbersList}} — do NOT reuse existing iteration numbers
{{customInstructionsSection}}
CRITICAL REQUIREMENTS
- **Copy first, edit second**: Start from an exact copy of the base iteration. Only then apply changes to the targeted elements.
- **Surgical edits only**: Do NOT redesign the layout, restructure the component, or restyle non-targeted elements.
- **Props interface**: Keep it IDENTICAL to the original component (no added/removed/renamed props, no type changes).
- **Tree manifest**: Update src/app/playground/iterations/tree.json for each new iteration file.
- **Registry index**: Register each iteration in src/app/playground/iterations/index.ts with a ".tsx" key.
- Include @sourceIteration {{sourceIterationFilename}} in the metadata comment
- Each iteration must modify the targeted elements differently — they should be visually distinct from each other.

QUALITY CHECKLIST (apply to EACH iteration)
- [ ] Props interface unchanged from original
- [ ] All non-targeted elements are pixel-identical to the base iteration
- [ ] Only the targeted elements have been modified
- [ ] All imports resolve correctly with no TypeScript errors
- [ ] Metadata comment included with correct @iteration/@parent/@sourceIteration
- [ ] File named correctly: {{cleanComponentName}}.iteration-{N}.tsx (filename prefix matches the default export function name)
- [ ] {{stylingQualityItem}}
- [ ] Registered in iterations/index.ts with a ".tsx" key
- [ ] Entry added/updated in iterations/tree.json with correct parent

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate all {{iterationCount}} iterations now.`;

export interface ElementIterationFromIterationPromptVars {
  skillSection?: string;
  componentName: string;
  sourcePath: string;
  iterationSourcePath: string;
  depthLabel: string;
  childrenSection?: string;
  propsInterface: string;
  cleanComponentName: string;
  componentId: string;
  customInstructionsSection?: string;
  elementSelectionsSection: string;
  iterationCount: string;
  iterationNumbersList: string;
  iterationSavesBlock: string;
  treeParent: string;
  sourceIterationFilename: string;
  stylingQualityItem: string;
  screenshotSection?: string;
  referenceNodesSection?: string;
}

export function elementIterationFromIterationPrompt(
  vars: ElementIterationFromIterationPromptVars,
): string {
  return fillTemplate(fromIterationPrompt, vars as unknown as Record<string, string>);
}
