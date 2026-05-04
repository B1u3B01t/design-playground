/**
 * Prompt template for AI-powered repository scanning.
 * The Cursor agent uses this to discover visual components and pages
 * worth showcasing in the playground.
 */

interface DiscoveryPromptParams {
  playgroundDir: string;
  existingEntryIds?: string[];
}

export function discoveryPrompt({ playgroundDir, existingEntryIds }: DiscoveryPromptParams): string {
  const preserveClause = existingEntryIds?.length
    ? `\n## Preserve existing entries\nThe following entry IDs already have status "added" in discovery.json. Keep them exactly as-is (do NOT overwrite their status or analysis). Only add or update entries with status "discovered".\nPreserve IDs: ${existingEntryIds.join(', ')}\n`
    : '';

  return `You are scanning a Next.js project to discover visual UI components and pages that can be showcased in a design playground.

## Task

Scan the project and create (or update) a discovery manifest at \`${playgroundDir}/discovery.json\`.

## Step 1 — Enumerate every candidate file FIRST

Before deciding what to include, build a complete list of every \`.tsx\` file in the repo by running:

\`\`\`bash
find . -type f -name "*.tsx" -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./${playgroundDir}/*"
\`\`\`

You MUST run this command and look at every file in the output. Do not rely on memory of conventional Next.js layouts — this codebase may colocate UI components inside \`src/app/\` (e.g. \`src/app/ui/home/Hero.tsx\`, \`src/app/<route>/ui/*.tsx\`, \`src/app/<route>/[slug]/*.tsx\`). Those colocated files are in scope.

## Directories in scope

Recursively traverse all of these (do NOT stop at the first level):

1. **Pages**: every \`page.tsx\` under \`src/app/\` (or \`app/\` if no \`src/\` exists), at any depth.
2. **Top-level components**: every \`.tsx\` under \`src/components/\` (or \`components/\`), at any depth — including nested subdirectories like \`src/components/editor/\`, \`src/components/Footer/\`, **and \`src/components/ui/\` (shadcn primitives like button, card, dialog, etc. ARE in scope)**.
3. **Colocated UI under \`src/app/\`**: every visual \`.tsx\` that is NOT a \`page.tsx\` and NOT a Next.js special file (see SKIP list). Common locations: \`src/app/ui/**\`, \`src/app/<route>/ui/**\`, \`src/app/<route>/[slug]/**\`, sibling files next to a \`page.tsx\` (e.g. \`src/app/signup/SignupForm.tsx\`).

## What to INCLUDE

- Every \`page.tsx\` that exports a React page — auth-gated pages (e.g. \`/account\`), admin/edit pages (e.g. \`/insights/[slug]/edit\`), legal/static pages (e.g. \`/privacy\`), and niche utility pages (e.g. \`/patternspdf\`) are ALL in scope. Do not filter by perceived "showcase value" — if it renders JSX with visual content, include it.
- Standalone visual components — cards, banners, modals, navbars, footers, players, badges, editors, toolbars, sections, grids, carousels, FABs, etc.
- Components are eligible **even if they also appear as \`childComponents\`** of another entry. A component appearing as a child in some entry's \`childComponents\` array does NOT exclude it from being its own standalone entry. (Example: \`MobileNavigation\` is rendered by \`Navbar\`, but it is also a standalone component and must be its own entry.)

## What to SKIP

- Everything inside \`${playgroundDir}/\`
- API routes (\`src/app/api/\` or \`app/api/\`) — \`route.ts\` and \`route.tsx\` are never in scope
- Next.js special files (anywhere in \`src/app/\` or \`app/\`): \`layout.tsx\`, \`loading.tsx\`, \`error.tsx\`, \`not-found.tsx\`, \`template.tsx\`, \`global-error.tsx\`
- Pure non-visual files: hooks (\`use-*.ts(x)\`), utilities, contexts, stores, types, constants, middleware
- True wrappers — defined precisely as: components whose JSX is **only** \`{children}\` (or \`{children}\` plus a single layout wrapper) with no visual elements of their own. \`ConditionalNavbar\`-style components that conditionally render another component without contributing visuals are wrappers and should be skipped. **Do NOT use "wrapper" loosely** — components that render real visual JSX (text, buttons, images, banners, players) are NOT wrappers, even if they also accept children.
- Pure provider/script-loader components: e.g. \`MixpanelProvider\`, \`GoogleOneTap\` (script injection only).
- Files that only re-export other components with no JSX of their own.
- Files smaller than 10 lines.
${preserveClause}
## Step 2 — How to decide per file

For each file from the \`find\` output, OPEN AND READ THE FILE, then ask:

1. Does it default-export or named-export a React component?
2. Does its JSX contain real visual elements — DOM tags with content/styling, images, custom visual components, motion elements? (Not just \`{children}\`, not just an effect/script.)
3. Is it not in the SKIP list above?

If all three are yes, include it as an entry. **Err on the side of including** — coverage is more important than curation. If you are unsure, include it.

## Step 3 — Naming and description rules (read once, apply to every entry)

### Page name — mechanical, no editorializing

Derive the page \`name\` from the URL route, not the rendered content. Procedure:

1. Drop the leading \`/\`.
2. Split on \`/\`.
3. Replace every dynamic segment (\`[slug]\`, \`[id]\`, \`[...slug]\`, etc.) with the literal word \`Detail\`.
4. Title-case each remaining segment as-is — no synonyms, no rebranding.
5. Join with spaces. Empty result (the \`/\` route) → \`Home\`.

| Route | Name |
|---|---|
| \`/\` | Home |
| \`/browse\` | Browse |
| \`/browse/[slug]\` | Browse Detail |
| \`/community/[slug]\` | Community Detail |
| \`/products\` | Products |
| \`/2025\` | 2025 |
| \`/insights/[slug]/edit\` | Insights Detail Edit |

Forbidden: "Gallery" for \`/browse\`, "Product Studio" for \`/products\`, "Rewind 2025" for \`/2025\`, "Community Blog Post" or "Interaction Detail" for any \`[slug]\` route.

### Component name — mechanical from filename

\`BiteDetailCard.tsx\` → \`"Bite Detail Card"\`. Do not editorialize.

### Two different name fields

- \`entries[].name\` — display name. Title Case With Spaces.
- \`childComponents[].name\` — import identifier. PascalCase, copied verbatim from the parent's \`import\` statement. Never spaced.

\`\`\`json
{
  "name": "Home",
  "childComponents": [
    { "name": "Hero",         "path": "src/app/ui/home/Hero.tsx" },
    { "name": "BitesPreview", "path": "src/app/ui/home/BitesPreview.tsx" }
  ]
}
\`\`\`

The \`BitesPreview\` component has its OWN entry with \`"name": "Bites Preview"\` (display) and \`"path": "src/app/ui/home/BitesPreview.tsx"\`.

### Description — what's on screen, not what's in the code

One sentence. Describe color, layout, type, imagery, motion. Never name libraries, hooks, providers, or rendering strategy.

If the description contains any of these tokens, rewrite it:
\`Server-rendered\`, \`SSR\`, \`Client-rendered\`, \`Memoized\`, \`Suspense\`, \`Zustand\`, \`useState\`, \`useEffect\`, \`useMemo\`, \`TipTap\`, \`Tiptap\`, \`ConvertKit\`, \`Bunny\`, \`Mixpanel\`, \`Supabase\`, \`postMessage\`, \`Exports \`, \`Uses \`, \`Renders \`, \`Imports \`, \`Passes \`, \`via a \`, \`-based\`, \`auto-resize\`, \`store\`, \`hook\`, \`context\`, \`provider\`, \`embed form\`, \`SSR data\`.

## Step 4 — Final validation (DO NOT SKIP)

After writing \`discovery.json\`, re-read the file and verify EVERY box below. If any check fails, fix and rewrite. Do not stop until all pass.

\`\`\`
☐  Top-level "version" is the integer 1 (not "1", not "1.0.0")
☐  Top-level "scannedAt" is an ISO 8601 string
☐  Top-level "entries" is an array

Per entry:
☐  Has all of: id, name, path, type, description, status, childComponents
☐  type is exactly "page" or "component"
☐  If type === "page":     has a "route" field (string starting with "/")
☐  If type === "component": does NOT have a "route" field
☐  status is exactly the string "discovered" (not "active", not "added", not "ready")
☐  id is unique across all entries, kebab-case
☐  path resolves to an existing file on disk (verify by listing the file)
☐  ONE entry per .tsx file — even if the file exports multiple components
☐  description contains NONE of the blocklist tokens above

Per childComponents[] entry:
☐  Is an OBJECT with exactly two keys: "name" and "path"
☐  "name" is PascalCase (no spaces) — the import identifier from the parent's source
☐  "path" resolves to an existing file on disk
☐  "path" also appears as a top-level entries[].path

Coverage:
☐  Every page.tsx returned by the \`find\` command (Step 1) is either an entry
   OR matches a SKIP rule with a stated reason
☐  Every .tsx under src/components/ is either an entry OR matches a SKIP rule
☐  Borderline files (script-loaders like ConvertKitEmbed, editor extensions,
   skeleton sub-components) are INCLUDED, not skipped
\`\`\`

Run through every box. Treat unchecked boxes as a failure that requires rewriting the file.

## Output format

Write the following JSON to \`${playgroundDir}/discovery.json\`:

\`\`\`json
{
  "version": 1,
  "scannedAt": "<current ISO 8601 timestamp>",
  "entries": [
    {
      "id": "<unique-kebab-case-slug>",
      "name": "<Human Friendly Name>",
      "path": "<relative/path/to/file.tsx>",
      "type": "page",
      "route": "/url-path",
      "description": "<One sentence describing what this looks like>",
      "status": "discovered",
      "childComponents": [
        { "name": "<PascalCaseComponentName>", "path": "<relative/path/to/ChildComponent.tsx>" }
      ]
    },
    {
      "id": "<unique-kebab-case-slug>",
      "name": "<Human Friendly Name>",
      "path": "<relative/path/to/file.tsx>",
      "type": "component",
      "description": "<One sentence describing what this looks like>",
      "status": "discovered",
      "childComponents": []
    }
  ]
}
\`\`\`

## Naming rules

- For pages: derive the name from the URL route. Examples:
  - \`/pricing\` → "Pricing"
  - \`/browse\` → "Browse"
  - \`/browse/[slug]\` → "Browse Detail"
  - \`/\` → "Home"
- For components: derive from the filename with spaces between words. Examples:
  - \`HeroSection.tsx\` → "Hero Section"
  - \`BitesGrid.tsx\` → "Bites Grid"
- Always use title case

## Field rules

- \`id\`: unique, kebab-case (e.g., "pricing-page", "hero-section")
- \`type\`: "page" for \`page.tsx\` files, "component" for everything else (top-level components AND colocated UI)
- \`route\`: only include for "page" type entries (the URL path, e.g., "/pricing"). Omit for "component" type.
- \`status\`: always set to "discovered" for new entries
- \`description\`: one sentence, describe the visual appearance (not the code)
- \`childComponents\`: array of visual child components imported and rendered by this entry. For each child:
  - \`name\`: the PascalCase React component name as imported (e.g., "Hero", "SignupForm", "PlanCards")
  - \`path\`: relative path to the child component file (e.g., "src/app/signup/SignupForm.tsx")
  - Only include children that are **visual UI components** — skip hooks, utilities, context providers, icons, and pure wrappers. (shadcn primitives from \`components/ui/\` ARE allowed as children.)
  - Only include children that live **within the project** (not from node_modules)
  - Read the file to identify which components it imports and renders in its JSX — list those as children
  - A child component listed here MUST also exist as its own top-level entry in \`entries[]\`. Children and standalone entries are not mutually exclusive.
  - If the entry has no visual child components, use an empty array \`[]\`

## Important

- Do NOT modify any files other than \`${playgroundDir}/discovery.json\`
- Read each candidate file before including it — do not guess based on filename alone
- **Coverage is the primary goal.** It is better to include a borderline file than to miss it. The user can prune later.
`;
}
