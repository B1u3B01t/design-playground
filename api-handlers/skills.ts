import path from 'path';
import fs from 'fs/promises';
import type { PlaygroundSkill } from '../skills';
import type { ApiRequest, ApiResponse } from './types';
import { resolvePlaygroundAbsolute } from './paths';

async function findSkillFiles(dir: string, acc: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await findSkillFiles(fullPath, acc);
    } else if (entry.isFile() && entry.name === 'SKILL.md') {
      acc.push(fullPath);
    }
  }
  return acc;
}

function parseFrontmatter(content: string): { name?: string; description?: string; body: string } {
  if (!content.startsWith('---')) {
    return { body: content };
  }

  const lines = content.split('\n');
  let i = 1;
  const frontmatterLines: string[] = [];

  for (; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      i++;
      break;
    }
    frontmatterLines.push(lines[i]);
  }

  const body = lines.slice(i).join('\n');
  const meta: { [key: string]: string } = {};

  for (const line of frontmatterLines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key) continue;
    meta[key] = value.replace(/^['"]|['"]$/g, '');
  }

  return {
    name: meta.name,
    description: meta.description,
    body,
  };
}

function toLabelFromId(id: string): string {
  return id
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function handleSkillsGet(_req: ApiRequest, res: ApiResponse) {
  try {
    const skillsRoot = path.join(resolvePlaygroundAbsolute(), 'skills');

    // Skills directory is optional — return empty if it doesn't exist
    try {
      await fs.access(skillsRoot);
    } catch {
      return res.json({ skills: [] });
    }

    const files = await findSkillFiles(skillsRoot);

    const skills: PlaygroundSkill[] = [];

    for (const file of files) {
      const raw = await fs.readFile(file, 'utf8');
      const { name, description, body } = parseFrontmatter(raw);

      const id = name || path.basename(path.dirname(file));
      const label = toLabelFromId(id);

      skills.push({
        id,
        label,
        description: description || '',
        systemPrompt: body.trim(),
      });
    }

    skills.sort((a, b) => a.label.localeCompare(b.label));

    res.json({ skills });
  } catch (error) {
    console.error('[Playground] Failed to load skills:', error);
    res.json({ skills: [] }, 500);
  }
}
