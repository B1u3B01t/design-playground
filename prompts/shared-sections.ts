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
export const FILE_REGISTRATION_INSTRUCTIONS = `IMPORTANT — SEQUENTIAL WORKFLOW: Process iterations ONE AT A TIME. For each iteration, complete ALL of the following steps before starting the next:
   a. Create and save the iteration file
   b. Include the required metadata comment block with @iteration, @parent, optional @sourceIteration, and @description
   c. Immediately register that file in: src/app/playground/iterations/index.ts (map key MUST include ".tsx")
   d. Immediately add a matching entry to: src/app/playground/iterations/tree.json with parent set to "{{componentId}}"
   e. Only then proceed to the next iteration

   This sequential approach ensures each iteration is visible on the canvas as soon as it's done.`;

/** Props constraint block shared across templates */
export const PROPS_CONSTRAINT = `- **Props interface**: Keep it IDENTICAL to the original component (no added/removed/renamed props, no type changes).
- **Iteration depth**: Follow the requested depth (Shell only, 1 level deep, or All levels).
- **Tree manifest**: Update src/app/playground/iterations/tree.json for every new iteration file.
- **Registry index**: Register every iteration in src/app/playground/iterations/index.ts with a ".tsx" map key.`;

// ---------------------------------------------------------------------------
// Prompt section formatters
// ---------------------------------------------------------------------------

export function formatChildrenSection(children?: string[]): string {
  if (!children || children.length === 0) return '';
  return `
Children to keep stable:
${children.map((c) => `- ${c}`).join('\n')}
`;
}

export function formatCustomInstructionsSection(customInstructions?: string): string {
  if (!customInstructions || !customInstructions.trim()) return '';
  return `

CUSTOM INSTRUCTIONS:
${customInstructions.trim()}

`;
}

export function formatSkillSection(skillPrompt?: string): string {
  if (!skillPrompt || !skillPrompt.trim()) return '';
  return `SKILL CONTEXT
══════════════

${skillPrompt.trim()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
}

export function formatScreenshotSection(screenshotPath?: string): string {
  if (!screenshotPath || !screenshotPath.trim()) return '';
  return `
CURRENT VISUAL STATE
Screenshot of the current component: ${screenshotPath.trim()}
Read this image to understand the current appearance before generating variations.
`;
}

export function formatReferenceNodesSection(
  nodes?: {
    componentName: string;
    type: 'component' | 'iteration';
    sourceFilename?: string;
    sourcePath?: string;
    screenshotPath?: string;
  }[],
): string {
  if (!nodes || nodes.length === 0) return '';

  const lines: string[] = [
    'REFERENCE COMPONENTS',
    '════════════════════',
    '',
    'The following components are selected on the canvas as design references.',
    'Use their visual style, structure, and patterns as context.',
    '',
  ];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const typeLabel = node.type === 'iteration' ? 'iteration' : 'component';
    const path = node.sourcePath || (node.sourceFilename
      ? `src/app/playground/iterations/${node.sourceFilename}`
      : undefined);

    lines.push(`${i + 1}. ${node.componentName} (${typeLabel})${path ? ` — ${path}` : ''}`);

    if (node.screenshotPath) {
      lines.push(`   Screenshot: ${node.screenshotPath}`);
    }

    lines.push('');
  }

  lines.push('Maintain visual and structural consistency with these reference components.');
  lines.push('Read the source code of each reference to understand the design patterns in use.');

  return lines.join('\n');
}

export function formatElementSelectionsSection(
  elements?: {
    tagName: string;
    displayName: string;
    textContent: string;
    cssSelector: string;
    htmlSource: string;
    ancestorComponents: string[];
    nodeId: string;
    componentName: string;
  }[],
): string {
  if (!elements || elements.length === 0) return '';

  const lines: string[] = [
    'TARGETED ELEMENTS',
    '══════════════════',
    '',
  ];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    lines.push(`Element ${i + 1}: <${el.tagName}> in ${el.componentName}`);

    if (el.textContent) {
      lines.push(`- Text: "${el.textContent}"`);
    }

    if (el.cssSelector) {
      lines.push(`- Selector: ${el.cssSelector}`);
    }

    if (el.htmlSource) {
      lines.push(`- HTML: ${el.htmlSource}`);
    }

    if (el.ancestorComponents.length > 0) {
      lines.push(`- Component ancestry: ${el.ancestorComponents.join(' > ')}`);
    }

    lines.push('');
  }

  lines.push('Focus your changes on these specific elements while keeping the rest of the component intact.');

  return lines.join('\n');
}
