import { ComponentType } from 'react';
import SubscriptionExpiringBannerPreview from './previews/SubscriptionExpiringBanner.preview';


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
  {
    id: 'subscription-expiring-banner',
    label: 'Subscription Expiring Banner',
    Component: SubscriptionExpiringBannerPreview,
    props: {
      isPro: true,
      subscriptionEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
      subscriptionStatus: 'active',
    },
    sourcePath: 'src/components/SubscriptionExpiringBanner.tsx',
    propsInterface: `{
  isPro?: boolean;
  subscriptionEndsAt?: string | null;
  subscriptionStatus?: string | null;
}`,
  },
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

// ---------------------------------------------------------------------------
// Adopt prompt generator
// ---------------------------------------------------------------------------

export function generateAdoptPrompt(
  componentId: string,
  iterationFilename: string
): string {
  const item = flatRegistry[componentId];
  const originalPath = item?.sourcePath || `src/components/${iterationFilename.split('.iteration')[0]}.tsx`;
  const iterationPath = `src/app/playground/iterations/${iterationFilename}`;

  return `ADOPT ITERATION
═══════════════

Original Component: ${originalPath}
Iteration to Adopt: ${iterationPath}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TASK

Replace the UI implementation of the original component with the layout/styling from the iteration, while ensuring ZERO breaking changes.

INSTRUCTIONS

1. Read both files:
   - Original: ${originalPath}
   - Iteration: ${iterationPath}

2. In the ORIGINAL component file:
   - Replace the JSX/render logic with the iteration's layout
   - Keep ALL existing imports that are still needed
   - Keep the EXACT same props interface and types
   - Keep ALL existing function logic (handlers, effects, computed values)
   - Keep the same export (default/named) as before

3. Do NOT:
   - Change the props interface in any way
   - Remove any existing functionality
   - Change the component's public API
   - Rename the component
   - Move the file

VERIFICATION CHECKLIST

Before saving, verify:
- [ ] Props interface is IDENTICAL to before
- [ ] All existing imports still resolve
- [ ] No TypeScript errors
- [ ] Component name unchanged
- [ ] Export style unchanged (default/named)
- [ ] All event handlers preserved
- [ ] All hooks/effects preserved
- [ ] File location unchanged

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Adopt the iteration now. Only modify the original component file.`;
}
