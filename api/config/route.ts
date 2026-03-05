import { NextResponse } from 'next/server';
import { handleConfigGet } from '../../api-handlers/config';
import type { ApiRequest, ApiResponse } from '../../api-handlers/types';

function adaptRequest(req: Request): ApiRequest {
  const url = new URL(req.url);
  return {
    method: req.method,
    url: req.url,
    json: () => req.json(),
    searchParams: url.searchParams,
  };
}

function createResponseAdapter(resolve: (res: NextResponse) => void): ApiResponse {
  return {
    json: (data, status = 200) => resolve(NextResponse.json(data, { status })),
    text: (body, headers = {}, status = 200) => resolve(new NextResponse(body, { status, headers })),
  };
}

export async function GET(req: Request) {
  return new Promise<NextResponse>((resolve) => {
    handleConfigGet(adaptRequest(req), createResponseAdapter(resolve));
  });
}
