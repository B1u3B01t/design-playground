import { NextResponse } from 'next/server';
import fs from 'fs';
import {
  designMdPath,
  designMdExists,
  STARTER_DESIGN_MD,
} from '../../../lib/design-md-helpers';

export const runtime = 'nodejs';

export async function GET() {
  if (!designMdExists()) {
    return NextResponse.json({ exists: false, content: '' });
  }
  try {
    const content = fs.readFileSync(designMdPath(), 'utf8');
    return NextResponse.json({ exists: true, content });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read DESIGN.md';
    return NextResponse.json({ exists: false, content: '', error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  let body: { content?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body?.content !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Missing `content` string in body.' },
      { status: 400 },
    );
  }
  try {
    fs.writeFileSync(designMdPath(), body.content, 'utf8');
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to write DESIGN.md';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST() {
  if (designMdExists()) {
    return NextResponse.json(
      { success: false, error: 'DESIGN.md already exists.' },
      { status: 409 },
    );
  }
  try {
    fs.writeFileSync(designMdPath(), STARTER_DESIGN_MD, 'utf8');
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to scaffold DESIGN.md';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
