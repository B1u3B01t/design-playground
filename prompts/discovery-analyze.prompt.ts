/**
 * Prompt template for per-component AI analysis.
 * The Cursor agent uses this to add a component to the playground registry
 * with realistic mock props — no wrapper files, just data + registry entry.
 */

interface DiscoveryAnalyzeParams {
  id: string;
  name: string;
  componentPath: string;
  type: 'page' | 'component';
  playgroundDir: string;
  /** Real data fetched from the app's data source. Use verbatim for mock props. */
  propsSnapshot?: Record<string, unknown>;
}

export function discoveryAnalyzePrompt({
  id,
  name,
  componentPath,
  type,
  playgroundDir,
  propsSnapshot,
}: DiscoveryAnalyzeParams): string {
  const cleanName = name.replace(/\s+/g, '');
  const mockDataFilename = `${cleanName}.mockData.ts`;

  const pageInstructions = `This is a page component (\`page.tsx\`). Examine its structure carefully:

1. **If the page imports and renders a SINGLE primary UI component** (e.g. \`<InsightsClient />\`), register that imported component directly — use its actual import path.
2. **If the page renders MULTIPLE components or significant inline JSX**, register the page's default export.
3. **If the page uses server-only features** (async component, \`cookies()\`, \`headers()\`, database queries, \`fetch\` with \`cache\`), you MUST find the client-side presentational component it delegates to. Never import server-only modules in a registry entry.
4. **If the page re-exports or wraps a client component with minimal additions**, register the client component directly.`;

  const componentInstructions = `This is a standalone component. Register it directly using its actual import path.

If it uses server-only features, find the underlying presentational component and register that instead.`;

  const snapshotSection = propsSnapshot
    ? `## Real data snapshot — use this for mock props

The following is live data fetched directly from this app's data source.
**Use these exact values** when writing the mock props. Do NOT copy any fetch logic — just inline the data as constants.

\`\`\`json
${JSON.stringify(propsSnapshot, null, 2)}
\`\`\`

`
    : '';

  return `You are adding a component to the design playground. Follow each step exactly.

## Component to register

- **Name**: ${name}
- **Path**: ${componentPath}
- **Type**: ${type}

## Step 1: Determine what to register

${type === 'page' ? pageInstructions : componentInstructions}

${snapshotSection}## Step 2: Create the mock data file

Create a file at: \`${playgroundDir}/data/${mockDataFilename}\`

Requirements:
- Export a single \`mockData\` const containing every prop needed to render the component
- All values must be realistic (real names, real-looking dates, plausible copy — NOT "Lorem ipsum" or "test123")
- Pure serialisable data only — no imports, no functions
- Include any enum/variant props (e.g. \`variant: 'expanded'\`) needed for the ideal default preview

\`\`\`ts
/**
 * Mock data for the ${name} component.
 * Auto-populated by the playground discovery flow — edit freely.
 */

export const mockData = {
  // spread all props the component needs
};
\`\`\`

## Step 3: Add an entry to registry.tsx

Open \`${playgroundDir}/registry.tsx\` and make two edits.

First, determine the **registry ID** and **camelCase variable name** for this component:
- The registry \`id\` MUST be the PascalCase name of the React component you are registering, converted to kebab-case.
  - Examples: \`Team\` → \`team\`, \`ArticleCard\` → \`article-card\`, \`InsightsClient\` → \`insights-client\`
  - Do NOT use the page/route name (e.g. do NOT use \`team-page\` or \`insights-page\`)
- The camelCase variable name is the same conversion in camelCase: \`team\`, \`articleCard\`, \`insightsClient\`

### 3a — add the import at the top (alongside the other mock data imports)

\`\`\`ts
import { mockData as <camelCaseName>MockData } from './data/${mockDataFilename.replace('.ts', '')}';
\`\`\`

Also add the component import (use \`dynamic\` for large page components, static import for small components):

\`\`\`ts
// for a large page component:
const <ComponentName> = dynamic(() => import('<correct import path>')) as ComponentType<Record<string, unknown>>;

// for a small/medium component:
import <ComponentName> from '<correct import path>';
\`\`\`

### 3b — add the entry inside the \`components\` group's \`children\` array

\`\`\`ts
{
  id: '<kebab-case component name — e.g. team, article-card, insights-client>',
  label: '${name}',
  Component: <ComponentName> as unknown as ComponentType<Record<string, unknown>>,
  props: <camelCaseName>MockData as Record<string, unknown>,
  sourcePath: '<path to the actual component file being registered>',
  size: '<one of: default | laptop | tablet | mobile>' as ComponentSize,
  propsInterface: \`<the component's TypeScript props interface as a string>\`,
},
\`\`\`

**ID rule (critical):** The \`id\` must match the component name in kebab-case, not the discovery entry ID (\`${id}\`). The iteration system uses this ID to link generated variants back to the registry.

Size guidelines:
- \`laptop\` — full-page layouts, dashboards, landing pages
- \`default\` — cards, sections, small/medium components
- \`tablet\` / \`mobile\` — only if the component targets that specific viewport

## Step 4: Update discovery.json

Read \`${playgroundDir}/discovery.json\` and update the entry with id \`${id}\`:

1. Set \`"status"\` to \`"added"\`
2. Add an \`"analysis"\` object:

\`\`\`json
{
  "analysis": {
    "showcasePath": "<path to the component file being registered>",
    "componentName": "<PascalCase React component name, e.g. Team, ArticleCard, InsightsClient>",
    "registryId": "<same kebab-case id used in registry.tsx, e.g. team, article-card, insights-client>",
    "propsInterface": "<TypeScript props interface as a string>",
    "size": "<default | laptop | tablet | mobile>"
  }
}
\`\`\`

## Rules

- Do NOT modify the original component at \`${componentPath}\`
- Do NOT create any wrapper or \`discovered/\` files — there is no \`discovered/\` directory
- Only touch: \`${playgroundDir}/data/${mockDataFilename}\`, \`${playgroundDir}/registry.tsx\`, \`${playgroundDir}/discovery.json\`
- All import paths must be correct relative to the project root (\`@/\` alias maps to \`src/\`)
- Mock data must look visually appealing and realistic when rendered
`;
}
