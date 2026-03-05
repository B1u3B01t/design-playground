#!/usr/bin/env node

/**
 * Playground Setup Script
 *
 * Installs required dependencies for the Playground feature.
 * Detects your package manager and framework, then only installs what's missing.
 *
 * Usage:  node src/app/playground/setup.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Colors (ANSI) ──────────────────────────────────────────────────────────
const bold  = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red   = (s) => `\x1b[31m${s}\x1b[0m`;
const dim   = (s) => `\x1b[2m${s}\x1b[0m`;
const cyan  = (s) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

// ── Find project root ──────────────────────────────────────────────────────
function findProjectRoot(startDir) {
  let dir = startDir;
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    dir = dirname(dir);
  }
  return null;
}

// ── Detect package manager ─────────────────────────────────────────────────
function detectPackageManager(root) {
  if (existsSync(join(root, 'bun.lockb')) || existsSync(join(root, 'bun.lock'))) return 'bun';
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

// ── Detect framework ──────────────────────────────────────────────────────
// Check meta-frameworks before plain vite since they all include vite as a dep
function detectFramework(allDeps) {
  if (allDeps['next']) return 'next';
  if (allDeps['@react-router/dev'] || allDeps['react-router']) return 'react-router';
  if (allDeps['@tanstack/react-router'] || allDeps['@tanstack/router-plugin']) return 'tanstack-router';
  if (allDeps['vike']) return 'vike';
  if (allDeps['@redwoodjs/sdk']) return 'redwoodjs';
  if (allDeps['astro']) return 'astro';
  if (allDeps['@remix-run/dev'] || allDeps['@remix-run/react']) return 'remix';
  if (allDeps['vite']) return 'vite';
  return 'unknown';
}

// Frameworks that use Vite under the hood and support the plugin API
const VITE_BASED_FRAMEWORKS = ['vite', 'react-router', 'tanstack-router', 'vike', 'redwoodjs', 'astro', 'remix'];

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
  console.log('');
  console.log(bold('  Playground Setup'));
  console.log(dim('  ─────────────────────────────────'));

  // 1. Load deps manifest
  const depsPath = join(__dirname, 'playground.deps.json');
  if (!existsSync(depsPath)) {
    console.log(red('  Error: playground.deps.json not found.'));
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(depsPath, 'utf-8'));
  const required = Object.keys(manifest.dependencies);
  const assumed  = manifest.requires || [];

  // 2. Find project root
  const root = findProjectRoot(__dirname);
  if (!root) {
    console.log(red('  Error: Could not find package.json in any parent directory.'));
    process.exit(1);
  }

  // 3. Read project's package.json
  const pkgPath = join(root, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  // 4. Detect framework
  const framework = detectFramework(allDeps);

  console.log('');
  console.log(bold('  Framework:'));
  const frameworkLabels = {
    'next': 'Next.js',
    'vite': 'Vite',
    'react-router': 'React Router v7',
    'tanstack-router': 'TanStack Router',
    'vike': 'Vike',
    'redwoodjs': 'RedwoodSDK',
    'astro': 'Astro',
    'remix': 'Remix',
    'unknown': 'Unknown',
  };
  console.log(`    ${green('+')} ${frameworkLabels[framework] || framework}`);

  // 5. Check assumed prerequisites
  console.log('');
  console.log(bold('  Prerequisites:'));
  let prerequisitesMet = true;
  for (const dep of assumed) {
    if (allDeps[dep]) {
      console.log(`    ${green('+')} ${dep}`);
    } else {
      console.log(`    ${red('x')} ${dep} ${red('(not found — please install it first)')}`);
      prerequisitesMet = false;
    }
  }

  if (!prerequisitesMet) {
    console.log('');
    console.log(red('  Some prerequisites are missing. Install them first, then re-run this script.'));
    process.exit(1);
  }

  // 5b. Check for Cursor CLI (optional — needed for "Run with Cursor" / variation generation)
  console.log('');
  console.log(bold('  Cursor CLI (optional):'));
  let cursorFound = false;
  try {
    execSync('cursor --version', { encoding: 'utf-8', timeout: 5000 });
    cursorFound = true;
  } catch {
    // not in PATH or not installed
  }
  if (cursorFound) {
    console.log(`    ${green('+')} cursor (found — "Run with Cursor" will work)`);
  } else {
    console.log(`    ${red('x')} cursor ${red('(not found)')}`);
    console.log('');
    console.log(dim('  Cursor is required for generating variations from the UI.'));
    console.log(dim('  Install the Cursor CLI: https://cursor.com/docs/cli/installation'));
    console.log('');
  }

  // 6. Find missing dependencies
  const missing = required.filter((dep) => !allDeps[dep]);

  if (missing.length === 0) {
    console.log('');
    console.log(bold('  Dependencies:'));
    console.log(`    ${green('+')} All ${required.length} packages already installed.`);
  } else {
    // 7. Detect package manager & install
    const pm = detectPackageManager(root);
    const installCmd = pm === 'yarn'
      ? `yarn add ${missing.join(' ')}`
      : `${pm} install ${missing.join(' ')}`;

    console.log('');
    console.log(bold('  Dependencies:'));
    for (const dep of required) {
      if (missing.includes(dep)) {
        console.log(`    ${cyan('~')} ${dep} ${dim('(installing)')}`);
      } else {
        console.log(`    ${green('+')} ${dep}`);
      }
    }

    console.log('');
    console.log(dim(`  Running: ${installCmd}`));
    console.log('');

    try {
      execSync(installCmd, { cwd: root, stdio: 'inherit' });
    } catch {
      console.log('');
      console.log(red('  Installation failed. Try running manually:'));
      console.log(`    ${installCmd}`);
      process.exit(1);
    }
  }

  // 8. Print framework-specific instructions
  console.log('');
  console.log(dim('  ─────────────────────────────────'));

  if (framework === 'next') {
    console.log(green('  Done! Start your dev server and visit /playground'));
  } else if (VITE_BASED_FRAMEWORKS.includes(framework)) {
    console.log(green('  Done! Next steps:'));
    console.log('');
    console.log(bold('  1. Add the Vite plugin to your vite.config.ts:'));
    console.log('');
    console.log(dim('     import playgroundPlugin from \'./src/app/playground/vite-plugin\';'));
    console.log('');
    console.log(dim('     export default defineConfig({'));
    console.log(dim('       plugins: [playgroundPlugin()],'));
    console.log(dim('     });'));
    console.log('');
    console.log(bold('  2. Create a route that renders the playground:'));
    console.log('');
    console.log(dim('     import PlaygroundClient from \'./src/app/playground/PlaygroundClient\';'));
    console.log(dim('     // Render <PlaygroundClient /> in your route'));
    console.log('');
  } else {
    console.log(green('  Done! Next steps:'));
    console.log('');
    console.log(bold('  Option A: Vite plugin (if using Vite)'));
    console.log(dim('     Add playgroundPlugin() to your vite.config.ts plugins array'));
    console.log('');
    console.log(bold('  Option B: Standalone server (any framework)'));
    console.log(dim('     npx tsx src/app/playground/server.ts'));
    console.log(dim('     Then set: window.__PLAYGROUND_API_BASE = \'http://localhost:4800\''));
    console.log('');
    console.log(bold('  Then render <PlaygroundClient /> in your app.'));
  }

  console.log('');
}

main();
