import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const IMAGES_DIR = path.join(process.cwd(), 'public/.playground/images');

async function ensureImagesDir() {
  if (!fsSync.existsSync(IMAGES_DIR)) {
    await fs.mkdir(IMAGES_DIR, { recursive: true });
  }
}

const SAFE_FILENAME_RE = /^[A-Za-z0-9._-]+\.(png|jpg|jpeg|gif|webp|svg)$/i;

function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '-').replace(/-+/g, '-');
}

export async function GET() {
  try {
    await ensureImagesDir();
    const files = await fs.readdir(IMAGES_DIR);
    const images = files
      .filter((f) => SAFE_FILENAME_RE.test(f))
      .map((filename) => ({
        filename,
        url: `/.playground/images/${filename}`,
      }));
    return NextResponse.json({ images });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ images: [], error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      imageBase64?: string;
      originalName?: string;
    } | null;

    if (!body?.imageBase64 || !body?.originalName) {
      return NextResponse.json(
        { success: false, error: 'Missing imageBase64 or originalName' },
        { status: 400 },
      );
    }

    const { imageBase64, originalName } = body;

    // Extract extension from original name or data URL
    let ext = path.extname(originalName).toLowerCase();
    if (!ext) {
      // Try to infer from data URL
      const mimeMatch = imageBase64.match(/^data:image\/(\w+);/);
      ext = mimeMatch ? `.${mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1]}` : '.png';
    }

    const baseName = sanitizeFilename(path.basename(originalName, path.extname(originalName)));
    const filename = `${Date.now()}-${baseName}${ext}`;

    if (!SAFE_FILENAME_RE.test(filename)) {
      return NextResponse.json(
        { success: false, error: 'Invalid filename after sanitization' },
        { status: 400 },
      );
    }

    const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await ensureImagesDir();
    const filePath = path.join(IMAGES_DIR, filename);
    await fs.writeFile(filePath, buffer);

    const relativePath = path.relative(process.cwd(), filePath);

    return NextResponse.json({
      success: true,
      filename,
      path: relativePath,
      url: `/.playground/images/${filename}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Playground][images] POST error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      filename?: string;
    } | null;

    if (!body?.filename) {
      return NextResponse.json(
        { success: false, error: 'Missing filename' },
        { status: 400 },
      );
    }

    const { filename } = body;

    if (!SAFE_FILENAME_RE.test(filename)) {
      return NextResponse.json(
        { success: false, error: 'Invalid filename' },
        { status: 400 },
      );
    }

    const filePath = path.join(IMAGES_DIR, filename);

    if (fsSync.existsSync(filePath)) {
      await fs.unlink(filePath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Playground][images] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
