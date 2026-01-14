# Playground Iteration System - Overview

## Purpose

The Playground allows developers to visually iterate on React components. Users can drag components onto a canvas, then generate layout or style variations using AI assistance.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        PLAYGROUND                           │
├──────────────┬──────────────────────────────────────────────┤
│   SIDEBAR    │                 CANVAS                       │
│              │                                              │
│  Components  │   ┌─────────┐      ┌─────────┐              │
│  - Cards     │   │ Original│──────│Iteration│              │
│  - Inputs    │   │Component│      │   1     │              │
│  - etc.      │   └─────────┘      └─────────┘              │
│              │        │                                     │
│              │        ├───────────┌─────────┐              │
│              │        │           │Iteration│              │
│              │        │           │   2     │              │
│              │                    └─────────┘              │
└──────────────┴──────────────────────────────────────────────┘
```

## Workflow

1. **Drag Component** → User drags a component from sidebar to canvas
2. **Click Iterate** → User clicks "Iterate" button on the component node
3. **Configure** → Set iteration count, depth, and custom instructions
4. **Generate** → Either:
   - **Copy Prompt** → Paste manually in Cursor chat
   - **Run with Cursor** → Automated via CLI (see CURSOR-INTEGRATION.md)
5. **AI Generates** → Cursor creates iteration files in `/iterations` folder
6. **Auto-Detection** → New files detected via API scan
7. **Display on Canvas** → Iterations appear connected to original component
8. **Adopt or Delete** → User can adopt an iteration or delete it

## Key Folders

| Folder | Purpose |
|--------|---------|
| `src/app/playground/` | Main playground code |
| `src/app/playground/docs/` | Documentation for AI agents |
| `src/app/playground/previews/` | Preview components for canvas (explicit props, no store deps) |
| `src/app/playground/iterations/` | Generated iteration files (temporary) |
| `src/app/playground/nodes/` | React Flow node components |

> **Note**: Preview files belong in `/playground/previews/`, NOT in `/src/components/`. See FILE-CONVENTIONS.md for details.

## State Management

- **Canvas State**: Stored in localStorage for persistence across sessions
- **Iteration Files**: Physical `.tsx` files in `/iterations` folder
- **Registry**: Maps component IDs to their React components

## Iteration Focus

Layout iterations change spatial arrangement, structure, and positioning:
- Grid vs Flex layouts
- Spacing and alignment
- Component ordering
- Responsive breakpoints

## Component Scope

Only components registered in `registry.tsx` can be iterated. Components can be:
- Simple (single file, no children)
- Composite (imports and uses other components)
- Pages (full page layouts)

Registered page components include:
- **Bites Client**: Browse page with filters and grid layout
- **Insights Client**: Insights listing page with category filtering and hero section

For composite components, users select iteration depth:
- **Shell only**: Only the container component changes
- **1 level deep**: Container + direct children
- **All levels**: Full recursive iteration

