---
name: stick-to-design-system
description: Constrains iterations to use only existing Tailwind utility classes from the codebase. Use when maintaining design system consistency is important and the component should integrate seamlessly with the existing UI.
---

# Design System (Tailwind)

Constrain all styling to **existing Tailwind utility classes** already present in the codebase. Do not introduce new custom classes, arbitrary values, or inline styles.

## Rules

- Use only Tailwind classes that already exist in the project
- Do NOT use inline `style={{}}` attributes for visual styling
- Do NOT use arbitrary value syntax like `w-[347px]` unless the project already uses it
- Prefer semantic Tailwind classes (e.g., `text-primary`, `bg-card`) when available
- Maintain consistency with the existing design system tokens (colors, spacing, typography)

## When to Use

This mode is appropriate when:
- The component will be integrated into a production design system
- Visual consistency with existing components is a priority
- The team enforces strict Tailwind class usage
