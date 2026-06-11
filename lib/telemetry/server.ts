// ============================================================================
// Telemetry server core (server-only — imports node:fs/node:os so an
// accidental client import fails the build; the PostHog key never reaches
// a client bundle).
//
// Single chokepoint for all outbound telemetry:
//   gates → sanitize (schema allowlist) → rate limit → queue → batch → fetch
//
// Telemetry is dev-only, anonymous, and content-free. Docs: ../../TELEMETRY.md
// ============================================================================

import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

import {
  PLAYGROUND_VERSION,
  TELEMETRY_SCHEMA_VERSION,
  TELEMETRY_DOCS_URL,
  type TelemetryEventName,
} from './constants';
import { sanitizeEvent } from './schema';
import { getAllProviders } from '../providers/registry';

// Public write-only ingestion key for PostHog EU project 199903 (this is not
// a secret in the credential sense — see TELEMETRY.md for the abuse posture).
// On rotation, also update the mirrored key in setup.mjs.
const POSTHOG_KEY = 'phc_zqGRtWzdvEqAf2UY2fyWJcogg5nM74V5BHtZhpxrKco8';
const POSTHOG_HOST = 'https://eu.i.posthog.com';

const FLUSH_INTERVAL_MS = 30_000;
const FLUSH_AT_QUEUE_SIZE = 25;
const QUEUE_CAP = 100;
const SEND_TIMEOUT_MS = 3_000;
// Rate caps: runaway-bug protection + abuse blast-radius limit.
const MAX_PER_10S = 20;
const MAX_PER_MINUTE = 120;
const MAX_PER_PROCESS = 2_000;

interface TelemetryConfig {
  anonymousId: string;
  enabled: boolean;
  notifiedAt: string | null;
  schemaVersion: number;
}

interface QueueItem {
  event: TelemetryEventName;
  distinct_id: string;
  properties: Record<string, unknown>;
  timestamp: string;
  retried?: boolean;
}

interface TelemetryState {
  sessionId: string;
  config: TelemetryConfig | null;
  configBroken: boolean;
  configLoadedAt: number;
  noticePrinted: boolean;
  queue: QueueItem[];
  flushTimer: ReturnType<typeof setInterval> | null;
  exitHookInstalled: boolean;
  sentThisProcess: number;
  window10s: { start: number; count: number };
  window60s: { start: number; count: number };
  providersPromise: Promise<Record<string, boolean>> | null;
  flushing: Promise<void> | null;
}

// HMR-safe singleton: `next dev` re-evaluates modules on edit, but
// globalThis survives — same pattern as the generate-route lockfiles.
const globalState = globalThis as typeof globalThis & {
  __playgroundTelemetry?: TelemetryState;
};

function state(): TelemetryState {
  if (!globalState.__playgroundTelemetry) {
    globalState.__playgroundTelemetry = {
      sessionId: randomUUID(),
      config: null,
      configBroken: false,
      configLoadedAt: 0,
      noticePrinted: false,
      queue: [],
      flushTimer: null,
      exitHookInstalled: false,
      sentThisProcess: 0,
      window10s: { start: 0, count: 0 },
      window60s: { start: 0, count: 0 },
      providersPromise: null,
      flushing: null,
    };
  }
  return globalState.__playgroundTelemetry;
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

const CI_ENV_VARS = [
  'CI',
  'CONTINUOUS_INTEGRATION',
  'GITHUB_ACTIONS',
  'GITLAB_CI',
  'CIRCLECI',
  'TRAVIS',
  'BUILDKITE',
  'JENKINS_URL',
  'TEAMCITY_VERSION',
  'APPVEYOR',
  'CODEBUILD_BUILD_ID',
  'VERCEL',
  'NETLIFY',
];

function envTruthy(value: string | undefined): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

function isCi(): boolean {
  return CI_ENV_VARS.some((name) => {
    const value = process.env[name];
    return value !== undefined && value !== '' && value !== 'false' && value !== '0';
  });
}

export function isDebugMode(): boolean {
  return envTruthy(process.env.PLAYGROUND_TELEMETRY_DEBUG);
}

function hasRealKey(): boolean {
  return POSTHOG_KEY.startsWith('phc_') && !POSTHOG_KEY.includes('PLACEHOLDER');
}

/** Full gate chain. Telemetry is impossible outside `next dev`. */
export function isTelemetryEnabled(): boolean {
  if (process.env.NODE_ENV !== 'development') return false;
  if (isCi()) return false;
  if (envTruthy(process.env.DO_NOT_TRACK)) return false;
  if (envTruthy(process.env.PLAYGROUND_TELEMETRY_DISABLED)) return false;
  const config = loadConfig();
  if (!config) return false;
  return config.enabled !== false;
}

// ---------------------------------------------------------------------------
// Machine config (~/.config/design-playground/telemetry.json)
// ---------------------------------------------------------------------------

function configDir(): string {
  if (process.platform === 'win32' && process.env.APPDATA) {
    return join(process.env.APPDATA, 'design-playground');
  }
  const base = process.env.XDG_CONFIG_HOME || join(os.homedir(), '.config');
  return join(base, 'design-playground');
}

function configPath(): string {
  return join(configDir(), 'telemetry.json');
}

function loadConfig(): TelemetryConfig | null {
  const s = state();
  if (s.configBroken) return null;
  // Re-read every 5s so a PATCH from another dev-server process is honored.
  if (s.config && Date.now() - s.configLoadedAt < 5_000) return s.config;
  try {
    const raw = readFileSync(configPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<TelemetryConfig>;
    if (typeof parsed.anonymousId === 'string' && parsed.anonymousId.length >= 8) {
      s.config = {
        anonymousId: parsed.anonymousId,
        enabled: parsed.enabled !== false,
        notifiedAt: typeof parsed.notifiedAt === 'string' ? parsed.notifiedAt : null,
        schemaVersion: TELEMETRY_SCHEMA_VERSION,
      };
      s.configLoadedAt = Date.now();
      return s.config;
    }
  } catch {
    // Missing or corrupt — fall through and (re)create.
  }
  try {
    const fresh: TelemetryConfig = {
      anonymousId: randomUUID(),
      enabled: true,
      notifiedAt: null,
      schemaVersion: TELEMETRY_SCHEMA_VERSION,
    };
    writeConfig(fresh);
    s.config = fresh;
    s.configLoadedAt = Date.now();
    return fresh;
  } catch {
    // Unwritable filesystem → telemetry silently off for this process.
    s.configBroken = true;
    return null;
  }
}

function writeConfig(config: TelemetryConfig): void {
  mkdirSync(configDir(), { recursive: true });
  // Atomic-ish write: concurrent dev servers can't interleave partial JSON.
  const tmp = configPath() + `.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n', 'utf8');
  renameSync(tmp, configPath());
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

function underRateLimit(): boolean {
  const s = state();
  if (s.sentThisProcess >= MAX_PER_PROCESS) return false;
  const now = Date.now();
  if (now - s.window10s.start > 10_000) s.window10s = { start: now, count: 0 };
  if (now - s.window60s.start > 60_000) s.window60s = { start: now, count: 0 };
  if (s.window10s.count >= MAX_PER_10S) return false;
  if (s.window60s.count >= MAX_PER_MINUTE) return false;
  s.window10s.count += 1;
  s.window60s.count += 1;
  s.sentThisProcess += 1;
  return true;
}

// ---------------------------------------------------------------------------
// Capture / queue / flush
// ---------------------------------------------------------------------------

function commonProps(): Record<string, unknown> {
  return {
    // Anonymous events: no person profiles are created or updated at PostHog.
    $process_person_profile: false,
    // Skip PostHog's GeoIP ingestion transformation — no location data is
    // ever derived, independent of project-side configuration.
    $geoip_disable: true,
    $lib: 'design-playground',
    session_id: state().sessionId,
    playground_version: PLAYGROUND_VERSION,
    schema_version: TELEMETRY_SCHEMA_VERSION,
    os: process.platform,
    node_major: Number.parseInt(process.versions.node, 10) || 0,
  };
}

/**
 * Record an event (fire-and-forget — never throws, never blocks the caller).
 * Props are validated against the schema allowlist; unknown events/props are
 * silently dropped.
 */
export function capture(name: TelemetryEventName, props?: Record<string, unknown>): void {
  try {
    if (!isTelemetryEnabled()) return;
    const sanitized = sanitizeEvent(name, props ?? {});
    if (!sanitized) return;

    if (isDebugMode()) {
      console.log(
        `[playground telemetry] ${sanitized.name} ${JSON.stringify(sanitized.props)}`,
      );
      return;
    }
    if (!hasRealKey()) return;
    if (!underRateLimit()) return;

    const config = loadConfig();
    if (!config) return;

    const s = state();
    if (s.queue.length >= QUEUE_CAP) return; // drop newest beyond cap
    s.queue.push({
      event: sanitized.name,
      distinct_id: config.anonymousId,
      properties: { ...commonProps(), ...sanitized.props },
      timestamp: new Date().toISOString(),
    });
    ensureFlushLoop();
    if (s.queue.length >= FLUSH_AT_QUEUE_SIZE) void flushTelemetry();
  } catch {
    // Telemetry must never break the product.
  }
}

/** True when the request reached us from this machine (not a tunnel/LAN guest). */
export function isLocalRequest(req: Request): boolean {
  try {
    const host = req.headers.get('host') ?? '';
    const hostname = host.startsWith('[')
      ? host.slice(1, host.indexOf(']'))
      : host.split(':')[0];
    return (
      hostname === 'localhost' ||
      hostname === '::1' ||
      hostname.startsWith('127.')
    );
  } catch {
    return false;
  }
}

/**
 * capture() gated on local origin — use in API routes so guest-triggered
 * work (via tunnel/room URLs) is never recorded; guests never saw a notice.
 */
export function captureFromRequest(
  req: Request,
  name: TelemetryEventName,
  props?: Record<string, unknown>,
): void {
  if (!isLocalRequest(req)) return;
  capture(name, props);
}

function ensureFlushLoop(): void {
  const s = state();
  if (s.flushTimer) return;
  s.flushTimer = setInterval(() => void flushTelemetry(), FLUSH_INTERVAL_MS);
  // Never keep the dev server alive just for telemetry (no-op in non-Node timers).
  (s.flushTimer as unknown as { unref?: () => void }).unref?.();
  if (!s.exitHookInstalled) {
    s.exitHookInstalled = true;
    // 'beforeExit' only: registering SIGINT/SIGTERM handlers changes process
    // semantics (Node skips default termination once any handler exists) and
    // races the tunnel route's exit handler. Tail-batch loss is accepted.
    process.once('beforeExit', () => void flushTelemetry(800));
  }
}

/** Flush the queue to PostHog (best-effort, bounded, errors swallowed). */
export async function flushTelemetry(timeoutMs: number = SEND_TIMEOUT_MS): Promise<void> {
  const s = state();
  if (s.flushing) return s.flushing;
  if (s.queue.length === 0) return;
  const batch = s.queue.splice(0, s.queue.length);
  const run = (async () => {
    try {
      const res = await fetch(`${POSTHOG_HOST}/batch/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: POSTHOG_KEY, batch }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      // Re-queue once, then drop — no infinite retry against a dead network.
      const retryable = batch.filter((item) => !item.retried);
      for (const item of retryable) item.retried = true;
      s.queue.unshift(...retryable.slice(0, Math.max(0, QUEUE_CAP - s.queue.length)));
    } finally {
      s.flushing = null;
    }
  })();
  s.flushing = run;
  return run;
}

// ---------------------------------------------------------------------------
// Session enrichment (provider availability, project hash)
// ---------------------------------------------------------------------------

function detectProviders(): Promise<Record<string, boolean>> {
  const s = state();
  if (s.providersPromise) return s.providersPromise;
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  s.providersPromise = Promise.all(
    getAllProviders().map(
      (provider) =>
        new Promise<[string, boolean]>((resolve) => {
          try {
            execFile(lookup, [provider.binary], { timeout: 1_500 }, (error) => {
              resolve([provider.id, !error]);
            });
          } catch {
            resolve([provider.id, false]);
          }
        }),
    ),
  ).then((entries) => Object.fromEntries(entries));
  return s.providersPromise;
}

/**
 * Server-side enrichment for session_started: which agent CLIs exist on PATH,
 * whether multiplayer is configured, and the salted project hash. The hash is
 * sha256(anonymousId + cwd) — counts distinct projects without ever revealing
 * a project name, and can't be joined across machines.
 */
export async function getSessionEnrichment(): Promise<Record<string, unknown>> {
  try {
    const config = loadConfig();
    if (!config) return {};
    const providers = await detectProviders();
    return {
      provider_cursor: providers['cursor'] ?? false,
      provider_claude_code: providers['claude-code'] ?? false,
      provider_codex: providers['codex'] ?? false,
      multiplayer_configured: Boolean(process.env.LIVEBLOCKS_SECRET_KEY),
      project_hash: createHash('sha256')
        .update(`${config.anonymousId}:${process.cwd()}`)
        .digest('hex')
        .slice(0, 16),
    };
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// First-run notice + status + opt-out
// ---------------------------------------------------------------------------

/**
 * Print the one-time terminal notice (called from page.tsx on each dev
 * request; gated by config.notifiedAt so it prints once per machine, ever).
 */
export function initTelemetryNotice(): void {
  try {
    if (process.env.NODE_ENV !== 'development') return;
    const s = state();
    if (s.noticePrinted) return;
    s.noticePrinted = true;
    if (!isTelemetryEnabled()) return;
    const config = loadConfig();
    if (!config || config.notifiedAt) return;
    writeConfig({ ...config, notifiedAt: new Date().toISOString() });
    s.config = { ...config, notifiedAt: new Date().toISOString() };
    console.log(
      [
        '',
        '┌─────────────────────────────────────────────────────────────────────┐',
        '│  Attention: Design Playground collects completely anonymous usage   │',
        '│  telemetry in dev (events like "generation completed" — never       │',
        '│  prompts, code, file paths, or names). This helps prioritize        │',
        '│  features and fixes.                                                │',
        '│                                                                     │',
        '│  Opt out anytime: PLAYGROUND_TELEMETRY_DISABLED=1, DO_NOT_TRACK=1,  │',
        '│  or the toggle in Model Settings.                                   │',
        `│  Details: TELEMETRY.md                                              │`,
        '└─────────────────────────────────────────────────────────────────────┘',
        `  ${TELEMETRY_DOCS_URL}`,
        '',
      ].join('\n'),
    );
  } catch {
    // Never break page rendering over a notice.
  }
}

export function getTelemetryStatus(): { enabled: boolean; debug: boolean } {
  return { enabled: isTelemetryEnabled(), debug: isDebugMode() };
}

/**
 * Persist the UI toggle. Disabling emits one final telemetry_opt_out event
 * and flushes before the switch lands (Next.js precedent) — so opt-out rates
 * are observable.
 */
export async function setTelemetryEnabled(enabled: boolean): Promise<void> {
  try {
    if (!enabled && isTelemetryEnabled()) {
      capture('telemetry_opt_out', { method: 'ui' });
      await flushTelemetry();
    }
    const config = loadConfig();
    if (!config) return;
    const next = { ...config, enabled };
    writeConfig(next);
    const s = state();
    s.config = next;
    s.configLoadedAt = Date.now();
  } catch {
    // Swallow — the GET status endpoint will reflect reality either way.
  }
}

// ---------------------------------------------------------------------------
// Git diff stats (playground-output measurement only)
// ---------------------------------------------------------------------------

export interface DiffTotals {
  lines_added: number;
  lines_removed: number;
  files_changed: number;
}

/**
 * Working-tree diff totals via `git diff --numstat` (numbers only — file
 * names from the output are summed and discarded). Snapshotted before/after
 * the playground's own write operations to attribute their churn; this is
 * the ONLY git read telemetry performs (never log/branch/remote inspection).
 * Returns null outside a git repo or on any error.
 */
export function getGitDiffTotals(): Promise<DiffTotals | null> {
  return new Promise((resolve) => {
    try {
      execFile(
        'git',
        ['diff', '--numstat'],
        { timeout: 2_000, cwd: process.cwd(), maxBuffer: 4 * 1024 * 1024 },
        (error, stdout) => {
          if (error) return resolve(null);
          let added = 0;
          let removed = 0;
          let files = 0;
          for (const line of stdout.split('\n')) {
            if (!line.trim()) continue;
            const [a, r] = line.split('\t');
            // Binary files show "-" — count the file, skip the lines.
            const addedNum = Number.parseInt(a, 10);
            const removedNum = Number.parseInt(r, 10);
            files += 1;
            if (Number.isFinite(addedNum)) added += addedNum;
            if (Number.isFinite(removedNum)) removed += removedNum;
          }
          resolve({ lines_added: added, lines_removed: removed, files_changed: files });
        },
      );
    } catch {
      resolve(null);
    }
  });
}

/** Delta between two snapshots (clamped ≥0; nulls if either side is missing). */
export function diffTotalsDelta(
  before: DiffTotals | null,
  after: DiffTotals | null,
): Record<keyof DiffTotals, number | null> {
  if (!before || !after) {
    return { lines_added: null, lines_removed: null, files_changed: null };
  }
  return {
    lines_added: Math.max(0, after.lines_added - before.lines_added),
    lines_removed: Math.max(0, after.lines_removed - before.lines_removed),
    files_changed: Math.max(0, after.files_changed - before.files_changed),
  };
}
