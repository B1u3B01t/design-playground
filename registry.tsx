import { ComponentType } from 'react';
import type { ComponentSize } from './lib/constants';
import PricingCard from './examples/PricingCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegistryGroupItem {
  id: string;
  label: string;
  children: RegistryItem[];
}

// Re-export ComponentSize from constants for backward compatibility
export type { ComponentSize } from './lib/constants';

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

const pricingCardProps = {
  planName: 'Pro',
  price: '$29',
  period: 'month',
  description: 'For growing teams that need more power and flexibility.',
  features: [
    'Unlimited projects',
    'Priority support',
    'Advanced analytics',
    'Custom integrations',
    'Team collaboration',
  ],
  ctaLabel: 'Get started',
  highlighted: true,
  badge: 'Most Popular',
};

// ---------------------------------------------------------------------------
// Registry tree
// ---------------------------------------------------------------------------

export const registry: RegistryItem[] = [
  {
    id: 'examples',
    label: 'Examples',
    children: [
      {
        id: 'pricing-card',
        label: 'Pricing Card',
        Component: PricingCard as unknown as ComponentType<Record<string, unknown>>,
        props: pricingCardProps,
        sourcePath: 'src/app/playground/examples/PricingCard.tsx',
        propsInterface: `interface PricingCardProps {
  planName: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
  badge?: string;
  onCtaClick?: () => void;
}`,
      },
    ],
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
6. Update src/app/playground/iterations/tree.json — add an entry for each new iteration with parent set to "${componentId}"
${customInstructionsSection}
CONSTRAINTS
- Keep props interface identical
- Use only existing Tailwind classes
- Include metadata comment in each file (see ITERATION-GUIDE.md for format)
- Make each iteration meaningfully different

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate the iterations now.`;
}

// ---------------------------------------------------------------------------
// Iteration-from-iteration prompt generator
// ---------------------------------------------------------------------------

export function generateIterationFromIterationPrompt(
  componentId: string,
  sourceIterationFilename: string,
  iterationCount: number,
  startNumber: number,
  depth: 'shell' | '1-level' | 'all' = 'shell',
  customInstructions?: string
): string {
  const item = flatRegistry[componentId];
  if (!item) return '';

  const componentName = item.label.replace(/\s*\(.*\)/, '');
  const cleanComponentName = componentName.replace(/\s+/g, '');
  const depthLabel = depth === 'shell' ? 'Shell only' : depth === '1-level' ? '1 level deep' : 'All levels';
  const endNumber = startNumber + iterationCount - 1;
  const iterationSourcePath = `src/app/playground/iterations/${sourceIterationFilename}`;

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

  const iterationNumbers = Array.from(
    { length: iterationCount },
    (_, i) => startNumber + i,
  );

  return `ITERATION REQUEST (from existing iteration)
═════════════════════════════════════════════

Component: ${componentName}
Original source: ${item.sourcePath}
Base iteration: ${iterationSourcePath}
Iterations requested: ${iterationCount} (numbered ${startNumber}–${endNumber})
Depth: ${depthLabel}
${childrenSection}
Props interface (DO NOT MODIFY):
${item.propsInterface}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCTIONS

1. Read the generation guide: src/app/playground/docs/ITERATION-GUIDE.md
2. Read the BASE ITERATION at: ${iterationSourcePath}
3. Also read the ORIGINAL component for context: ${item.sourcePath}
4. Generate ${iterationCount} new variations based on the base iteration
5. Save each as:
${iterationNumbers.map(n => `   - src/app/playground/iterations/${cleanComponentName}.iteration-${n}.tsx`).join('\n')}
6. Register ALL iterations (old and new) in: src/app/playground/iterations/index.ts
7. Update src/app/playground/iterations/tree.json — add an entry for each new iteration with parent set to "${sourceIterationFilename}"
${customInstructionsSection}
IMPORTANT
- Use the BASE ITERATION as your starting point, NOT the original component
- Each new variation should diverge from the base iteration in meaningful ways
- Iteration numbers MUST be ${iterationNumbers.join(', ')} (continuing from existing iterations)
- Include @sourceIteration ${sourceIterationFilename} in each file's metadata comment

CONSTRAINTS
- Keep props interface identical
- Use only existing Tailwind classes
- Include metadata comment in each file (with correct @iteration number AND @sourceIteration)
- Make each iteration meaningfully different from the base and from each other

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
