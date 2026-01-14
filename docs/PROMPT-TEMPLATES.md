# Prompt Templates

These templates are used to generate prompts for the playground iteration system.

## Layout Iteration Prompt

Used when clicking "Iterate" to generate layout variations.

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

## Adopt Iteration Prompt

Used when adopting an iteration to replace the original component's UI.

```
ADOPT ITERATION
═══════════════

Original Component: {originalComponentPath}
Iteration to Adopt: {iterationPath}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TASK

Replace the UI implementation of the original component with the layout/styling from the iteration, while ensuring ZERO breaking changes.

INSTRUCTIONS

1. Read both files:
   - Original: {originalComponentPath}
   - Iteration: {iterationPath}

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

Adopt the iteration now. Only modify the original component file.
```

## Variable Definitions

| Variable | Description | Example |
|----------|-------------|---------|
| `{componentName}` | Name of the component | `ArticleCard` |
| `{sourcePath}` | Full path to source file | `src/components/ArticleCard.tsx` |
| `{originalComponentPath}` | Path to original component | `src/components/ArticleCard.tsx` |
| `{iterationPath}` | Path to iteration file | `src/app/playground/iterations/ArticleCard.iteration-2.tsx` |
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
