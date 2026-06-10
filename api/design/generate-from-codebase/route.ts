import fs from 'fs';
import path from 'path';
import {
  spawnAgent,
  getProviderNotFoundMessage,
} from '../../../lib/providers';
import type { ProviderId } from '../../../lib/providers';
import { designMdPath } from '../../../lib/design-md-helpers';
import { runDesignMdCli } from '../../../lib/run-design-md-cli';

export const runtime = 'nodejs';

interface GenerateBody {
  provider?: ProviderId;
  model?: string;
  notes?: string;
  overwrite?: boolean;
}

const FALLBACK_SCHEMA = `Top-level YAML keys (FLAT — no "tokens:" wrapper):
  version: alpha            # optional
  name: <string>
  description: <string>     # optional
  colors:
    <token-name>: "#hex"    # e.g. primary, secondary, tertiary, neutral, on-primary
  typography:
    <token-name>:           # e.g. h1, h2, body-md, label-caps — keyed by ROLE
      fontFamily: <string>
      fontSize: <dim>       # rem | px | em
      fontWeight: <number>  # optional
      lineHeight: <number>  # optional
      letterSpacing: <dim>  # optional
  spacing:
    <scale-level>: <dim>    # e.g. xs, sm, md, lg, xl — px or rem
  rounded:
    <scale-level>: <dim>    # e.g. sm, md, lg — px or rem  (NOTE: "rounded", not "radius")
  components:
    <component-name>:       # e.g. button-primary, button-primary-hover, card
      backgroundColor: "{colors.tertiary}"   # token reference
      textColor: "{colors.on-tertiary}"
      typography: "{typography.body-md}"
      rounded: "{rounded.md}"
      padding: 12px
      size | height | width: <dim>           # optional

Token reference syntax: {path.to.token} — e.g. {colors.primary}, {rounded.sm}.
Valid component properties (others get a warning): backgroundColor, textColor,
typography, rounded, padding, size, height, width.

Section order (## headings, omit any that don't apply, but keep this order):
  1. Overview              (alias: Brand & Style)
  2. Colors
  3. Typography
  4. Layout                (alias: Layout & Spacing)
  5. Elevation & Depth     (alias: Elevation)
  6. Shapes
  7. Components
  8. Do's and Don'ts`;

async function fetchLiveSpec(): Promise<string> {
  const result = await runDesignMdCli(['spec']);
  if (result.ok && result.stdout.trim().length > 0) {
    return result.stdout;
  }
  return FALLBACK_SCHEMA;
}

function readHostFile(rel: string): string | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
  } catch {
    return null;
  }
}

function findHostGlobalsCss(): { path: string; contents: string } | null {
  const candidates = [
    'src/app/globals.css',
    'app/globals.css',
    'src/styles/globals.css',
    'styles/globals.css',
  ];
  for (const rel of candidates) {
    const contents = readHostFile(rel);
    if (contents !== null) return { path: rel, contents };
  }
  return null;
}

function findHostTailwindConfig(): { path: string; contents: string } | null {
  const candidates = [
    'tailwind.config.ts',
    'tailwind.config.js',
    'tailwind.config.mjs',
    'tailwind.config.cjs',
  ];
  for (const rel of candidates) {
    const contents = readHostFile(rel);
    if (contents !== null) return { path: rel, contents };
  }
  return null;
}

function findExistingDesignMd(): string | null {
  try {
    return fs.readFileSync(designMdPath(), 'utf8');
  } catch {
    return null;
  }
}

interface BuildPromptOpts {
  spec: string;
  notes?: string;
  globalsCss: { path: string; contents: string } | null;
  tailwindConfig: { path: string; contents: string } | null;
  existingDesignMd: string | null;
}

function buildPrompt(opts: BuildPromptOpts): string {
  const targetPath = designMdPath();

  const globalsBlock = opts.globalsCss
    ? [
        `=== HOST globals.css (path: ${opts.globalsCss.path}) ===`,
        opts.globalsCss.contents,
        '=== END HOST globals.css ===',
      ].join('\n')
    : [
        '=== HOST globals.css ===',
        '(NOT FOUND — the host app has no globals.css at the conventional locations.',
        ' Derive tokens from tailwind.config and component source within the host app only.',
        ' Do NOT invent tokens to fill the gap.)',
        '=== END HOST globals.css ===',
      ].join('\n');

  const tailwindBlock = opts.tailwindConfig
    ? [
        `=== HOST tailwind config (path: ${opts.tailwindConfig.path}) ===`,
        opts.tailwindConfig.contents,
        '=== END HOST tailwind config ===',
      ].join('\n')
    : '';

  const existingBlock = opts.existingDesignMd
    ? [
        '=== EXISTING DESIGN.md (you are overwriting this — preserve human-curated names where reasonable) ===',
        opts.existingDesignMd,
        '=== END EXISTING DESIGN.md ===',
      ].join('\n')
    : '';

  return [
    'You are a senior design-systems engineer. Your one and only task is to produce a high-quality DESIGN.md file at the project root by inspecting THIS HOST APP and writing in the EXACT @google/design.md format below.',
    '',
    `TARGET PATH (write here, overwrite if it exists): ${targetPath}`,
    '',
    '=== DESIGN.md FORMAT (authoritative — follow this exactly) ===',
    opts.spec,
    '=== END FORMAT ===',
    '',
    globalsBlock,
    '',
    tailwindBlock,
    '',
    existingBlock,
    '',
    'STEPS:',
    '1. GROUND YOURSELF IN THE HOST APP\'S GLOBAL STYLES FIRST. The contents of the host app\'s globals.css are inlined above under "=== HOST globals.css ===". Read it before anything else. The @theme block, :root custom properties (--color-*, --spacing-*, --radius-*, --font-*), and any @layer base rules ARE the source of truth for this design system. Every token you emit should trace back to a value visible there (or, failing that, the tailwind config / component source within the host app).',
    '2. Cross-reference, in this order, ALL WITHIN THE HOST APP ONLY:',
    '   - tailwind config (inlined above, if present).',
    '   - Existing UI components under src/components/** and src/app/**/*.tsx — note their actual padding/radius/typography classes. EXCLUDE src/app/playground/** and public/.playground/** entirely; those are tooling, not the host app\'s product surface.',
    '   - public/ for logo / brand color / favicon hints.',
    '   - README.md / CLAUDE.md for tone-of-voice and product purpose.',
    '3. Synthesize what you found into a DESIGN.md. Write directly to the target path. Do NOT ask questions. Do NOT produce surrounding commentary — only the file.',
    '',
    'STRICT REQUIREMENTS:',
    '- HOST APP ONLY. Do not read or derive values from: node_modules/, .next/, .git/, src/app/playground/**, public/.playground/**, or any path outside the current working directory.',
    '- NO FABRICATION. Every color, spacing, radius, and typography value must trace back to a value found in the host app (globals.css preferred, then tailwind config, then component source). If a category genuinely has no source values in the host app, OMIT that section rather than inventing — do not add placeholder tokens.',
    '- The YAML front-matter MUST use FLAT top-level keys: `colors`, `typography`, `spacing`, `rounded`, `components` (NEVER nest these under a `tokens:` key — the linter and exporter will fail).',
    '- Use `rounded:` (NOT `radius:`).',
    '- Typography keys are ROLE-based (`h1`, `h2`, `body-md`, `label-caps`), NOT axis-based (`sans`, `mono`). Each is a full object with `fontFamily`, `fontSize`, etc.',
    '- Color values are bare hex strings: `primary: "#1A1C1E"` — NOT DTCG `{ value, type }` objects.',
    '- In Markdown bodies, reference tokens via {colors.primary} / {rounded.sm} / {typography.h1} — NEVER hard-code raw hex codes.',
    '- Use the EXACT section order listed in the spec above. ## headings only.',
    '- Components section: list the 3–6 most visually defining components you found IN THE HOST APP (e.g. `button-primary`, `card`, `dialog`). Map each to allowed properties only: backgroundColor, textColor, typography, rounded, padding, size, height, width.',
    '- Define color pairs that pass WCAG AA (≥ 4.5:1 body contrast).',
    '- Define a `primary` color (the linter warns when missing).',
    '- Keep the file under ~6 KB. Be opinionated and concise.',
    '- After writing, output a single line: "DESIGN.md written to <absolute path>".',
    '',
    opts.notes ? `EXTRA GUIDANCE FROM USER:\n${opts.notes}\n` : '',
    'Begin now. Anchor on globals.css, then write the file.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function POST(req: Request) {
  let body: GenerateBody | null = null;
  try {
    body = await req.json();
  } catch {
    /* allow empty body */
  }
  const providerId: ProviderId = body?.provider ?? 'cursor';
  const notes = body?.notes?.trim() || undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const log = (line: string) => controller.enqueue(encoder.encode(line + '\n'));
      log(`> Fetching the latest @google/design.md spec…`);

      const spec = await fetchLiveSpec();
      const fromLive = spec !== FALLBACK_SCHEMA;
      log(
        fromLive
          ? `> Using live spec from the installed package.`
          : `> @google/design.md not callable yet; using built-in schema reference.`,
      );
      const globalsCss = findHostGlobalsCss();
      const tailwindConfig = findHostTailwindConfig();
      const existingDesignMd = findExistingDesignMd();

      if (globalsCss) {
        log(`> Read host ${globalsCss.path} (${globalsCss.contents.length} bytes) — anchoring the AI on it.`);
      } else {
        log(`[warn] No host globals.css found at the conventional locations. The AI will be told not to invent tokens to fill the gap.`);
      }
      if (tailwindConfig) {
        log(`> Read host ${tailwindConfig.path} (${tailwindConfig.contents.length} bytes).`);
      }
      if (existingDesignMd) {
        log(`> Existing DESIGN.md detected (${existingDesignMd.length} bytes) — passed as reference for naming continuity.`);
      }

      log(`> Asking the AI to study your host app and draft DESIGN.md…`);
      log(`> Provider: ${providerId}${body?.model ? `  •  model: ${body.model}` : ''}`);
      log('');

      const prompt = buildPrompt({ spec, notes, globalsCss, tailwindConfig, existingDesignMd });

      let child;
      try {
        child = spawnAgent(
          providerId,
          {
            model: body?.model,
            ...(providerId === 'claude-code' ? { claudeDetailedStdout: false } : {}),
            ...(providerId === 'codex' ? { codexDetailedStdout: false } : {}),
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
          return fs.statSync(designMdPath()).mtimeMs;
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
          return fs.statSync(designMdPath()).mtimeMs;
        } catch {
          return null;
        }
      })();
      const wrote = after !== null && before !== after;
      const filePath = designMdPath();

      if (exitCode === 0 && wrote) {
        log(`> Wrote ${path.relative(process.cwd(), filePath)} ✓`);

        // Auto-lint so the user immediately sees if the AI drifted from the spec.
        log(`> Running lint to verify the result…`);
        const lint = await runDesignMdCli(['lint', filePath]);
        if (lint.ok) {
          log(`> Lint passed.`);
        } else {
          log(`[warn] Lint surfaced issues (see Check tab):`);
          if (lint.stdout) log(lint.stdout.trim());
          if (lint.stderr) log(lint.stderr.trim());
        }
      } else if (exitCode === 0 && !wrote) {
        log(`[warn] The agent finished but didn't change ${path.relative(process.cwd(), filePath)}.`);
        log(`       You can try again, or pick a different model in Model Settings.`);
      } else {
        log(`[failed] Agent exited with code ${exitCode}.`);
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
