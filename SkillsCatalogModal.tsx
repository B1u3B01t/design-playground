'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, Search, Toolbox, Package, Link2, X, Trash2, ExternalLink, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { getSkillBubbleStyle } from './lib/skill-icons';
import { FEATURED_SKILLS, type FeaturedSkill } from './lib/featured-skills';
import type { PlaygroundSkill } from './skills';

interface SkillsCatalogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after any add/remove succeeds so the parent can refresh its skill list. */
  onSkillsChanged?: () => void;
}

type Tab = 'installed' | 'browse' | 'url';

interface InstalledSkill extends PlaygroundSkill {
  source?: 'builtin' | 'user';
}

interface PreviewedSkill {
  source: string;
  /** Empty string for single-skill-at-root repos. */
  skill: string;
  name: string;
  description: string;
  url: string;
  /** True when SKILL.md lives at the repo root; install the whole repo. */
  isRootSkill?: boolean;
}

// ---------------------------------------------------------------------------
// Shared row
// ---------------------------------------------------------------------------

function SkillRow({
  id,
  name,
  description,
  meta,
  trailing,
}: {
  id: string;
  name: string;
  description?: string;
  meta?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="group flex items-start gap-3 px-4 py-3.5 rounded-xl bg-stone-50/60 border border-stone-100 hover:border-stone-200 hover:bg-stone-50 transition-all">
      <span style={getSkillBubbleStyle(id, 28)} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[13px] font-semibold text-stone-800 truncate">{name}</span>
          {meta && (
            <span className="text-[10px] font-medium text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
              {meta}
            </span>
          )}
        </div>
        {description && (
          <p className="text-[12px] text-stone-500 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="shrink-0 pt-0.5">{trailing}</div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  label,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 px-1 pt-4 pb-2">
      <Icon className="w-3.5 h-3.5 text-stone-400" />
      <span className="text-[11px] font-semibold tracking-wider uppercase text-stone-400 select-none">
        {label}
      </span>
      <span className="text-[10px] text-stone-300 bg-stone-100 px-1.5 py-0.5 rounded-full font-medium">
        {count}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export default function SkillsCatalogModal({
  open,
  onOpenChange,
  onSkillsChanged,
}: SkillsCatalogModalProps) {
  const [tab, setTab] = useState<Tab>('browse');
  const [installed, setInstalled] = useState<InstalledSkill[]>([]);
  const [isLoadingInstalled, setIsLoadingInstalled] = useState(false);
  const [search, setSearch] = useState('');
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  // From URL tab
  const [urlInput, setUrlInput] = useState('');
  const [urlPreview, setUrlPreview] = useState<PreviewedSkill[] | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const previewAbortRef = useRef<AbortController | null>(null);

  const installedIds = useMemo(() => new Set(installed.map((s) => s.id)), [installed]);

  const fetchInstalled = useCallback(async () => {
    setIsLoadingInstalled(true);
    try {
      const res = await fetch('/playground/api/skills');
      const data = (await res.json()) as { skills?: InstalledSkill[] };
      if (Array.isArray(data.skills)) setInstalled(data.skills);
    } catch {
      // ignored — UI shows empty state
    } finally {
      setIsLoadingInstalled(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchInstalled();
  }, [open, fetchInstalled]);

  const markBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

  const handleAdd = useCallback(
    async (source: string, displayName: string, dedupeId: string) => {
      markBusy(dedupeId, true);
      const toastId = toast.loading(`Adding ${displayName}…`);
      try {
        const res = await fetch('/playground/api/skills/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Failed to add skill', { id: toastId, duration: 5000 });
          return;
        }
        toast.success(`Added ${displayName}`, { id: toastId, duration: 3000 });
        await fetchInstalled();
        onSkillsChanged?.();
      } catch {
        toast.error('Failed to add skill', { id: toastId, duration: 5000 });
      } finally {
        markBusy(dedupeId, false);
      }
    },
    [fetchInstalled, onSkillsChanged],
  );

  const handleUpdate = useCallback(
    async (id: string, displayName: string) => {
      markBusy(id, true);
      const toastId = toast.loading(`Updating ${displayName}…`);
      try {
        const res = await fetch('/playground/api/skills/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Failed to update skill', { id: toastId, duration: 5000 });
          return;
        }
        toast.success(`${displayName} is up to date`, { id: toastId, duration: 3000 });
        await fetchInstalled();
        onSkillsChanged?.();
      } catch {
        toast.error('Failed to update skill', { id: toastId, duration: 5000 });
      } finally {
        markBusy(id, false);
      }
    },
    [fetchInstalled, onSkillsChanged],
  );

  const handleRemove = useCallback(
    async (skill: InstalledSkill) => {
      markBusy(skill.id, true);
      const toastId = toast.loading(`Removing ${skill.label}…`);
      try {
        const res = await fetch('/playground/api/skills/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: skill.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Failed to remove skill', { id: toastId, duration: 5000 });
          return;
        }
        toast.success(`Removed ${skill.label}`, { id: toastId, duration: 3000 });
        await fetchInstalled();
        onSkillsChanged?.();
      } catch {
        toast.error('Failed to remove skill', { id: toastId, duration: 5000 });
      } finally {
        markBusy(skill.id, false);
      }
    },
    [fetchInstalled, onSkillsChanged],
  );

  // Debounced preview
  useEffect(() => {
    if (tab !== 'url') return;
    if (!urlInput.trim()) {
      setUrlPreview(null);
      setUrlError(null);
      return;
    }
    if (previewAbortRef.current) previewAbortRef.current.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    const handle = setTimeout(async () => {
      setIsPreviewing(true);
      setUrlError(null);
      try {
        const res = await fetch('/playground/api/skills/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: urlInput.trim() }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          setUrlPreview(null);
          setUrlError(data.error || 'Could not load preview');
        } else {
          setUrlPreview(data.skills || []);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setUrlPreview(null);
          setUrlError('Could not load preview');
        }
      } finally {
        setIsPreviewing(false);
      }
    }, 450);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [tab, urlInput]);

  // Reset URL state when leaving tab
  useEffect(() => {
    if (tab !== 'url') {
      setUrlPreview(null);
      setUrlError(null);
    }
  }, [tab]);

  // ---- Filtering ----------------------------------------------------------
  const lower = search.toLowerCase();

  const filteredInstalled = installed.filter(
    (s) =>
      !lower ||
      s.label.toLowerCase().includes(lower) ||
      s.description?.toLowerCase().includes(lower),
  );

  const filteredFeatured = FEATURED_SKILLS.filter(
    (s) =>
      !lower ||
      s.name.toLowerCase().includes(lower) ||
      s.description.toLowerCase().includes(lower),
  );

  const featuredByCategory = useMemo(() => {
    const groups = new Map<string, FeaturedSkill[]>();
    for (const s of filteredFeatured) {
      const list = groups.get(s.category) ?? [];
      list.push(s);
      groups.set(s.category, list);
    }
    return groups;
  }, [filteredFeatured]);

  // ---- Render -------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-xl max-h-[85vh] flex flex-col overflow-hidden !rounded-2xl !p-0"
      >
        <div className="px-6 pt-6 pb-4 space-y-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="!text-base">Skills</DialogTitle>
              <DialogClose className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all">
                <X className="w-4 h-4" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
            <DialogDescription>
              Add reusable creative direction to your variations. Powered by{' '}
              <a
                href="https://www.npmjs.com/package/skills"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-stone-300 underline-offset-2 hover:text-stone-700"
              >
                the skills CLI
              </a>
              .
            </DialogDescription>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 w-fit">
            <TabButton active={tab === 'browse'} onClick={() => setTab('browse')} icon={Toolbox}>
              Browse
            </TabButton>
            <TabButton active={tab === 'installed'} onClick={() => setTab('installed')} icon={Package}>
              Installed
              <span className="ml-1.5 text-[10px] text-stone-500 bg-white px-1.5 py-0.5 rounded-full">
                {installed.length}
              </span>
            </TabButton>
            <TabButton active={tab === 'url'} onClick={() => setTab('url')} icon={Link2}>
              From URL
            </TabButton>
          </div>

          {/* Search (browse + installed only) */}
          {tab !== 'url' && (
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder={tab === 'installed' ? 'Search installed skills…' : 'Search featured skills…'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300/50 focus:border-stone-300 transition-all"
              />
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
          {tab === 'browse' && (
            <BrowseTab
              groups={featuredByCategory}
              installedIds={installedIds}
              busyIds={busyIds}
              onAdd={(s) => handleAdd(s.source, s.name, s.id)}
              searchTerm={search}
              totalFiltered={filteredFeatured.length}
            />
          )}
          {tab === 'installed' && (
            <InstalledTab
              skills={filteredInstalled}
              isLoading={isLoadingInstalled}
              busyIds={busyIds}
              onRemove={handleRemove}
              onBrowse={() => setTab('browse')}
            />
          )}
          {tab === 'url' && (
            <FromUrlTab
              value={urlInput}
              onChange={setUrlInput}
              preview={urlPreview}
              error={urlError}
              isPreviewing={isPreviewing}
              installedIds={installedIds}
              busyIds={busyIds}
              onAdd={(p) => {
                const installSource = p.isRootSkill ? p.source : `${p.source}@${p.skill}`;
                const installedId = p.isRootSkill ? p.name : p.skill;
                handleAdd(installSource, p.name, installedId);
              }}
              onUpdate={(p) => handleUpdate(p.isRootSkill ? p.name : p.skill, p.name)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Tab pieces
// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
        active
          ? 'bg-white text-stone-900 shadow-sm'
          : 'text-stone-500 hover:text-stone-800'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </button>
  );
}

function BrowseTab({
  groups,
  installedIds,
  busyIds,
  onAdd,
  searchTerm,
  totalFiltered,
}: {
  groups: Map<string, FeaturedSkill[]>;
  installedIds: Set<string>;
  busyIds: Set<string>;
  onAdd: (skill: FeaturedSkill) => void;
  searchTerm: string;
  totalFiltered: number;
}) {
  if (totalFiltered === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-[13px] text-stone-400">
          {searchTerm ? `No results for “${searchTerm}”` : 'No featured skills'}
        </p>
      </div>
    );
  }
  return (
    <>
      {[...groups.entries()].map(([category, skills]) => (
        <div key={category}>
          <SectionHeader icon={Toolbox} label={category} count={skills.length} />
          <div className="space-y-2">
            {skills.map((skill) => {
              const isInstalled = installedIds.has(skill.id);
              const isBusy = busyIds.has(skill.id);
              return (
                <SkillRow
                  key={skill.id}
                  id={skill.id}
                  name={skill.name}
                  description={skill.description}
                  trailing={
                    isBusy ? (
                      <BusyPill label="Adding…" />
                    ) : isInstalled ? (
                      <InstalledPill />
                    ) : (
                      <AddButton onClick={() => onAdd(skill)} />
                    )
                  }
                />
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function InstalledTab({
  skills,
  isLoading,
  busyIds,
  onRemove,
  onBrowse,
}: {
  skills: InstalledSkill[];
  isLoading: boolean;
  busyIds: Set<string>;
  onRemove: (skill: InstalledSkill) => void;
  onBrowse: () => void;
}) {
  if (isLoading && skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-5 h-5 text-stone-300 animate-spin" />
        <p className="text-[13px] text-stone-400">Loading skills…</p>
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center">
          <Package className="w-6 h-6 text-stone-400" />
        </div>
        <p className="text-[14px] font-medium text-stone-600 text-center">No skills installed yet</p>
        <p className="text-[12px] text-stone-400 text-center max-w-[280px] leading-relaxed">
          Browse featured skills, or paste a GitHub URL to bring in your own.
        </p>
        <button
          onClick={onBrowse}
          className="mt-1 px-4 py-2 text-[12px] font-medium text-white bg-stone-800 rounded-xl hover:bg-stone-700 transition-all"
        >
          Browse skills
        </button>
      </div>
    );
  }

  const user = skills.filter((s) => s.source === 'user');
  const builtin = skills.filter((s) => s.source !== 'user');

  return (
    <>
      {user.length > 0 && (
        <div>
          <SectionHeader icon={Package} label="Added by you" count={user.length} />
          <div className="space-y-2">
            {user.map((skill) => (
              <SkillRow
                key={skill.id}
                id={skill.id}
                name={skill.label}
                description={skill.description}
                trailing={
                  busyIds.has(skill.id) ? (
                    <BusyPill label="Removing…" />
                  ) : (
                    <RemoveButton onClick={() => onRemove(skill)} />
                  )
                }
              />
            ))}
          </div>
        </div>
      )}
      {builtin.length > 0 && (
        <div>
          <SectionHeader icon={Toolbox} label="Built in" count={builtin.length} />
          <div className="space-y-2">
            {builtin.map((skill) => (
              <SkillRow
                key={skill.id}
                id={skill.id}
                name={skill.label}
                description={skill.description}
                meta="built-in"
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function FromUrlTab({
  value,
  onChange,
  preview,
  error,
  isPreviewing,
  installedIds,
  busyIds,
  onAdd,
  onUpdate,
}: {
  value: string;
  onChange: (v: string) => void;
  preview: PreviewedSkill[] | null;
  error: string | null;
  isPreviewing: boolean;
  installedIds: Set<string>;
  busyIds: Set<string>;
  onAdd: (skill: PreviewedSkill) => void;
  onUpdate: (skill: PreviewedSkill) => void;
}) {
  return (
    <div className="space-y-4 pt-1">
      <div>
        <label className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1.5 block">
          GitHub source or skills command
        </label>
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="owner/repo, a GitHub URL, or `npx skills add …`"
          className="w-full px-4 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300/50 focus:border-stone-300 transition-all font-mono"
        />
        <p className="text-[11px] text-stone-400 mt-1.5 leading-relaxed">
          Accepts <code className="font-mono text-stone-500">owner/repo</code>,{' '}
          <code className="font-mono text-stone-500">owner/repo@skill</code>, a GitHub URL, or a full{' '}
          <code className="font-mono text-stone-500">npx skills add …</code> command. Leave off the skill name to import everything in the repo.
        </p>
      </div>

      {isPreviewing && (
        <div className="flex items-center gap-2 text-[12px] text-stone-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Looking up skill…
        </div>
      )}

      {error && !isPreviewing && (
        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
          <p className="text-[12px] text-amber-700 leading-relaxed">{error}</p>
        </div>
      )}

      {preview && preview.length > 0 && !isPreviewing && (
        <div className="space-y-2">
          {preview.map((p) => {
            const installedId = p.isRootSkill ? p.name : p.skill;
            const isInstalled = installedIds.has(installedId);
            const isBusy = busyIds.has(installedId);
            return (
              <SkillRow
                key={`${p.source}@${p.skill || '__root__'}`}
                id={installedId}
                name={p.name}
                description={p.description}
                meta={p.source}
                trailing={
                  <div className="flex items-center gap-1.5">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all"
                      aria-label="View on GitHub"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    {isBusy ? (
                      <BusyPill label="Working…" />
                    ) : isInstalled ? (
                      <>
                        <UpdateButton onClick={() => onUpdate(p)} />
                        <InstalledPill />
                      </>
                    ) : (
                      <AddButton onClick={() => onAdd(p)} />
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small action pills
// ---------------------------------------------------------------------------

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium text-stone-500 bg-white border border-stone-200 hover:text-stone-800 hover:border-stone-300 hover:shadow-sm transition-all"
    >
      <Plus className="w-3 h-3" />
      Add
    </button>
  );
}

function UpdateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium text-stone-500 bg-white border border-stone-200 hover:text-stone-800 hover:border-stone-300 hover:shadow-sm transition-all"
    >
      <ArrowUpCircle className="w-3 h-3" />
      Update
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium text-stone-500 bg-white border border-stone-200 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all"
    >
      <Trash2 className="w-3 h-3" />
      Remove
    </button>
  );
}

function InstalledPill() {
  return (
    <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200">
      Installed
    </span>
  );
}

function BusyPill({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-stone-100 border border-stone-150">
      <Loader2 className="w-3 h-3 animate-spin text-stone-500" />
      <span className="text-[11px] text-stone-500">{label}</span>
    </div>
  );
}

