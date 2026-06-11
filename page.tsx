import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import PlaygroundClient from './PlaygroundClient';
import { initTelemetryNotice } from './lib/telemetry/server';

// Read from the filesystem (process.cwd) per request so the project id is always
// derived from the actual project this server is running in.
export const dynamic = 'force-dynamic';

export default async function PlaygroundPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; host?: string }>;
}) {
  const { room, host } = await searchParams;
  // One-time terminal notice about anonymous dev telemetry (no-op after the
  // first run, and entirely inert outside `next dev`). See TELEMETRY.md.
  initTelemetryNotice();
  // Stable id for the project this dev server runs in. localStorage is scoped by
  // origin (http://localhost:<port>), so two projects that reuse a port would
  // otherwise share canvas state; this id keeps each project's canvas separate.
  const cwd = process.cwd();
  const projectId = `${basename(cwd)}-${createHash('sha1').update(cwd).digest('hex').slice(0, 8)}`;
  return <PlaygroundClient projectId={projectId} roomId={room} isHost={host === '1'} />;
}
