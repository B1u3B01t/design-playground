import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const IMAGES_DIR = path.join(
  process.cwd(),
  'src/app/playground/iterations/iterations-images',
);

function ensureImagesDir() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
}

const SAFE_FILENAME_RE = /^[A-Za-z0-9._-]+\.png$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const filename = url.searchParams.get('filename');

  if (!filename || !SAFE_FILENAME_RE.test(filename)) {
    return NextResponse.json(
      { exists: false, error: 'Invalid or missing filename' },
      { status: 400 },
    );
  }

  const filePath = path.join(IMAGES_DIR, filename);
  const relativePath = path.relative(process.cwd(), filePath);

  if (fs.existsSync(filePath)) {
    return NextResponse.json({ exists: true, path: relativePath });
  }

  return NextResponse.json({ exists: false });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      imageBase64?: string;
      filename?: string;
    } | null;

    if (!body?.imageBase64 || !body?.filename) {
      return NextResponse.json(
        { success: false, error: 'Missing imageBase64 or filename' },
        { status: 400 },
      );
    }

    const { imageBase64, filename } = body;

    if (!SAFE_FILENAME_RE.test(filename)) {
      return NextResponse.json(
        { success: false, error: 'Invalid filename. Use alphanumeric, dashes, dots, ending in .png' },
        { status: 400 },
      );
    }

    // Strip data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    ensureImagesDir();
    const filePath = path.join(IMAGES_DIR, filename);
    fs.writeFileSync(filePath, buffer);

    const relativePath = path.relative(process.cwd(), filePath);

    return NextResponse.json({ success: true, path: relativePath });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Playground][screenshot] POST error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
