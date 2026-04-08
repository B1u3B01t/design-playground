// ---------------------------------------------------------------------------
// Multi-Select Property Intersection
// ---------------------------------------------------------------------------
// Computes shared styles across multiple selected elements (Figma-like).
// ---------------------------------------------------------------------------

import type { ComputedStyles } from '../lib/computed-styles';

export interface SharedStyles extends Partial<ComputedStyles> {
  /** Properties that have different values across selections */
  mixed: Set<string>;
}

/**
 * Compute the intersection of computed styles across multiple elements.
 * Properties with the same value across all elements are included.
 * Properties with different values are marked as 'mixed'.
 */
export function computeSharedStyles(
  stylesMap: Map<string, ComputedStyles>
): SharedStyles {
  const entries = Array.from(stylesMap.values());

  if (entries.length === 0) {
    return { mixed: new Set() };
  }

  if (entries.length === 1) {
    return { ...entries[0], mixed: new Set() };
  }

  // Cap at 10 elements for performance
  const capped = entries.slice(0, 10);

  const shared: Partial<ComputedStyles> = {};
  const mixed = new Set<string>();

  const allKeys = Object.keys(capped[0]) as (keyof ComputedStyles)[];
  for (const key of allKeys) {
    const firstValue = capped[0][key];
    const allSame = capped.every((s) => s[key] === firstValue);
    if (allSame) {
      (shared as Record<string, string>)[key] = firstValue;
    } else {
      mixed.add(key);
    }
  }

  return { ...shared, mixed };
}
