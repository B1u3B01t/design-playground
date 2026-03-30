/**
 * Returns true if the text looks like JSX/TSX source code.
 * Checks text/plain clipboard data — code editors always put source there.
 * Plain HTML never has `import` or `export default`, so this correctly
 * distinguishes JSX from HTML before the HTML-paste path fires.
 */
export function looksLikeJsx(text: string): boolean {
  if (!text) return false;
  const hasImport = /\bimport\s+/.test(text);
  const hasExportDefault = /\bexport\s+default\b/.test(text);
  const hasReactImport = /from\s+['"]react['"]/.test(text);
  const hasCapitalTag = /<[A-Z][A-Za-z0-9]*[\s/>]/.test(text);
  const hasCurlyInJsx = /\{[^}]+\}/.test(text) && /<[a-zA-Z]/.test(text);
  return hasImport || hasExportDefault || hasReactImport || (hasCapitalTag && hasCurlyInJsx);
}

/**
 * Normalizes pasted TSX/JSX into a valid React module with:
 *   - 'use client' directive at the top
 *   - A default export
 *
 * Three cases:
 * 1. Full component with `export default` → prepend 'use client' if missing, return as-is.
 * 2. Named/arrow function without default export → prepend 'use client', append `export default FnName;`.
 * 3. Bare JSX fragment → wrap in a generated function component.
 *
 * @param source       Raw clipboard text (may include browser clipboard markers)
 * @param componentName  PascalCase name for the generated component (e.g. "Frame1")
 */
export function wrapJsxComponent(source: string, componentName: string): string {
  // Strip browser clipboard markers
  let cleaned = source
    .replace(/<!--StartFragment-->/gi, '')
    .replace(/<!--EndFragment-->/gi, '')
    .trim();

  const hasClientDirective = /^['"]use client['"]/.test(cleaned);
  const clientDirective = "'use client';\n\n";

  // Case 1: already has a default export — use as-is (just ensure 'use client')
  if (/export\s+default\s+(function|class|const|[A-Z(])/.test(cleaned) || /export\s+default\s+[a-zA-Z_$]/.test(cleaned)) {
    if (!hasClientDirective) {
      return clientDirective + cleaned;
    }
    return cleaned;
  }

  // Case 2: named function or arrow component without default export
  const fnMatch = cleaned.match(/^(?:export\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/);
  if (fnMatch) {
    const fnName = fnMatch[1];
    // Remove leading 'export ' if present (we add our own default export)
    const body = cleaned.replace(/^export\s+/, '');
    const needsReactImport = !body.includes("from 'react'") && !body.includes('from "react"');
    const reactImport = needsReactImport ? "import React from 'react';\n\n" : '';
    return `${clientDirective}${reactImport}${body}\n\nexport default ${fnName};\n`;
  }

  // Case 3: bare JSX fragment — wrap in a generated function component
  const needsReactImport = !cleaned.includes("from 'react'") && !cleaned.includes('from "react"');
  const reactImport = needsReactImport ? "import React from 'react';\n\n" : '';
  return `${clientDirective}${reactImport}function ${componentName}() {\n  return (\n    <div>\n      ${cleaned.split('\n').join('\n      ')}\n    </div>\n  );\n}\n\nexport default ${componentName};\n`;
}
