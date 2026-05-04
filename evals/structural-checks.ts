/**
 * Deterministic structural checks on a discovery.json output.
 * These are NOT pass/fail gates — they feed into the LLM judge as ground-truth
 * findings so it doesn't have to re-derive them.
 */

import fs from 'fs';
import path from 'path';

interface DiscoveryEntry {
  id?: unknown;
  name?: unknown;
  path?: unknown;
  type?: unknown;
  route?: unknown;
  description?: unknown;
  status?: unknown;
  childComponents?: unknown;
}

interface DiscoveryDoc {
  version?: unknown;
  scannedAt?: unknown;
  entries?: unknown;
}

export interface StructuralFindings {
  shapeOk: boolean;
  shapeIssues: string[];
  entryCount: number;
  duplicateIds: string[];
  duplicatePaths: { path: string; ids: string[] }[];
  badIds: string[];
  badNames: string[];
  missingFields: { id: string; missing: string[] }[];
  pathsNotOnDisk: string[];
  skipRuleViolations: string[];
  badType: string[];
  pageMissingRoute: string[];
  routeOnComponent: string[];
  routeNotStartingWithSlash: string[];
  statusNotDiscovered: string[];
  childShapeViolations: { entryId: string; index: number; reason: string; value: unknown }[];
  childNameNotPascalCase: { entryId: string; childName: string }[];
  childComponentMissingPaths: { entryId: string; childPath: string }[];
  childPathHasNoTopLevelEntry: { entryId: string; childPath: string }[];
  descriptionBlocklistHits: { entryId: string; tokens: string[] }[];
  descriptionEmpty: string[];
}

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PASCAL_RE = /^[A-Z][A-Za-z0-9]*$/;
const SPECIAL_FILES = new Set([
  'layout.tsx',
  'loading.tsx',
  'error.tsx',
  'not-found.tsx',
  'template.tsx',
  'global-error.tsx',
]);

const DESCRIPTION_BLOCKLIST = [
  'server-rendered', 'ssr', 'client-rendered', 'memoized', 'suspense',
  'zustand', 'usestate', 'useeffect', 'usememo', 'tiptap',
  'convertkit', 'bunny', 'mixpanel', 'supabase', 'postmessage',
  'exports ', 'uses ', 'renders ', 'imports ', 'passes ',
  'via a ', '-based', 'auto-resize',
];

export function runStructuralChecks(
  raw: unknown,
  cwd: string,
  playgroundRel: string,
): StructuralFindings {
  const findings: StructuralFindings = {
    shapeOk: true,
    shapeIssues: [],
    entryCount: 0,
    duplicateIds: [],
    duplicatePaths: [],
    badIds: [],
    badNames: [],
    missingFields: [],
    pathsNotOnDisk: [],
    skipRuleViolations: [],
    badType: [],
    pageMissingRoute: [],
    routeOnComponent: [],
    routeNotStartingWithSlash: [],
    statusNotDiscovered: [],
    childShapeViolations: [],
    childNameNotPascalCase: [],
    childComponentMissingPaths: [],
    childPathHasNoTopLevelEntry: [],
    descriptionBlocklistHits: [],
    descriptionEmpty: [],
  };

  if (!raw || typeof raw !== 'object') {
    findings.shapeOk = false;
    findings.shapeIssues.push('Top-level value is not an object');
    return findings;
  }
  const doc = raw as DiscoveryDoc;
  if (doc.version !== 1) {
    findings.shapeIssues.push(`version is ${JSON.stringify(doc.version)} — must be the integer 1`);
  }
  if (typeof doc.scannedAt !== 'string') {
    findings.shapeIssues.push('scannedAt missing or non-string');
  }
  if (!Array.isArray(doc.entries)) {
    findings.shapeOk = false;
    findings.shapeIssues.push('entries missing or not an array');
    return findings;
  }
  findings.shapeOk = findings.shapeIssues.length === 0;

  const entries = doc.entries as DiscoveryEntry[];
  findings.entryCount = entries.length;

  const seenIds = new Set<string>();
  const idsByPath = new Map<string, string[]>();
  const topLevelPaths = new Set<string>();
  for (const e of entries) {
    if (typeof e.path === 'string') topLevelPaths.add(normalizePath(e.path));
  }

  for (const e of entries) {
    const id = typeof e.id === 'string' ? e.id : '<unknown>';
    const required = ['id', 'name', 'path', 'type', 'description', 'status', 'childComponents'];
    const missing = required.filter((k) => (e as Record<string, unknown>)[k] === undefined);
    if (missing.length) findings.missingFields.push({ id, missing });

    if (typeof e.id === 'string') {
      if (seenIds.has(e.id)) findings.duplicateIds.push(e.id);
      seenIds.add(e.id);
      if (!KEBAB_RE.test(e.id)) findings.badIds.push(e.id);
    }

    if (typeof e.name === 'string' && !isTitleCase(e.name)) findings.badNames.push(`${id}: "${e.name}"`);

    if (typeof e.path === 'string') {
      const norm = normalizePath(e.path);
      const list = idsByPath.get(norm) ?? [];
      list.push(id);
      idsByPath.set(norm, list);

      const abs = path.resolve(cwd, e.path);
      if (!fs.existsSync(abs)) findings.pathsNotOnDisk.push(`${id}: ${e.path}`);
      if (violatesSkipRules(e.path, playgroundRel)) findings.skipRuleViolations.push(`${id}: ${e.path}`);
    }

    if (e.type !== 'page' && e.type !== 'component') {
      findings.badType.push(`${id}: type=${JSON.stringify(e.type)}`);
    }
    if (e.type === 'page') {
      if (typeof e.route !== 'string') {
        findings.pageMissingRoute.push(id);
      } else if (!e.route.startsWith('/')) {
        findings.routeNotStartingWithSlash.push(`${id}: route="${e.route}"`);
      }
    }
    if (e.type === 'component' && e.route !== undefined) {
      findings.routeOnComponent.push(id);
    }
    if (e.status !== 'discovered' && e.status !== 'added') {
      findings.statusNotDiscovered.push(`${id}: status=${JSON.stringify(e.status)}`);
    }

    if (typeof e.description === 'string') {
      if (!e.description.trim()) {
        findings.descriptionEmpty.push(id);
      } else {
        const lower = e.description.toLowerCase();
        const hits = DESCRIPTION_BLOCKLIST.filter((tok) => lower.includes(tok));
        if (hits.length) findings.descriptionBlocklistHits.push({ entryId: id, tokens: hits });
      }
    }

    if (Array.isArray(e.childComponents)) {
      e.childComponents.forEach((c, idx) => {
        if (c === null || typeof c !== 'object' || Array.isArray(c)) {
          findings.childShapeViolations.push({
            entryId: id,
            index: idx,
            reason: 'not an object',
            value: c,
          });
          return;
        }
        const child = c as { name?: unknown; path?: unknown };
        if (typeof child.name !== 'string') {
          findings.childShapeViolations.push({
            entryId: id,
            index: idx,
            reason: 'name missing or non-string',
            value: c,
          });
        } else if (!PASCAL_RE.test(child.name)) {
          findings.childNameNotPascalCase.push({ entryId: id, childName: child.name });
        }
        if (typeof child.path !== 'string') {
          findings.childShapeViolations.push({
            entryId: id,
            index: idx,
            reason: 'path missing or non-string',
            value: c,
          });
          return;
        }
        const abs = path.resolve(cwd, child.path);
        if (!fs.existsSync(abs)) {
          findings.childComponentMissingPaths.push({ entryId: id, childPath: child.path });
        }
        if (!topLevelPaths.has(normalizePath(child.path))) {
          findings.childPathHasNoTopLevelEntry.push({ entryId: id, childPath: child.path });
        }
      });
    }
  }

  for (const [p, ids] of idsByPath) {
    if (ids.length > 1) findings.duplicatePaths.push({ path: p, ids });
  }

  return findings;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

function isTitleCase(s: string): boolean {
  if (!s.trim()) return false;
  return s
    .split(/\s+/)
    .every((w) => /^[A-Z0-9][A-Za-z0-9]*$/.test(w) || /^(of|and|the|a|an|for|in|on|to)$/i.test(w));
}

function violatesSkipRules(p: string, playgroundRel: string): boolean {
  const norm = p.replace(/\\/g, '/');
  if (norm.startsWith(playgroundRel + '/')) return true;
  if (/(^|\/)src\/app\/api\//.test(norm) || /(^|\/)app\/api\//.test(norm)) return true;
  const base = norm.split('/').pop() ?? '';
  if (SPECIAL_FILES.has(base)) return true;
  return false;
}
