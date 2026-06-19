#!/usr/bin/env node

/**
 * Playground Setup Script
 *
 * Installs required dependencies for the Playground feature.
 * Detects your package manager and only installs what's missing.
 * Configures the host .gitignore so playground files stay out of git.
 *
 * Usage:
 *   node src/app/playground/setup.mjs
 *   node src/app/playground/setup.mjs --untrack   # stop tracking already-committed playground files
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import {
  ensureHostGitignore,
} from './lib/host-gitignore.mjs';

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

// ── Anonymous telemetry (content-free; see TELEMETRY.md) ───────────────────
// This standalone script can't import the TS module in lib/telemetry/, so the
// write-only key (PostHog EU project 199903) and gates are mirrored inline.
// Keep the key in sync with lib/telemetry/server.ts on rotation.
const POSTHOG_KEY = 'phc_zqGRtWzdvEqAf2UY2fyWJcogg5nM74V5BHtZhpxrKco8';
const POSTHOG_HOST = 'https://eu.i.posthog.com';

function telemetryConfigPath() {
  const base =
    process.platform === 'win32' && process.env.APPDATA
      ? process.env.APPDATA
      : process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'design-playground', 'telemetry.json');
}

function telemetryDisabled() {
  const truthy = (v) => v === '1' || v === 'true' || v === 'yes';
  if (truthy(process.env.DO_NOT_TRACK)) return true;
  if (truthy(process.env.PLAYGROUND_TELEMETRY_DISABLED)) return true;
  const ciVars = [
    'CI', 'CONTINUOUS_INTEGRATION', 'GITHUB_ACTIONS', 'GITLAB_CI', 'CIRCLECI',
    'TRAVIS', 'BUILDKITE', 'JENKINS_URL', 'TEAMCITY_VERSION', 'APPVEYOR',
    'CODEBUILD_BUILD_ID', 'VERCEL', 'NETLIFY',
  ];
  if (ciVars.some((n) => process.env[n] && process.env[n] !== 'false' && process.env[n] !== '0')) {
    return true;
  }
  if (!POSTHOG_KEY.startsWith('phc_') || POSTHOG_KEY.includes('PLACEHOLDER')) return true;
  return false;
}

function loadOrCreateAnonymousId() {
  const file = telemetryConfigPath();
  try {
    const config = JSON.parse(readFileSync(file, 'utf-8'));
    if (config.enabled === false) return null;
    if (typeof config.anonymousId === 'string' && config.anonymousId.length >= 8) {
      return config.anonymousId;
    }
  } catch { /* missing/corrupt — create below */ }
  try {
    const config = {
      anonymousId: randomUUID(),
      enabled: true,
      notifiedAt: null,
      schemaVersion: 1,
    };
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    return config.anonymousId;
  } catch {
    return null;
  }
}

function hasBinary(bin) {
  try {
    execSync(`${process.platform === 'win32' ? 'where' : 'which'} ${bin}`, {
      stdio: 'ignore',
      timeout: 1500,
    });
    return true;
  } catch {
    return false;
  }
}

/** One anonymous "installs" event (booleans + platform only) — never blocks setup. */
async function sendSetupTelemetry() {
  try {
    if (telemetryDisabled() || typeof fetch !== 'function') return;
    const anonymousId = loadOrCreateAnonymousId();
    if (!anonymousId) return;
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: 'setup_completed',
        distinct_id: anonymousId,
        properties: {
          $process_person_profile: false,
          $geoip_disable: true,
          $lib: 'design-playground',
          schema_version: 1,
          os: process.platform,
          node_major: parseInt(process.versions.node, 10) || 0,
          provider_cursor: hasBinary('cursor'),
          provider_claude_code: hasBinary('claude'),
          provider_codex: hasBinary('codex'),
        },
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch { /* telemetry must never break setup */ }
}

function printTelemetryNote() {
  console.log(dim('  Note: the playground collects anonymous usage telemetry in dev'));
  console.log(dim('  (counts and timings only — never prompts, code, or file names).'));
  console.log(dim('  Opt out: PLAYGROUND_TELEMETRY_DISABLED=1 · details in TELEMETRY.md'));
  console.log('');
}

function configureGitignore(root, allDeps) {
  const untrack = process.argv.includes('--untrack');
  const includePdfWorker = Boolean(allDeps['pdfjs-dist']);

  try {
    const result = ensureHostGitignore(root, { untrack, includePdfWorker });
    console.log('');
    console.log(bold('  Git:'));
    console.log(`    ${green('+')} Updated .gitignore (playground + artifacts)`);
    if (result.untracked) {
      console.log(`    ${green('+')} Removed previously tracked playground files from git index`);
    } else if (result.trackedWarning) {
      const relSetup = relative(root, join(__dirname, 'setup.mjs')).split('\\').join('/');
      console.log(`    ${dim('!')} Some playground files are still tracked by git.`);
      console.log(dim(`      Run: node ${relSetup} --untrack`));
    }
    console.log(dim('  Note: package.json dependency changes remain tracked (required to build).'));
  } catch (err) {
    console.log('');
    console.log(bold('  Git:'));
    console.log(`    ${red('x')} Could not update .gitignore: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function finishSetup(root, allDeps) {
  configureGitignore(root, allDeps);
  console.log('');
  console.log(green('  Done! Start your dev server and visit /playground'));
  console.log('');
  printTelemetryNote();
  await sendSetupTelemetry();
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
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

  // 4b. Check for agent CLI providers (at least one needed for generation)
  console.log('');
  console.log(bold('  Agent CLI Providers:'));

  const providers = [
    { name: 'Cursor', cmd: 'cursor --version', installHint: 'https://cursor.com/docs/cli/installation' },
    { name: 'Claude Code', cmd: 'claude --version', installHint: 'npm install -g @anthropic-ai/claude-code' },
    { name: 'Codex', cmd: 'codex --version', installHint: 'npm install -g @openai/codex — then run `codex login`' },
  ];

  let anyProviderFound = false;
  for (const p of providers) {
    let found = false;
    try {
      execSync(p.cmd, { encoding: 'utf-8', timeout: 5000 });
      found = true;
    } catch {
      // not in PATH or not installed
    }
    if (found) {
      console.log(`    ${green('+')} ${p.name} (found)`);
      anyProviderFound = true;
    } else {
      console.log(`    ${dim('-')} ${p.name} ${dim('(not found)')}`);
    }
  }

  if (!anyProviderFound) {
    console.log('');
    console.log(dim('  At least one agent CLI provider is required for generating variations.'));
    console.log(dim('  Install one of:'));
    for (const p of providers) {
      console.log(dim(`    - ${p.name}: ${p.installHint}`));
    }
    console.log('');
  }

  // 5. Find missing dependencies
  const missing = required.filter((dep) => !allDeps[dep]);

  if (missing.length === 0) {
    console.log('');
    console.log(bold('  Dependencies:'));
    console.log(`    ${green('+')} All ${required.length} packages already installed.`);
    await finishSetup(root, allDeps);
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

  await finishSetup(root, {
    ...allDeps,
    ...Object.fromEntries(missing.map((dep) => [dep, 'installed'])),
  });
}

main();
