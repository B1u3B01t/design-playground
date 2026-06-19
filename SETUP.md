# Playground Setup

## Quick Start

1. Copy the `playground/` folder into your Next.js project's `src/app/` directory
2. Open a terminal in your project root
3. Run the setup script:
   ```
   node src/app/playground/setup.mjs
   ```
4. Start your project (`npm run dev` or `npm run build && npm start`)
5. Open `http://localhost:3000/playground`

## Manual Install

If you prefer to skip the script, install the playground's dependencies **nested** —
from inside the playground folder, so nothing lands in your host `package.json`:

```
cd src/app/playground
npm install --legacy-peer-deps
```

Use your project's package manager if different: `pnpm install --config.auto-install-peers=false`,
`yarn install`, or `bun install`. The `--legacy-peer-deps` / `auto-install-peers=false` flag keeps
React out of the nested `node_modules` so it resolves to your app's single copy (no "invalid hook
call"). An `.npmrc` in the folder already sets this for npm, so a bare `npm install` there works too.

## Prerequisites

Your project needs these already installed:

- **Next.js** (App Router, v13+)
- **React** 18 or 19
- **Tailwind CSS** v4

The playground UI is **self-contained** — it ships its own neutral theme (a private `--pg-*` token namespace) and needs **no color setup**. Your own components, when rendered on the canvas, inherit **your app's** theme tokens automatically (light and dark): if your project uses [shadcn/ui](https://ui.shadcn.com)-style tokens (`--background`, `--primary`, `--muted`, …) in your global stylesheet, previews match your app exactly; if not, previews simply use whatever colors your components specify.

## How It Works

1. **Drag** components from the sidebar onto the canvas
2. **Generate variations** by clicking the sparkle icon on any component (requires an agent CLI — Cursor, Claude Code, or Codex)
3. **Compare** variations side-by-side on the canvas
4. **Use a variation** by clicking "Use this" to copy the import path
5. **Delete** variations you don't want — files are removed from your project automatically

## AI Generation

The variation generator runs an agent CLI as a subprocess. At least one of the following must be installed and in your PATH:

- **Cursor** — [Cursor CLI](https://cursor.com/docs/cli/installation), then `cursor agent login`
- **Claude Code** — `npm install -g @anthropic-ai/claude-code`
- **Codex** — `npm install -g @openai/codex`, then `codex login`

Switch providers in the Model Settings dialog (gear icon in the header). Codex runs sandboxed (`workspace-write`) by default — it can read everything but only write inside the repo; this and the reasoning effort are configurable under Advanced Options.

The setup script (`node src/app/playground/setup.mjs`) checks for installed providers and will tell you what's missing. Without one, everything else works — you just won't be able to generate new variations from the UI.

## Git

Setup updates your project's `.gitignore` so playground files stay out of version control:

- The full `src/app/playground/` (or `app/playground/`) folder
- Runtime artifacts: `.playground-temp/`, `public/.playground/`, uploaded images/PDFs
- HTML design frames under `public/{slug}/` (including iterations)
- Skills installed by the playground (`skills-lock.json`, `.claude/skills/`)

**Your host `package.json` and lockfile are untouched.** The playground's dependencies install nested under `src/app/playground/node_modules/` (gitignored), so setup produces no dependency diff for your project to commit.

**Create Page routes** (`src/app/{slug}/page.tsx` created from the playground) are host-app pages and remain tracked unless you ignore them yourself.

If you previously committed playground files, stop tracking them (files stay on disk):

```
node src/app/playground/setup.mjs --untrack
```

New HTML frames are added to `.gitignore` automatically when created or after generation.

## Removing the Playground

Delete the `src/app/playground/` folder. Its nested `node_modules/` (and everything the playground installed) goes with it — there is **nothing to uninstall** from your host project, because the playground never added anything to your `package.json`.
