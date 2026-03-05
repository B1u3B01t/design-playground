/**
 * Standalone Playground API Server
 *
 * A zero-dependency Node.js HTTP server that serves the playground API.
 * Use this when not running Next.js or Vite.
 *
 * Usage:
 *   npx tsx src/app/playground/server.ts
 *
 * Environment:
 *   PLAYGROUND_API_PORT  - Port to listen on (default: 4800)
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { handleGeneratePost, handleGenerateDelete, handleGenerateGet } from './api-handlers/generate';
import { handleIterationsGet, handleIterationsPost, handleIterationsDelete } from './api-handlers/iterations';
import { handleModelsGet } from './api-handlers/models';
import { handleSkillsGet } from './api-handlers/skills';
import { handleTunnelGet, handleTunnelPost, handleTunnelDelete } from './api-handlers/tunnel';
import type { ApiRequest, ApiResponse } from './api-handlers/types';

const PORT = parseInt(process.env.PLAYGROUND_API_PORT || '4800', 10);

// ---------------------------------------------------------------------------
// Adapt Node.js IncomingMessage/ServerResponse to ApiRequest/ApiResponse
// ---------------------------------------------------------------------------

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
    req.on('error', reject);
  });
}

function adaptRequest(req: IncomingMessage): ApiRequest {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  let parsedBody: any = undefined;

  return {
    method: req.method || 'GET',
    url: req.url || '/',
    json: async () => {
      if (parsedBody === undefined) {
        parsedBody = await parseBody(req);
      }
      return parsedBody;
    },
    searchParams: url.searchParams,
  };
}

function adaptResponse(res: ServerResponse): ApiResponse {
  return {
    json: (data: any, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    },
    text: (body: string, headers: Record<string, string> = {}, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'text/plain', ...headers });
      res.end(body);
    },
  };
}

// ---------------------------------------------------------------------------
// Route table
// ---------------------------------------------------------------------------

type Handler = (req: ApiRequest, res: ApiResponse) => Promise<void>;

const routes: Record<string, Record<string, Handler>> = {
  '/playground/api/generate': {
    POST: handleGeneratePost,
    DELETE: handleGenerateDelete,
    GET: handleGenerateGet,
  },
  '/playground/api/iterations': {
    GET: handleIterationsGet,
    POST: handleIterationsPost,
    DELETE: handleIterationsDelete,
  },
  '/playground/api/models': {
    GET: handleModelsGet,
  },
  '/playground/api/skills': {
    GET: handleSkillsGet,
  },
  '/playground/api/tunnel': {
    GET: handleTunnelGet,
    POST: handleTunnelPost,
    DELETE: handleTunnelDelete,
  },
  '/playground/api/tunnel/beacon': {
    POST: handleTunnelDelete,
  },
};

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method || 'GET';

  const routeHandlers = routes[pathname];
  if (!routeHandlers) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  const handler = routeHandlers[method];
  if (!handler) {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    await handler(adaptRequest(req), adaptResponse(res));
  } catch (err) {
    console.error(`[playground-server] Error in ${method} ${pathname}:`, err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n  Playground API server running at http://localhost:${PORT}\n`);
  console.log(`  Routes:`);
  for (const [path, methods] of Object.entries(routes)) {
    console.log(`    ${Object.keys(methods).join(', ').padEnd(20)} ${path}`);
  }
  console.log('');
});
