import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  DESIGN_MD_PACKAGE,
  designMdExists,
} from '../../../lib/design-md-helpers';

export const runtime = 'nodejs';

const SCRIPTS = {
  'design:lint': 'design.md lint DESIGN.md',
  'design:diff': 'design.md diff DESIGN.md',
  'design:export': 'design.md export DESIGN.md',
};

function patchPackageJsonScripts(): { added: string[]; error?: string } {
  const pkgPath = path.join(process.cwd(), 'package.json');
  try {
    const raw = fs.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    pkg.scripts = pkg.scripts ?? {};
    const added: string[] = [];
    for (const [name, cmd] of Object.entries(SCRIPTS)) {
      if (!pkg.scripts[name]) {
        pkg.scripts[name] = cmd;
        added.push(name);
      }
    }
    if (added.length > 0) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    }
    return { added };
  } catch (error) {
    return { added: [], error: error instanceof Error ? error.message : 'package.json patch failed' };
  }
}

export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const log = (line: string) => controller.enqueue(encoder.encode(line + '\n'));

      log(`> Installing ${DESIGN_MD_PACKAGE} as a dev dependency…`);

      const child = spawn('npm', ['install', '--save-dev', DESIGN_MD_PACKAGE], {
        cwd: process.cwd(),
        env: { ...process.env, npm_config_color: 'false' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      child.stdout.on('data', (chunk: Buffer) => {
        controller.enqueue(encoder.encode(chunk.toString('utf8')));
      });
      child.stderr.on('data', (chunk: Buffer) => {
        controller.enqueue(encoder.encode(chunk.toString('utf8')));
      });

      const exitCode: number | null = await new Promise((resolve) => {
        child.on('close', (code) => resolve(code));
        child.on('error', (err) => {
          log(`\n[error] ${err.message}`);
          resolve(1);
        });
      });

      if (exitCode !== 0) {
        log(`\n[failed] npm install exited with code ${exitCode}.`);
        log('[done]');
        controller.close();
        return;
      }

      log(`\n> Installed ${DESIGN_MD_PACKAGE}.`);

      if (designMdExists()) {
        log('> DESIGN.md already exists; left untouched.');
      } else {
        log('> DESIGN.md not found. Use step 2 ("Generate from my codebase" or "Use blank starter") to create it.');
      }

      // Patch package.json scripts
      const patch = patchPackageJsonScripts();
      if (patch.error) {
        log(`[warn] Could not update package.json scripts: ${patch.error}`);
      } else if (patch.added.length === 0) {
        log('> npm scripts already present (design:lint, design:diff, design:export).');
      } else {
        log(`> Added npm scripts: ${patch.added.join(', ')}.`);
      }

      log('\n[done]');
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
