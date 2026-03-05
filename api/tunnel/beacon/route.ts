import { NextResponse } from 'next/server';
import { handleTunnelDelete } from '../../../api-handlers/tunnel';
import type { ApiRequest, ApiResponse } from '../../../api-handlers/types';

/**
 * Beacon endpoint — called by sendBeacon() on tab close.
 * sendBeacon only supports POST, so this proxies to the DELETE logic.
 */
export async function POST() {
  return new Promise<NextResponse>((resolve) => {
    const req: ApiRequest = {
      method: 'DELETE',
      url: '',
      json: async () => null,
      searchParams: new URLSearchParams(),
    };
    const res: ApiResponse = {
      json: (data, status = 200) => resolve(NextResponse.json(data, { status })),
      text: (body, headers = {}, status = 200) => resolve(new NextResponse(body, { status, headers })),
    };
    handleTunnelDelete(req, res);
  });
}
