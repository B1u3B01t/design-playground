import path from 'path';
import fs from 'fs/promises';
import { NextResponse } from 'next/server';
import type { PlaygroundSkill } from '../../skills';
import { resolvePlaygroundDir } from '../../lib/resolve-playground-dir';

const BUILTIN_SKILLS_DIR = path.join(resolvePlaygroundDir(), 'skills');
const USER_SKILLS_DIR = path.join(process.cwd(), '.claude', 'skills');

async function findSkillFiles(dir: string, acc: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
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

export type SkillSource = 'builtin' | 'user';

export interface ExtendedPlaygroundSkill extends PlaygroundSkill {
  source: SkillSource;
}

async function loadSkillsFromDir(
  root: string,
  source: SkillSource,
): Promise<ExtendedPlaygroundSkill[]> {
  const files = await findSkillFiles(root);
  const cwd = process.cwd();
  const skills: ExtendedPlaygroundSkill[] = [];

  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    const { name, description, body } = parseFrontmatter(raw);
    const id = name || path.basename(path.dirname(file));
    const label = toLabelFromId(id);
    const skillPath = path.relative(cwd, file).split(path.sep).join('/');
    skills.push({
      id,
      label,
      description: description || '',
      systemPrompt: body.trim(),
      skillPath,
      source,
    });
  }

  return skills;
}

export async function GET() {
  try {
    const [builtin, user] = await Promise.all([
      loadSkillsFromDir(BUILTIN_SKILLS_DIR, 'builtin'),
      loadSkillsFromDir(USER_SKILLS_DIR, 'user'),
    ]);

    const seen = new Set<string>();
    const merged: ExtendedPlaygroundSkill[] = [];
    for (const skill of [...user, ...builtin]) {
      if (seen.has(skill.id)) continue;
      seen.add(skill.id);
      merged.push(skill);
    }

    merged.sort((a, b) => a.label.localeCompare(b.label));

    return NextResponse.json({ skills: merged });
  } catch (error) {
    console.error('[Playground] Failed to load skills:', error);
    return NextResponse.json({ skills: [] }, { status: 500 });
  }
}
