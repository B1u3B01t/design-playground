'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { toast } from 'sonner';
import PlaygroundSidebar from './PlaygroundSidebar';
import PlaygroundCanvas from './PlaygroundCanvas';
import PlaygroundHeader from './PlaygroundHeader';
import DiscoveryModal, { type DiscoveryEntry } from './DiscoveryModal';
import { getProviderFields } from './lib/generation-body';
import { matchesAction } from './lib/keybindings';
import { ADD_ALL_QUEUE_STORAGE_KEY } from './lib/constants';
import { preloadAllComponents } from './registry';

export interface PendingChild {
  id: string;
  name: string;
  path: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
}

export default function PlaygroundClient() {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [pendingChildren, setPendingChildren] = useState<Map<string, PendingChild[]>>(new Map());
  const hasScanTriggered = useRef(false);
  const scanPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (scanPollRef.current) clearTimeout(scanPollRef.current);
    };
  }, []);

  // Preload all dynamic components to prevent HMR cascades on first drop
  useEffect(() => {
    const schedule = typeof requestIdleCallback === 'function'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 100);
    const id = schedule(() => preloadAllComponents());
    return () => {
      if (typeof cancelIdleCallback === 'function' && typeof id === 'number') {
        cancelIdleCallback(id);
      }
    };
  }, []);

  // Sidebar toggle keybinding
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (matchesAction(e, 'sidebar.toggle')) {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Auto-scan on first visit
  useEffect(() => {
    if (hasScanTriggered.current) return;
    hasScanTriggered.current = true;

    (async () => {
      try {
        const res = await fetch('/playground/api/discover');
        const data = await res.json();

        if (data.status === 'not_scanned') {
          const scanToastId = toast.loading('Scanning your project for components…', {
            duration: Infinity,
          });

          try {
            const scanRes = await fetch('/playground/api/discover', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...getProviderFields() }),
            });
            const scanData = await scanRes.json();

            if (scanData.success && scanData.entries) {
              const pages = scanData.entries.filter((e: { type: string }) => e.type === 'page');
              const components = scanData.entries.filter((e: { type: string }) => e.type === 'component');

              toast.success(
                `Found ${pages.length} page${pages.length !== 1 ? 's' : ''} and ${components.length} component${components.length !== 1 ? 's' : ''}`,
                {
                  id: scanToastId,
                  duration: 5000,
                  action: {
                    label: 'View',
                    onClick: () => setDiscoveryOpen(true),
                  },
                },
              );
            } else {
              toast.error(scanData.error || 'Scan failed', {
                id: scanToastId,
                duration: 4000,
              });
            }
          } catch {
            toast.error('Failed to scan project', {
              id: scanToastId,
              duration: 4000,
            });
          }
        } else if (data.status === 'scanning') {
          // A scan was already running (e.g. from a previous session) — join it with a toast
          const scanToastId = toast.loading('Scanning your project for components…', {
            duration: Infinity,
          });

          const poll = async () => {
            try {
              const r = await fetch('/playground/api/discover');
              const d = await r.json();
              if (d.status === 'complete' && d.entries) {
                const pages = d.entries.filter((e: { type: string }) => e.type === 'page');
                const components = d.entries.filter((e: { type: string }) => e.type === 'component');
                toast.success(
                  `Found ${pages.length} page${pages.length !== 1 ? 's' : ''} and ${components.length} component${components.length !== 1 ? 's' : ''}`,
                  {
                    id: scanToastId,
                    duration: 5000,
                    action: { label: 'View', onClick: () => setDiscoveryOpen(true) },
                  },
                );
              } else if (d.status === 'scanning') {
                scanPollRef.current = setTimeout(poll, 2500);
              } else {
                toast.dismiss(scanToastId);
              }
            } catch {
              toast.dismiss(scanToastId);
            }
          };
          scanPollRef.current = setTimeout(poll, 2500);
        }
      } catch {
        // Silently fail — discovery is optional
      }
    })();
  }, []);

  // Notify sidebar to refresh discovered components
  const notifySidebar = useCallback(() => {
    window.dispatchEvent(new CustomEvent('playground:discovery-updated'));
  }, []);

  // Analyze a list of child components sequentially, showing them as pending in the sidebar.
  const analyzeChildren = useCallback(async (
    parentRegistryId: string,
    children: { id: string; name: string; path: string }[],
  ) => {
    if (children.length === 0) return;

    const initialPending: PendingChild[] = children.map((c) => ({
      id: c.id,
      name: c.name,
      path: c.path,
      status: 'pending' as const,
    }));

    setPendingChildren((prev) => {
      const next = new Map(prev);
      next.set(parentRegistryId, initialPending);
      return next;
    });

    for (let i = 0; i < children.length; i++) {
      const child = children[i];

      // Update status to 'analyzing'
      setPendingChildren((prev) => {
        const next = new Map(prev);
        const list = [...(next.get(parentRegistryId) || [])];
        list[i] = { ...list[i], status: 'analyzing' };
        next.set(parentRegistryId, list);
        return next;
      });

      try {
        const childRes = await fetch('/playground/api/discover/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: child.id,
            path: child.path,
            name: child.name,
            type: 'component',
            // Pass parent's registry ID so the child's registry entry references
            // the correct parent ID for sidebar nesting.
            parentId: parentRegistryId,
            ...getProviderFields(),
          }),
        });
        const childData = await childRes.json();

        setPendingChildren((prev) => {
          const next = new Map(prev);
          const list = [...(next.get(parentRegistryId) || [])];
          list[i] = { ...list[i], status: childData.success ? 'done' : 'error' };
          next.set(parentRegistryId, list);
          return next;
        });

        if (childData.success) {
          notifySidebar();
        }
      } catch {
        setPendingChildren((prev) => {
          const next = new Map(prev);
          const list = [...(next.get(parentRegistryId) || [])];
          list[i] = { ...list[i], status: 'error' };
          next.set(parentRegistryId, list);
          return next;
        });
      }
    }

    // Clear pending children after all are done
    setPendingChildren((prev) => {
      const next = new Map(prev);
      next.delete(parentRegistryId);
      return next;
    });
    notifySidebar();
  }, [notifySidebar]);

  // Catch-up: detect orphaned children (parent added, children still "discovered") and auto-analyze them.
  // This handles cases where a parent was analyzed before the child auto-analysis feature existed.
  const hasCatchupRun = useRef(false);
  useEffect(() => {
    if (hasCatchupRun.current) return;
    hasCatchupRun.current = true;

    (async () => {
      try {
        const res = await fetch('/playground/api/discover');
        const data = await res.json();
        if (data.status !== 'complete' || !data.entries) return;

        const entries: DiscoveryEntry[] = data.entries;

        // Find parent entries that are "added" and have children still "discovered"
        for (const parent of entries) {
          if (parent.status !== 'added' || !parent.analysis?.registryId) continue;

          const parentRegistryId = parent.analysis.registryId;

          // Find child entries that reference this parent and are not yet analyzed
          const orphanedChildren = entries.filter(
            (e) => e.parentId === parent.id && e.status === 'discovered',
          );

          if (orphanedChildren.length > 0) {
            analyzeChildren(
              parentRegistryId,
              orphanedChildren.map((c) => ({ id: c.id, name: c.name, path: c.path })),
            );
          }
        }
      } catch {
        // Silently fail — catch-up is best-effort
      }
    })();
  }, [analyzeChildren]);

  // ---------------------------------------------------------------------------
  // "Add All" — persisted in sessionStorage so it survives HMR remounts.
  // When the analyze API's agent modifies registry.tsx, Next.js fires HMR which
  // remounts this component. A plain async loop would be killed. Instead we
  // persist the queue in sessionStorage and resume from a useEffect on mount.
  // ---------------------------------------------------------------------------

  interface AddAllQueue {
    entries: Pick<DiscoveryEntry, 'id' | 'name' | 'path' | 'type'>[];
    currentIndex: number;
    successCount: number;
    failCount: number;
  }

  const addAllProcessingRef = useRef(false);

  const processAddAllQueue = useCallback(async () => {
    // Prevent concurrent runs (e.g. useEffect + handleAddAll both calling this)
    if (addAllProcessingRef.current) return;
    addAllProcessingRef.current = true;

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const raw = sessionStorage.getItem(ADD_ALL_QUEUE_STORAGE_KEY);
        if (!raw) return;

        const queue: AddAllQueue = JSON.parse(raw);
        const { entries, currentIndex, successCount, failCount } = queue;

        if (currentIndex >= entries.length) {
          // Done — show summary toast and clean up
          sessionStorage.removeItem(ADD_ALL_QUEUE_STORAGE_KEY);
          toast.dismiss('add-all-progress');
          if (failCount === 0) {
            toast.success(
              `Added ${successCount} component${successCount !== 1 ? 's' : ''} to playground`,
              { duration: 5000 },
            );
          } else {
            toast.warning(
              `Added ${successCount} of ${entries.length} — ${failCount} failed`,
              { duration: 5000 },
            );
          }
          return;
        }

        const entry = entries[currentIndex];
        toast.loading(
          `Setting up "${entry.name}"… (${currentIndex + 1}/${entries.length})`,
          { id: 'add-all-progress', duration: Infinity },
        );

        let success = false;
        try {
          const res = await fetch('/playground/api/discover/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: entry.id,
              path: entry.path,
              name: entry.name,
              type: entry.type,
              ...getProviderFields(),
            }),
          });
          const data = await res.json();

          if (data.success && data.entry) {
            success = true;
            notifySidebar();
            const children: { id: string; name: string; path: string }[] = data.childEntries || [];
            if (children.length > 0) {
              const parentRegistryId = data.entry.analysis?.registryId || entry.id;
              analyzeChildren(parentRegistryId, children);
            }
          }
        } catch {
          // fail — counted below
        }

        // Persist progress BEFORE state updates (HMR may fire any moment)
        const updatedQueue: AddAllQueue = {
          entries,
          currentIndex: currentIndex + 1,
          successCount: successCount + (success ? 1 : 0),
          failCount: failCount + (success ? 0 : 1),
        };
        sessionStorage.setItem(ADD_ALL_QUEUE_STORAGE_KEY, JSON.stringify(updatedQueue));

        setAddingIds((prev) => {
          const next = new Set(prev);
          next.delete(entry.id);
          return next;
        });

        // Loop continues to process next entry. If HMR kills us here,
        // the useEffect below will resume from updatedQueue on remount.
      }
    } finally {
      addAllProcessingRef.current = false;
    }
  }, [notifySidebar, analyzeChildren]);

  // Start "Add All" — saves queue to sessionStorage then processes
  const handleAddAll = useCallback((entries: DiscoveryEntry[]) => {
    const queue: AddAllQueue = {
      entries: entries.map((e) => ({ id: e.id, name: e.name, path: e.path, type: e.type })),
      currentIndex: 0,
      successCount: 0,
      failCount: 0,
    };
    sessionStorage.setItem(ADD_ALL_QUEUE_STORAGE_KEY, JSON.stringify(queue));

    setAddingIds((prev) => {
      const next = new Set(prev);
      entries.forEach((e) => next.add(e.id));
      return next;
    });

    processAddAllQueue();
  }, [processAddAllQueue]);

  // Resume "Add All" on mount (HMR recovery)
  useEffect(() => {
    const raw = sessionStorage.getItem(ADD_ALL_QUEUE_STORAGE_KEY);
    if (!raw) return;

    const queue: AddAllQueue = JSON.parse(raw);
    const remaining = queue.entries.slice(queue.currentIndex);
    if (remaining.length > 0) {
      setAddingIds((prev) => {
        const next = new Set(prev);
        remaining.forEach((e) => next.add(e.id));
        return next;
      });
      processAddAllQueue();
    } else {
      // Queue was complete — clean up
      sessionStorage.removeItem(ADD_ALL_QUEUE_STORAGE_KEY);
    }
  }, [processAddAllQueue]);

  // Add a component — runs at the PlaygroundClient level so it persists across modal open/close
  const handleAddComponent = useCallback(async (entry: DiscoveryEntry) => {
    setAddingIds((prev) => new Set(prev).add(entry.id));

    const toastId = toast.loading(`Setting up "${entry.name}"…`, {
      duration: Infinity,
    });

    try {
      const res = await fetch('/playground/api/discover/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          path: entry.path,
          name: entry.name,
          type: entry.type,
          ...getProviderFields(),
        }),
      });

      const data = await res.json();

      if (data.success && data.entry) {
        toast.success(`"${entry.name}" added to playground`, {
          id: toastId,
          duration: 4000,
        });
        notifySidebar();

        // Handle child components — analyze them sequentially
        const children: { id: string; name: string; path: string }[] = data.childEntries || [];
        if (children.length > 0) {
          const parentRegistryId = data.entry.analysis?.registryId || entry.id;
          analyzeChildren(parentRegistryId, children);
        }
      } else {
        toast.error(data.error || `Failed to add "${entry.name}"`, {
          id: toastId,
          duration: 5000,
        });
      }
    } catch {
      toast.error(`Failed to add "${entry.name}"`, {
        id: toastId,
        duration: 5000,
      });
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  }, [notifySidebar, analyzeChildren]);

  return (
    <ReactFlowProvider>
      <div
        className="playground-main-view fixed inset-0 flex flex-col overflow-hidden z-50"
        style={{ fontFamily: 'var(--font-geist-sans), Geist, system-ui, sans-serif', background: '#f5f5f4' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
      >
        {/* Top header — full width */}
        <PlaygroundHeader sidebarVisible={sidebarVisible} onToggleSidebar={() => setSidebarVisible(!sidebarVisible)} />

        {/* Body: sidebar + canvas */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Sidebar — floating panel, not a layout column */}
          <div
            className={`absolute top-3 left-3 bottom-3 z-10 transition-all duration-[250ms] ease-in-out ${
              sidebarVisible ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 -translate-x-3 pointer-events-none'
            }`}
          >
            <PlaygroundSidebar
              onCollapse={() => setSidebarVisible(false)}
              onOpenDiscovery={() => setDiscoveryOpen(true)}
              pendingChildren={pendingChildren}
            />
          </div>

          {/* Sidebar reveal button — shown only when sidebar is hidden */}
          <button
            onClick={() => setSidebarVisible(true)}
            aria-label="Show sidebar"
            className={`group absolute top-3 left-3 z-10 flex items-center justify-center w-12 h-12 rounded-2xl bg-white border border-border text-stone-900 hover:bg-stone-50 transition-all duration-[250ms] ease-in-out ${
              sidebarVisible ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
            }`}
          >
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
              className="transition-transform duration-500 ease-in-out group-hover:rotate-90"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          </button>

          {/* Canvas — always full size, sidebar overlays */}
          <div className="flex-1 relative">
            <PlaygroundCanvas />
          </div>
        </div>
      </div>

      {/* Discovery modal */}
      <DiscoveryModal
        open={discoveryOpen}
        onOpenChange={setDiscoveryOpen}
        addingIds={addingIds}
        onAdd={handleAddComponent}
        onAddAll={handleAddAll}
      />

    </ReactFlowProvider>
  );
}
