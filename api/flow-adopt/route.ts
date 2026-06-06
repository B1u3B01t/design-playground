import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolvePlaygroundDir } from '../../lib/resolve-playground-dir';
import { findFlowDescriptorById } from '../../lib/flows/registry';

const execFileP = promisify(execFile);

interface AdoptRequestBody {
  descriptorId: string;
  /** stage id → iteration filename (e.g. "SignupForm.iteration-3.tsx") */
  canonicalIterationByStage: Record<string, string>;
}

interface StageDiff {
  stageId: string;
  stageLabel: string;
  originalPath: string;
  iterationFilename: string;
  unifiedDiff: string;
}

/**
 * Generate a unified diff per non-synthetic stage that has a canonical
 * iteration chosen. The diff is rooted on the original source path so it
 * `git apply`s cleanly against the working tree.
 *
 * Each stage's diff is constructed by:
 *   1. Reading the original file at `descriptor.sourceFiles` (matched by name)
 *   2. Reading the iteration file at `src/app/playground/iterations/<name>`
 *   3. Spawning `git diff --no-index --no-prefix` between two temp copies
 *      named identically to the original (so headers reference the real path)
 *   4. Post-processing the resulting hunk headers to use the original path
 *
 * Diffs from all stages are concatenated and written to
 *   .context/flow-adopt-<descriptor>-<timestamp>.patch
 *
 * The route returns: { combinedDiff, perStageDiffs, patchPath }.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as AdoptRequestBody;
  const descriptor = findFlowDescriptorById(body.descriptorId);
  if (!descriptor) {
    return NextResponse.json({ error: 'Unknown descriptor' }, { status: 400 });
  }

  const projectRoot = process.cwd();
  const playgroundDir = resolvePlaygroundDir();
  const iterationsDir = path.join(playgroundDir, 'iterations');

  const perStageDiffs: StageDiff[] = [];
  const errors: string[] = [];

  for (const stage of descriptor.stages) {
    if (stage.synthetic) continue;
    const iterationFilename = body.canonicalIterationByStage[stage.id];
    if (!iterationFilename) continue;

    const originalRel = matchSourceFile(descriptor.sourceFiles, iterationFilename);
    if (!originalRel) {
      errors.push(`No source file matches iteration ${iterationFilename}`);
      continue;
    }
    const originalAbs = path.join(projectRoot, originalRel);
    const iterationAbs = path.join(iterationsDir, iterationFilename);

    try {
      const originalContent = await fs.readFile(originalAbs, 'utf-8');
      const iterationContent = await fs.readFile(iterationAbs, 'utf-8');
      const unifiedDiff = await diffStrings(
        originalContent,
        iterationContent,
        originalRel,
      );
      perStageDiffs.push({
        stageId: stage.id,
        stageLabel: stage.label,
        originalPath: originalRel,
        iterationFilename,
        unifiedDiff,
      });
    } catch (err) {
      errors.push(`Failed to diff stage ${stage.id}: ${(err as Error).message}`);
    }
  }

  const combinedDiff = perStageDiffs.map((d) => d.unifiedDiff).join('\n');

  let patchPath: string | null = null;
  if (combinedDiff.trim()) {
    const contextDir = path.join(projectRoot, '.context');
    await fs.mkdir(contextDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    patchPath = path.join('.context', `flow-adopt-${descriptor.id}-${stamp}.patch`);
    await fs.writeFile(
      path.join(projectRoot, patchPath),
      combinedDiff,
      'utf-8',
    );
  }

  return NextResponse.json({
    descriptorId: descriptor.id,
    perStageDiffs,
    combinedDiff,
    patchPath,
    errors,
  });
}

function matchSourceFile(sourceFiles: string[], iterationFilename: string): string | null {
  // iteration filename pattern: "<ComponentName>.iteration-<n>.tsx"
  const base = iterationFilename.split('.iteration-')[0];
  if (!base) return null;
  return (
    sourceFiles.find((f) => path.basename(f, path.extname(f)) === base) ?? null
  );
}

/**
 * Produce a unified diff between two strings that, when applied via
 * `git apply`, modifies the file at `originalPath`. We do this by writing
 * the original and modified content to identically-named files inside two
 * sibling temp directories ("a/" and "b/") and running git diff between
 * them — that's the same trick git itself uses internally.
 */
async function diffStrings(
  original: string,
  modified: string,
  originalPath: string,
): Promise<string> {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'flow-adopt-'));
  const aDir = path.join(tmpRoot, 'a', path.dirname(originalPath));
  const bDir = path.join(tmpRoot, 'b', path.dirname(originalPath));
  const aPath = path.join(tmpRoot, 'a', originalPath);
  const bPath = path.join(tmpRoot, 'b', originalPath);
  try {
    await fs.mkdir(aDir, { recursive: true });
    await fs.mkdir(bDir, { recursive: true });
    await writeFile(aPath, original, 'utf-8');
    await writeFile(bPath, modified, 'utf-8');
    let stdout = '';
    try {
      const result = await execFileP('git', [
        'diff',
        '--no-index',
        '--src-prefix=a/',
        '--dst-prefix=b/',
        '--',
        path.join('a', originalPath),
        path.join('b', originalPath),
      ], {
        cwd: tmpRoot,
        maxBuffer: 10 * 1024 * 1024,
      });
      stdout = result.stdout;
    } catch (err) {
      // git diff --no-index returns 1 when files differ — that's success
      const e = err as { code?: number; stdout?: string };
      if (e.code === 1 && typeof e.stdout === 'string') {
        stdout = e.stdout;
      } else {
        throw err;
      }
    }
    return stdout;
  } finally {
    await rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  }
}
