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
          className="flex items-center gap-1 w-full px-2 py-0.5 text-left text-[11px] font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-md transition-colors"
          style={{ paddingLeft: `${depth * 10 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 shrink-0" />
          )}
          <span className="uppercase tracking-wider text-[10px]">{item.label}</span>
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
        className="flex items-center gap-1.5 py-1 text-sm text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-md cursor-grab active:cursor-grabbing transition-colors group"
        style={{ paddingLeft: `${depth * 10 + 8}px`, paddingRight: '8px' }}
      >
        <GripVertical className="w-3.5 h-3.5 text-stone-300 group-hover:text-stone-400 shrink-0 transition-colors" />
        <span>{item.label}</span>
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
    <aside className="w-52 h-full bg-white rounded-xl border border-stone-200/80 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
          <span className="text-[11px] font-semibold tracking-widest uppercase text-stone-400 select-none">
            Components
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onOpenDiscovery}
            className="p-0.5 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            aria-label="Add components"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onCollapse}
            className="p-0.5 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2.5 pb-2 flex-shrink-0">
        <input
          type="text"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-2.5 py-1.5 text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:border-stone-400 transition-colors"
        />
      </div>

      {/* Component tree */}
      <div className="flex-1 overflow-y-auto px-1.5 min-h-0">
        {filteredRegistry.length > 0 ? (
          filteredRegistry.map((item) => <TreeNode key={item.id} item={item} />)
        ) : (
          <p className="text-xs text-stone-400 text-center py-3">No components found</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 flex-shrink-0 border-t border-stone-100">
        <p className="text-[11px] text-stone-400 text-center select-none">
          Drag drop any component
        </p>
      </div>
    </aside>
  );
}
