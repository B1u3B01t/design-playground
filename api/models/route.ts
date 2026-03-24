import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { MODELS_CACHE_TTL_MS, type ModelOption } from '../../lib/constants';
import type { ProviderId } from '../../lib/providers';
import { getProvider } from '../../lib/providers';

/**
 * Playground models API – returns available AI models for generation.
 *
 * GET: List models for the requested provider.
 *      - Cursor: runs CLI subcommand, parses output, caches 5 min.
 *      - Claude Code: returns static model list (no CLI subcommand).
 *      Query param: ?provider=cursor|claude-code (default: cursor)
 */

// Per-provider in-memory cache
const modelCache = new Map<ProviderId, { models: ModelOption[]; timestamp: number }>();
const CACHE_TTL_MS = MODELS_CACHE_TTL_MS;

function fetchModelsFromCLI(binary: string, args: string[], parse: (stdout: string) => ModelOption[]): Promise<ModelOption[]> {
  return new Promise((resolve, reject) => {
    execFile(binary, args, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        const config = getProvider('cursor'); // for ENOENT message
        reject(new Error(
          error.message.includes('ENOENT')
            ? config.notFoundMessage
            : `${binary} ${args.join(' ')} failed: ${stderr || error.message}`
        ));
        return;
      }

      const models = parse(stdout);

      // Must have more than just the "Auto (Default)" entry
      if (models.length <= 1) {
        reject(new Error(`No models parsed from ${binary} ${args.join(' ')} output`));
        return;
      }

      resolve(models);
    });
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const providerId = (url.searchParams.get('provider') || 'cursor') as ProviderId;

  const config = getProvider(providerId);
  const modelListArgs = config.buildModelListArgs();

  // Provider doesn't support dynamic model listing — return static list
  if (!modelListArgs) {
    return NextResponse.json({
      success: true,
      models: config.fallbackModels,
      source: 'static',
    });
  }

  // Check cache
  const now = Date.now();
  const cached = modelCache.get(providerId);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      models: cached.models,
      source: 'cache',
    });
  }

  // Fetch from CLI
  try {
    const models = await fetchModelsFromCLI(
      config.binary,
      modelListArgs,
      config.parseModelOutput!,
    );

    modelCache.set(providerId, { models, timestamp: Date.now() });

    return NextResponse.json({
      success: true,
      models,
      source: `${providerId}-cli`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[Playground][models] ${config.displayName} CLI fetch failed:`, message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
