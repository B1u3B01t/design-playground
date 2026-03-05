import { execFile } from 'child_process';
import { MODELS_CACHE_TTL_MS, type ModelOption } from '../lib/constants';
import type { ApiRequest, ApiResponse } from './types';

// In-memory cache
let cachedModels: ModelOption[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = MODELS_CACHE_TTL_MS;

/**
 * Parse the output of `cursor agent models`.
 */
function parseModelsOutput(stdout: string): ModelOption[] {
  const models: ModelOption[] = [{ value: '', label: 'Auto (Default)' }];
  const lines = stdout.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(\S+)\s+-\s+(.+?)(?:\s+\((default|current)\))*\s*$/);
    if (match) {
      const [, value, rawLabel] = match;
      const label = rawLabel.trim();
      models.push({ value, label });
    }
  }

  return models;
}

function fetchModelsFromCLI(): Promise<ModelOption[]> {
  return new Promise((resolve, reject) => {
    execFile('cursor', ['agent', 'models'], { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(
          error.message.includes('ENOENT')
            ? 'Cursor CLI not found. Make sure `cursor` is in your PATH.'
            : `cursor agent models failed: ${stderr || error.message}`
        ));
        return;
      }

      const models = parseModelsOutput(stdout);

      if (models.length <= 1) {
        reject(new Error('No models parsed from cursor agent models output'));
        return;
      }

      resolve(models);
    });
  });
}

export async function handleModelsGet(_req: ApiRequest, res: ApiResponse) {
  const now = Date.now();
  if (cachedModels && now - cacheTimestamp < CACHE_TTL_MS) {
    return res.json({
      success: true,
      models: cachedModels,
      source: 'cache',
    });
  }

  try {
    const models = await fetchModelsFromCLI();
    cachedModels = models;
    cacheTimestamp = Date.now();

    res.json({
      success: true,
      models,
      source: 'cursor-cli',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[Playground][models] CLI fetch failed:', message);
    res.json({ success: false, error: message }, 500);
  }
}
