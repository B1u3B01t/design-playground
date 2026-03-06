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

## Directories to scan

1. **Pages**: All \`page.tsx\` files under \`src/app/\` (or \`app/\` if no \`src/\` directory exists)
2. **Components**: All \`.tsx\` files under \`src/components/\` (or \`components/\` if no \`src/\` exists)

## What to INCLUDE

- Pages (\`page.tsx\`) that render meaningful visual UI (landing pages, dashboards, forms, pricing pages, etc.)
- Standalone components that render visual UI elements (cards, sections, heroes, grids, etc.)

## What to SKIP

- Everything inside \`${playgroundDir}/\`
- API routes (\`src/app/api/\` or \`app/api/\`)
- Next.js special files: \`layout.tsx\`, \`loading.tsx\`, \`error.tsx\`, \`not-found.tsx\`, \`template.tsx\`, \`global-error.tsx\`
- Files inside \`src/components/ui/\` or \`components/ui/\` (these are shadcn/ui primitives)
- Non-visual files: hooks, utilities, contexts, providers, stores, types, constants, middleware
- Files that only re-export other components with no visual content of their own
- Files smaller than 10 lines
${preserveClause}
## How to decide

Read each candidate file and check:
1. Does it export a React component (default export or named export)?
2. Does it contain JSX with actual visual elements (not just a wrapper/provider)?
3. Would it be visually interesting to preview in a design playground?

If all three are yes, include it.

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
      "status": "discovered"
    },
    {
      "id": "<unique-kebab-case-slug>",
      "name": "<Human Friendly Name>",
      "path": "<relative/path/to/file.tsx>",
      "type": "component",
      "description": "<One sentence describing what this looks like>",
      "status": "discovered"
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
- \`type\`: "page" for page.tsx files, "component" for standalone components
- \`route\`: only include for "page" type entries (the URL path, e.g., "/pricing")
- \`status\`: always set to "discovered" for new entries
- \`description\`: one sentence, describe the visual appearance (not the code)

## Important

- Do NOT modify any files other than \`${playgroundDir}/discovery.json\`
- Read each candidate file before including it — do not guess based on filename alone
- Quality over quantity — only include components that would be visually interesting to preview
`;
}
