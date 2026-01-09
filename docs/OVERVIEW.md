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
3. **Select Mode** → Choose "Layout" or "Vibe" iteration type
4. **Prompt Copied** → System generates and copies prompt to clipboard
5. **Paste in Cursor** → User pastes prompt in Cursor AI chat
6. **AI Generates** → Cursor AI creates iteration files in `/iterations` folder
7. **Auto-Detection** → File watcher detects new files
8. **Display on Canvas** → Iterations appear connected to original component
9. **Adopt or Delete** → User can adopt an iteration or delete it

## Key Folders

| Folder | Purpose |
|--------|---------|
| `src/app/playground/` | Main playground code |
| `src/app/playground/docs/` | Documentation for AI agents |
| `src/app/playground/iterations/` | Generated iteration files (temporary) |
| `src/app/playground/nodes/` | React Flow node components |

## State Management

- **Canvas State**: Stored in localStorage for persistence across sessions
- **Iteration Files**: Physical `.tsx` files in `/iterations` folder
- **Registry**: Maps component IDs to their React components

## Iteration Types

### Layout Iteration
Changes spatial arrangement, structure, and positioning:
- Grid vs Flex layouts
- Spacing and alignment
- Component ordering
- Responsive breakpoints

### Vibe Iteration
Changes visual style while keeping structure:
- Colors and gradients
- Typography weights
- Border styles
- Shadow and depth
- Animation/transitions

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

