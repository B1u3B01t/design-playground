'use client';

import { memo } from 'react';
import { NodeResizeControl, useReactFlow } from '@xyflow/react';
import { RESIZE_MIN_WIDTH, RESIZE_MIN_HEIGHT } from '../lib/constants';

export interface TextNodeData {
  text: string;
}

function TextNodeInner({ id, data, selected }: { id: string; data: TextNodeData; selected?: boolean }) {
  const { updateNodeData } = useReactFlow();

  return (
    <div
      className="flex flex-col"
      style={{
        minWidth: RESIZE_MIN_WIDTH,
        minHeight: RESIZE_MIN_HEIGHT,
        width: '100%',
        height: '100%',
        fontFamily: 'var(--font-geist-sans), Geist, system-ui, sans-serif',
      }}
    >
      {/* Resize handle — bottom-right corner, only when selected */}
      <NodeResizeControl
        position="bottom-right"
        minWidth={RESIZE_MIN_WIDTH}
        minHeight={RESIZE_MIN_HEIGHT}
        style={{
          background: 'transparent',
          border: 'none',
          width: 10,
          height: 10,
          bottom: 2,
          right: 2,
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'auto' : 'none',
          cursor: 'nwse-resize',
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" className="text-stone-300 hover:text-stone-500 transition-colors">
          <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.2" />
          <line x1="9" y1="4" x2="4" y2="9" stroke="currentColor" strokeWidth="1.2" />
          <line x1="9" y1="7" x2="7" y2="9" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </NodeResizeControl>

      <textarea
        data-screenshot-target
        className="nodrag nowheel nopan w-full h-full p-3 bg-transparent outline-none resize-none text-stone-800 text-sm leading-relaxed placeholder:text-stone-400 rounded-xl transition-all"
        style={{
          fontFamily: 'var(--font-geist-sans), Geist, system-ui, sans-serif',
          border: '1px dashed',
          borderColor: selected ? '#d6d3d1' : 'transparent',
        }}
        value={data.text}
        placeholder="Type something..."
        onChange={(e) => updateNodeData(id, { text: e.target.value })}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}

const TextNode = memo(TextNodeInner);
export default TextNode;
