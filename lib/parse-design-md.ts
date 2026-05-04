/**
 * Minimal client-safe parser for DESIGN.md front-matter.
 *
 * The @google/design.md schema is intentionally small and predictable
 * (colors / typography / spacing / rounded / components) so we can hand-parse
 * it without bundling a YAML library. This trades exhaustiveness for zero
 * deps — anything the parser doesn't recognise is silently ignored.
 */

export interface ParsedTypography {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string | number;
  lineHeight?: string | number;
  letterSpacing?: string;
}

export interface ParsedComponent {
  backgroundColor?: string;
  textColor?: string;
  typography?: string;
  rounded?: string;
  padding?: string;
  size?: string;
  height?: string;
  width?: string;
}

export interface ParsedDesignSystem {
  name?: string;
  description?: string;
  colors: Record<string, string>;
  typography: Record<string, ParsedTypography>;
  spacing: Record<string, string>;
  rounded: Record<string, string>;
  components: Record<string, ParsedComponent>;
}

const EMPTY: ParsedDesignSystem = {
  colors: {},
  typography: {},
  spacing: {},
  rounded: {},
  components: {},
};

function stripQuotes(v: string): string {
  const trimmed = v.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function indent(line: string): number {
  let i = 0;
  while (i < line.length && line[i] === ' ') i++;
  return i;
}

function extractFrontMatter(md: string): string | null {
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return match ? match[1] : null;
}

/**
 * Stable, isomorphic hash of a DESIGN.md's YAML front-matter. Used to detect
 * when the LLM-generated philosophy showcase has drifted out of sync with the
 * tokens. Not cryptographic — collision resistance isn't required, only
 * change detection across edits. FNV-1a 32-bit, hex-encoded.
 */
export function hashFrontMatter(designMd: string): string {
  const yaml = extractFrontMatter(designMd) ?? '';
  let hash = 0x811c9dc5;
  for (let i = 0; i < yaml.length; i++) {
    hash ^= yaml.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Parse the YAML front-matter of a DESIGN.md file. Returns an empty system on failure. */
export function parseDesignMd(md: string): ParsedDesignSystem {
  const yaml = extractFrontMatter(md);
  if (!yaml) return { ...EMPTY };

  const result: ParsedDesignSystem = {
    name: undefined,
    description: undefined,
    colors: {},
    typography: {},
    spacing: {},
    rounded: {},
    components: {},
  };

  const lines = yaml.split(/\r?\n/);
  let topKey: keyof ParsedDesignSystem | null = null;
  let nestedKey: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const ind = indent(raw);
    const content = raw.trim();

    // Top-level key: `colors:`, `typography:`, etc, OR scalar like `name: "x"`
    if (ind === 0) {
      const m = content.match(/^([A-Za-z_-][\w-]*):\s*(.*)$/);
      if (!m) {
        topKey = null;
        nestedKey = null;
        continue;
      }
      const key = m[1];
      const value = m[2];
      if (key === 'name') {
        result.name = stripQuotes(value);
        topKey = null;
      } else if (key === 'description') {
        result.description = stripQuotes(value);
        topKey = null;
      } else if (
        key === 'colors' ||
        key === 'typography' ||
        key === 'spacing' ||
        key === 'rounded' ||
        key === 'components'
      ) {
        topKey = key;
        nestedKey = null;
      } else {
        topKey = null;
        nestedKey = null;
      }
      continue;
    }

    if (!topKey) continue;

    // 2-space indent: a token name OR a scalar entry under a flat block
    if (ind === 2) {
      const m = content.match(/^([A-Za-z_-][\w-]*):\s*(.*)$/);
      if (!m) continue;
      const name = m[1];
      const value = m[2];

      if (topKey === 'colors' || topKey === 'spacing' || topKey === 'rounded') {
        if (value !== '') {
          (result[topKey] as Record<string, string>)[name] = stripQuotes(value);
        }
        nestedKey = null;
      } else if (topKey === 'typography') {
        if (value === '') {
          // Beginning of a nested role definition (e.g. `h1:`)
          nestedKey = name;
          result.typography[name] = {};
        } else {
          // Inline value (rare for typography but be tolerant)
          result.typography[name] = { fontFamily: stripQuotes(value) };
          nestedKey = null;
        }
      } else if (topKey === 'components') {
        if (value === '') {
          nestedKey = name;
          result.components[name] = {};
        } else {
          nestedKey = null;
        }
      }
      continue;
    }

    // 4-space indent: properties of a typography role / component
    if (ind === 4 && nestedKey) {
      const m = content.match(/^([A-Za-z_-][\w-]*):\s*(.*)$/);
      if (!m) continue;
      const propName = m[1];
      const propValue = stripQuotes(m[2]);
      if (topKey === 'typography') {
        const role = result.typography[nestedKey];
        if (!role) continue;
        if (propName === 'fontFamily') role.fontFamily = propValue;
        else if (propName === 'fontSize') role.fontSize = propValue;
        else if (propName === 'fontWeight')
          role.fontWeight = isNaN(Number(propValue)) ? propValue : Number(propValue);
        else if (propName === 'lineHeight')
          role.lineHeight = isNaN(Number(propValue)) ? propValue : Number(propValue);
        else if (propName === 'letterSpacing') role.letterSpacing = propValue;
      } else if (topKey === 'components') {
        const comp = result.components[nestedKey];
        if (!comp) continue;
        if (propName === 'backgroundColor') comp.backgroundColor = propValue;
        else if (propName === 'textColor') comp.textColor = propValue;
        else if (propName === 'typography') comp.typography = propValue;
        else if (propName === 'rounded') comp.rounded = propValue;
        else if (propName === 'padding') comp.padding = propValue;
        else if (propName === 'size') comp.size = propValue;
        else if (propName === 'height') comp.height = propValue;
        else if (propName === 'width') comp.width = propValue;
      }
      continue;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Token reference resolution: {colors.primary} → "#1A1C1E"
// ---------------------------------------------------------------------------

export function resolveToken(
  ref: string | undefined,
  ds: ParsedDesignSystem,
): string | undefined {
  if (!ref) return undefined;
  const m = ref.match(/^\{([^}]+)\}$/);
  if (!m) return ref; // already a literal
  const path = m[1].split('.');
  if (path.length < 2) return undefined;
  const [bucket, ...rest] = path;
  if (bucket === 'colors') return ds.colors[rest.join('.')];
  if (bucket === 'spacing') return ds.spacing[rest.join('.')];
  if (bucket === 'rounded') return ds.rounded[rest.join('.')];
  if (bucket === 'typography') {
    const role = ds.typography[rest.join('.')];
    return role?.fontFamily;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Color helpers — used to render tonal scales next to base colors.
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    if ([r, g, b].some(isNaN)) return null;
    return { r, g, b };
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    if ([r, g, b].some(isNaN)) return null;
    return { r, g, b };
  }
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mix(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

/** Generate an 11-stop tonal scale from a base hex, dark→light. */
export function tonalScale(hex: string): string[] {
  const base = hexToRgb(hex);
  if (!base) return [];
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };
  const stops: string[] = [];
  // Dark side: mix with black at 80%, 60%, 40%, 20%
  for (const t of [0.8, 0.6, 0.4, 0.2]) {
    const m = mix(black, base, 1 - t);
    stops.push(rgbToHex(m.r, m.g, m.b));
  }
  // Base
  stops.push(hex.startsWith('#') ? hex.toUpperCase() : `#${hex.toUpperCase()}`);
  // Light side: mix with white at 20%, 40%, 60%, 80%, 92%, 98%
  for (const t of [0.2, 0.4, 0.6, 0.8, 0.92, 0.98]) {
    const m = mix(base, white, t);
    stops.push(rgbToHex(m.r, m.g, m.b));
  }
  return stops;
}

/** Return black or white, whichever has better contrast on the given hex. */
export function readableTextColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000';
  // Relative luminance per WCAG
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  return L > 0.5 ? '#000' : '#fff';
}

/** Pick a sensible "surface" color for component cards from the parsed system. */
export function pickSurfaceColor(ds: ParsedDesignSystem): string {
  return (
    ds.colors.neutral ||
    ds.colors.background ||
    ds.colors['neutral-100'] ||
    ds.colors.surface ||
    '#F2EBE5'
  );
}
