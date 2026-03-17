export function fillTemplate(template: string, vars: Record<string, string>): string {
  const result = template.replace(/{{(\w+)}}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key] ?? '';
    }
    return '';
  });

  return result;
}
