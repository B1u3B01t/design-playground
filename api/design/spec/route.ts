import { NextResponse } from 'next/server';
import { runDesignMdCli } from '../../../lib/run-design-md-cli';

export const runtime = 'nodejs';

export async function GET() {
  const result = await runDesignMdCli(['spec']);
  return NextResponse.json(result);
}
