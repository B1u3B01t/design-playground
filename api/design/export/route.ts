import { NextResponse } from 'next/server';
import { designMdExists, DESIGN_MD_FILENAME } from '../../../lib/design-md-helpers';
import { runDesignMdCli } from '../../../lib/run-design-md-cli';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!designMdExists()) {
    return NextResponse.json({ ok: false, error: 'DESIGN.md not found.' }, { status: 404 });
  }
  let body: { format?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    /* allow empty body — default format */
  }
  const format = body?.format === 'dtcg' ? 'dtcg' : 'tailwind';
  const result = await runDesignMdCli(['export', '--format', format, DESIGN_MD_FILENAME]);
  return NextResponse.json({ ...result, format });
}
