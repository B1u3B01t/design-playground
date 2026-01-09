# Prompt Templates

These templates are used to generate iteration prompts when users click the Iterate button.

## Layout Iteration Prompt

```
ITERATION REQUEST
═════════════════

Mode: Layout
Component: {componentName}
Source: {sourcePath}
Iterations requested: {count}
Depth: {depth}

{#if hasChildren}
Children to keep stable:
{#each stableChildren}
- {childName}
{/each}
{/if}

Props interface (DO NOT MODIFY):
{propsInterface}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCTIONS

1. Read the source component at the path above
2. Generate {count} layout variations
3. Save each as: src/app/playground/iterations/{componentName}.iteration-{n}.tsx
4. Follow rules in: src/app/playground/docs/ITERATION-GUIDE.md

LAYOUT FOCUS AREAS
- Spatial arrangement (flex direction, grid columns)
- Alignment and distribution
- Component ordering
- Spacing and gaps
- Responsive behavior

CONSTRAINTS
- Keep props interface identical
- Use only existing Tailwind classes
- Include metadata comment in each file
- Make each iteration meaningfully different

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate the iterations now.
```

## Vibe Iteration Prompt

```
ITERATION REQUEST
═════════════════

Mode: Vibe
Component: {componentName}
Source: {sourcePath}
Iterations requested: {count}
Depth: {depth}

{#if hasChildren}
Children to keep stable:
{#each stableChildren}
- {childName}
{/each}
{/if}

Props interface (DO NOT MODIFY):
{propsInterface}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCTIONS

1. Read the source component at the path above
2. Generate {count} style variations
3. Save each as: src/app/playground/iterations/{componentName}.iteration-{n}.tsx
4. Follow rules in: src/app/playground/docs/ITERATION-GUIDE.md

VIBE FOCUS AREAS
- Color variations
- Typography (weights, sizes)
- Border styles (radius, width)
- Shadows and depth
- Hover/focus states
- Subtle animations

CONSTRAINTS
- Keep layout/structure IDENTICAL to original
- Keep props interface identical
- Use only existing Tailwind classes
- Include metadata comment in each file
- Make each iteration have a distinct visual feel

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate the iterations now.
```

## Variable Definitions

| Variable | Description | Example |
|----------|-------------|---------|
| `{componentName}` | Name of the component | `ArticleCard` |
| `{sourcePath}` | Full path to source file | `src/components/ArticleCard.tsx` |
| `{count}` | Number of iterations | `4` |
| `{depth}` | Iteration depth | `Shell only` |
| `{propsInterface}` | TypeScript props definition | See below |

## Props Interface Format

Extract the props interface from the component and format as:

```
Props interface (DO NOT MODIFY):
- post: InsightPost (required)
- category: InsightCategory (optional)
- variant: "minimal" | "expanded" (optional, default: "expanded")
- className: string (optional)
- onClick: () => void (optional)
```

