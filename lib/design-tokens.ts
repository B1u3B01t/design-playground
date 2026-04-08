// ---------------------------------------------------------------------------
// Design Token Extraction
// ---------------------------------------------------------------------------
// Extracts design tokens at runtime from CSS custom properties.
// Used by the design editor sidebar to offer project-aware options.
// ---------------------------------------------------------------------------

export interface DesignToken {
  name: string;
  cssVar: string;
  value: string;
  category: 'color' | 'spacing' | 'radius' | 'font';
}

// ---------------------------------------------------------------------------
// CSS Custom Property extraction
// ---------------------------------------------------------------------------

const COLOR_VAR_NAMES = [
  'background', 'foreground', 'primary', 'primary-foreground',
  'secondary', 'secondary-foreground', 'muted', 'muted-foreground',
  'accent', 'accent-foreground', 'destructive', 'destructive-foreground',
  'border', 'input', 'ring', 'card', 'card-foreground',
  'popover', 'popover-foreground',
  'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5',
  'text-brown', 'text-brown-dark', 'text-brown-light',
  'accent-orange',
  'sidebar', 'sidebar-foreground', 'sidebar-primary', 'sidebar-accent', 'sidebar-border',
];

const RADIUS_VAR_NAMES = ['radius'];

const FONT_VAR_NAMES = ['font-geist-sans', 'font-geist-mono'];

let cachedTokens: DesignToken[] | null = null;

/**
 * Extract all available design tokens from CSS custom properties.
 * Results are cached for the duration of the session.
 */
export function extractDesignTokens(): DesignToken[] {
  if (cachedTokens) return cachedTokens;

  const tokens: DesignToken[] = [];
  const root = document.documentElement;
  const computed = getComputedStyle(root);

  // Color tokens
  for (const name of COLOR_VAR_NAMES) {
    const value = computed.getPropertyValue(`--${name}`).trim();
    if (value) {
      tokens.push({
        name,
        cssVar: `--${name}`,
        value: value.startsWith('hsl') ? value : resolveColor(value),
        category: 'color',
      });
    }
  }

  // Radius tokens
  for (const name of RADIUS_VAR_NAMES) {
    const value = computed.getPropertyValue(`--${name}`).trim();
    if (value) {
      tokens.push({ name, cssVar: `--${name}`, value, category: 'radius' });
    }
  }

  // Font tokens
  for (const name of FONT_VAR_NAMES) {
    const value = computed.getPropertyValue(`--${name}`).trim();
    if (value) {
      tokens.push({ name, cssVar: `--${name}`, value, category: 'font' });
    }
  }

  cachedTokens = tokens;
  return tokens;
}

/**
 * Get color tokens only.
 */
export function getColorTokens(): DesignToken[] {
  return extractDesignTokens().filter((t) => t.category === 'color');
}

/**
 * Get font tokens only.
 */
export function getFontTokens(): DesignToken[] {
  return extractDesignTokens().filter((t) => t.category === 'font');
}

// ---------------------------------------------------------------------------
// Tailwind spacing scale (hardcoded — Tailwind v4 doesn't expose via CSS vars)
// ---------------------------------------------------------------------------

export const TAILWIND_SPACING_SCALE: Record<string, string> = {
  '0': '0px',
  '0.5': '0.125rem',
  '1': '0.25rem',
  '1.5': '0.375rem',
  '2': '0.5rem',
  '2.5': '0.625rem',
  '3': '0.75rem',
  '3.5': '0.875rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '7': '1.75rem',
  '8': '2rem',
  '9': '2.25rem',
  '10': '2.5rem',
  '11': '2.75rem',
  '12': '3rem',
  '14': '3.5rem',
  '16': '4rem',
  '20': '5rem',
  '24': '6rem',
  '28': '7rem',
  '32': '8rem',
  '36': '9rem',
  '40': '10rem',
  '44': '11rem',
  '48': '12rem',
  '52': '13rem',
  '56': '14rem',
  '60': '15rem',
  '64': '16rem',
  '72': '18rem',
  '80': '20rem',
  '96': '24rem',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveColor(value: string): string {
  // If it's an HSL shorthand (e.g., "24 100% 98%"), convert to hsl()
  if (/^\d/.test(value) && value.includes('%')) {
    return `hsl(${value})`;
  }
  return value;
}
