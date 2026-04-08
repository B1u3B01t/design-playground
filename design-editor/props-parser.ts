// ---------------------------------------------------------------------------
// Props Interface Parser
// ---------------------------------------------------------------------------
// Lightweight regex parser for TypeScript props interface strings.
// Handles simple types; falls back to 'complex' for anything it can't parse.
// ---------------------------------------------------------------------------

export interface ParsedProp {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'string-union' | 'complex';
  required: boolean;
  options?: string[];
  rawType: string;
}

/**
 * Parse a propsInterface string (raw TypeScript) into a list of parsed props.
 *
 * Handles:
 *   name?: string
 *   name: number
 *   name: boolean
 *   name: 'a' | 'b' | 'c'
 *   name?: "default" | "outline" | "ghost"
 *   anything else → complex
 */
export function parsePropsInterface(propsInterface: string): ParsedProp[] {
  if (!propsInterface) return [];

  const props: ParsedProp[] = [];

  // Strip interface/type wrapper
  let body = propsInterface
    .replace(/^(export\s+)?(interface|type)\s+\w+(\s*=)?\s*\{?/, '')
    .replace(/\}\s*$/, '')
    .trim();

  // Split by semicolons or newlines (handling both)
  const lines = body.split(/[;\n]/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Skip comments
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;

    // Match: name? : type
    const match = line.match(/^(\w+)(\??):\s*(.+?)\s*$/);
    if (!match) continue;

    const [, name, optional, rawType] = match;
    const required = optional !== '?';

    // Check for string union: 'a' | 'b' | 'c' or "a" | "b" | "c"
    const unionMatch = rawType.match(/^(['"][\w-]+['"]\s*\|\s*)*['"][\w-]+['"]$/);
    if (unionMatch) {
      const options = rawType.match(/['"]([^'"]+)['"]/g)?.map((s) => s.replace(/['"]/g, '')) ?? [];
      props.push({ name, type: 'string-union', required, options, rawType });
      continue;
    }

    // Simple types
    const trimmedType = rawType.replace(/\s/g, '');
    if (trimmedType === 'string') {
      props.push({ name, type: 'string', required, rawType });
    } else if (trimmedType === 'number') {
      props.push({ name, type: 'number', required, rawType });
    } else if (trimmedType === 'boolean') {
      props.push({ name, type: 'boolean', required, rawType });
    } else {
      props.push({ name, type: 'complex', required, rawType });
    }
  }

  return props;
}
