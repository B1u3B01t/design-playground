export function fillTemplate(template: string, vars: Record<string, string>): string {
  const result = template.replace(/{{(\w+)}}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key] ?? '';
    }
    return '';
  });

  return result;
}

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

