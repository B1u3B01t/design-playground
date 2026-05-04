/**
 * @name: create-page-prompt
 * @description: Prompt used to scaffold a brand-new Next.js page from a user description, register it in the playground registry, and place it under src/app/{slug}/page.tsx so it becomes a real public route.
 * @variables :
 *   skillSection: Optional skill context block to prepend to the prompt.
 *   description: The user's natural-language description of the page they want.
 *   stylingConstraint: Standard styling constraint block from shared-sections.
 *   reservedSlugs: Comma-separated list of slugs that must never be used.
 */

import { fillTemplate } from './utility';

const prompt = `
{{skillSection}}
CREATE NEW NEXT.JS PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are creating a brand-new Next.js page from the user's description below. The page becomes a real public route at /{slug} on the production site.blahbalh

USER DESCRIPTION
{{description}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTEXT YOU MUST KNOW

- Reserved Next.js convention slugs (NEVER use these — even with a suffix): {{reservedSlugs}}
- The new page will inherit src/app/layout.tsx (root layout already wraps the site with navbar, footer, providers, fonts, app-theme CSS variables, and globals.css). Do NOT create a layout.tsx.
- The page will also be rendered as a node on the playground canvas via the existing ComponentNode. The canvas wraps it in an .app-theme div, so all CSS variables from src/app/globals.css apply both on canvas and on the live route.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCTIONS

1. Pick a slug
   - List the top-level directories under src/app/ first (use your file-listing tool / glob or read of the directory). Treat every existing top-level directory as a TAKEN slug.
   - Derive a short, descriptive kebab-case slug from the user description (e.g., "pricing-comparison", "founder-story", "case-study-acme").
   - Sanitize: lowercase, [a-z0-9-] only, no leading/trailing hyphens, no consecutive hyphens, max 40 chars.
   - If the slug appears in the reserved list above, pick a different one.
   - If the slug collides with an existing top-level directory in src/app/, append "-2"; if "-2" is also taken, "-3"; up to "-99". If you cannot find a free slug, abort and explain.

2. Pick a PascalCase component name from the slug
   - Convert kebab-case to PascalCase (e.g., "pricing-comparison" → "PricingComparison").
   - This will be the default export name for the page.

3. Pick a human label
   - Title Case based on the slug (e.g., "pricing-comparison" → "Pricing Comparison").
   - Used as the sidebar label.

4. Write the page file at src/app/{slug}/page.tsx
   - Top of file: 'use client';
   - Default export: export default function {PascalName}() { ... }
   - Use Tailwind utility classes for layout and spacing.
   - Use the app's CSS variables (already in src/app/globals.css and exposed via .app-theme) for colors and fonts where possible — e.g., text-foreground, bg-background, border-border, font-sans, font-serif. If you need a specific brand color, prefer existing Tailwind theme tokens over hardcoded hex.
   - The page is a fully standalone landing/route surface. The root layout will add the site navbar and footer around it — DO NOT include a navbar or footer of your own.
   - Make the page substantively reflect the user's description (real content, real layout, real interactions where they make sense). Avoid placeholder text like "Lorem ipsum" — write content that fits the description.
   - Prefer composing with primitives from @/components/ui where they exist; otherwise inline JSX is fine.
   - Avoid heavy external dependencies. Stick to React, Tailwind, and what is already in package.json.
   - Do NOT create a layout.tsx file in the new directory.
   - Do NOT add metadata exports unless the description asks for them.

5. Register the page in the playground registry
   File: src/app/playground/registry.tsx
   You must edit this file in two places:

   a. Near the top of the file, in the block of dynamic imports (look for the existing pattern around line 32-56), add a new line:
      const {PascalName} = dynamic(() => import('@/app/{slug}/page')) as ComponentType<Record<string, unknown>>;
      Place it alphabetically among the other dynamic-import lines if a clear ordering exists; otherwise just append to that block.

   b. Inside the registry array, find the group with id: 'pages' (it has label: 'Pages'). Add a new leaf entry as the LAST child of that group's children array, then RE-SORT the children array alphabetically by the label field. The new leaf shape:

      {
        id: '{slug}',
        label: '{Title Case Label}',
        Component: {PascalName} as unknown as ComponentType<Record<string, unknown>>,
        sourcePath: 'src/app/{slug}/page.tsx',
        size: 'default' as ComponentSize,
        propsInterface: '// {PascalName} takes no props — content is internal',
      },

   Match the exact formatting (single quotes, trailing commas, indentation) of the existing entries in the file. Do not modify any existing entries.

{{stylingConstraint}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUALITY CHECKLIST

- [ ] Slug is unique against the taken list AND not in the reserved list
- [ ] src/app/{slug}/page.tsx exists, starts with 'use client', has a default export named {PascalName}
- [ ] No layout.tsx was created in src/app/{slug}/
- [ ] registry.tsx has a new dynamic import line for the page
- [ ] registry.tsx Pages group includes the new leaf, alphabetically sorted by label
- [ ] All imports resolve, no TypeScript errors, no syntax errors in registry.tsx
- [ ] Page content meaningfully reflects the user description (not generic placeholder)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create the page now.`;

export const RESERVED_TOP_LEVEL_SLUGS = [
  'api',
  'app',
  'playground',
  'pricing',
  'search',
  'public',
  'static',
  '_next',
  'favicon.ico',
];

export interface CreatePagePromptVars {
  skillSection?: string;
  description: string;
  stylingConstraint: string;
  reservedSlugs: string;
}

export function createPagePrompt(vars: CreatePagePromptVars): string {
  return fillTemplate(prompt, vars as unknown as Record<string, string>);
}
