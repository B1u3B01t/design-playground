/**
 * Playground config API handler.
 *
 * Returns the auto-detected playground root path so the frontend
 * can construct correct file paths in prompts and import aliases.
 */

import type { ApiRequest, ApiResponse } from './types';
import { resolvePlaygroundRoot } from './paths';

export async function handleConfigGet(_req: ApiRequest, res: ApiResponse) {
  res.json({ playgroundRoot: resolvePlaygroundRoot() });
}
