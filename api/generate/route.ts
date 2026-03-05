import { NextResponse } from 'next/server';
import { handleGeneratePost, handleGenerateDelete, handleGenerateGet } from '../../api-handlers/generate';
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

export async function POST(req: Request) {
  return new Promise<NextResponse>((resolve) => {
    handleGeneratePost(adaptRequest(req), createResponseAdapter(resolve));
  });
}

export async function DELETE(req: Request) {
  return new Promise<NextResponse>((resolve) => {
    handleGenerateDelete(adaptRequest(req), createResponseAdapter(resolve));
  });
}

export async function GET(req: Request) {
  return new Promise<NextResponse>((resolve) => {
    handleGenerateGet(adaptRequest(req), createResponseAdapter(resolve));
  });
}
