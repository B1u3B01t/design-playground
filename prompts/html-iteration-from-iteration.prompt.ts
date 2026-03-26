/**
 * Prompt template for generating HTML iterations from an existing HTML iteration.
 */
import { fillTemplate } from './utility';

const prompt = `
{{skillSection}}
HTML PAGE ITERATION REQUEST (FROM ITERATION)
═════════════════════════════════════════════

Page: {{pageName}}
Source iteration: public/{{pageFolder}}/{{sourceIterationFolder}}/index.html
Iterations requested: {{iterationCount}}
{{screenshotSection}}

INSTRUCTIONS

1. Read the source iteration at public/{{pageFolder}}/{{sourceIterationFolder}}/index.html
2. Understand its structure, layout, and visual design
3. Generate {{iterationCount}} variations numbered {{iterationNumbersList}}
4. For each iteration, complete ALL steps before starting the next:
   a. Create folder: public/{{pageFolder}}/iteration-{{N}}/
   b. Save as: public/{{pageFolder}}/iteration-{{N}}/index.html
   c. Copy any local assets as needed (images, fonts, etc.)
   d. Add entry to public/.playground/html-tree.json:
      { "version": 1, "entries": { "{{pageFolder}}/iteration-{{N}}": { "parent": "{{sourceIterationFolder}}" } } }
   e. Only then start the next iteration

CRITICAL REQUIREMENTS
- Output must be a complete, self-contained HTML file
- All CSS must be inline (<style> tags or style="" attributes) — no external <link> stylesheets
- No JavaScript frameworks or build tools
- Preserve the page's semantic structure
- Asset paths: use absolute paths like /{{pageFolder}}/image.png for shared assets
{{customInstructionsSection}}

CREATIVE LAYOUT & THEME FREEDOM (when iterationCount > 1)
- Explore bold layouts: asymmetric grids, overlapping elements, creative spacing
- Each iteration must be structurally and/or visually distinct from the source and other iterations

QUALITY CHECKLIST
- [ ] Valid, complete HTML document
- [ ] Inline CSS only (no external stylesheets)
- [ ] Asset references resolve correctly
- [ ] Entry added to public/.playground/html-tree.json with correct parent
- [ ] Visually distinct from source and other iterations`;

export interface HtmlIterationFromIterationPromptVars {
  skillSection?: string;
  pageName: string;
  pageFolder: string;
  sourceIterationFolder: string;
  iterationCount: string;
  iterationNumbersList: string;
  screenshotSection?: string;
  customInstructionsSection?: string;
}

export function htmlIterationFromIterationPrompt(vars: HtmlIterationFromIterationPromptVars): string {
  return fillTemplate(prompt, vars as unknown as Record<string, string>);
}
