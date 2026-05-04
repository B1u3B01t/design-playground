/**
 * Runs the LLM-as-judge through the Claude Code CLI (same auth/binary the
 * production agent uses). No ANTHROPIC_API_KEY needed — the CLI handles auth.
 *
 * The judge runs in plain-text mode (`-p --output-format text`) and we parse
 * the first JSON object out of stdout.
 */

import { spawnAgent, getProviderNotFoundMessage } from '../lib/providers';
import type { ProviderId } from '../lib/providers';
import { judgePrompt, type JudgePromptInput } from './judge.prompt';

export interface JudgeResult {
  scores: Record<string, { score: number; rationale: string }>;
  missing: string[];
  falsePositives: string[];
  promptImprovements: string[];
  verdict: string;
  raw: string;
}

const DEFAULT_JUDGE_MODEL = 'opus';
const DEFAULT_JUDGE_TIMEOUT_MS = 300_000;

export async function runJudge(input: JudgePromptInput): Promise<JudgeResult> {
  const provider: ProviderId = (process.env.EVAL_JUDGE_PROVIDER as ProviderId) ?? 'claude-code';
  const model = process.env.EVAL_JUDGE_MODEL ?? DEFAULT_JUDGE_MODEL;
  const timeoutMs = Number(process.env.EVAL_JUDGE_TIMEOUT_MS ?? DEFAULT_JUDGE_TIMEOUT_MS);
  const prompt = judgePrompt(input);

  const raw = await runCli(provider, model, prompt, timeoutMs);
  const json = extractJson(raw);
  if (!json || typeof json !== 'object') {
    throw new Error(`Judge response was not valid JSON. Raw output:\n${raw}`);
  }
  const r = json as Record<string, unknown>;
  return {
    scores: (r.scores ?? {}) as JudgeResult['scores'],
    missing: Array.isArray(r.missing) ? (r.missing as string[]) : [],
    falsePositives: Array.isArray(r.falsePositives) ? (r.falsePositives as string[]) : [],
    promptImprovements: Array.isArray(r.promptImprovements)
      ? (r.promptImprovements as string[])
      : [],
    verdict: typeof r.verdict === 'string' ? r.verdict : '',
    raw,
  };
}

function runCli(
  provider: ProviderId,
  model: string,
  prompt: string,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let proc;
    try {
      proc = spawnAgent(provider, { model }, process.cwd());
    } catch (e) {
      reject(e);
      return;
    }
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      setTimeout(() => proc.kill('SIGKILL'), 2000);
    }, timeoutMs);

    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      const msg = err.code === 'ENOENT' ? getProviderNotFoundMessage(provider) : err.message;
      reject(new Error(msg));
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Judge CLI exited with code ${code}. Stderr:\n${stderr.slice(0, 1000)}`));
        return;
      }
      resolve(stdout);
    });

    proc.stdin?.write(prompt);
    proc.stdin?.end();
  });
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}
