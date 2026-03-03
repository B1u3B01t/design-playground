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

