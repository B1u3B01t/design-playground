'use client';

import { useEffect, useState } from 'react';
import type { PlaygroundSkill } from '../skills';
import { SKILLS_CHANGED_EVENT } from '../lib/constants';

// ---------------------------------------------------------------------------
// useSkills — shared, deduped skills fetch
// ---------------------------------------------------------------------------
// Both chat surfaces (CursorChat and DockedChatBar) need the skills catalog.
// A module-level cache + in-flight promise means they share a single
// `/playground/api/skills` request instead of each firing their own. Refreshes
// when a SKILLS_CHANGED_EVENT is dispatched (skill added/removed).
// ---------------------------------------------------------------------------

let cache: PlaygroundSkill[] | null = null;
let inflight: Promise<PlaygroundSkill[]> | null = null;

function loadSkills(): Promise<PlaygroundSkill[]> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetch('/playground/api/skills')
    .then((res) => (res.ok ? res.json() : { skills: [] }))
    .then((data: { skills?: PlaygroundSkill[] }) => {
      cache = Array.isArray(data?.skills) ? data.skills : [];
      return cache;
    })
    .catch(() => {
      cache = cache ?? [];
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useSkills(): PlaygroundSkill[] {
  const [skills, setSkills] = useState<PlaygroundSkill[]>(() => cache ?? []);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      loadSkills().then((s) => {
        if (!cancelled) setSkills(s);
      });
    load();

    // Invalidate + refetch when the catalog changes. Nulling only `cache`
    // (not `inflight`) lets concurrent listeners dedupe onto one request.
    const onChanged = () => {
      cache = null;
      load();
    };
    window.addEventListener(SKILLS_CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(SKILLS_CHANGED_EVENT, onChanged);
    };
  }, []);

  return skills;
}
