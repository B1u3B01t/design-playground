/**
 * Discovery prompt eval harness.
 *
 *   npx tsx src/app/playground/evals/discovery.eval.ts
 *
 * 1. Snapshots any existing discovery.json (so the user's manifest survives).
 * 2. Runs the production prompt through the production spawnAgent('claude-code').
 * 3. Reads the agent-produced discovery.json.
 * 4. Computes deterministic structural findings + a repo file inventory.
 * 5. Calls the LLM-as-judge for a rubric critique.
 * 6. Writes prompt.txt, output.json, stdout.log, stderr.log, structural.json,
 *    judge.json, and report.md to a timestamped run directory.
 *
 * Env:
 *   ANTHROPIC_API_KEY   required (for the judge)
 *   EVAL_MODEL          model passed to the agent CLI (default: 'sonnet')
 *   EVAL_JUDGE_MODEL    judge model (default: 'claude-opus-4-5')
 *   EVAL_PROVIDER       'claude-code' (default) or 'cursor'
 *   EVAL_TIMEOUT_MS     hard timeout for the agent run (default: 600000)
 */

import fs from 'fs';
import path from 'path';
import { discoveryPrompt } from '../prompts/discovery.prompt';
import { resolvePlaygroundDir } from '../lib/resolve-playground-dir';
import { DISCOVERY_MANIFEST_FILENAME } from '../lib/constants';
import {
  spawnAgent,
  getProviderDisplayName,
  getProviderNotFoundMessage,
} from '../lib/providers';
import type { ProviderId } from '../lib/providers';
import { runStructuralChecks } from './structural-checks';
import { buildFileInventory } from './file-inventory';
import { runJudge } from './judge';

const CWD = process.cwd();
const PLAYGROUND_DIR = resolvePlaygroundDir();
const PLAYGROUND_REL = path.relative(CWD, PLAYGROUND_DIR).replace(/\\/g, '/');
const DISCOVERY_PATH = path.join(PLAYGROUND_DIR, DISCOVERY_MANIFEST_FILENAME);
const RUNS_DIR = path.join(PLAYGROUND_DIR, 'evals', 'runs');

async function main() {
  const provider = (process.env.EVAL_PROVIDER as ProviderId) ?? 'claude-code';
  const model = process.env.EVAL_MODEL ?? 'sonnet';
  const timeoutMs = Number(process.env.EVAL_TIMEOUT_MS ?? 600_000);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(RUNS_DIR, stamp);
  fs.mkdirSync(runDir, { recursive: true });

  console.log(`[eval] run dir: ${runDir}`);
  console.log(`[eval] provider=${getProviderDisplayName(provider)} model=${model}`);

  const baselinePath = path.join(runDir, 'baseline.json');
  const hadBaseline = fs.existsSync(DISCOVERY_PATH);
  if (hadBaseline) {
    fs.copyFileSync(DISCOVERY_PATH, baselinePath);
    fs.unlinkSync(DISCOVERY_PATH);
    console.log(`[eval] snapshotted existing discovery.json -> baseline.json`);
  }

  const restoreBaseline = () => {
    if (hadBaseline && fs.existsSync(baselinePath)) {
      fs.copyFileSync(baselinePath, DISCOVERY_PATH);
      console.log(`[eval] restored baseline discovery.json`);
    }
  };
  process.on('SIGINT', () => { restoreBaseline(); process.exit(130); });

  try {
    const promptText = discoveryPrompt({ playgroundDir: PLAYGROUND_REL });
    fs.writeFileSync(path.join(runDir, 'prompt.txt'), promptText);
    console.log(`[eval] prompt: ${promptText.length} chars`);

    const { stdout, stderr, code } = await runAgent(provider, model, promptText, timeoutMs);
    fs.writeFileSync(path.join(runDir, 'stdout.log'), stdout);
    fs.writeFileSync(path.join(runDir, 'stderr.log'), stderr);
    console.log(`[eval] agent exited code=${code}`);

    if (code !== 0) {
      console.error(`[eval] agent failed. See ${runDir}/stderr.log`);
      writeFailureReport(runDir, { code, stderr });
      restoreBaseline();
      process.exit(1);
    }

    if (!fs.existsSync(DISCOVERY_PATH)) {
      console.error(`[eval] agent completed but no discovery.json was written`);
      writeFailureReport(runDir, { code, stderr, missingOutput: true });
      restoreBaseline();
      process.exit(1);
    }

    const outputRaw = fs.readFileSync(DISCOVERY_PATH, 'utf-8');
    fs.writeFileSync(path.join(runDir, 'output.json'), outputRaw);
    let output: unknown;
    try { output = JSON.parse(outputRaw); } catch (e) {
      console.error(`[eval] output is not valid JSON:`, e);
      writeFailureReport(runDir, { code, stderr, parseError: String(e) });
      restoreBaseline();
      process.exit(1);
    }

    const structural = runStructuralChecks(output, CWD, PLAYGROUND_REL);
    fs.writeFileSync(path.join(runDir, 'structural.json'), JSON.stringify(structural, null, 2));
    console.log(`[eval] structural: ${structural.entryCount} entries | skip-violations=${structural.skipRuleViolations.length} | bad-paths=${structural.pathsNotOnDisk.length} | child-shape-violations=${structural.childShapeViolations.length} | pages-missing-route=${structural.pageMissingRoute.length} | status-anomalies=${structural.statusNotDiscovered.length} | desc-blocklist-hits=${structural.descriptionBlocklistHits.length} | dup-paths=${structural.duplicatePaths.length} | child-no-top-level=${structural.childPathHasNoTopLevelEntry.length}`);

    const inventory = buildFileInventory(CWD, PLAYGROUND_REL);
    fs.writeFileSync(path.join(runDir, 'inventory.json'), JSON.stringify(inventory, null, 2));
    console.log(`[eval] inventory: ${inventory.pages.length} pages, ${inventory.components.length} components`);

    console.log(`[eval] running judge...`);
    const judge = await runJudge({
      promptText,
      output,
      structuralFindings: structural,
      fileInventory: inventory,
    });
    fs.writeFileSync(path.join(runDir, 'judge.json'), JSON.stringify(judge, null, 2));

    const report = renderReport({
      provider: getProviderDisplayName(provider),
      model,
      stamp,
      structural,
      inventory,
      judge,
      output,
    });
    fs.writeFileSync(path.join(runDir, 'report.md'), report);

    console.log('\n========== SCORES ==========');
    for (const [k, v] of Object.entries(judge.scores)) {
      console.log(`  ${k.padEnd(22)} ${v.score}/5  ${v.rationale}`);
    }
    console.log('\n========== VERDICT ==========');
    console.log(judge.verdict);
    console.log(`\nFull report: ${path.join(runDir, 'report.md')}`);
  } finally {
    restoreBaseline();
  }
}

function runAgent(
  provider: ProviderId,
  model: string,
  prompt: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    let proc;
    try {
      proc = spawnAgent(provider, { model }, CWD);
    } catch (e) {
      reject(e);
      return;
    }
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      console.error(`[eval] timeout after ${timeoutMs}ms — killing agent`);
      proc.kill('SIGTERM');
      setTimeout(() => proc.kill('SIGKILL'), 2000);
    }, timeoutMs);

    proc.stdout?.on('data', (d: Buffer) => {
      const s = d.toString();
      stdout += s;
      process.stdout.write(s);
    });
    proc.stderr?.on('data', (d: Buffer) => {
      const s = d.toString();
      stderr += s;
      process.stderr.write(s);
    });
    proc.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      const msg = err.code === 'ENOENT' ? getProviderNotFoundMessage(provider) : err.message;
      reject(new Error(msg));
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });

    proc.stdin?.write(prompt);
    proc.stdin?.end();
  });
}

function writeFailureReport(runDir: string, info: Record<string, unknown>) {
  fs.writeFileSync(path.join(runDir, 'report.md'),
    `# Discovery Eval — FAILED\n\n\`\`\`json\n${JSON.stringify(info, null, 2)}\n\`\`\`\n`);
}

function renderReport(args: {
  provider: string;
  model: string;
  stamp: string;
  structural: ReturnType<typeof runStructuralChecks>;
  inventory: ReturnType<typeof buildFileInventory>;
  judge: Awaited<ReturnType<typeof runJudge>>;
  output: unknown;
}): string {
  const { provider, model, stamp, structural, inventory, judge, output } = args;
  const scoreLines = Object.entries(judge.scores)
    .map(([k, v]) => `| ${k} | ${v.score}/5 | ${v.rationale} |`)
    .join('\n');
  const entries = (output as { entries?: { id: string; path: string; type: string }[] }).entries ?? [];
  return `# Discovery Eval Report

**Run:** ${stamp}
**Provider:** ${provider}
**Model:** ${model}

## Rubric Scores

| Dimension | Score | Rationale |
|---|---|---|
${scoreLines}

## Verdict

${judge.verdict}

## Top Prompt Improvements

${judge.promptImprovements.map((s, i) => `${i + 1}. ${s}`).join('\n') || '_(none)_'}

## Missing Entries (per judge)

${judge.missing.map((s) => `- ${s}`).join('\n') || '_(none)_'}

## False Positives (per judge)

${judge.falsePositives.map((s) => `- ${s}`).join('\n') || '_(none)_'}

## Structural Findings

- Entries: ${structural.entryCount}
- Shape OK: ${structural.shapeOk}
- Shape issues: ${structural.shapeIssues.join(', ') || '_(none)_'}
- Bad ids: ${structural.badIds.join(', ') || '_(none)_'}
- Bad names: ${structural.badNames.join(', ') || '_(none)_'}
- Duplicate ids: ${structural.duplicateIds.join(', ') || '_(none)_'}
- Duplicate paths (same file in multiple entries): ${structural.duplicatePaths.map((d) => `${d.path} -> [${d.ids.join(', ')}]`).join('; ') || '_(none)_'}
- Paths not on disk: ${structural.pathsNotOnDisk.join(', ') || '_(none)_'}
- Skip-rule violations: ${structural.skipRuleViolations.join(', ') || '_(none)_'}
- Bad type: ${structural.badType.join(', ') || '_(none)_'}
- Pages missing route: ${structural.pageMissingRoute.join(', ') || '_(none)_'}
- Routes not starting with /: ${structural.routeNotStartingWithSlash.join(', ') || '_(none)_'}
- Route on component entry: ${structural.routeOnComponent.join(', ') || '_(none)_'}
- Status anomalies: ${structural.statusNotDiscovered.join(', ') || '_(none)_'}
- childComponents shape violations (not {name,path} objects): ${structural.childShapeViolations.length === 0 ? '_(none)_' : structural.childShapeViolations.map((v) => `${v.entryId}[${v.index}]: ${v.reason} (${JSON.stringify(v.value)})`).join('; ')}
- childComponents name not PascalCase: ${structural.childNameNotPascalCase.map((c) => `${c.entryId}->${c.childName}`).join(', ') || '_(none)_'}
- Missing child paths on disk: ${structural.childComponentMissingPaths.map((c) => `${c.entryId}->${c.childPath}`).join(', ') || '_(none)_'}
- Child paths with no top-level entry: ${structural.childPathHasNoTopLevelEntry.map((c) => `${c.entryId}->${c.childPath}`).join(', ') || '_(none)_'}
- Description blocklist hits: ${structural.descriptionBlocklistHits.map((h) => `${h.entryId}: [${h.tokens.join(', ')}]`).join('; ') || '_(none)_'}
- Empty descriptions: ${structural.descriptionEmpty.join(', ') || '_(none)_'}

## Repo Inventory

- Pages found in repo: ${inventory.pages.length}
- Components found in repo: ${inventory.components.length}
- Files legitimately skipped: ${inventory.skipped.length}

## Discovered Entries (${entries.length})

${entries.map((e) => `- \`${e.id}\` (${e.type}) — ${e.path}`).join('\n') || '_(none)_'}
`;
}

main().catch((err) => {
  console.error('[eval] fatal:', err);
  process.exit(1);
});
