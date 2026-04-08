// ---------------------------------------------------------------------------
// Unit Parsing & Conversion Utilities
// ---------------------------------------------------------------------------

export type CSSUnit = 'px' | 'rem' | 'em' | '%' | 'auto' | 'vh' | 'vw' | 'none';

export interface ParsedValue {
  number: number | null;
  unit: CSSUnit;
  raw: string;
}

export interface ConversionContext {
  parentSize?: number;
  rootFontSize?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

export const UNIT_OPTIONS: { value: CSSUnit; label: string }[] = [
  { value: 'px', label: 'px' },
  { value: 'rem', label: 'rem' },
  { value: 'em', label: 'em' },
  { value: '%', label: '%' },
  { value: 'auto', label: 'auto' },
  { value: 'vh', label: 'vh' },
  { value: 'vw', label: 'vw' },
];

/**
 * Parse a CSS value string into a number and unit.
 * Handles values like "16px", "1.5rem", "50%", "auto", "none", "0", "normal"
 */
export function parseValue(raw: string): ParsedValue {
  const trimmed = (raw ?? '').trim();

  if (!trimmed || trimmed === 'none' || trimmed === 'normal' || trimmed === 'initial' || trimmed === 'inherit') {
    return { number: null, unit: 'none', raw: trimmed };
  }

  if (trimmed === 'auto') {
    return { number: null, unit: 'auto', raw: trimmed };
  }

  const match = trimmed.match(/^(-?[\d.]+)\s*(px|rem|em|%|vh|vw)?$/);
  if (match) {
    const num = parseFloat(match[1]);
    const unit = (match[2] || 'px') as CSSUnit;
    return { number: num, unit, raw: trimmed };
  }

  // Fallback: try to extract just the number (computed styles often return px)
  const numOnly = parseFloat(trimmed);
  if (!isNaN(numOnly)) {
    return { number: numOnly, unit: 'px', raw: trimmed };
  }

  return { number: null, unit: 'none', raw: trimmed };
}

/**
 * Convert a numeric value between CSS units.
 */
export function convertUnit(
  value: number,
  fromUnit: CSSUnit,
  toUnit: CSSUnit,
  context: ConversionContext = {}
): number {
  if (fromUnit === toUnit) return value;

  const rootFontSize = context.rootFontSize ?? 16;
  const viewportWidth = context.viewportWidth ?? window.innerWidth;
  const viewportHeight = context.viewportHeight ?? window.innerHeight;
  const parentSize = context.parentSize ?? 0;

  // First convert to px
  let px: number;
  switch (fromUnit) {
    case 'px': px = value; break;
    case 'rem': px = value * rootFontSize; break;
    case 'em': px = value * rootFontSize; break; // Approximation
    case '%': px = (value / 100) * parentSize; break;
    case 'vh': px = (value / 100) * viewportHeight; break;
    case 'vw': px = (value / 100) * viewportWidth; break;
    default: px = value;
  }

  // Then convert from px to target
  switch (toUnit) {
    case 'px': return round(px);
    case 'rem': return round(px / rootFontSize);
    case 'em': return round(px / rootFontSize); // Approximation
    case '%': return parentSize ? round((px / parentSize) * 100) : 0;
    case 'vh': return round((px / viewportHeight) * 100);
    case 'vw': return round((px / viewportWidth) * 100);
    default: return round(px);
  }
}

/**
 * Format a number + unit as a CSS value string.
 */
export function formatValue(num: number | null, unit: CSSUnit): string {
  if (unit === 'auto') return 'auto';
  if (unit === 'none' || num === null) return '';
  if (num === 0) return '0';
  return `${num}${unit}`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Convert an rgb/rgba color string to a hex color.
 * Returns the input if it's already hex or not parseable.
 */
export function rgbToHex(rgb: string): string {
  const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgb.startsWith('#') ? rgb : '#000000';
  const r = parseInt(match[1]).toString(16).padStart(2, '0');
  const g = parseInt(match[2]).toString(16).padStart(2, '0');
  const b = parseInt(match[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}
