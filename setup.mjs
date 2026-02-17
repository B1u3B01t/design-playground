#!/usr/bin/env node

/**
 * Playground Setup Script
 *
 * Installs required dependencies for the Playground feature.
 * Detects your package manager and only installs what's missing.
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

  // 4. Check assumed prerequisites
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

  // 4b. Check for Cursor CLI (optional — needed for "Run with Cursor" / variation generation)
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

  // 5. Find missing dependencies
  const missing = required.filter((dep) => !allDeps[dep]);

  if (missing.length === 0) {
    console.log('');
    console.log(bold('  Dependencies:'));
    console.log(`    ${green('+')} All ${required.length} packages already installed.`);
    console.log('');
    console.log(green('  Done! Start your dev server and visit /playground'));
    console.log('');
    process.exit(0);
  }

  // 6. Detect package manager & install
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

  console.log('');
  console.log(green('  Done! Start your dev server and visit /playground'));
  console.log('');
}

main();
