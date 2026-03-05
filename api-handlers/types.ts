/**
 * Framework-agnostic request/response types for playground API handlers.
 *
 * These abstractions allow the same handler logic to work with
 * Next.js route handlers, Vite dev server middleware, and
 * standalone Node.js HTTP servers.
 */

export interface ApiRequest {
  method: string;
  url: string;
  json(): Promise<any>;
  searchParams: URLSearchParams;
}

export interface ApiResponse {
  json(data: any, status?: number): void;
  text(body: string, headers?: Record<string, string>, status?: number): void;
}
