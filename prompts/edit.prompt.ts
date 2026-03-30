/**
 * Prompt for in-place file editing (edit mode).
 */

export interface EditPromptOptions {
  filePath: string;
  customInstructions: string;
  skillPrompt?: string;
  screenshotPath?: string;
  referenceNodesSection?: string;
  elementSelections?: Array<{
    tagName: string;
    displayName?: string;
    textContent?: string;
    cssSelector?: string;
    htmlSource?: string;
    ancestorComponents?: string[];
  }>;
}

export function editPrompt(opts: EditPromptOptions): string {
  const sections: string[] = [];

  sections.push(
    `Edit the file at ${opts.filePath} according to the following instructions.`,
    'Do NOT create new files. Modify the existing file in-place.',
  );

  // JSX canvas-components must stay fully self-contained
  if (opts.filePath.includes('canvas-components/')) {
    sections.push(
      `## Self-Contained Component Rules\n` +
      `This file is a canvas-component that renders inside the playground. It MUST remain fully self-contained:\n` +
      `- The ONLY allowed import is 'react' (e.g. import React, { useState } from 'react')\n` +
      `- Do NOT add imports for any UI library: no shadcn/ui, no @radix-ui, no lucide-react, no @/components, no next/image, no next/link, no framer-motion, no other packages\n` +
      `- Use ONLY inline styles or style objects — no Tailwind classes, no external CSS imports, no CSS modules\n` +
      `- All icons, images, and assets must be inline SVG or CSS-based\n` +
      `- Keep 'use client' directive and default export`,
    );
  }

  if (opts.skillPrompt) {
    sections.push('## Guidelines\n' + opts.skillPrompt);
  }

  if (opts.screenshotPath) {
    sections.push(
      `## Current Screenshot\nA screenshot of the current state has been saved to: ${opts.screenshotPath}\nUse this as visual reference for what needs to change.`,
    );
  }

  if (opts.elementSelections && opts.elementSelections.length > 0) {
    const selLines = opts.elementSelections.map((el) => {
      const parts = [`- **${el.displayName || el.tagName}**`];
      if (el.cssSelector) parts.push(`  Selector: \`${el.cssSelector}\``);
      if (el.textContent) parts.push(`  Text: "${el.textContent.slice(0, 200)}"`);
      if (el.htmlSource) parts.push(`  HTML:\n\`\`\`html\n${el.htmlSource}\n\`\`\``);
      if (el.ancestorComponents?.length) parts.push(`  Ancestors: ${el.ancestorComponents.join(' > ')}`);
      return parts.join('\n');
    });
    sections.push('## Selected Elements\nApply changes specifically to these selected elements:\n' + selLines.join('\n\n'));
  }

  if (opts.referenceNodesSection) {
    sections.push('## Reference Nodes\n' + opts.referenceNodesSection);
  }

  sections.push('## Instructions\n' + opts.customInstructions);

  return sections.join('\n\n');
}
