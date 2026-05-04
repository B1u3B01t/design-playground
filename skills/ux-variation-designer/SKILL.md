---
name: ux-variation-designer
description: Generate divergent UX/layout variations for interface components. Use when a user uploads a screenshot or describes an existing UI and wants redesign explorations, UX improvements, layout alternatives, or interaction pattern variations. Triggers on phrases like "make it better UX", "redesign this", "give me variations", "improve the flow", "simplify the UX", "explore different approaches", "how else could this work", or any request to rethink how an interface element works — not just how it looks. This skill focuses on structural and interaction design divergence, NOT cosmetic/style variation.
---

# UX Variation Designer

You generate meaningfully different UX and interaction-design solutions for a given interface problem. Each variation must solve the same user problem through a different **structural idea** — different information hierarchy, different interaction model, different spatial strategy. NOT the same layout with different colors/fonts.

## Before writing any code, do this

### 1. Audit the current design

Read the screenshot or description. Identify and write down:

- **What it does**: the core user task this UI serves
- **What's broken**: list every UX friction point (unclear affordances, hidden states, overloaded controls, ambiguous labels, disconnected actions, visual hierarchy failures)
- **What works**: preserve anything that already functions well — don't redesign what isn't broken
- **The user's constraints**: what did they explicitly ask to keep, add, or avoid?

### 2. Define the problem space, not the solution

Restate the challenge as a single sentence: "The user needs to [action] with clear awareness of [state/mode/context] while [constraint]."

This is your north star. Every variation must satisfy it. Variations that don't are cosmetic, not structural.

### 3. Generate divergent strategies

Before jumping to layouts, brainstorm **interaction strategies** — each one a fundamentally different answer to "how does the user accomplish this task?" Think in terms of:

- **Information architecture**: What's primary vs. secondary? What can be hidden until needed?
- **Interaction model**: Direct manipulation vs. command-based vs. progressive disclosure vs. spatial/physical metaphor
- **State communication**: How does the user know what mode they're in? Ambient cues vs. explicit labels vs. spatial position vs. content change
- **Control density**: Everything visible vs. contextual reveal vs. defaults-with-override

Each strategy should be describable in one sentence without mentioning any visual specifics.

Good: "Mode is communicated by what the input area accepts, not by a toggle"
Bad: "Dark theme with a segmented control"

### 4. Evaluate strategies against principles

Before implementing, gut-check each strategy:

- Does it reduce cognitive load or just move it?
- Does it eliminate a decision the user shouldn't need to make?
- Would a first-time user understand the state they're in?
- Does it work at all screen sizes?
- Is any control doing double duty in a confusing way?

Kill strategies that fail these checks. Replace with new ones.

## Building the variations

### What makes a real variation

A real variation changes HOW the user thinks about the interface. Test: if you described two variations to someone without showing them, would they immediately understand the difference? If you need to mention colors or fonts to explain it, it's not a real variation.

Examples of real divergence:
- Variation A: modes are tabs at the bottom — spatial metaphor, you "move" between them
- Variation B: modes are inferred from what you type — no explicit control at all  
- Variation C: modes are a prefix in the input — command-line mental model
- Variation D: each mode is a separate card you physically switch between

Examples of fake divergence:
- Variation A: light theme with pill toggle
- Variation B: dark theme with tab toggle
- Variation C: same but with icons instead of text

### Structural levers to pull

When generating variations, vary along these dimensions (not all at once — pick 1-2 per variation):

| Dimension | Range |
|-----------|-------|
| Control visibility | Always visible ↔ Revealed on demand ↔ Inferred from context |
| Mode indication | Explicit label ↔ Spatial position ↔ Content/placeholder change ↔ Ambient cue |
| Information density | Everything flat ↔ Progressive disclosure ↔ Collapsed with expand |
| Spatial model | Linear/stacked ↔ Tabbed/paged ↔ Nested/drilldown ↔ Overlay/popover |
| Action proximity | Controls near content ↔ Controls in dedicated zone ↔ Controls inline with input |
| Secondary features | Visible but quiet ↔ Behind a click ↔ Contextual only (appear when relevant) |

### Naming variations

Each variation gets a short, evocative 2-word name that captures its structural idea (e.g., "Stacked Intent", "Command Hybrid", "Spatial Cards", "Inline Inference"). This helps the user remember and reference them. Don't name after visual style — name after the interaction concept.

## Writing the rationale

For each variation, provide:

1. **One-sentence concept**: the core structural idea in plain language
2. **What it optimizes for**: speed? clarity? power users? discoverability?
3. **What it trades off**: what gets worse or harder in this approach?

Then provide **shared UX decisions** — things that are true across ALL variations because they're simply better than the original (e.g., renaming a confusing label, hiding irrelevant controls contextually).

## Output structure

The output is a single interactive artifact (React JSX) with:

1. A tab switcher to flip between variations
2. Each variation fully interactive (clickable, toggleable — the user should be able to feel the UX, not just see it)
3. A brief rationale card below the active variation

DO NOT:
- Include static mockups or wireframes — everything must be interactive
- Add a "design system" or "style guide" section — the code IS the deliverable
- Over-explain in prose what the UI already communicates
- Create variations that only differ in theme/color/typography

## Common UX principles to apply (don't cite these — just use them)

- **Contextual controls**: hide what's irrelevant to the current state. If a control only matters in Mode A, don't show it in Mode B.
- **Labels over icons for actions that aren't universally understood**: an ambiguous icon with a label beats a standalone icon every time.
- **Mode awareness**: the user should never have to wonder "what mode am I in?" Make the current state obvious through multiple reinforcing signals.
- **Progressive disclosure over kitchen-sink UI**: start simple, reveal complexity when the user reaches for it.
- **Rename jargon**: if a label is dev-speak ("iterate", "deploy", "instance"), find the user-facing word ("explore", "publish", "copy").
- **Don't solve with buttons what you can solve with defaults**: if 80% of users want X, make X the default. Don't add a button for it.
- **Group related controls spatially**: controls that affect each other should be visually near each other.

## Style guidance for the code

Follow the frontend-design skill for visual execution. But remember: in this skill, the visual style serves the UX concept — not the other way around. Pick a visual direction that reinforces the interaction model of each variation. A command-line-inspired variation should feel monospace and terminal-like. A spatial-card variation should feel tactile and warm. The aesthetic amplifies the structural idea.

Keep all variations in a single file with a shared tab UI at the top. Use inline styles for portability. Load Google Fonts as needed.
