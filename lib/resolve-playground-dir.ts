import fs from 'fs';
import path from 'path';

/**
 * Resolve the playground directory, handling both `src/app/playground`
 * and `app/playground` Next.js layouts.
 */
export function resolvePlaygroundDir(): string {
  const root = process.cwd();
  const candidates = [
    path.join(root, 'src', 'app', 'playground'),
    path.join(root, 'app', 'playground'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}
