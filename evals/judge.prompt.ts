/**
 * LLM-as-judge prompt for critiquing the output of discovery.prompt.ts.
 *
 * The judge gets four inputs:
 *  - the prompt text that was sent to the agent (the thing under test)
 *  - the produced discovery.json
 *  - deterministic structural findings (id casing, missing files, skip-rule violations)
 *  - a file inventory of the repo's actual page.tsx and component files
 *
 * It returns strict JSON scoring six rubric dimensions plus actionable
 * prompt-improvement suggestions.
 */

export interface JudgePromptInput {
  promptText: string;
  output: unknown;
  structuralFindings: unknown;
  fileInventory: { pages: string[]; components: string[]; skipped: string[] };
}

export function judgePrompt(input: JudgePromptInput): string {
  return `You are a strict reviewer evaluating the output of a "repo discovery" prompt.

A Next.js project was scanned by an AI agent following the PROMPT below. The agent
wrote a discovery.json manifest listing visual pages and components worth showcasing
in a design playground. Your job is to grade how well the prompt + output performed,
on a rubric, and recommend wording fixes to the prompt.

================================================================================
PROMPT UNDER TEST
================================================================================
${input.promptText}

================================================================================
PRODUCED discovery.json
================================================================================
${JSON.stringify(input.output, null, 2)}

================================================================================
DETERMINISTIC STRUCTURAL FINDINGS (pre-computed; trust these as ground truth)
================================================================================
${JSON.stringify(input.structuralFindings, null, 2)}

================================================================================
REPO FILE INVENTORY (ground truth for coverage)
================================================================================
Pages (page.tsx files, excluding those the prompt instructs to skip):
${input.fileInventory.pages.map((p) => `  - ${p}`).join('\n') || '  (none)'}

Components (.tsx under src/components/, excluding ui/ primitives):
${input.fileInventory.components.map((p) => `  - ${p}`).join('\n') || '  (none)'}

Files that the prompt's skip rules legitimately exclude (for sanity checks):
${input.fileInventory.skipped.map((p) => `  - ${p}`).join('\n') || '  (none)'}

================================================================================
RUBRIC
================================================================================
Score each of the following 1-5 (1 = poor, 5 = excellent). Provide a one-sentence
rationale grounded in specific entries or omissions:

1. coverage              — did entries[] capture the visually meaningful pages
                           and components from the inventory? Penalize missing
                           obvious entries.
2. skipRuleCompliance    — did it correctly exclude api routes, layout/error/
                           loading/template/not-found/global-error files,
                           the playground dir itself, and sub-10-line files?
                           NOTE: \`components/ui/\` (shadcn primitives) IS in scope
                           and should be INCLUDED. Do NOT flag those as violations.
3. naming                — kebab-case ids, title-case names, route-derived page
                           names per the prompt's stated rules.
4. descriptionQuality    — descriptions are one sentence, describe visual
                           appearance (not code), distinct per entry, useful
                           to a designer browsing the playground.
5. childComponents       — listed children are PascalCase, exist on disk,
                           are visual UI (not hooks/contexts/icons/shadcn-ui),
                           and empty arrays only where truly no visual children.
6. schemaCorrectness     — required fields present per entry, route only on
                           pages, status="discovered", id uniqueness.

================================================================================
OUTPUT FORMAT
================================================================================
Respond with ONLY a single JSON object (no prose, no markdown fences) in exactly
this shape:

{
  "scores": {
    "coverage":           { "score": 1-5, "rationale": "..." },
    "skipRuleCompliance": { "score": 1-5, "rationale": "..." },
    "naming":             { "score": 1-5, "rationale": "..." },
    "descriptionQuality": { "score": 1-5, "rationale": "..." },
    "childComponents":    { "score": 1-5, "rationale": "..." },
    "schemaCorrectness":  { "score": 1-5, "rationale": "..." }
  },
  "missing":          ["src/app/.../page.tsx — should have been included because ..."],
  "falsePositives":   ["src/app/.../layout.tsx — violates skip rules"],
  "promptImprovements": [
    "Top fix #1: <concrete wording change to discovery.prompt.ts>",
    "Top fix #2: ...",
    "Top fix #3: ..."
  ],
  "verdict": "One paragraph overall summary."
}

Be terse but specific. Cite entry ids and file paths. Do not invent files
that aren't in the inventory.`;
}
