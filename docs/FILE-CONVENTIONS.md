# File Conventions

## Playground File Locations

All playground-related files stay within the playground folder:

```
src/app/playground/
├── previews/          ← Preview components for the canvas
├── iterations/        ← Generated iteration files
├── docs/              ← Documentation
├── nodes/             ← React Flow node components
└── registry.tsx       ← Component registry
```

## Preview File Location

> ⚠️ **IMPORTANT**: Preview files must be in the playground folder, NOT in `/src/components/`.

Preview files are playground-specific versions of components that take explicit props instead of reading from app stores/context. They belong in:

```
src/app/playground/previews/
```

Naming convention:
```
{ComponentName}.preview.tsx
```

Example:
```
src/app/playground/previews/SubscriptionExpiringBanner.preview.tsx
```

### Why separate preview files?

Production components often use hooks like `useUserStore()` or `useAuth()` which require app context. Preview files accept explicit props so they can render in isolation on the playground canvas.

```tsx
// ❌ Production component - won't work in playground
export function Banner() {
  const { isPro } = useUserStore();  // No store in playground!
  ...
}

// ✅ Preview component - works in playground
export function BannerPreview({ isPro }: { isPro: boolean }) {
  ...  // Explicit props, no store dependency
}
```

## Iteration File Location

All iteration files go in:
```
src/app/playground/iterations/
```

## Naming Convention

```
{ComponentName}.iteration-{number}.tsx
```

Examples:
- `ArticleCard.iteration-1.tsx`
- `ArticleCard.iteration-2.tsx`
- `BitesClient.iteration-1.tsx`
- `LargeArticleCard.iteration-3.tsx`

## File Structure Template

```tsx
"use client";

// ============================================
// IMPORTS - Keep same as original component
// ============================================
import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
// ... other imports from original

// ============================================
// ITERATION METADATA
// ============================================
/**
 * @iteration 1
 * @parent ComponentName
 * @mode Layout
 * @description Brief description of the variation
 */

// ============================================
// TYPES - Import from original or redefine
// ============================================
import type { SomeType } from "@/components/OriginalComponent";

// Or if types are not exported, redefine them:
type SomeType = {
  // ... same as original
};

// ============================================
// COMPONENT
// ============================================
export default function ComponentName(props: OriginalPropsType) {
  // Implementation with variations
}
```

## Export Requirements

1. **Default export required** - The component must be the default export
2. **Same function name** - Use the original component name
3. **Same props type** - Accept identical props

```tsx
// ✅ Correct
export default function ArticleCard({ post, category }: Props) { }

// ❌ Wrong - named export
export function ArticleCard({ post, category }: Props) { }

// ❌ Wrong - different name
export default function ArticleCardVariant({ post, category }: Props) { }
```

## Handling Child Components

### When keeping children stable (Shell only)

Import and use children exactly as in the original:

```tsx
// Original imports child
import InsightBadge from "./InsightBadge";

// Iteration keeps same import and usage
import InsightBadge from "@/components/InsightBadge";

// Use it the same way
<InsightBadge label={post.badge} size="md" />
```

### When iterating children (1 level or All levels)

Create child iterations with their own files:

```
iterations/
├── ArticleCard.iteration-1.tsx
├── ArticleCard.iteration-1.InsightBadge.tsx  # Child of iteration 1
├── ArticleCard.iteration-2.tsx
└── ArticleCard.iteration-2.InsightBadge.tsx  # Child of iteration 2
```

Import the iterated child:

```tsx
// In ArticleCard.iteration-1.tsx
import InsightBadge from "./ArticleCard.iteration-1.InsightBadge";
```

## Relative Imports

When importing from the iterations folder, use relative paths:

```tsx
// Importing sibling iteration files
import ChildComponent from "./ParentComponent.iteration-1.ChildComponent";
```

When importing from the main codebase, use aliases:

```tsx
// Importing from main codebase
import { cn } from "@/lib/utils";
import type { InsightPost } from "@/components/ArticleCard";
```

## Index Registration

**Every iteration must be registered in `src/app/playground/iterations/index.ts`** for it to render on the canvas.

```ts
// Import (path WITHOUT .tsx)
import BitesClientIteration1 from './BitesClient.iteration-1';

// Map key (MUST include .tsx)
export const iterationComponents = {
  'BitesClient.iteration-1.tsx': BitesClientIteration1,
};
```

> ⚠️ **Common mistake**: Map keys MUST include the `.tsx` extension.
> The API returns filenames with `.tsx`, so keys without it cause iterations to render as empty containers.
>
> ```ts
> // ✅ CORRECT
> 'BitesClient.iteration-1.tsx': BitesClientIteration1,
>
> // ❌ WRONG (empty container!)
> 'BitesClient.iteration-1': BitesClientIteration1,
> ```

## Cleanup

Iteration files are temporary. They will be deleted when:
- User deletes the iteration node from canvas
- User explicitly clears all iterations

Do NOT commit iteration files to git. The `.gitignore` should include:
```
src/app/playground/iterations/*
!src/app/playground/iterations/.gitkeep
```

