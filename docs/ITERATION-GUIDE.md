# Iteration Generation Guide

This guide is for AI agents (like Cursor) to understand how to generate component iterations.

## Your Task

When a user pastes an iteration prompt, you will:
1. Read the source component
2. Understand its structure and purpose
3. Generate the requested number of variations
4. Save each variation as a separate file in the iterations folder

## Input Format

You will receive a structured prompt like this:

```
ITERATION REQUEST
─────────────────
Component: ArticleCard
Source: src/components/ArticleCard.tsx
Mode: Layout
Depth: Shell only
Iterations: 4

Children to keep stable:
- InsightBadge
- Badge

Props interface (DO NOT CHANGE):
- post: InsightPost
- category?: InsightCategory
- variant?: "minimal" | "expanded"
- className?: string
- onClick?: () => void
```

## Generation Rules

### 1. Props Interface
**NEVER** change the props interface. The iteration must be a drop-in replacement.

```tsx
// ✅ CORRECT - Same props
export default function ArticleCard({ post, category, variant, className, onClick }: Props)

// ❌ WRONG - Changed props
export default function ArticleCard({ post, category, layout, theme }: Props)
```

### 2. Iteration Depth

**Shell only**: Only modify the container component's layout/structure. Keep all child component imports and usage exactly the same.

**1 level deep**: You may also create variations of direct children, but keep their props interfaces stable.

**All levels**: Full freedom to iterate on all nested components.

### 3. File Output

Create files in: `src/app/playground/iterations/`

Naming: `{ComponentName}.iteration-{n}.tsx`

Example:
```
src/app/playground/iterations/
├── ArticleCard.iteration-1.tsx
├── ArticleCard.iteration-2.tsx
├── ArticleCard.iteration-3.tsx
└── ArticleCard.iteration-4.tsx
```

### 4. File Structure

Each iteration file must:

```tsx
"use client";

// Keep same imports as original
import Image from "next/image";
import { cn } from "@/lib/utils";
// ... other imports

// Add iteration metadata comment
/**
 * @iteration 1
 * @parent ArticleCard
 * @sourceIteration ArticleCard.iteration-2.tsx  (only if derived from another iteration)
 * @description Horizontal card layout with image on left
 */

// Keep same type imports/definitions
import type { InsightPost, InsightCategory } from "@/components/ArticleCard";

// Export as default with SAME props interface
export default function ArticleCard({ post, category, variant = "expanded", className, onClick }: {
  post: InsightPost;
  category?: InsightCategory;
  variant?: "minimal" | "expanded";
  className?: string;
  onClick?: () => void;
}) {
  // Your iteration implementation
}
```

### 5. Metadata Comment

Always include the metadata comment block:

```tsx
/**
 * @iteration {number}            - Which iteration this is (1, 2, 3, 4)
 * @parent {ComponentName}        - Original component name
 * @sourceIteration {filename}    - (Optional) The iteration file this was derived from
 * @description {text}            - Brief description of what changed
 */
```

- `@sourceIteration` is **required** when the iteration was generated from another iteration (not directly from the original component). Use the full filename including `.tsx`, e.g. `PricingCard.iteration-1.tsx`.
- `@sourceIteration` should be **omitted** when the iteration was generated directly from the original component.

### 6. Tree Manifest (`tree.json`)

After creating iterations, you **must** update `src/app/playground/iterations/tree.json`. This file tracks the parent-child relationships between iterations.

```json
{
  "version": 1,
  "entries": {
    "PricingCard.iteration-1.tsx": { "parent": "pricing-card" },
    "PricingCard.iteration-2.tsx": { "parent": "pricing-card" },
    "PricingCard.iteration-3.tsx": { "parent": "PricingCard.iteration-1.tsx" }
  }
}
```

- `parent` is either a **registry component ID** (e.g. `"pricing-card"`) for iterations created from the original component, or an **iteration filename** (e.g. `"PricingCard.iteration-1.tsx"`) for iterations created from another iteration.
- If the file doesn't exist yet, create it with `{ "version": 1, "entries": {} }` and add your entries.
- Always **merge** new entries into the existing file — do not overwrite existing entries.

## Layout Guidelines

Focus on structural changes:

| Change Type | Examples |
|-------------|----------|
| Direction | Row ↔ Column, LTR ↔ RTL |
| Alignment | Start, Center, End, Stretch |
| Distribution | Space-between, Space-around, Gap sizes |
| Grid | 1-col → 2-col, Card grid → List |
| Ordering | Image first → Text first |
| Grouping | Flat → Nested sections |
| Responsive | Stack on mobile, Side-by-side on desktop |

### Layout Iteration Examples

**Original**: Vertical card with image on top
- **Iteration 1**: Horizontal card, image left
- **Iteration 2**: Horizontal card, image right  
- **Iteration 3**: Overlay layout, text on image
- **Iteration 4**: Minimal list item style

## Tailwind Constraints

Key principle: **Stick to existing Tailwind classes used in the codebase**. Do not introduce new color values, custom utilities, or CSS-in-JS.

## CRITICAL: Preserve Design Theme

> ⚠️ **Always follow the design theme of the original component unless explicitly told otherwise.**

When generating iterations, you MUST preserve the visual theme from the source component:

### Colors & Text Classes
Copy the exact color classes from the original:
```tsx
// ✅ CORRECT - Use same colors as original
text-foreground        // Title text
text-text-brown-dark   // Secondary text (category, author, date)
opacity-80             // Subtitle opacity
bg-accent              // Image placeholder background

// ❌ WRONG - Inventing new theme colors
text-white             // Unless original uses white text
bg-gray-900            // Unless original has dark backgrounds
text-white/80          // Don't assume dark theme
```

### Badge & Icon Styling
Preserve exact styling including inline styles:
```tsx
// ✅ CORRECT - Copy exact badge styling
<Badge className="px-0 py-0 text-xs leading-none border-transparent bg-transparent" style={{ color: "#6D5B4B" }}>

// ❌ WRONG - Changing badge colors/style
<Badge className="bg-amber-500/20 text-amber-300">
```

### Why This Matters
- Iterations should be **layout variations**, not theme variations
- Users expect iterations to match their app's existing visual identity
- White-on-white or dark-on-dark text makes iterations unusable
- The playground renders iterations in the same context as the original component

### Quick Checklist
Before finalizing an iteration, verify:
- [ ] Text colors match original (`text-foreground`, `text-text-brown-dark`, etc.)
- [ ] Background colors match original (`bg-accent`, no dark backgrounds unless original has them)
- [ ] Badge/icon styling is identical
- [ ] Opacity values preserved (`opacity-80`, `opacity-50`, etc.)
- [ ] No assumptions about light/dark mode - use what the original uses

## CRITICAL: Register Iterations in Index

**Iterations MUST be registered in `src/app/playground/iterations/index.ts` to render on the canvas.**

The playground uses static imports (not dynamic imports) because Next.js/webpack requires knowing importable modules at build time. After creating iteration files, you MUST update the index:

```ts
// src/app/playground/iterations/index.ts

import { ComponentType } from 'react';

// Import all iterations for each component
import ArticleCardIteration1 from './ArticleCard.iteration-1';
import ArticleCardIteration2 from './ArticleCard.iteration-2';
import ArticleCardIteration3 from './ArticleCard.iteration-3';
import ArticleCardIteration4 from './ArticleCard.iteration-4';

// Map filename to component
export const iterationComponents: Record<string, ComponentType<Record<string, unknown>>> = {
  'ArticleCard.iteration-1.tsx': ArticleCardIteration1 as ComponentType<Record<string, unknown>>,
  'ArticleCard.iteration-2.tsx': ArticleCardIteration2 as ComponentType<Record<string, unknown>>,
  'ArticleCard.iteration-3.tsx': ArticleCardIteration3 as ComponentType<Record<string, unknown>>,
  'ArticleCard.iteration-4.tsx': ArticleCardIteration4 as ComponentType<Record<string, unknown>>,
};

export function getIterationComponent(filename: string): ComponentType<Record<string, unknown>> | undefined {
  return iterationComponents[filename];
}
```

> ⚠️ **CRITICAL: Map keys MUST include `.tsx` extension**
>
> The API returns filenames WITH the `.tsx` extension. If you omit it, iterations will appear as empty containers on the canvas.
>
> ```ts
> // ✅ CORRECT - Keys include .tsx extension
> 'BitesClient.iteration-1.tsx': BitesClientIteration1,
>
> // ❌ WRONG - Missing .tsx extension (iterations won't render!)
> 'BitesClient.iteration-1': BitesClientIteration1,
> ```
>
> Note: Import paths do NOT include `.tsx` (that's standard TypeScript), but map keys MUST include it.

### Why This Is Required

1. The API at `/playground/api/iterations` scans the filesystem and detects iteration files
2. The `IterationNode` component needs to render the actual iteration component
3. Dynamic imports with template literals (`import(\`./\${filename}\`)`) don't work in Next.js
4. Static imports in the index file solve this by pre-registering all iterations

### When Adding New Iterations

After generating iteration files for a NEW component (not ArticleCard), add imports to the index:

```ts
// Add imports
import NewComponentIteration1 from './NewComponent.iteration-1';
import NewComponentIteration2 from './NewComponent.iteration-2';
// ... etc

// Add to the map
export const iterationComponents = {
  // ... existing entries
  'NewComponent.iteration-1.tsx': NewComponentIteration1 as ComponentType<Record<string, unknown>>,
  'NewComponent.iteration-2.tsx': NewComponentIteration2 as ComponentType<Record<string, unknown>>,
  // ... etc
};
```

## Registry Configuration: Props and Data

When adding components to the registry (`src/app/playground/registry.tsx`), configure props thoughtfully.

### Prefer Real API Data Over Sample Data

**Use live API calls when possible.** Components that fetch data look and behave more realistically with real data.

```tsx
// ✅ PREFERRED - Let component fetch real data
{
  id: 'bites-client',
  Component: BitesClient,
  props: {
    items: [],           // Start empty, component will fetch
    filters: realFilters, // Real filter options
    platforms: ['All', 'Web', 'Mobile'],  // Truthy values trigger API
    limit: 9,            // Reasonable limit for preview
  },
}

// ❌ AVOID - Static sample data (unless API unavailable)
{
  props: {
    items: sampleItems,  // Static, doesn't reflect real content
    filters: {},         // Disables features
  },
}
```

### When to Use Sample Data

Only use sample/mock data when:
1. The API doesn't exist yet
2. The API requires authentication the playground can't provide
3. The component is purely presentational (no data fetching)

### Component Size Configuration

For page-level components, use the `size` property:

```tsx
{
  id: 'my-page-component',
  Component: MyPageComponent,
  size: 'laptop',  // 'default' | 'laptop' | 'tablet' | 'mobile'
  props: { ... },
}
```

| Size | Viewport | Scale | Use For |
|------|----------|-------|---------|
| `default` | Auto | 100% | Small components (cards, buttons) |
| `laptop` | 1024×640 | 60% | Full page layouts |
| `tablet` | 768×1024 | 50% | Tablet-optimized views |
| `mobile` | 375×812 | 70% | Mobile screens |

> **Note:** Iterations automatically inherit the `size` from their parent component in the registry. You don't need to specify size in iteration files - they will render at the same viewport/scale as the original component.

### Debugging Component Data Issues

If a component shows empty/broken content:

1. **Check browser Network tab** — Is the API being called? What's the response?
2. **Check server terminal** — Look for API errors or 404s
3. **Verify props trigger data fetch** — Some components need truthy filter values to fetch
4. **Check data transformation** — Component might expect specific fields (e.g., `videoId`, `poster`)

Example fix for BitesClient:
```tsx
// This triggers API fetch (selectedPlatform is truthy)
platforms: ['All', 'Web', 'Mobile']

// This prevents API fetch (selectedPlatform is falsy)  
platforms: ['', 'Web', 'Mobile']
```

## Quality Checklist

Before saving each iteration:

- [ ] Props interface unchanged
- [ ] All imports resolve correctly
- [ ] Metadata comment included
- [ ] File named correctly
- [ ] No TypeScript errors
- [ ] Uses only allowed Tailwind classes
- [ ] **Design theme preserved** (text colors, backgrounds, badge styling match original)
- [ ] Meaningful variation from original
- [ ] Each iteration is distinct from others
- [ ] **Iterations registered in `iterations/index.ts`**
- [ ] **Map keys include `.tsx` extension** (e.g., `'Component.iteration-1.tsx'`)
- [ ] **`iterations/tree.json` updated** with correct parent for each new iteration
- [ ] **`@sourceIteration` included** in metadata if derived from another iteration

