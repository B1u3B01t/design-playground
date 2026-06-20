/** Normalize a human title into a public/ HTML frame folder name. */
export function normalizePlanFrameName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

/** Derive a slug from plan markdown (YAML `name` or first `#` heading). */
export function derivePlanFrameBaseName(planText: string): string {
  if (!planText.trim()) return '';

  const frontmatter = planText.match(/^---\s*\n([\s\S]*?)\n---/);
  if (frontmatter) {
    const nameLine = frontmatter[1].match(/^name:\s*['"]?([^'"\n]+)['"]?\s*$/m);
    if (nameLine?.[1]) {
      const normalized = normalizePlanFrameName(nameLine[1]);
      if (normalized) return normalized;
    }
  }

  const heading = planText.match(/^#\s+(.+)$/m);
  if (heading?.[1]) {
    const normalized = normalizePlanFrameName(heading[1]);
    if (normalized) return normalized;
  }

  return '';
}

export function resolveUniqueFrameName(baseName: string, existingFolders: string[]): string {
  const normalized = normalizePlanFrameName(baseName) || 'visualise-plan';
  if (!existingFolders.includes(normalized)) return normalized;
  for (let i = 2; i <= 99; i++) {
    const candidate = `${normalized}-${i}`;
    if (!existingFolders.includes(candidate)) return candidate;
  }
  return `${normalized}-${Date.now()}`;
}

export async function pickPlanFrameName(planText: string, fallbackName?: string): Promise<string> {
  let folders: string[] = [];
  try {
    const res = await fetch('/playground/api/html-pages');
    if (res.ok) {
      const data = (await res.json()) as { pages?: { folder: string }[] };
      folders = (data.pages ?? []).map((p) => p.folder);
    }
  } catch {
    /* use empty list */
  }

  let base = derivePlanFrameBaseName(planText);
  if (!base) {
    if (fallbackName?.trim()) {
      base = normalizePlanFrameName(fallbackName);
    } else {
      let max = 0;
      for (const folder of folders) {
        const m = folder.match(/^untitled-(\d+)$/i);
        if (m) max = Math.max(max, Number(m[1]));
      }
      base = `untitled-${max + 1}`;
    }
  }

  return resolveUniqueFrameName(base || 'visualise-plan', folders);
}
