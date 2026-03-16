---
name: no-bound-explore
description: Enables maximum creative freedom using inline CSS styles instead of Tailwind. Use when exploring expressive, unconventional designs without design system constraints.
---

# Creative (Inline CSS)

Use **inline `style={{}}` attributes** for all styling. This unlocks the full CSS property space for maximum creative expressiveness.

## Rules

- Use `style={{}}` for all visual styling (colors, gradients, transforms, shadows, etc.)
- Do NOT use Tailwind utility classes for visual styling
- You may still use Tailwind for basic layout utilities (`flex`, `grid`, `items-center`) if desired, but prefer inline styles for visual properties
- Leverage the full power of CSS: custom gradients, backdrop filters, clip-path, mix-blend-mode, CSS transforms, transitions, and animations

## Creative Latitude

With inline CSS you can:
- Create complex multi-stop gradients and mesh-like backgrounds
- Use `clipPath` and `shapeOutside` for non-rectangular elements
- Apply `mixBlendMode` and `filter` for visual effects
- Use `transform` for perspective, rotation, and 3D effects
- Use CSS custom properties (`var(--...)`) for consistency within a single iteration
- Combine `backdropFilter` with transparency for glassmorphism effects
- Use `boxShadow` with multiple layers for depth and glow effects

## When to Use

This mode is appropriate when:
- Exploring radical design directions unconstrained by an existing system
- Creating one-off visual explorations or prototypes
- The design brief calls for effects that Tailwind cannot express
- Maximum creative expressiveness is more important than design system consistency
