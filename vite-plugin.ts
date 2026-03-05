/**
 * Vite plugin for the Playground API.
 *
 * Adds API route middleware to the Vite dev server so the playground
 * works without Next.js. Same-origin, no CORS needed.
 *
 * Usage in vite.config.ts:
 *   import playgroundPlugin from './src/app/playground/vite-plugin';
 *   export default defineConfig({ plugins: [playgroundPlugin()] });
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

// Vite types are defined inline to avoid requiring `vite` as a dependency.
// These match the subset of Vite's Plugin and Connect types used here.
interface ViteDevServer {
  middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void };
}
interface VitePlugin {
  name: string;
  configureServer?: (server: ViteDevServer) => void;
}
import { handleConfigGet } from './api-handlers/config';
import { handleGeneratePost, handleGenerateDelete, handleGenerateGet } from './api-handlers/generate';
import { handleIterationsGet, handleIterationsPost, handleIterationsDelete } from './api-handlers/iterations';
import { handleModelsGet } from './api-handlers/models';
import { handleSkillsGet } from './api-handlers/skills';
import { handleTunnelGet, handleTunnelPost, handleTunnelDelete } from './api-handlers/tunnel';
import type { ApiRequest, ApiResponse } from './api-handlers/types';

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
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
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
// Route handler mapping
// ---------------------------------------------------------------------------

type Handler = (req: ApiRequest, res: ApiResponse) => Promise<void>;

interface Route {
  method: string;
  handler: Handler;
}

const routeMap: Record<string, Route[]> = {
  '/playground/api/config': [
    { method: 'GET', handler: handleConfigGet },
  ],
  '/playground/api/generate': [
    { method: 'POST', handler: handleGeneratePost },
    { method: 'DELETE', handler: handleGenerateDelete },
    { method: 'GET', handler: handleGenerateGet },
  ],
  '/playground/api/iterations': [
    { method: 'GET', handler: handleIterationsGet },
    { method: 'POST', handler: handleIterationsPost },
    { method: 'DELETE', handler: handleIterationsDelete },
  ],
  '/playground/api/models': [
    { method: 'GET', handler: handleModelsGet },
  ],
  '/playground/api/skills': [
    { method: 'GET', handler: handleSkillsGet },
  ],
  '/playground/api/tunnel': [
    { method: 'GET', handler: handleTunnelGet },
    { method: 'POST', handler: handleTunnelPost },
    { method: 'DELETE', handler: handleTunnelDelete },
  ],
  '/playground/api/tunnel/beacon': [
    { method: 'POST', handler: handleTunnelDelete },
  ],
};

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default function playgroundPlugin(): VitePlugin {
  return {
    name: 'playground-api',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;
        const method = req.method || 'GET';

        const routes = routeMap[pathname];
        if (!routes) return next();

        const route = routes.find((r) => r.method === method);
        if (!route) {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        route.handler(adaptRequest(req), adaptResponse(res)).catch((err) => {
          console.error(`[playground-api] Error in ${method} ${pathname}:`, err);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        });
      });
    },
  };
}
