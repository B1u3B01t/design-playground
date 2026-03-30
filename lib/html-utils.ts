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
