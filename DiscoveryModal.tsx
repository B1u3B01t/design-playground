'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Check, Loader2, Plus, RefreshCw, Search, FileText, Layers, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscoveryEntry {
  id: string;
  name: string;
  path: string;
  type: 'page' | 'component';
  route?: string;
  description: string;
  status: 'discovered' | 'adding' | 'added';
  analysis?: {
    showcasePath: string;
    componentName: string;
    discoveredFilename: string;
    propsInterface: string;
    size: string;
  };
}

interface DiscoveryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addingIds: Set<string>;
  onAdd: (entry: DiscoveryEntry) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBreadcrumb(filePath: string): string {
  return filePath
    .replace(/^src\//, '')
    .replace(/\/page\.tsx$/, '')
    .replace(/\.tsx$/, '')
    .split('/')
    .join(' / ');
}

// ---------------------------------------------------------------------------
// Entry card component
// ---------------------------------------------------------------------------

function DiscoveryCard({
  entry,
  isAdding,
  onAdd,
}: {
  entry: DiscoveryEntry;
  isAdding: boolean;
  onAdd: (entry: DiscoveryEntry) => void;
}) {
  const isAdded = entry.status === 'added';

  return (
    <div className="group flex items-start gap-3 px-4 py-3.5 rounded-xl bg-stone-50/60 border border-stone-100 hover:border-stone-200 hover:bg-stone-50 transition-all">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[13px] font-semibold text-stone-800">
            {entry.name}
          </span>
          {entry.route && (
            <span className="text-[10px] font-medium text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full">
              {entry.route}
            </span>
          )}
        </div>
        {!entry.route && (
          <p className="text-[11px] text-stone-400 font-mono">
            {formatBreadcrumb(entry.path)}
          </p>
        )}
        {entry.description && (
          <p className="text-[12px] text-stone-500 mt-1.5 leading-relaxed">
            {entry.description}
          </p>
        )}
      </div>

      <div className="shrink-0 pt-0.5">
        {isAdded ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-100">
            <Check className="w-3 h-3 text-emerald-600" />
            <span className="text-[11px] font-medium text-emerald-700">Added</span>
          </div>
        ) : isAdding ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-stone-100 border border-stone-150">
            <Loader2 className="w-3 h-3 animate-spin text-stone-500" />
            <span className="text-[11px] text-stone-500">Setting up…</span>
          </div>
        ) : (
          <button
            onClick={() => onAdd(entry)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium text-stone-500 bg-white border border-stone-200 hover:text-stone-800 hover:border-stone-300 hover:shadow-sm transition-all"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

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
// Main modal
// ---------------------------------------------------------------------------

export default function DiscoveryModal({
  open,
  onOpenChange,
  addingIds,
  onAdd,
}: DiscoveryModalProps) {
  const [entries, setEntries] = useState<DiscoveryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/playground/api/discover');
      const data = await res.json();
      if (data.status === 'complete' && data.entries) {
        setEntries(data.entries);
      } else if (data.status === 'not_scanned') {
        setEntries([]);
      }
    } catch {
      setError('Failed to load components');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchEntries();
  }, [open, fetchEntries]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/playground/api/discover', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.entries) {
        setEntries(data.entries);
      } else {
        setError(data.error || 'Scan failed');
      }
    } catch {
      setError('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Merge server entries with the parent's addingIds for display
  const mergedEntries = useMemo(
    () =>
      entries.map((e) =>
        addingIds.has(e.id) && e.status !== 'added'
          ? { ...e, status: 'adding' as const }
          : e,
      ),
    [entries, addingIds],
  );

  // Filter
  const lowerSearch = search.toLowerCase();
  const filtered = mergedEntries.filter(
    (e) =>
      e.name.toLowerCase().includes(lowerSearch) ||
      e.description?.toLowerCase().includes(lowerSearch),
  );

  const pages = filtered.filter((e) => e.type === 'page');
  const components = filtered.filter((e) => e.type === 'component');
  const isEmpty = entries.length === 0 && !isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-xl max-h-[85vh] flex flex-col overflow-hidden !rounded-2xl !p-0">
        {/* Header area */}
        <div className="px-6 pt-6 pb-4 space-y-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="!text-base">Add to Playground</DialogTitle>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all disabled:opacity-50"
                  aria-label="Rescan project"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
                <DialogClose className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all">
                  <X className="w-4 h-4" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>
            </div>
            <DialogDescription>
              {isRefreshing
                ? 'Scanning your project…'
                : entries.length > 0
                  ? `Found ${pages.length} page${pages.length !== 1 ? 's' : ''} and ${components.length} component${components.length !== 1 ? 's' : ''} in your project`
                  : 'Discover components and pages in your project'}
            </DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search components…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300/50 focus:border-stone-300 transition-all"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
            <p className="text-[12px] text-red-600 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 text-stone-300 animate-spin" />
              <p className="text-[13px] text-stone-400">Loading components…</p>
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center">
                <Layers className="w-6 h-6 text-stone-400" />
              </div>
              <p className="text-[14px] font-medium text-stone-600 text-center">No components found</p>
              <p className="text-[12px] text-stone-400 text-center max-w-[280px] leading-relaxed">
                Add pages or components to your project, then scan to discover them
              </p>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="mt-1 px-4 py-2 text-[12px] font-medium text-white bg-stone-800 rounded-xl hover:bg-stone-700 transition-all disabled:opacity-50"
              >
                {isRefreshing ? 'Scanning…' : 'Scan project'}
              </button>
            </div>
          ) : (
            <>
              {/* Pages section */}
              {pages.length > 0 && (
                <div>
                  <SectionHeader icon={FileText} label="Pages" count={pages.length} />
                  <div className="space-y-2">
                    {pages.map((entry) => (
                      <DiscoveryCard
                        key={entry.id}
                        entry={entry}
                        isAdding={addingIds.has(entry.id)}
                        onAdd={onAdd}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Components section */}
              {components.length > 0 && (
                <div>
                  <SectionHeader icon={Layers} label="Components" count={components.length} />
                  <div className="space-y-2">
                    {components.map((entry) => (
                      <DiscoveryCard
                        key={entry.id}
                        entry={entry}
                        isAdding={addingIds.has(entry.id)}
                        onAdd={onAdd}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Filtered empty state */}
              {filtered.length === 0 && entries.length > 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-[13px] text-stone-400">
                    No results for &ldquo;{search}&rdquo;
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isEmpty && !isLoading && (
          <div className="px-6 py-3 border-t border-stone-100 bg-stone-50/50">
            <p className="text-[11px] text-stone-400 text-center select-none">
              Click Add to analyze and prepare a component for the playground
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
