// ============================================================================
// Local telemetry route — the ONLY thing browser code talks to (the browser
// never reaches PostHog). Validates every client event against the schema
// allowlist, enriches session_started server-side, and exposes the status /
// opt-out toggle for the settings UI.
//
// Dev-only: every handler 404s in production builds. Docs: ../../TELEMETRY.md
// ============================================================================

import {
  capture,
  getSessionEnrichment,
  getTelemetryStatus,
  isLocalRequest,
  setTelemetryEnabled,
} from '../../lib/telemetry/server';
import {
  CLIENT_ALLOWED_EVENTS,
  runSanitizerSelfTest,
  sanitizeEvent,
} from '../../lib/telemetry/schema';

export const dynamic = 'force-dynamic';

function notFound(): Response {
  return new Response(null, { status: 404 });
}

function isDev(): boolean {
  return process.env.NODE_ENV === 'development';
}

export async function POST(request: Request): Promise<Response> {
  if (!isDev()) return notFound();
  // Always 204 regardless of drop reason — no oracle for probing the gates.
  const accepted = new Response(null, { status: 204 });
  try {
    if (!isLocalRequest(request)) return accepted;

    const body = (await request.json()) as { event?: unknown; props?: unknown };
    if (typeof body.event !== 'string') return accepted;

    // Browser code may only emit the client subset — generation/discovery
    // stats are server-originated, so page scripts can't forge them.
    if (!(CLIENT_ALLOWED_EVENTS as readonly string[]).includes(body.event)) {
      return accepted;
    }

    const sanitized = sanitizeEvent(body.event, body.props);
    if (!sanitized) return accepted;

    // Route errors are server-originated; browsers may only report renderer
    // crashes — page scripts can't fabricate backend failure stats.
    if (sanitized.name === 'error_occurred' && sanitized.props.area !== 'component_render') {
      return accepted;
    }

    if (sanitized.name === 'session_started') {
      // Server-side enrichment: provider availability, multiplayer config,
      // salted project hash. Client-supplied values for these are ignored.
      const enrichment = await getSessionEnrichment();
      capture('session_started', { ...sanitized.props, ...enrichment });
    } else {
      capture(sanitized.name, sanitized.props);
    }
  } catch {
    // Malformed body / aborted request — drop silently.
  }
  return accepted;
}

export async function GET(request: Request): Promise<Response> {
  if (!isDev()) return notFound();
  const url = new URL(request.url);

  if (url.searchParams.get('action') === 'selftest') {
    // Zero-dependency test runner for the sanitizer (host has no test tooling).
    const failures = runSanitizerSelfTest();
    return Response.json(
      { pass: failures.length === 0, failures },
      { status: failures.length === 0 ? 200 : 500 },
    );
  }

  return Response.json(getTelemetryStatus());
}

export async function PATCH(request: Request): Promise<Response> {
  if (!isDev()) return notFound();
  if (!isLocalRequest(request)) return notFound();
  try {
    const body = (await request.json()) as { enabled?: unknown };
    if (typeof body.enabled !== 'boolean') {
      return Response.json({ error: 'enabled must be boolean' }, { status: 400 });
    }
    await setTelemetryEnabled(body.enabled);
    return Response.json(getTelemetryStatus());
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
}
