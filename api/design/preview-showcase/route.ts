import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const SHOWCASE_PATH = () => path.join(process.cwd(), '.context', 'design-preview.html');

export async function GET() {
  const filePath = SHOWCASE_PATH();
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    const match = html.match(/^<!--\s*design-md-hash:\s*([a-f0-9]+)\s*-->/);
    const hash = match ? match[1] : null;
    return Response.json({ exists: true, html, hash });
  } catch {
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
