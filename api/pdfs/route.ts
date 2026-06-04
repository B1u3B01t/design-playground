import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const PDFS_DIR = path.join(process.cwd(), 'public/.playground/pdfs');

async function ensurePdfsDir() {
  if (!fsSync.existsSync(PDFS_DIR)) {
    await fs.mkdir(PDFS_DIR, { recursive: true });
  }
}

const SAFE_FILENAME_RE = /^[A-Za-z0-9._-]+\.pdf$/i;

function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '-').replace(/-+/g, '-');
}

export async function GET() {
  try {
    await ensurePdfsDir();
    const files = await fs.readdir(PDFS_DIR);
    const pdfs = files
      .filter((f) => SAFE_FILENAME_RE.test(f))
      .map((filename) => ({
        filename,
        url: `/.playground/pdfs/${filename}`,
      }));
    return NextResponse.json({ pdfs });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ pdfs: [], error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      pdfBase64?: string;
      originalName?: string;
    } | null;

    if (!body?.pdfBase64 || !body?.originalName) {
      return NextResponse.json(
        { success: false, error: 'Missing pdfBase64 or originalName' },
        { status: 400 },
      );
    }

    const { pdfBase64, originalName } = body;
    const baseName = sanitizeFilename(path.basename(originalName, path.extname(originalName)));
    const filename = `${Date.now()}-${baseName}.pdf`;

    if (!SAFE_FILENAME_RE.test(filename)) {
      return NextResponse.json(
        { success: false, error: 'Invalid filename after sanitization' },
        { status: 400 },
      );
    }

    const base64Data = pdfBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await ensurePdfsDir();
    const filePath = path.join(PDFS_DIR, filename);
    await fs.writeFile(filePath, buffer);

    const relativePath = path.relative(process.cwd(), filePath);

    return NextResponse.json({
      success: true,
      filename,
      path: relativePath,
      url: `/.playground/pdfs/${filename}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Playground][pdfs] POST error:', error);
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

    const filePath = path.join(PDFS_DIR, filename);

    if (fsSync.existsSync(filePath)) {
      await fs.unlink(filePath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Playground][pdfs] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
