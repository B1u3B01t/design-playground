'use client';

import { useState, DragEvent } from 'react';
import { ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import { registry, RegistryItem, isGroup, isLeaf } from './registry';
import { DND_DATA_KEY } from './lib/constants';

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
          className="flex items-center gap-1 w-full px-1.5 py-0.5 text-left text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors font-mono"
          style={{ paddingLeft: `${depth * 10 + 6}px` }}
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-gray-400" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-400" />
          )}
          <span>{item.label}</span>
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
        className="flex items-center gap-1.5 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded cursor-grab active:cursor-grabbing transition-colors group font-mono"
        style={{ paddingLeft: `${depth * 10 + 6}px` }}
      >
        <GripVertical className="w-3 h-3 text-gray-400 group-hover:text-gray-500 transition-colors" />
        <span>{item.label}</span>
      </div>
    );
  }

  return null;
}

export default function PlaygroundSidebar() {
  const [search, setSearch] = useState('');

  const filterItems = (items: RegistryItem[], query: string): RegistryItem[] => {
    if (!query.trim()) return items;

    const lowerQuery = query.toLowerCase();

    return items
      .map((item) => {
        if (isGroup(item)) {
          const filteredChildren = filterItems(item.children, query);
          if (filteredChildren.length > 0) {
            return { ...item, children: filteredChildren };
          }
          if (item.label.toLowerCase().includes(lowerQuery)) {
            return item;
          }
          return null;
        }

        if (isLeaf(item) && item.label.toLowerCase().includes(lowerQuery)) {
          return item;
        }

        return null;
      })
      .filter((item): item is RegistryItem => item !== null);
  };

  const filteredRegistry = filterItems(registry, search);

  return (
    <aside className="w-56 h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="px-2.5 py-2 border-b border-gray-200">
        <h1 className="text-sm font-semibold text-gray-900 tracking-tight font-mono">Playground</h1>
        <p className="text-[10px] text-gray-500 font-mono">Drag to canvas</p>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-gray-200">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-2 py-1 text-xs bg-gray-50 border border-gray-300 rounded text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
        />
      </div>

      {/* Component tree */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {filteredRegistry.length > 0 ? (
          filteredRegistry.map((item) => <TreeNode key={item.id} item={item} />)
        ) : (
          <p className="text-xs text-gray-400 text-center py-2 font-mono">No components found</p>
        )}
      </div>

      {/* Footer */}
      {/* <div className="px-2 py-1.5 border-t border-gray-200">
        <p className="text-[9px] text-gray-400 text-center font-mono uppercase tracking-wide">Dev Mode</p>
      </div> */}
    </aside>
  );
}

