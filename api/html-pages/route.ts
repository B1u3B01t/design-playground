import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { HTML_TREE_DIR, HTML_TREE_FILENAME } from '../../lib/constants';
import type { HtmlPageInfo } from '../../lib/constants';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const TREE_DIR = path.join(PUBLIC_DIR, HTML_TREE_DIR);
const TREE_PATH = path.join(TREE_DIR, HTML_TREE_FILENAME);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TreeManifest {
  version: number;
  entries: Record<string, { parent: string }>;
}

function readTreeManifest(): TreeManifest {
  try {
    if (fs.existsSync(TREE_PATH)) {
      return JSON.parse(fs.readFileSync(TREE_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { version: 1, entries: {} };
}

function writeTreeManifest(manifest: TreeManifest) {
  if (!fs.existsSync(TREE_DIR)) {
    fs.mkdirSync(TREE_DIR, { recursive: true });
  }
  fs.writeFileSync(TREE_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
}

function scanHtmlPages(): HtmlPageInfo[] {
  if (!fs.existsSync(PUBLIC_DIR)) return [];

  const entries = fs.readdirSync(PUBLIC_DIR, { withFileTypes: true });
  const manifest = readTreeManifest();
  const pages: HtmlPageInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === HTML_TREE_DIR) continue;
    if (entry.name.startsWith('.')) continue;

    const pageDir = path.join(PUBLIC_DIR, entry.name);
    const indexPath = path.join(pageDir, 'index.html');

    if (!fs.existsSync(indexPath)) continue;

    // Scan for iteration subdirectories
    const iterations: { folder: string; number: number }[] = [];
    try {
      const subEntries = fs.readdirSync(pageDir, { withFileTypes: true });
      for (const sub of subEntries) {
        if (!sub.isDirectory()) continue;
        const match = sub.name.match(/^iteration-(\d+)$/);
        if (match) {
          const iterIndex = path.join(pageDir, sub.name, 'index.html');
          if (fs.existsSync(iterIndex)) {
            iterations.push({ folder: sub.name, number: parseInt(match[1], 10) });
          }
        }
      }
    } catch { /* ignore */ }

    iterations.sort((a, b) => a.number - b.number);

    pages.push({
      id: `html:${entry.name}`,
      label: entry.name,
      folder: entry.name,
      iterations,
    });
  }

  return pages;
}

// ---------------------------------------------------------------------------
// PUT — Create a new HTML page with a starter template
// ---------------------------------------------------------------------------

export async function PUT(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { name?: string } | null;

    if (!body?.name) {
      return NextResponse.json(
        { success: false, error: 'Missing page name' },
        { status: 400 },
      );
    }

    // Sanitize: lowercase, alphanumeric + hyphens only
    const name = body.name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100);

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Invalid page name' },
        { status: 400 },
      );
    }

    const pageDir = path.join(PUBLIC_DIR, name);
    const indexPath = path.join(pageDir, 'index.html');

    if (fs.existsSync(indexPath)) {
      return NextResponse.json(
        { success: false, error: `Page "${name}" already exists` },
        { status: 409 },
      );
    }

    fs.mkdirSync(pageDir, { recursive: true });

    const template = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fafaf9;
      color: #1c1917;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    p {
      color: #78716c;
      font-size: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${name}</h1>
    <p>Edit this page or iterate on it from the playground.</p>
  </div>
</body>
</html>`;

    fs.writeFileSync(indexPath, template, 'utf-8');

    return NextResponse.json({
      success: true,
      page: {
        id: `html:${name}`,
        label: name,
        folder: name,
        iterations: [],
      },
    });
  } catch (error) {
    console.error('[html-pages] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create HTML page' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// GET — List HTML pages and their iterations
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const pages = scanHtmlPages();
    return NextResponse.json({ pages });
  } catch (error) {
    console.error('[html-pages] GET error:', error);
    return NextResponse.json(
      { pages: [], error: 'Failed to scan HTML pages' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Rebuild html-tree.json manifest
// ---------------------------------------------------------------------------

export async function POST() {
  try {
    const pages = scanHtmlPages();
    const existing = readTreeManifest();
    const entries = { ...existing.entries };

    // Add any iterations not yet in the manifest
    for (const page of pages) {
      for (const iter of page.iterations) {
        const key = `${page.folder}/${iter.folder}`;
        if (!entries[key]) {
          entries[key] = { parent: `html:${page.folder}` };
        }
      }
    }

    writeTreeManifest({ version: 1, entries });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[html-pages] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to rebuild manifest' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Remove an iteration folder
// ---------------------------------------------------------------------------

export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      pageFolder?: string;
      iterationFolder?: string;
    } | null;

    if (!body?.pageFolder || !body?.iterationFolder) {
      return NextResponse.json(
        { success: false, error: 'Missing pageFolder or iterationFolder' },
        { status: 400 },
      );
    }

    const { pageFolder, iterationFolder } = body;

    // Validate names to prevent directory traversal
    if (pageFolder.includes('..') || iterationFolder.includes('..')) {
      return NextResponse.json(
        { success: false, error: 'Invalid path' },
        { status: 400 },
      );
    }

    const iterDir = path.join(PUBLIC_DIR, pageFolder, iterationFolder);
    if (fs.existsSync(iterDir)) {
      fs.rmSync(iterDir, { recursive: true });
    }

    // Update tree manifest — remove entry and reparent children
    const manifest = readTreeManifest();
    const removedKey = `${pageFolder}/${iterationFolder}`;
    const removedParent = manifest.entries[removedKey]?.parent;
    delete manifest.entries[removedKey];

    // Reparent children of the removed iteration
    if (removedParent) {
      for (const [key, value] of Object.entries(manifest.entries)) {
        if (value.parent === removedKey || value.parent === iterationFolder) {
          manifest.entries[key] = { parent: removedParent };
        }
      }
    }

    writeTreeManifest(manifest);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[html-pages] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete iteration' },
      { status: 500 },
    );
  }
}
