/**
 * If the clipboard plain text is a single http(s) URL, returns a normalized
 * href. Used for paste-to-embed on the playground canvas.
 */
export function parsePastedHttpUrl(plain: string): string | null {
  const trimmed = plain.trim();
  if (!trimmed) return null;
  // Strip common Markdown / editor wrappers
  const stripped = trimmed.replace(/^<+|>+$/g, '').trim();
  const match = stripped.match(/^https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  try {
    const u = new URL(match[0]);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Detects whether the given HTML string is a full document or a fragment,
 * and wraps fragments in a bare-bones HTML skeleton.
 */
export function wrapHtmlFragment(html: string): string {
  // Strip browser clipboard markers
  let cleaned = html
    .replace(/<!--StartFragment-->/gi, '')
    .replace(/<!--EndFragment-->/gi, '')
    .trim();

  // Check if it's already a full HTML document
  if (/^\s*<!doctype\s/i.test(cleaned) || /^\s*<html[\s>]/i.test(cleaned)) {
    return cleaned;
  }

  // Wrap fragment in a minimal skeleton
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pasted Frame</title>
</head>
<body>
${cleaned}
</body>
</html>`;
}
