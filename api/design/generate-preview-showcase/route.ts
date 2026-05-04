import fs from 'fs';
import path from 'path';
import {
  spawnAgent,
  getProviderNotFoundMessage,
} from '../../../lib/providers';
import type { ProviderId } from '../../../lib/providers';
import { designMdPath } from '../../../lib/design-md-helpers';
import { hashFrontMatter } from '../../../lib/parse-design-md';

export const runtime = 'nodejs';

interface GenerateBody {
  provider?: ProviderId;
  model?: string;
}

const SHOWCASE_PATH = () => path.join(process.cwd(), '.context', 'design-preview.html');

function readDesignMd(): string | null {
  try {
    return fs.readFileSync(designMdPath(), 'utf8');
  } catch {
    return null;
  }
}

function buildPrompt(designMd: string, outPath: string): string {
  return [
    'You are a senior brand-systems designer. Your one and only task is to produce a single self-contained HTML file that visually demonstrates the design system defined in DESIGN.md, dramatizing both the YAML tokens AND the philosophy prose below the front-matter.',
    '',
    `WRITE THE FILE TO THIS EXACT PATH (overwrite if it exists): ${outPath}`,
    '',
    '=== DESIGN.md (source of truth — read both the YAML front-matter AND the prose below) ===',
    designMd,
    '=== END DESIGN.md ===',
    '',
    'OUTPUT REQUIREMENTS:',
    '- A single self-contained HTML5 document. No external JS, no <script> tags.',
    '- All styles inline in a single <style> block. NO CSS imports except Google Fonts <link> tags in <head> for the typography fontFamily values found in the YAML (e.g. Geist Sans, Bricolage Grotesque, Inter). If the font name is not on Google Fonts (e.g. Louize), use a sensible fallback chain (Georgia, serif).',
    '- Use the EXACT hex values from the YAML front-matter — do not reinterpret them. Resolve {colors.x} / {rounded.x} / {typography.x} references to literals.',
    '- The <body> background must be the page background color from the YAML.',
    '',
    'CONTENT — render these vignettes stacked vertically inside a single column with max-width 960px and generous vertical rhythm. Each vignette is a card that contains (a) the visual itself and (b) a small caption (label-caps style) naming which philosophy principle it dramatizes:',
    '  1. HERO BLOCK — display headline using h1 typography + body subtitle + a primary CTA button. Caption: "Editorial display + single primary action".',
    '  2. NAV BAR — pill-shaped nav links with one active state and a primary CTA on the right. Caption: "Pill shapes signal interactivity".',
    '  3. CARD GRID — 3 article-style cards (image placeholder area using a tonal surface fill, title in display font, meta line in label-caps, body excerpt). Caption: "Tonal surface layering, no shadows".',
    '  4. BUTTON CLUSTER — primary, secondary, ghost variants side-by-side, plus a disabled state. Caption: "Same radius tier across a button group".',
    '  5. FORM — a labeled input + helper text + a submit button. Caption: "Inputs use {rounded.lg} not pill — only buttons go full radius".',
    '  6. BADGE ROW — a few inline badges (category, status, PRO/premium using accent color if present). Caption: "Premium accent reserved for high-value labels".',
    '  7. PRICING / FEATURED CARD — a single elevated card with a 2px foreground border, a "Most Popular" pill badge, price, feature list, and CTA. Caption: "Heavy shadow + scale lift used only here".',
    '',
    'PHILOSOPHY ECHOES — at the very top of the document, before the vignettes, render a 2–3 sentence opening paragraph (in body typography on the page background) drawn from the Overview section of DESIGN.md. This sets the tone.',
    '',
    'CAPTION STYLING — captions sit above each vignette as small uppercase eyebrows in label-caps typography. Use the muted-foreground color if available, otherwise foreground at 60% opacity.',
    '',
    'STRICT RULES:',
    '- NO JavaScript whatsoever. No <script>. No event handlers. No data: URIs that contain script.',
    '- NO external assets except Google Fonts <link> tags. Image areas must be pure CSS (solid color blocks, gradients, or inline SVG).',
    '- Resolve every token reference. The output HTML must contain literal hex values, not {colors.primary} placeholders.',
    '- Honor the philosophy: if the prose says accent-orange is reserved for premium CTAs, only use it on the PRO badge / pricing CTA. Do not sprinkle it everywhere.',
    '- Do not invent tokens that aren\'t in the YAML.',
    '- Max-width 960px container, centered. Vignettes stack with 48–64px vertical gap.',
    '',
    `OUTPUT BEHAVIOR — write the HTML directly to ${outPath} using the file-write tool available to you. Do not print the HTML to stdout. After writing, output a single line: "Showcase written to ${outPath}".`,
    '',
    'Begin now.',
  ].join('\n');
}

export async function POST(req: Request) {
  let body: GenerateBody | null = null;
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const providerId: ProviderId = body?.provider ?? 'cursor';

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const log = (line: string) => controller.enqueue(encoder.encode(line + '\n'));

      const designMd = readDesignMd();
      if (!designMd) {
        log('[error] DESIGN.md not found. Generate or scaffold one first.');
        log('[done]');
        controller.close();
        return;
      }

      const outPath = SHOWCASE_PATH();
      const outDir = path.dirname(outPath);
      try {
        fs.mkdirSync(outDir, { recursive: true });
      } catch (err) {
        log(`[error] Could not create ${path.relative(process.cwd(), outDir)}: ${(err as Error).message}`);
        log('[done]');
        controller.close();
        return;
      }

      log(`> Reading your design system…`);
      log(`> Composing a visual showcase of your design philosophy…`);
      log('');

      const prompt = buildPrompt(designMd, outPath);

      let child;
      try {
        child = spawnAgent(
          providerId,
          {
            model: body?.model,
            ...(providerId === 'claude-code' ? { claudeDetailedStdout: false } : {}),
          },
          process.cwd(),
        );
      } catch (error) {
        log(`[error] ${(error as Error).message}`);
        log('[done]');
        controller.close();
        return;
      }

      const before = (() => {
        try {
          return fs.statSync(outPath).mtimeMs;
        } catch {
          return null;
        }
      })();

      child.stdout?.on('data', (chunk: Buffer) => {
        controller.enqueue(encoder.encode(chunk.toString('utf8')));
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        controller.enqueue(encoder.encode(chunk.toString('utf8')));
      });
      child.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') {
          log(`\n[error] ${getProviderNotFoundMessage(providerId)}`);
        } else {
          log(`\n[error] ${err.message}`);
        }
      });

      child.stdin?.write(prompt);
      child.stdin?.end();

      const exitCode: number | null = await new Promise((resolve) => {
        child.on('close', (code) => resolve(code));
      });

      log('');
      const after = (() => {
        try {
          return fs.statSync(outPath).mtimeMs;
        } catch {
          return null;
        }
      })();
      const wrote = after !== null && before !== after;

      if (exitCode === 0 && wrote) {
        // Prepend the front-matter hash header so the client can detect drift.
        try {
          const html = fs.readFileSync(outPath, 'utf8');
          const hash = hashFrontMatter(designMd);
          const headerLine = `<!-- design-md-hash: ${hash} -->`;
          const stripped = html.replace(/^<!--\s*design-md-hash:[^>]*-->\s*\r?\n?/, '');
          fs.writeFileSync(outPath, `${headerLine}\n${stripped}`, 'utf8');
          log(`> Your showcase is ready ✓`);
        } catch (err) {
          log(`> Your showcase is ready (with a small caveat): ${(err as Error).message}`);
        }
      } else if (exitCode === 0 && !wrote) {
        log(`> The AI didn't produce a showcase this time. Try again.`);
      } else {
        log(`> Something went wrong. Try again, or check Model Settings.`);
      }
      log('[done]');
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
