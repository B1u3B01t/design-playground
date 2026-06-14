'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { toast, Toaster } from 'sonner';
import PlaygroundSidebar from './PlaygroundSidebar';
import PlaygroundCanvas from './PlaygroundCanvas';
import PlaygroundHeader from './PlaygroundHeader';
import DiscoveryModal, { type DiscoveryEntry } from './DiscoveryModal';
import SkillsCatalogModal from './SkillsCatalogModal';
import { getProviderFields } from './lib/generation-body';
import { matchesAction } from './lib/keybindings';
import {
  ADD_ALL_QUEUE_STORAGE_KEY,
  ITERATION_PROMPT_COPIED_EVENT,
  OPEN_SKILLS_CATALOG_EVENT,
  SKILLS_CHANGED_EVENT,
  STORAGE_KEY,
} from './lib/constants';
import {
  captureClient,
  fetchTelemetryStatus,
  setTelemetryEnabledClient,
} from './lib/telemetry/client';
import { startActivityTracking } from './lib/telemetry/activity';
import {
  TELEMETRY_DOCS_URL,
  TELEMETRY_NOTICE_ACK_KEY,
  TELEMETRY_SESSION_SENT_KEY,
} from './lib/telemetry/constants';
import { preloadAllComponents } from './registry';
import { LiveblocksProvider, RoomProvider } from '@liveblocks/react';
import { liveblocksAuth } from './liveblocks.config';
import { MultiplayerProvider, type MultiplayerState } from './lib/multiplayer-context';
import { CanvasFlowProvider } from './lib/canvas-flow';
import { GenerationPresenceBridge } from './lib/presence';
import './lib/ngrok-headers';
import { LiveblocksSetupGuard } from './lib/liveblocks-setup';

export interface PendingChild {
  id: string;
  name: string;
  path: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
}

function getSidebarVisibilityStorageKey(projectId?: string) {
  return `${projectId ? `${STORAGE_KEY}:${projectId}` : STORAGE_KEY}:sidebar-visible`;
}

function loadSidebarVisibility(storageKey: string) {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored == null ? true : stored === '1';
  } catch {
    return true;
  }
}

export default function PlaygroundClient({
  projectId,
  roomId,
  isHost = false,
}: {
  projectId?: string;
  roomId?: string;
  isHost?: boolean;
} = {}) {
  const sidebarVisibilityStorageKey = getSidebarVisibilityStorageKey(projectId);
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(() =>
    loadSidebarVisibility(sidebarVisibilityStorageKey),
  );
  /** Whether sidebar was opened via hover (auto-hide) vs click (sticky). */
  const sidebarHoverRef = useRef(false);
  const sidebarHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [skillsCatalogOpen, setSkillsCatalogOpen] = useState(false);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [pendingChildren, setPendingChildren] = useState<Map<string, PendingChild[]>>(new Map());
  const hasScanTriggered = useRef(false);
  const scanPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(sidebarVisibilityStorageKey, sidebarVisible ? '1' : '0');
    } catch {
      // Ignore storage failures and keep runtime behavior unchanged.
    }
  }, [sidebarVisibilityStorageKey, sidebarVisible]);

  const cancelSidebarHideTimer = useCallback(() => {
    if (sidebarHideTimerRef.current) {
      clearTimeout(sidebarHideTimerRef.current);
      sidebarHideTimerRef.current = null;
    }
  }, []);

  const handleShowSidebar = useCallback(() => {
    cancelSidebarHideTimer();
    if (!sidebarVisible) {
      sidebarHoverRef.current = true;
      setSidebarVisible(true);
    }
  }, [sidebarVisible, cancelSidebarHideTimer]);

  const startSidebarHideTimer = useCallback(() => {
    if (!sidebarHoverRef.current) return;
    cancelSidebarHideTimer();
    sidebarHideTimerRef.current = setTimeout(() => {
      setSidebarVisible(false);
      sidebarHoverRef.current = false;
    }, 120);
  }, [cancelSidebarHideTimer]);

  const handleToggleSidebar = useCallback((forceOpen = false) => {
    cancelSidebarHideTimer();
    setSidebarVisible((visible) => {
      if (forceOpen) {
        sidebarHoverRef.current = false;
        return true;
      }

      if (!visible) {
        sidebarHoverRef.current = false;
        return true;
      }

      sidebarHoverRef.current = false;
      return false;
    });
  }, [cancelSidebarHideTimer]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (scanPollRef.current) clearTimeout(scanPollRef.current);
      if (sidebarHideTimerRef.current) clearTimeout(sidebarHideTimerRef.current);
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
        handleToggleSidebar();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleToggleSidebar]);

  // Listen for requests to open the Skills catalog
  useEffect(() => {
    const handler = () => setSkillsCatalogOpen(true);
    window.addEventListener(OPEN_SKILLS_CATALOG_EVENT, handler);
    return () => window.removeEventListener(OPEN_SKILLS_CATALOG_EVENT, handler);
  }, []);

  // Anonymous dev telemetry: session start, time tracking, first-run notice.
  // Guests (room link without host=1) are never recorded — they never saw a
  // consent notice. Everything here is content-free; see TELEMETRY.md.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (roomId && !isHost) return;

    if (!sessionStorage.getItem(TELEMETRY_SESSION_SENT_KEY)) {
      sessionStorage.setItem(TELEMETRY_SESSION_SENT_KEY, '1');
      captureClient('session_started', { multiplayer_enabled: !!roomId });
      if (roomId && isHost) {
        captureClient('feature_used', { feature: 'multiplayer_session_started' });
      }
    }

    const stopActivityTracking = startActivityTracking();

    const onPromptCopied = () => {
      captureClient('feature_used', { feature: 'prompt_copied' });
    };
    window.addEventListener(ITERATION_PROMPT_COPIED_EVENT, onPromptCopied);

    // One-time in-app notice (catches users who missed the terminal notice).
    if (!localStorage.getItem(TELEMETRY_NOTICE_ACK_KEY)) {
      void fetchTelemetryStatus().then((status) => {
        if (!status?.enabled) return;
        if (localStorage.getItem(TELEMETRY_NOTICE_ACK_KEY)) return;
        localStorage.setItem(TELEMETRY_NOTICE_ACK_KEY, '1');
        toast.info('Anonymous usage telemetry is enabled in dev', {
          description:
            'Counts and timings only — never prompts, code, or file names. See TELEMETRY.md.',
          duration: 12000,
          action: {
            label: 'Disable',
            onClick: () => {
              void setTelemetryEnabledClient(false).then((ok) => {
                if (ok) toast.success('Telemetry disabled on this machine');
              });
            },
          },
        });
        // Surface the docs link for the curious without cluttering the toast.
        console.info(`[playground] Telemetry details: ${TELEMETRY_DOCS_URL}`);
      });
    }

    return () => {
      stopActivityTracking();
      window.removeEventListener(ITERATION_PROMPT_COPIED_EVENT, onPromptCopied);
    };
  }, [roomId, isHost]);

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
            closeButton: true,
            dismissible: true,
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
            closeButton: true,
            dismissible: true,
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
          { id: 'add-all-progress', duration: Infinity, closeButton: true, dismissible: true },
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
      closeButton: true,
      dismissible: true,
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

  const body = (
    <ReactFlowProvider>
      <div
        className="playground-main-view fixed inset-0 flex flex-col overflow-hidden z-50"
        style={{ fontFamily: 'var(--font-geist-sans), Geist, system-ui, sans-serif', background: '#f5f5f4' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
      >
        {/* Top header — full width */}
        <PlaygroundHeader sidebarVisible={sidebarVisible} onToggleSidebar={handleToggleSidebar} />

        {/* Body: sidebar + canvas */}
        {/* Rail: inset 1.5rem (= left-6), toolbar outer width ~54px, tight gap */}
        <div className="flex flex-1 overflow-hidden relative">
          <div
            className={`absolute left-[calc(1.5rem+54px+0.5rem)] top-6 bottom-6 z-10 transition-all duration-[160ms] ease-out ${
              sidebarVisible ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 -translate-x-3 pointer-events-none'
            }`}
            onMouseEnter={cancelSidebarHideTimer}
            onMouseLeave={startSidebarHideTimer}
          >
            <PlaygroundSidebar
              onCollapse={() => {
                cancelSidebarHideTimer();
                sidebarHoverRef.current = false;
                setSidebarVisible(false);
              }}
              onOpenDiscovery={() => setDiscoveryOpen(true)}
              pendingChildren={pendingChildren}
            />
          </div>

          {/* Canvas — always full size, sidebar overlays */}
          <div className="flex-1 relative">
            <CanvasFlowProvider storageKey={projectId ? `${STORAGE_KEY}:${projectId}` : STORAGE_KEY}>
              <PlaygroundCanvas
                sidebarVisible={sidebarVisible}
                onToggleSidebar={handleToggleSidebar}
                onShowSidebar={handleShowSidebar}
                onHideSidebar={startSidebarHideTimer}
                projectId={projectId}
              />
            </CanvasFlowProvider>
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

      {/* Skills catalog modal */}
      <SkillsCatalogModal
        open={skillsCatalogOpen}
        onOpenChange={setSkillsCatalogOpen}
        onSkillsChanged={() => {
          window.dispatchEvent(new CustomEvent(SKILLS_CHANGED_EVENT));
        }}
      />
    </ReactFlowProvider>
  );

  const multiplayer: MultiplayerState = {
    enabled: !!roomId,
    isHost,
    roomId: roomId ?? null,
  };

  const toaster = <Toaster position="bottom-right" richColors closeButton />;

  // Single-player: no Liveblocks providers, just expose a (disabled) multiplayer context.
  if (!roomId) {
    return (
      <>
        {toaster}
        <MultiplayerProvider value={multiplayer}>{body}</MultiplayerProvider>
      </>
    );
  }

  // Multiplayer: mount Liveblocks providers around the existing canvas. Storage for the
  // canvas is created lazily by useLiveblocksFlow (no initialStorage needed); we use the
  // non-suspense hooks everywhere, so no ClientSideSuspense boundary is required.
  return (
    <>
      {toaster}
      <LiveblocksProvider authEndpoint={liveblocksAuth}>
        <RoomProvider
          id={roomId}
          initialPresence={{ cursor: null, selection: [], generating: false }}
        >
          <MultiplayerProvider value={multiplayer}>
            <LiveblocksSetupGuard />
            <GenerationPresenceBridge />
            {body}
          </MultiplayerProvider>
        </RoomProvider>
      </LiveblocksProvider>
    </>
  );
}
