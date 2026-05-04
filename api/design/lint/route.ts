import { NextResponse } from 'next/server';
import { designMdExists, DESIGN_MD_FILENAME } from '../../../lib/design-md-helpers';
import { runDesignMdCli } from '../../../lib/run-design-md-cli';

export const runtime = 'nodejs';

export async function POST() {
  if (!designMdExists()) {
    return NextResponse.json(
      { ok: false, error: 'DESIGN.md not found at project root.' },
      { status: 404 },
    );
  }
  const result = await runDesignMdCli(['lint', DESIGN_MD_FILENAME]);
  return NextResponse.json(result, { status: result.ok ? 200 : 200 });
}
