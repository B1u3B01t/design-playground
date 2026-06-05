import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import PlaygroundClient from './PlaygroundClient';

// Read from the filesystem (process.cwd) per request so the project id is always
// derived from the actual project this server is running in.
export const dynamic = 'force-dynamic';

export default function PlaygroundPage() {
  // Stable id for the project this dev server runs in. localStorage is scoped by
  // origin (http://localhost:<port>), so two projects that reuse a port would
  // otherwise share canvas state; this id keeps each project's canvas separate.
  const cwd = process.cwd();
  const projectId = `${basename(cwd)}-${createHash('sha1').update(cwd).digest('hex').slice(0, 8)}`;
  return <PlaygroundClient projectId={projectId} />;
}
