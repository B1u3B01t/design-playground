'use client';

import { useState, DragEvent } from 'react';
import { ChevronRight, ChevronDown, GripVertical, ChevronLeft, Plus } from 'lucide-react';
import { registry, RegistryItem, isGroup, isLeaf } from './registry';
import { DND_DATA_KEY } from './lib/constants';

// ---------------------------------------------------------------------------
// Tree node
// ---------------------------------------------------------------------------

interface TreeNodeProps {
  item: RegistryItem;
  depth?: number;
}

function TreeNode({ item, depth = 0 }: TreeNodeProps) {
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
              <TreeNode key={child.id} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isLeaf(item)) {
    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, item.id)}
        className="flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-sm cursor-grab active:cursor-grabbing transition-colors group select-none"
        style={{ paddingLeft: `${depth * 10 + 8}px` }}
      >
        <GripVertical className="w-3.5 h-3.5 text-stone-300 group-hover:text-stone-400 shrink-0 transition-colors" />
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
}

export default function PlaygroundSidebar({ onCollapse, onOpenDiscovery }: PlaygroundSidebarProps) {
  const [search, setSearch] = useState('');

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
        if (isLeaf(item) && item.label.toLowerCase().includes(lowerQuery)) return item;
        return null;
      })
      .filter((item): item is RegistryItem => item !== null);
  };

  const filteredRegistry = filterItems(registry, search);

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

      {/* Component tree */}
      <div className="flex-1 overflow-y-auto px-1.5 min-h-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 [&::-webkit-scrollbar-thumb]:rounded">
        {filteredRegistry.length > 0 ? (
          filteredRegistry.map((item) => <TreeNode key={item.id} item={item} />)
        ) : (
          <p className="text-xs text-stone-400 text-center py-3 select-none">No components found</p>
        )}
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
