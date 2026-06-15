// ============================================================================
// Telemetry Constants (isomorphic — safe to import from client and server)
//
// The playground collects anonymous, content-free usage telemetry in dev.
// Full schema + opt-out docs: ../../TELEMETRY.md
// ============================================================================

/**
 * Playground release version sent with every event. The submodule has no
 * package.json, so this is a manually-bumped constant — bump it in release
 * commits so dashboards can segment by version.
 */
export const PLAYGROUND_VERSION = '0.1.0';

/** Bump when the event schema changes shape (lets dashboards filter junk). */
export const TELEMETRY_SCHEMA_VERSION = 1;

/** Local route client events are forwarded through (never PostHog directly). */
export const TELEMETRY_ROUTE = '/playground/api/telemetry';

/** sessionStorage key deduping session_started per browser session. */
export const TELEMETRY_SESSION_SENT_KEY = 'playground-telemetry-session-sent';

/** sessionStorage key deduping the one-time dev telemetry notice toast. */
export const TELEMETRY_NOTICE_SHOWN_KEY = 'playground-telemetry-notice-shown';

/** Auto-dismiss duration for the telemetry notice toast (ms). */
export const TELEMETRY_NOTICE_TOAST_MS = 4_000;

/** Where the full telemetry documentation lives. */
export const TELEMETRY_DOCS_URL =
  'https://github.com/B1u3B01t/design-playground/blob/master/TELEMETRY.md';

/** Every event name the playground can emit. The schema in schema.ts is the
 * single source of truth for which properties each event may carry. */
export type TelemetryEventName =
  | 'setup_completed'
  | 'session_started'
  | 'time_summary'
  | 'discovery_run'
  | 'generation_started'
  | 'generation_completed'
  | 'generation_failed'
  | 'code_adopted'
  | 'feature_used'
  | 'error_occurred'
  | 'telemetry_opt_out';

/** How a generation was initiated (additive `source` field on /api/generate). */
export type GenerationSource =
  | 'dialog'
  | 'drag'
  | 'chat'
  | 'chat_edit'
  | 'chat_freeform'
  | 'new_page'
  | 'adopt'
  | 'unknown';
