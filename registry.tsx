import { ComponentType } from 'react';


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegistryGroupItem {
  id: string;
  label: string;
  children: RegistryItem[];
}

export type ComponentSize = 'default' | 'laptop' | 'tablet' | 'mobile';

export interface RegistryLeafItem {
  id: string;
  label: string;
  Component: ComponentType<Record<string, unknown>>;
  props?: Record<string, unknown>;
  getProps?: () => Promise<Record<string, unknown>> | Record<string, unknown>;
  // Iteration metadata
  sourcePath: string;
  propsInterface: string;
  children?: string[]; // Child component names that can be iterated
  size?: ComponentSize; // Display size for the component preview
}

export type RegistryItem = RegistryGroupItem | RegistryLeafItem;

export function isGroup(item: RegistryItem): item is RegistryGroupItem {
  return 'children' in item && !('Component' in item);
}

export function isLeaf(item: RegistryItem): item is RegistryLeafItem {
  return 'Component' in item;
}

// ---------------------------------------------------------------------------
// Sample data for components
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Registry tree
// ---------------------------------------------------------------------------

export const registry: RegistryItem[] = [
];

// ---------------------------------------------------------------------------
// Flatten helper
// ---------------------------------------------------------------------------

export function flattenRegistry(
  items: RegistryItem[],
  result: Record<string, RegistryLeafItem> = {}
): Record<string, RegistryLeafItem> {
  for (const item of items) {
    if (isLeaf(item)) {
      result[item.id] = item;
    } else if (isGroup(item)) {
      flattenRegistry(item.children, result);
    }
  }
  return result;
}

export const flatRegistry = flattenRegistry(registry);

// ---------------------------------------------------------------------------
// Prompt generator
// ---------------------------------------------------------------------------

export function generateIterationPrompt(
  componentId: string,
  iterationCount: number = 4,
  depth: 'shell' | '1-level' | 'all' = 'shell',
  customInstructions?: string
): string {
  const item = flatRegistry[componentId];
  if (!item) return '';

  const depthLabel = depth === 'shell' ? 'Shell only' : depth === '1-level' ? '1 level deep' : 'All levels';
  
  const childrenSection = item.children && item.children.length > 0
    ? `
Children to keep stable:
${item.children.map(c => `- ${c}`).join('\n')}
`
    : '';

  const customInstructionsSection = customInstructions && customInstructions.trim()
    ? `

CUSTOM INSTRUCTIONS:
${customInstructions.trim()}

`
    : '';

  return `ITERATION REQUEST
═════════════════

Component: ${item.label.replace(/\s*\(.*\)/, '')}
Source: ${item.sourcePath}
Iterations requested: ${iterationCount}
Depth: ${depthLabel}
${childrenSection}
Props interface (DO NOT MODIFY):
${item.propsInterface}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCTIONS

1. Read the generation guide: src/app/playground/docs/ITERATION-GUIDE.md
2. Read the source component at the path above
3. Generate ${iterationCount} variations
4. Save each as: src/app/playground/iterations/${item.label.replace(/\s*\(.*\)/, '').replace(/\s+/g, '')}.iteration-{n}.tsx
5. Register iterations in: src/app/playground/iterations/index.ts
${customInstructionsSection}
CONSTRAINTS
- Keep props interface identical
- Use only existing Tailwind classes
- Include metadata comment in each file
- Make each iteration meaningfully different

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate the iterations now.`;
}

