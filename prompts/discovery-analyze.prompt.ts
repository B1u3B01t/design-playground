/**
 * Prompt template for per-component AI analysis.
 * The Cursor agent uses this to create a playground-ready wrapper
 * for a discovered component, with realistic mock props.
 */

interface DiscoveryAnalyzeParams {
  id: string;
  name: string;
  componentPath: string;
  type: 'page' | 'component';
  playgroundDir: string;
}

export function discoveryAnalyzePrompt({
  id,
  name,
  componentPath,
  type,
  playgroundDir,
}: DiscoveryAnalyzeParams): string {
  const cleanName = name.replace(/\s+/g, '');
  const discoveredFilename = `${cleanName}.discovered.tsx`;

  const pageInstructions = `This is a page component (\`page.tsx\`). Examine its structure carefully:

1. **If the page imports and renders a SINGLE primary UI component** (e.g., \`<PricingPageClient />\`), create the wrapper for that imported component instead of the page itself. Import that component directly.
2. **If the page renders MULTIPLE components or has significant inline JSX**, create the wrapper for the page's default export.
3. **If the page uses server-only features** (async component, \`cookies()\`, \`headers()\`, database queries, \`fetch\` with \`cache\`), you MUST find the client-side presentational component it delegates to and wrap that instead. Never import server-only modules.
4. **If the page re-exports or wraps a client component with minimal additions**, wrap the client component directly.`;

  const componentInstructions = `This is a standalone component. Create a wrapper that imports and renders it with realistic mock props.

If the component uses server-only features, find the underlying presentational component and wrap that instead.`;

  return `You are preparing a component for the design playground by creating a self-contained wrapper with realistic mock data.

## Component to analyze

- **Name**: ${name}
- **Path**: ${componentPath}
- **Type**: ${type}

## Step 1: Determine what to showcase

${type === 'page' ? pageInstructions : componentInstructions}

## Step 2: Create the wrapper file

Create a file at: \`${playgroundDir}/discovered/${discoveredFilename}\`

Requirements:
- MUST start with \`'use client';\`
- MUST include metadata comments (see format below)
- MUST import the target component using its actual export path
- MUST export a default function that renders the component with hardcoded props
- MUST be completely self-contained — no external data fetching, no \`useEffect\` calls for data
- All mock data must be inline and realistic (real-looking text, numbers, dates — NOT "Lorem ipsum" or "test123")
- If the component accepts children, provide meaningful children content

Format:
\`\`\`tsx
'use client';
/**
 * @discovery
 * @source ${componentPath}
 * @description <one sentence describing the visual result>
 */
import ComponentName from '<correct import path>';

export default function ${cleanName}Discovered() {
  return (
    <ComponentName
      prop1="realistic value"
      prop2={42}
    />
  );
}
\`\`\`

## Step 3: Update discovery.json

Read \`${playgroundDir}/discovery.json\` and update the entry with id \`${id}\`:

1. Set \`"status"\` to \`"added"\`
2. Add an \`"analysis"\` object with these fields:

\`\`\`json
{
  "analysis": {
    "showcasePath": "<path to the actual component file being rendered>",
    "componentName": "<PascalCase name of the React component>",
    "discoveredFilename": "${discoveredFilename}",
    "propsInterface": "<the TypeScript props interface as a string, or empty string if no props>",
    "size": "<one of: default | laptop | tablet | mobile>"
  }
}
\`\`\`

Size guidelines:
- \`"laptop"\` — for full-page layouts, dashboards, landing pages (anything meant to fill the viewport)
- \`"default"\` — for small/medium components (cards, buttons, sections)
- \`"tablet"\` or \`"mobile"\` — only if the component is specifically designed for that viewport

## Important rules

- Do NOT modify the original component file at \`${componentPath}\`
- ONLY create/modify files inside \`${playgroundDir}/discovered/\` and \`${playgroundDir}/discovery.json\`
- Make mock props look realistic and visually appealing when rendered
- If the component uses Tailwind CSS, that's fine — it works in the playground
- If the component imports from \`@/\` paths, use the same alias in your wrapper
- Ensure the import path in your wrapper is correct relative to the project structure
`;
}
