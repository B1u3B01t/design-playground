# Prompt Templates

These templates are used to generate prompts for the playground iteration system.

## Iteration Prompt (`iteration.prompt.ts`)

Used when clicking a component node and submitting instructions to generate layout/design variations.

```
ITERATION REQUEST
═════════════════

Component: {{componentName}}
Source: {{sourcePath}}
Iterations requested: {{iterationCount}}
Depth: {{depthLabel}}
{{childrenSection}}
Props interface (DO NOT MODIFY):
{{propsInterface}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCTIONS

1. Read the generation guide: src/app/playground/docs/ITERATION-GUIDE.md
2. Read the source component at the path above
3. Generate {{iterationCount}} compatible variations
4. Save each as: src/app/playground/iterations/{{cleanComponentName}}.iteration-{n}.tsx
   - Register in index.ts and tree.json

{{customInstructionsSection}}
CRITICAL REQUIREMENTS / CREATIVE FREEDOM / QUALITY CHECKLIST
...
```

## Iteration-from-Iteration Prompt (`iteration-from-iteration.prompt.ts`)

Used when clicking an iteration node to generate further variations based on that iteration.

```
ITERATION REQUEST (from existing iteration)
═════════════════════════════════════════════

Component: {{componentName}}
Original source: {{sourcePath}}
Base iteration: {{iterationSourcePath}}
Iterations requested: {{iterationCount}} (numbered {{startNumber}}–{{endNumber}})
Depth: {{depthLabel}}
...

INSTRUCTIONS
- Uses the BASE ITERATION as starting point, not the original component
- Each variation diverges from the base iteration
- Includes @sourceIteration {{sourceIterationFilename}} in metadata
```

## Element-Targeted Iteration Prompt (`element-iteration.prompt.ts`)

Used when the user Alt+clicks specific DOM elements before submitting. Produces surgical edits instead of full redesigns.

```
ELEMENT-TARGETED ITERATION REQUEST
════════════════════════════════════

Component: {{componentName}}
Source: {{sourcePath}}
Iterations requested: 1
Depth: {{depthLabel}}
...

{{elementSelectionsSection}}

INSTRUCTIONS
- Copy the component file verbatim
- Only modify the targeted elements
- Everything else must remain pixel-identical

CRITICAL REQUIREMENTS
- Copy first, edit second
- Surgical edits only — no layout redesign
```

Also has an iteration-from-iteration variant for when elements are selected on an iteration node.

## Adopt Iteration Prompt (`adopt.prompt.ts`)

Used when adopting an iteration to replace the original component's UI.

```
ADOPT ITERATION
═══════════════

Original Component: {{originalPath}}
Iteration to Adopt: {{iterationPath}}

TASK
Replace the UI of the original component with the iteration's layout/styling.
Keep all logic, props interface, and public API intact.
```

## Variable Definitions

| Variable | Description | Example |
|----------|-------------|---------|
| `{{componentName}}` | Name of the component | `Pricing Card` |
| `{{sourcePath}}` | Full path to source file | `src/app/playground/examples/PricingCard.tsx` |
| `{{iterationCount}}` | Number of iterations to generate | `3` |
| `{{depthLabel}}` | Iteration depth label | `Shell only` |
| `{{propsInterface}}` | TypeScript props definition | `interface PricingCardProps { ... }` |
| `{{cleanComponentName}}` | Component name without spaces | `PricingCard` |
| `{{componentId}}` | Registry ID | `pricing-card` |
| `{{customInstructionsSection}}` | User-provided instructions | Formatted block or empty |
| `{{skillSection}}` | Skill context from SKILL.md | Formatted block or empty |
| `{{childrenSection}}` | Child components list | Formatted list or empty |
| `{{iterationSourcePath}}` | Path to base iteration file | `src/app/playground/iterations/PricingCard.iteration-1.tsx` |
| `{{startNumber}}` | First iteration number | `4` |
| `{{endNumber}}` | Last iteration number | `6` |
| `{{iterationSavesBlock}}` | Save paths for each iteration | Bullet list |
| `{{treeParent}}` | Parent in tree.json | `PricingCard.iteration-1.tsx` |
| `{{sourceIterationFilename}}` | Base iteration filename | `PricingCard.iteration-1.tsx` |
| `{{iterationNumbersList}}` | Comma-separated iteration numbers | `4, 5, 6` |
| `{{elementSelectionsSection}}` | Formatted element details | `TARGETED ELEMENTS` block |
| `{{iterationNumber}}` | Single iteration number (element-targeted) | `5` |
| `{{originalPath}}` | Original component path (adopt) | `src/app/playground/examples/PricingCard.tsx` |
| `{{iterationPath}}` | Iteration path (adopt) | `src/app/playground/iterations/PricingCard.iteration-2.tsx` |
