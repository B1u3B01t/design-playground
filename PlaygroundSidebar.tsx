'use client';

import { useState, useEffect, useMemo, useCallback, useRef, DragEvent, MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronDown, ChevronLeft, Plus, Palette, Loader2, RefreshCw, RotateCcw, Frame, FileCode, Component, Trash2 } from 'lucide-react';
import { registry, RegistryItem, RegistryLeafItem, isGroup, isLeaf } from './registry';
import {
  DND_DATA_KEY,
  HTML_ID_PREFIX,
  FOCUS_NODE_EVENT,
  JSX_ID_PREFIX,
  DELETE_FRAME_EVENT,
  DESIGN_SYSTEM_SHOWCASE_ID,
  DESIGN_SYSTEM_GENERATED_EVENT,
  GENERATION_COMPLETE_EVENT,
  JSX_COMPONENT_ADDED_EVENT,
} from './lib/constants';
import type { HtmlPageInfo, JsxComponentInfo, ComponentSize } from './lib/constants';
import type { PendingChild } from './PlaygroundClient';
import ComponentErrorBoundary from './nodes/ComponentErrorBoundary';
import DesignSystemModal from './DesignSystemModal';
import { useModelSettingsStore } from './lib/model-settings-store';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a map of parentId -> child leaf items from the registry tree. */
function buildChildrenMap(items: RegistryItem[]): Map<string, RegistryLeafItem[]> {
  const map = new Map<string, RegistryLeafItem[]>();
  function collect(list: RegistryItem[]) {
    for (const item of list) {
      if (isLeaf(item) && item.parentId) {
        const existing = map.get(item.parentId) || [];
        existing.push(item);
        map.set(item.parentId, existing);
      } else if (isGroup(item)) {
        collect(item.children);
      }
    }
  }
  collect(items);
  return map;
}

/** Flatten all leaves under a group (including nested children with parentId). */
function flattenLeaves(items: RegistryItem[]): RegistryLeafItem[] {
  const out: RegistryLeafItem[] = [];
  for (const item of items) {
    if (isLeaf(item)) out.push(item);
    else if (isGroup(item)) out.push(...flattenLeaves(item.children));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Component preview card — renders a live, scaled-down preview of the component
// ---------------------------------------------------------------------------

/** Pick a sensible viewport width for the preview based on the component's size hint. */
function pickPreviewViewport(size: ComponentSize | undefined): { width: number; height: number } {
  switch (size) {
    case 'laptop': return { width: 1470, height: 832 };
    case 'tablet': return { width: 768, height: 1024 };
    case 'mobile': return { width: 393, height: 852 };
    case 'default':
    default:       return { width: 720, height: 480 };
  }
}

interface ComponentPreviewCardProps {
  item: RegistryLeafItem;
  onPageContextMenu?: (e: MouseEvent, payload: PageContextPayload) => void;
}

function ComponentPreviewCard({ item, onPageContextMenu }: ComponentPreviewCardProps) {
  const PreviewComponent = item.Component;
  const props = (item.props ?? {}) as Record<string, unknown>;
  const viewport = pickPreviewViewport(item.size);

  // Measure the card's actual rendered width so we can compute an accurate
  // scale factor — keeps previews sharp when the sidebar gets resized.
  const previewRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.12);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / viewport.width);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewport.width]);

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData(DND_DATA_KEY, item.id);
    e.dataTransfer.setData('text/plain', '');
    e.dataTransfer.effectAllowed = 'move';
  };

  const isPage = /^src\/app\/[^/]+\/page\.tsx$/.test(item.sourcePath);
  const slug = isPage ? slugFromSourcePath(item.sourcePath) : null;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDoubleClick={() => focusNodeOnCanvas(item.id)}
      onContextMenu={isPage && slug && onPageContextMenu ? (e) => onPageContextMenu(e, { id: item.id, label: item.label, slug }) : undefined}
      className="group cursor-grab active:cursor-grabbing select-none"
      title={`Drag ${item.label} onto canvas`}
    >
      {/* Preview thumbnail — fixed height, component scaled to fit the width.
          Tall components get cropped at the bottom (like a real thumbnail). */}
      <div
        ref={previewRef}
        className="relative w-full h-[96px] overflow-hidden bg-stone-50 rounded-xl border border-stone-200/70 group-hover:border-stone-300 group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all pointer-events-none"
      >
        <div
          className="app-theme bg-background absolute top-0 left-0 origin-top-left"
          style={{
            width: viewport.width,
            height: viewport.height,
            transform: `scale(${scale})`,
          }}
        >
          <ComponentErrorBoundary componentName={item.label}>
            <PreviewComponent {...props} />
          </ComponentErrorBoundary>
        </div>
      </div>

      {/* Label — sits OUTSIDE the card, below it, as muted text */}
      <div className="mt-1.5 px-0.5 text-[11px] font-medium text-stone-700 truncate">
        {item.label}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Design system preview card — draggable thumbnail of the generated showcase
// ---------------------------------------------------------------------------

function DesignSystemPreviewCard({ html }: { html: string }) {
  const previewRef = useRef<HTMLDivElement>(null);
  // The showcase is generated at full desktop width; scale to fit the card.
  const VIEWPORT_WIDTH = 1280;
  const VIEWPORT_HEIGHT = 1600;
  const [scale, setScale] = useState(0.18);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / VIEWPORT_WIDTH);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData(DND_DATA_KEY, DESIGN_SYSTEM_SHOWCASE_ID);
    e.dataTransfer.setData('text/plain', '');
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group cursor-grab active:cursor-grabbing select-none"
      title="Drag onto canvas"
    >
      <div
        ref={previewRef}
        className="relative w-full h-[140px] overflow-hidden bg-stone-50 rounded-xl border border-stone-200/70 group-hover:border-stone-300 group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all pointer-events-none"
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width: VIEWPORT_WIDTH,
            height: VIEWPORT_HEIGHT,
            transform: `scale(${scale})`,
          }}
        >
          <iframe
            srcDoc={html}
            sandbox="allow-same-origin"
            title="Design system preview"
            className="w-full h-full border-0 pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tree node
// ---------------------------------------------------------------------------

interface PageContextPayload {
  id: string;
  label: string;
  slug: string;
}

interface TreeNodeProps {
  item: RegistryItem;
  depth?: number;
  childrenMap: Map<string, RegistryLeafItem[]>;
  pendingChildren: Map<string, PendingChild[]>;
  parentGroupId?: string;
  onPageContextMenu?: (e: MouseEvent, payload: PageContextPayload) => void;
}

function focusNodeOnCanvas(componentId: string) {
  window.dispatchEvent(new CustomEvent(FOCUS_NODE_EVENT, { detail: { componentId } }));
}

function slugFromSourcePath(sourcePath: string): string | null {
  const match = sourcePath.match(/^src\/app\/([^/]+)\/page\.tsx$/);
  return match ? match[1] : null;
}

function TreeNode({ item, depth = 0, childrenMap, pendingChildren, parentGroupId, onPageContextMenu }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, componentId: string) => {
    e.dataTransfer.setData(DND_DATA_KEY, componentId);
    e.dataTransfer.setData('text/plain', '');
    e.dataTransfer.effectAllowed = 'move';
  };

  if (isGroup(item)) {
    const sortedChildren = item.id === 'pages'
      ? [...item.children].sort((a, b) => a.label.localeCompare(b.label))
      : item.children;
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 w-full px-2 py-2 text-left text-[11px] font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-2xl transition-colors"
          style={{ paddingLeft: `${depth * 10 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="uppercase tracking-[0.08em] text-[10px]">{item.label}</span>
        </button>
        {expanded && (
          <div>
            {sortedChildren.map((child) => (
              <TreeNode
                key={child.id}
                item={child}
                depth={depth + 1}
                childrenMap={childrenMap}
                pendingChildren={pendingChildren}
                parentGroupId={item.id}
                onPageContextMenu={onPageContextMenu}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isLeaf(item)) {
    const registryChildren = childrenMap.get(item.id) || [];
    const pending = pendingChildren.get(item.id) || [];
    // Filter out pending items that already exist as registry children (done analyzing)
    const registryChildIds = new Set(registryChildren.map((c) => c.id));
    const activePending = pending.filter((p) => p.status !== 'done' && !registryChildIds.has(p.id));
    const hasChildren = registryChildren.length > 0 || activePending.length > 0;

    if (hasChildren) {
      return (
        <div>
          {/* Parent item — both expandable and draggable */}
          <div
            className="flex items-center gap-1 px-2 py-1.5 text-[13px] text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-2xl transition-colors group select-none"
            style={{ paddingLeft: `${depth * 10 + 8}px` }}
          >
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDoubleClick={() => focusNodeOnCanvas(item.id)}
              className="flex items-center gap-1.5 flex-1 min-w-0 cursor-grab active:cursor-grabbing"
            >
              <Component className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{item.label}</span>
              <button
              onClick={() => setExpanded(!expanded)}
              className="shrink-0 p-0 text-stone-400 hover:text-stone-600"
            >
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
            </div>
          </div>
          {expanded && (
            <div>
              {/* Already-analyzed child components */}
              {registryChildren.map((child) => (
                <TreeNode key={child.id} item={child} depth={depth + 1} childrenMap={childrenMap} pendingChildren={pendingChildren} />
              ))}
              {/* Pending child components — greyed out with spinner */}
              {activePending.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-stone-400 opacity-50 cursor-default select-none rounded-2xl"
                  title={`Adding ${child.name}…`}
                  style={{ paddingLeft: `${(depth + 1) * 10 + 8}px` }}
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-300 shrink-0" />
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{child.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Normal leaf — no children
    const isPage = parentGroupId === 'pages';
    const slug = isPage ? slugFromSourcePath(item.sourcePath) : null;
    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, item.id)}
        onDoubleClick={() => focusNodeOnCanvas(item.id)}
        onContextMenu={isPage && slug && onPageContextMenu ? (e) => onPageContextMenu(e, { id: item.id, label: item.label, slug }) : undefined}
        className="flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-2xl cursor-grab active:cursor-grabbing transition-colors group select-none"
        style={{ paddingLeft: `${depth * 10 + 8}px` }}
      >
        {/* {item.parentId ?
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400 shrink-0">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M9.87737 12H9.9H11.5C11.7761 12 12 11.7761 12 11.5C12 11.2239 11.7761 11 11.5 11H9.9C8.77164 11 7.95545 10.9996 7.31352 10.9472C6.67744 10.8952 6.25662 10.7946 5.91103 10.6185C5.25247 10.283 4.71703 9.74753 4.38148 9.08897C4.20539 8.74338 4.10481 8.32256 4.05284 7.68648C4.00039 7.04455 4 6.22836 4 5.1V3.5C4 3.22386 3.77614 3 3.5 3C3.22386 3 3 3.22386 3 3.5V5.1V5.12263C3 6.22359 3 7.08052 3.05616 7.76791C3.11318 8.46584 3.23058 9.0329 3.49047 9.54296C3.9219 10.3897 4.61031 11.0781 5.45704 11.5095C5.9671 11.7694 6.53416 11.8868 7.23209 11.9438C7.91948 12 8.77641 12 9.87737 12Z" fill="currentColor"/>
            </svg>
            <Component className="w-3.5 h-3.5 shrink-0" />
          </>
        :
          <Component className="w-3.5 h-3.5 shrink-0" />
        } */}
        <Component className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{item.label}</span>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main sidebar
// ---------------------------------------------------------------------------

interface PlaygroundSidebarProps {
  onCollapse: () => void;
  onOpenDiscovery: () => void;
  pendingChildren: Map<string, PendingChild[]>;
}

export default function PlaygroundSidebar({ onCollapse, onOpenDiscovery, pendingChildren }: PlaygroundSidebarProps) {
  const [search, setSearch] = useState('');
  const [htmlPages, setHtmlPages] = useState<HtmlPageInfo[]>([]);
  const [jsxComponents, setJsxComponents] = useState<JsxComponentInfo[]>([]);
  const [htmlExpanded, setHtmlExpanded] = useState(true);
  const [isRefreshingHtml, setIsRefreshingHtml] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [designSystemHtml, setDesignSystemHtml] = useState<string | null>(null);
  const [designSystemExpanded, setDesignSystemExpanded] = useState(true);
  const [isGeneratingDesignSystem, setIsGeneratingDesignSystem] = useState(false);
  const activeProvider = useModelSettingsStore((s) => s.activeProvider);
  const enabledModels = useModelSettingsStore(
    (s) => s.providerState[s.activeProvider]?.enabledModels ?? [],
  );

  const childrenMap = useMemo(() => buildChildrenMap(registry), []);

  // Per-group expanded state for the grid view (defaults to expanded)
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>({});
  const isGroupExpanded = (id: string) => groupExpanded[id] !== false;
  const toggleGroup = (id: string) =>
    setGroupExpanded((prev) => ({ ...prev, [id]: prev[id] === false ? true : false }));

  // Fetch HTML pages and JSX components on mount
  const fetchHtmlPages = useCallback(async () => {
    try {
      setIsRefreshingHtml(true);
      const [htmlRes, jsxRes] = await Promise.all([
        fetch('/playground/api/html-pages'),
        fetch('/playground/api/oncanvas-components'),
      ]);
      if (htmlRes.ok) {
        const data = await htmlRes.json();
        setHtmlPages(data.pages || []);
      }
      if (jsxRes.ok) {
        const data = await jsxRes.json();
        setJsxComponents(data.components || []);
      }
    } catch { /* ignore */ }
    finally { setIsRefreshingHtml(false); }
  }, []);

  useEffect(() => { fetchHtmlPages(); }, [fetchHtmlPages]);

  useEffect(() => {
    const refresh = () => { void fetchHtmlPages(); };
    window.addEventListener('playground:html-pages-updated', refresh);
    window.addEventListener(GENERATION_COMPLETE_EVENT, refresh as EventListener);
    window.addEventListener(JSX_COMPONENT_ADDED_EVENT, refresh as EventListener);
    return () => {
      window.removeEventListener('playground:html-pages-updated', refresh);
      window.removeEventListener(GENERATION_COMPLETE_EVENT, refresh as EventListener);
      window.removeEventListener(JSX_COMPONENT_ADDED_EVENT, refresh as EventListener);
    };
  }, [fetchHtmlPages]);

  const fetchDesignSystem = useCallback(async () => {
    try {
      const res = await fetch('/playground/api/design/preview-showcase', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json() as { exists: boolean; html: string | null };
      setDesignSystemHtml(data.exists && data.html ? data.html : null);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchDesignSystem(); }, [fetchDesignSystem]);

  useEffect(() => {
    const handler = () => { fetchDesignSystem(); };
    window.addEventListener(DESIGN_SYSTEM_GENERATED_EVENT, handler);
    return () => window.removeEventListener(DESIGN_SYSTEM_GENERATED_EVENT, handler);
  }, [fetchDesignSystem]);

  const regenerateDesignSystem = useCallback(async () => {
    if (isGeneratingDesignSystem) return;
    setIsGeneratingDesignSystem(true);
    try {
      const res = await fetch('/playground/api/design/generate-preview-showcase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: activeProvider,
          model: enabledModels[0],
        }),
      });
      if (res.body) {
        const reader = res.body.getReader();
        // Drain the stream — the server returns when generation is done.
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }
      await fetchDesignSystem();
      window.dispatchEvent(new CustomEvent(DESIGN_SYSTEM_GENERATED_EVENT));
      toast.success('Design system regenerated');
    } catch (error) {
      toast.error(`Regeneration failed: ${(error as Error).message}`);
    } finally {
      setIsGeneratingDesignSystem(false);
    }
  }, [isGeneratingDesignSystem, activeProvider, enabledModels, fetchDesignSystem]);

  // Context menu state
  type ContextMenuFrame =
    | { id: string; label: string; frameType: 'html' | 'jsx' }
    | { id: string; label: string; frameType: 'page'; slug: string };
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; frame: ContextMenuFrame } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const handleFrameContextMenu = useCallback((e: MouseEvent, frame: { id: string; label: string; frameType: 'html' | 'jsx' }) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, frame });
  }, []);

  const handlePageContextMenu = useCallback((e: MouseEvent, payload: PageContextPayload) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      frame: { id: payload.id, label: payload.label, frameType: 'page', slug: payload.slug },
    });
  }, []);

  const handleDeleteFrame = useCallback(async () => {
    if (!contextMenu) return;
    const { frame } = contextMenu;
    setContextMenu(null);

    try {
      if (frame.frameType === 'html') {
        const folder = frame.id.replace(HTML_ID_PREFIX, '');
        await fetch('/playground/api/html-pages', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageFolder: folder }),
        });
      } else if (frame.frameType === 'jsx') {
        const filename = frame.id.replace(JSX_ID_PREFIX, '') + '.tsx';
        await fetch('/playground/api/oncanvas-components', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename }),
        });
      } else if (frame.frameType === 'page') {
        const res = await fetch(`/playground/api/pages?slug=${encodeURIComponent(frame.slug)}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.error('[Sidebar] Page delete failed:', data?.error);
        }
      }
      // Tell the canvas to remove nodes for this frame
      window.dispatchEvent(new CustomEvent(DELETE_FRAME_EVENT, { detail: { componentId: frame.id } }));
      fetchHtmlPages();
    } catch { /* ignore */ }
  }, [contextMenu, fetchHtmlPages]);

  // Close context menu on outside click or escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu]);

  const handleDragStartHtml = (e: DragEvent<HTMLDivElement>, pageId: string) => {
    e.dataTransfer.setData(DND_DATA_KEY, pageId);
    e.dataTransfer.setData('text/plain', '');
    e.dataTransfer.effectAllowed = 'move';
  };

  // For the grid view, filtering happens against the FLAT list of leaves
  // under each group — so a search like "card" will surface SubscribeBanner's
  // children too (not just top-level components).
  const filterRegistryForGrid = (items: RegistryItem[], query: string): RegistryItem[] => {
    if (!query.trim()) return items;
    const lowerQuery = query.toLowerCase();
    return items
      .map((item): RegistryItem | null => {
        if (isGroup(item)) {
          const allLeaves = flattenLeaves(item.children);
          const matchedLeaves = allLeaves.filter((l) => l.label.toLowerCase().includes(lowerQuery));
          if (matchedLeaves.length === 0 && !item.label.toLowerCase().includes(lowerQuery)) return null;
          // Re-expose matched leaves directly as the group's flat children so
          // the grid renderer (which flattens again) shows exactly the matches.
          return { ...item, children: matchedLeaves };
        }
        if (isLeaf(item)) {
          if (item.label.toLowerCase().includes(lowerQuery)) return item;
          const kids = childrenMap.get(item.id) || [];
          if (kids.some((k) => k.label.toLowerCase().includes(lowerQuery))) return item;
          return null;
        }
        return null;
      })
      .filter((item): item is RegistryItem => item !== null);
  };

  // Use the unstripped registry as the base — `flattenLeaves` already walks
  // every leaf (parents and children) so we don't need to strip anything.
  const filteredRegistry = filterRegistryForGrid(registry, search);

  // Merge HTML pages and JSX components into one sorted frames list
  const allFrames = [
    ...htmlPages.map(p => ({ id: p.id, label: p.label, frameType: 'html' as const })),
    ...jsxComponents.map(c => ({ id: c.id, label: c.label, frameType: 'jsx' as const })),
  ].sort((a, b) => {
    const na = parseInt(a.label.match(/(\d+)/)?.[1] ?? '0', 10);
    const nb = parseInt(b.label.match(/(\d+)/)?.[1] ?? '0', 10);
    return na - nb;
  });

  const filteredFrames = search.trim()
    ? allFrames.filter(f => f.label.toLowerCase().includes(search.toLowerCase()))
    : allFrames;

  // Keep backward compat for the empty-state check
  const filteredHtmlPages = filteredFrames;

  return (
    <aside className="w-[280px] h-full bg-white rounded-2xl border border-border flex flex-col overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400 shrink-0">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
          <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-stone-400 select-none">
            Project
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setDesignOpen(true)}
            className="flex items-center justify-center w-[24px] h-[24px] rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            aria-label="Design system"
          >
            <Palette className="w-[14px] h-[14px]" />
          </button>
          <button
            onClick={onOpenDiscovery}
            className="flex items-center justify-center w-[24px] h-[24px] rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            aria-label="Add components"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onCollapse();
            }}
            onClick={onCollapse}
            className="flex items-center justify-center w-[24px] h-[24px] rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-3 flex-shrink-0">
        <input
          type="text"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-[13px] bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-400/15 transition-colors"
        />
      </div>

      {/* Scrollable area for both HTML pages and component tree */}
      <div className="flex-1 overflow-y-auto px-1.5 min-h-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 [&::-webkit-scrollbar-thumb]:rounded">
        {/* Design system section — generated showcase, draggable to canvas */}
        {designSystemHtml && (!search.trim() || 'design system'.includes(search.toLowerCase())) && (
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setDesignSystemExpanded(!designSystemExpanded)}
                className="flex items-center gap-1.5 px-2 py-2 text-left text-[11px] font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-2xl transition-colors flex-1"
              >
                {designSystemExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="uppercase tracking-[0.08em] text-[10px]">Design system</span>
              </button>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={regenerateDesignSystem}
                      disabled={isGeneratingDesignSystem}
                      className="p-1 rounded text-stone-400 hover:text-stone-600 transition-colors disabled:opacity-50"
                      aria-label="Regenerate"
                    >
                      {isGeneratingDesignSystem ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Regenerate</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {designSystemExpanded && (
              <div className="grid grid-cols-1 gap-y-4 px-2 pt-2 pb-4">
                <DesignSystemPreviewCard html={designSystemHtml} />
              </div>
            )}
          </div>
        )}

        {/* Frames section — HTML pages and on-canvas JSX components */}
        {filteredFrames.length > 0 && (
          <div className="mb-1">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setHtmlExpanded(!htmlExpanded)}
                className="flex items-center gap-1.5 px-2 py-2 text-left text-[11px] font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-2xl transition-colors flex-1"
              >
                {htmlExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="uppercase tracking-[0.08em] text-[10px]">Riffs</span>
              </button>
              <button
                onClick={fetchHtmlPages}
                disabled={isRefreshingHtml}
                className="p-1 rounded text-stone-400 hover:text-stone-600 transition-colors"
                aria-label="Refresh frames"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshingHtml ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {htmlExpanded && filteredFrames.map(frame => (
              <div
                key={frame.id}
                draggable
                onDragStart={(e) => handleDragStartHtml(e, frame.id)}
                onDoubleClick={() => focusNodeOnCanvas(frame.id)}
                onContextMenu={(e) => handleFrameContextMenu(e, frame)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-sm cursor-grab active:cursor-grabbing transition-colors group select-none"
                style={{ paddingLeft: '18px' }}
              >
                {frame.frameType === 'jsx' ? (
                  <FileCode className="w-3.5 h-3.5 shrink-0 text-purple-500" />
                ) : (
                  <Frame className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{frame.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Component grid — flat 2-column layout of preview cards.
            Top-level groups become collapsible section headers; leaves under
            them (including nested children with parentId) are flattened into
            a single grid per group. */}
        {filteredRegistry.length > 0 ? (
          filteredRegistry.map((item) => {
            if (isGroup(item)) {
              const leaves = flattenLeaves(item.children);
              const expanded = isGroupExpanded(item.id);
              return (
                <div key={item.id} className="mb-2">
                  <button
                    onClick={() => toggleGroup(item.id)}
                    className="flex items-center gap-1.5 w-full px-2 py-2 text-left text-[11px] font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-2xl transition-colors"
                  >
                    {expanded ? (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="uppercase tracking-[0.08em] text-[10px]">{item.label}</span>
                    <span className="ml-auto text-[10px] text-stone-400">{leaves.length}</span>
                  </button>
                  {expanded && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-4 px-2 pt-2 pb-4">
                      {leaves.map((leaf) => (
                        <ComponentPreviewCard
                          key={leaf.id}
                          item={leaf}
                          onPageContextMenu={handlePageContextMenu}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            // Stand-alone leaf at the top level — fall back to the original
            // tree row so we never lose access to it.
            return (
              <TreeNode
                key={item.id}
                item={item}
                childrenMap={childrenMap}
                pendingChildren={pendingChildren}
                onPageContextMenu={handlePageContextMenu}
              />
            );
          })
        ) : !search.trim() ? (
          /* Empty state — no components discovered yet */
          <div className="px-2 pt-1 pb-3">
            {/* Skeleton preview cards */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 pt-2 pb-3 opacity-40 pointer-events-none select-none">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="w-full h-[96px] rounded-xl bg-stone-200 animate-pulse" />
                  <div
                    className="h-2 rounded-full bg-stone-200 animate-pulse"
                    style={{ width: i % 2 === 0 ? '60%' : '75%' }}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={onOpenDiscovery}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-stone-900 text-white text-[12px] font-medium hover:bg-stone-700 active:bg-stone-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add my components
            </button>
          </div>
        ) : (
          <p className="text-xs text-stone-400 text-center py-3 select-none">No results</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 flex-shrink-0 border-t border-stone-100">
        <p className="text-[11px] text-stone-400 text-center select-none">
          Drag drop any component
        </p>
      </div>

      {/* Context menu — portaled to body to avoid clipping by aside overflow */}
      {contextMenu && createPortal(
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[140px] bg-white border border-stone-200 rounded-2xl shadow-lg py-1 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={handleDeleteFrame}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-[13px] text-red-600 hover:bg-red-50 transition-colors text-left rounded-2xl"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete {contextMenu.frame.label}
          </button>
        </div>,
        document.body,
      )}

      <DesignSystemModal open={designOpen} onOpenChange={setDesignOpen} />
    </aside>
  );
}
