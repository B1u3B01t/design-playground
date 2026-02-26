---
name: design-variations
description: Generates multiple distinct visual variations of a component or page, exploring divergent styles, layouts, and aesthetic directions. Use when the user wants to explore design alternatives, iterate on a UI with variety, compare visual approaches, or generate multiple versions of a component or page.
---

# Design Variations

Generate a set of variations for a component or page that are **meaningfully different from each other**. Each iteration must take a distinct creative direction—different layout strategy, different visual mood, different typographic personality, different spatial philosophy. Never converge toward a single "safe" middle ground.

## Core Principle

**Diverge first, converge later.** The goal is to expand the design space, not to find the "best" version. Treat each variation as a committed exploration of one specific direction, executed with full conviction.

## Generating Variations

### 1. Choose Divergent Axes

Before generating, pick **different axes of variation** across iterations. Rotate through these dimensions so no two variations share the same combination:

| Axis | Example Poles |
|------|---------------|
| **Layout** | Centered single-column ↔ Asymmetric split ↔ Grid mosaic ↔ Full-bleed edge-to-edge ↔ Overlapping layers ↔ Stacked cards ↔ Sidebar-dominant ↔ Z-pattern flow |
| **Density** | Spacious with breathing room ↔ Compact and information-dense |
| **Mood** | Warm and approachable ↔ Cold and clinical ↔ Bold and confrontational ↔ Quiet and meditative ↔ Playful and irreverent ↔ Luxurious and refined |
| **Typography** | Large editorial display type ↔ Monospaced utilitarian ↔ Serif-forward classic ↔ Handwritten/organic ↔ Condensed geometric sans ↔ Mixed-weight contrast |
| **Color strategy** | Monochromatic ↔ High-contrast duotone ↔ Rich polychromatic ↔ Muted earth tones ↔ Neon/saturated ↔ Black-and-white with one accent ↔ Pastel gradients |
| **Visual language** | Flat and minimal ↔ Skeuomorphic/textured ↔ Glassmorphic ↔ Brutalist ↔ Neumorphic ↔ Retro/vintage ↔ Futuristic/sci-fi ↔ Editorial/magazine |
| **Motion philosophy** | Static and confident ↔ Subtle micro-interactions ↔ Dramatic entrance choreography ↔ Continuous ambient motion |
| **Hierarchy** | Hero-image dominant ↔ Typography-led ↔ Data/content-first ↔ Illustration-driven ↔ Navigation-forward |

### 2. Commit to a Direction Per Variation

Each variation must:

- **Pick a clear stance** on at least 3–4 axes above and push it far
- **Not hedge**—if a variation is "minimalist," it should be aggressively minimal, not "sort of clean"
- **Feel like a different designer made it**—different taste, different influences, different priorities
- **Be production-quality**—opinionated does not mean rough; every variation should be polished and intentional

### 3. Avoid Sameness Traps

Common failure modes to actively avoid:

- Variations that only differ in color palette but share identical layout and typography
- "Safe" defaults creeping into every variation (rounded corners, card grids, centered hero)
- All variations converging to the same visual weight and density
- Repeating the same font family across variations
- Using the same component patterns (e.g., every variation has a card grid or the same button style)

### 4. Sequencing Strategy

When generating multiple variations in sequence:

- **Variation 1**: Start with whatever direction feels most natural for the brief—but commit fully
- **Variation 2**: Deliberately invert at least 2 major axes from Variation 1 (e.g., if V1 was spacious and dark, V2 should be dense and light)
- **Variation 3+**: Survey what you've already generated and fill gaps in the design space. What mood hasn't been explored? What layout structure hasn't been tried?
- **Never repeat** a layout skeleton. If you used a centered hero + grid below, that structure is spent

## When the User Specifies a Theme

If the user provides constraints (e.g., "dark mode," "corporate," "playful"), treat them as **boundaries, not destinations**:

- The constraint narrows the space—explore within it aggressively
- "Corporate" could mean Swiss-style grid precision, or mahogany-and-brass executive gravitas, or sleek SaaS dashboard, or bold startup energy
- Find the unexpected corners within the user's constraint
- Each variation should still feel distinctly different from the others while respecting the boundary

## What Makes a Good Variation Set

A strong set of variations should:

- Make the user say "I hadn't thought of that" at least once
- Include at least one direction that feels surprising or uncomfortable
- Cover meaningfully different layout structures
- Show range in visual density and spatial rhythm
- Demonstrate different typographic personalities
- Feel like a design studio presented their best competing concepts

## Implementation Quality

Every variation must be:

- Fully functional with working interactions
- Responsive and well-structured
- Visually polished—no placeholder styling or half-committed aesthetics
- Self-consistent—each variation should feel like a complete, intentional design, not a fragment

Execute each direction with full conviction. Half-measures produce mediocre variations that don't help anyone make decisions.
