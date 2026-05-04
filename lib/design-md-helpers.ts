import fs from 'fs';
import path from 'path';

export const DESIGN_MD_FILENAME = 'DESIGN.md';
export const DESIGN_MD_PACKAGE = '@google/design.md';

export function designMdPath(): string {
  return path.join(process.cwd(), DESIGN_MD_FILENAME);
}

export function designMdExists(): boolean {
  try {
    return fs.statSync(designMdPath()).isFile();
  } catch {
    return false;
  }
}

export function readDesignMd(): string | null {
  try {
    return fs.readFileSync(designMdPath(), 'utf8');
  } catch {
    return null;
  }
}

export function localBinPath(): string {
  return path.join(process.cwd(), 'node_modules', '.bin', 'design.md');
}

export function isPackageInstalled(): { installed: boolean; version?: string } {
  try {
    const pkgJson = path.join(
      process.cwd(),
      'node_modules',
      '@google',
      'design.md',
      'package.json',
    );
    const raw = fs.readFileSync(pkgJson, 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return { installed: true, version: parsed.version };
  } catch {
    return { installed: false };
  }
}

export function extractFrontMatter(md: string): string | null {
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return match ? match[1] : null;
}

export function buildSystemPromptAddon(md: string): string {
  const yaml = extractFrontMatter(md);
  const sections: string[] = [];
  sections.push(
    '=== DESIGN SYSTEM CONSTRAINTS (from DESIGN.md) ===',
    'Honor the tokens below in any UI you generate. Reference them via {path.to.token}',
    'syntax (e.g. {colors.primary}, {rounded.sm}). Section order: Overview, Colors,',
    'Typography, Layout, Elevation & Depth, Shapes, Components, Do\'s and Don\'ts.',
  );
  if (yaml) {
    sections.push('', '--- Tokens (YAML front-matter) ---', yaml);
  }
  const body = yaml ? md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '') : md;
  const trimmedBody = body.trim();
  if (trimmedBody.length > 0) {
    sections.push(
      '',
      '--- Design rationale (Markdown) ---',
      trimmedBody.length > 4000 ? trimmedBody.slice(0, 4000) + '\n…(truncated)' : trimmedBody,
    );
  }
  sections.push('=== END DESIGN SYSTEM ===', '');
  return sections.join('\n');
}

/**
 * Starter DESIGN.md matching the real @google/design.md alpha schema.
 * Schema reference: https://github.com/google-labs-code/design.md
 *
 * Top-level YAML keys are FLAT (no `tokens:` wrapper):
 *   name, description, colors, typography, spacing, rounded, components
 * Token references use {path.to.token}, e.g. {colors.primary}.
 */
export const STARTER_DESIGN_MD = `---
version: alpha
name: My Project
description: Starter design system. Edit these tokens to match your brand.
colors:
  primary: "#1A1C1E"
  secondary: "#6C7278"
  tertiary: "#2563EB"
  neutral: "#F7F5F2"
  on-primary: "#FFFFFF"
  on-tertiary: "#FFFFFF"
typography:
  h1:
    fontFamily: Inter
    fontSize: 3rem
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  h2:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: 600
    lineHeight: 1.2
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    lineHeight: 1.6
  label-caps:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 500
    letterSpacing: "0.06em"
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
rounded:
  sm: 4px
  md: 8px
  lg: 16px
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  card:
    backgroundColor: "{colors.neutral}"
    rounded: "{rounded.lg}"
    padding: 24px
---

## Overview

Describe the product and the feeling its UI should evoke. Two or three sentences
is plenty — the tokens above carry the precise values; this section gives the
*why*.

## Colors

The palette pairs high-contrast neutrals with a single accent for action.

- **Primary ({colors.primary}):** Deep ink for headlines and core text.
- **Secondary ({colors.secondary}):** Borders, captions, metadata.
- **Tertiary ({colors.tertiary}):** Reserved for primary actions and links.
- **Neutral ({colors.neutral}):** Page background; warmer than pure white.

## Typography

Headings use {typography.h1} for hero moments, {typography.h2} for section
titles. Body copy uses {typography.body-md}. Reserve {typography.label-caps}
for small uppercase eyebrows and metadata.

## Layout

Default container padding: {spacing.lg}. Section gap: {spacing.xl}. Inline gaps
between adjacent controls: {spacing.sm} or {spacing.md}.

## Elevation & Depth

Prefer flat surfaces with subtle 1px borders over shadows.

## Shapes

Default radius is {rounded.md}. Pills and large cards use {rounded.lg}.

## Components

### Button (primary)

- Background: {colors.tertiary}
- Text: {colors.on-tertiary}
- Radius: {rounded.md}
- Padding: 12px

### Card

- Background: {colors.neutral}
- Radius: {rounded.lg}
- Padding: 24px

## Do's and Don'ts

- Do: keep contrast ratios at or above 4.5:1 for body text.
- Do: reference tokens via {path} syntax — never hard-code values in components.
- Don't: introduce new colors outside this palette without adding a token first.
`;
