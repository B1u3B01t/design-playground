import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const SHOWCASE_PATH = () => path.join(process.cwd(), '.context', 'design-preview.html');

export async function GET(req: Request) {
  const filePath = SHOWCASE_PATH();
  const raw = new URL(req.url).searchParams.get('raw');
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    if (raw) {
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }
    const match = html.match(/^<!--\s*design-md-hash:\s*([a-f0-9]+)\s*-->/);
    const hash = match ? match[1] : null;
    return Response.json({ exists: true, html, hash });
  } catch {
    if (raw) {
      return new Response('', { status: 404 });
    }
    return Response.json({ exists: false, html: null, hash: null });
  }
}

export async function DELETE() {
  const filePath = SHOWCASE_PATH();
  try {
    fs.unlinkSync(filePath);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
