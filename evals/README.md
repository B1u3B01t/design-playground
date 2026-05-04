# Discovery Prompt Eval

Quality eval for `src/app/playground/prompts/discovery.prompt.ts`. Runs the prompt
end-to-end through the production agent code path (`spawnAgent('claude-code')`),
then has a separate Claude judge score the produced `discovery.json` against a
six-dimension rubric.

## Run

```bash
npm run eval:discovery
```

Or directly:

```bash
npx tsx src/app/playground/evals/discovery.eval.ts
```

No `ANTHROPIC_API_KEY` needed — both the scanner and the judge run through the
Claude Code CLI, which handles auth itself. Just make sure the CLI is logged in
(`claude` then `/login` once) and installed: `npm install -g @anthropic-ai/claude-code`.

## Env

| Var | Default | Notes |
|---|---|---|
| `EVAL_MODEL` | `sonnet` | Model passed to the scanner agent CLI as `--model`. |
| `EVAL_JUDGE_MODEL` | `opus` | Model for the judge CLI invocation. |
| `EVAL_PROVIDER` | `claude-code` | Or `cursor`. Same providers production uses. |
| `EVAL_JUDGE_PROVIDER` | `claude-code` | Provider for the judge run. |
| `EVAL_TIMEOUT_MS` | `600000` | Hard timeout for the scanner run. |
| `EVAL_JUDGE_TIMEOUT_MS` | `300000` | Hard timeout for the judge run. |

## What it does

1. Snapshots any existing `discovery.json` to `runs/<stamp>/baseline.json` and
   removes it (so the agent produces a fresh manifest). Restored on exit even
   on Ctrl-C or failure.
2. Builds the prompt via the real `discoveryPrompt(...)` function — no
   duplication.
3. Spawns the agent via the real `spawnAgent(...)`, pipes the prompt to stdin,
   captures stdout/stderr.
4. Reads the agent-produced `discovery.json`, runs deterministic structural
   checks (kebab-case ids, title-case names, paths-exist, skip-rule violations,
   schema shape).
5. Walks the repo to build a "ground truth" file inventory of pages and
   components the prompt *should* have considered.
6. Calls the LLM-as-judge with prompt text + output + structural findings +
   inventory. Judge returns JSON scores on six rubric dimensions plus
   actionable prompt-wording fixes.
7. Writes a markdown report.

## Run artifacts

`src/app/playground/evals/runs/<timestamp>/`

- `prompt.txt` — the exact text sent to the agent
- `output.json` — the agent's discovery.json
- `baseline.json` — the user's pre-existing manifest (restored after the run)
- `stdout.log` / `stderr.log` — raw agent output
- `structural.json` — deterministic findings
- `inventory.json` — repo file inventory used as ground truth
- `judge.json` — judge's scored response
- `report.md` — human-readable summary

## Rubric

Each scored 1-5 with a one-sentence rationale:

- **coverage** — were all visually meaningful pages/components found?
- **skipRuleCompliance** — were api routes, layout/error/loading/etc.,
  `components/ui/`, the playground dir, sub-10-line files correctly excluded?
- **naming** — kebab-case ids, title-case names, route-derived page names.
- **descriptionQuality** — one sentence, visual not code, distinct.
- **childComponents** — real, visual, on-disk, no shadcn/icon noise.
- **schemaCorrectness** — required fields, route only on pages, status valid.

The judge also returns a `verdict` paragraph and the top three concrete prompt
wording fixes it would recommend. Use these to iterate on
`discovery.prompt.ts`, then re-run and diff.

## Iterating on the prompt

A typical workflow:

```bash
# baseline run
npm run eval:discovery
# read runs/<stamp>/report.md, note suggested wording fixes
# edit src/app/playground/prompts/discovery.prompt.ts
# re-run
npm run eval:discovery
# diff the two reports
```

Compare across multiple model strengths to surface prompt fragility:

```bash
EVAL_MODEL=haiku  npm run eval:discovery
EVAL_MODEL=sonnet npm run eval:discovery
EVAL_MODEL=opus   npm run eval:discovery
```

A prompt that scores high on opus but low on haiku is under-specified.
