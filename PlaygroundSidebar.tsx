'use client';

import { useState, useEffect, useMemo, useCallback, DragEvent } from 'react';
import { ChevronRight, ChevronDown, ChevronLeft, Plus, Loader2, RefreshCw, Frame, Component, Folder } from 'lucide-react';
import { registry, RegistryItem, RegistryLeafItem, isGroup, isLeaf } from './registry';
import { DND_DATA_KEY, HTML_ID_PREFIX } from './lib/constants';
import type { HtmlPageInfo } from './lib/constants';
import type { PendingChild } from './PlaygroundClient';

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

/** Remove leaf items that have a parentId from group children (they render nested under their parent). */
function stripChildLeaves(items: RegistryItem[]): RegistryItem[] {
  return items
    .map((item) => {
      if (isGroup(item)) {
        return { ...item, children: stripChildLeaves(item.children) };
      }
      if (isLeaf(item) && item.parentId) return null;
      return item;
    })
    .filter((item): item is RegistryItem => item !== null);
}

// ---------------------------------------------------------------------------
// Tree node
// ---------------------------------------------------------------------------

interface TreeNodeProps {
  item: RegistryItem;
  depth?: number;
  childrenMap: Map<string, RegistryLeafItem[]>;
  pendingChildren: Map<string, PendingChild[]>;
}

function TreeNode({ item, depth = 0, childrenMap, pendingChildren }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, componentId: string) => {
    e.dataTransfer.setData(DND_DATA_KEY, componentId);
    e.dataTransfer.effectAllowed = 'move';
  };

  if (isGroup(item)) {
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
            {item.children.map((child) => (
              <TreeNode key={child.id} item={child} depth={depth + 1} childrenMap={childrenMap} pendingChildren={pendingChildren} />
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
    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, item.id)}
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
  const [htmlExpanded, setHtmlExpanded] = useState(true);
  const [isRefreshingHtml, setIsRefreshingHtml] = useState(false);

  const childrenMap = useMemo(() => buildChildrenMap(registry), []);
  const strippedRegistry = useMemo(() => stripChildLeaves(registry), []);

  // Fetch HTML pages on mount
  const fetchHtmlPages = useCallback(async () => {
    try {
      setIsRefreshingHtml(true);
      const response = await fetch('/playground/api/html-pages');
      if (response.ok) {
        const data = await response.json();
        setHtmlPages(data.pages || []);
      }
    } catch { /* ignore */ }
    finally { setIsRefreshingHtml(false); }
  }, []);

  useEffect(() => { fetchHtmlPages(); }, [fetchHtmlPages]);

  const handleDragStartHtml = (e: DragEvent<HTMLDivElement>, pageId: string) => {
    e.dataTransfer.setData(DND_DATA_KEY, pageId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const filterItems = (items: RegistryItem[], query: string): RegistryItem[] => {
    if (!query.trim()) return items;
    const lowerQuery = query.toLowerCase();
    return items
      .map((item) => {
        if (isGroup(item)) {
          const filteredChildren = filterItems(item.children, query);
          if (filteredChildren.length > 0) return { ...item, children: filteredChildren };
          if (item.label.toLowerCase().includes(lowerQuery)) return item;
          return null;
        }
        if (isLeaf(item)) {
          // Match on the item itself
          if (item.label.toLowerCase().includes(lowerQuery)) return item;
          // Match on any of its registry children
          const kids = childrenMap.get(item.id) || [];
          if (kids.some((k) => k.label.toLowerCase().includes(lowerQuery))) return item;
          return null;
        }
        return null;
      })
      .filter((item): item is RegistryItem => item !== null);
  };

  const filteredRegistry = filterItems(strippedRegistry, search);

  // Filter HTML pages by search
  const filteredHtmlPages = search.trim()
    ? htmlPages.filter(p => p.label.toLowerCase().includes(search.toLowerCase()))
    : htmlPages;

  return (
    <aside className="w-[208px] h-full bg-white rounded-2xl border border-border flex flex-col overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
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
            onClick={onOpenDiscovery}
            className="flex items-center justify-center w-[24px] h-[24px] rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            aria-label="Add components"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
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
        {/* HTML Pages section */}
        {filteredHtmlPages.length > 0 && (
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
                <span className="uppercase tracking-[0.08em] text-[10px]">Frames</span>
              </button>
              <button
                onClick={fetchHtmlPages}
                disabled={isRefreshingHtml}
                className="p-1 rounded text-stone-400 hover:text-stone-600 transition-colors"
                aria-label="Refresh HTML pages"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshingHtml ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {htmlExpanded && filteredHtmlPages.map(page => (
              <div
                key={page.id}
                draggable
                onDragStart={(e) => handleDragStartHtml(e, page.id)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-sm cursor-grab active:cursor-grabbing transition-colors group select-none"
                style={{ paddingLeft: '18px' }}
              >
                <Frame className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{page.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Component tree */}
        {filteredRegistry.length > 0 ? (
          filteredRegistry.map((item) => (
            <TreeNode key={item.id} item={item} childrenMap={childrenMap} pendingChildren={pendingChildren} />
          ))
        ) : filteredHtmlPages.length === 0 ? (
          <p className="text-xs text-stone-400 text-center py-3 select-none">No components found</p>
        ) : null}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 flex-shrink-0 border-t border-stone-100">
        <p className="text-[11px] text-stone-400 text-center select-none">
          Drag drop any component
        </p>
      </div>
    </aside>
  );
}
