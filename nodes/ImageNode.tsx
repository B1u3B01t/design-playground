'use client';

import { memo, useCallback, useRef } from 'react';
import { NodeResizeControl } from '@xyflow/react';
import { ImageIcon, Trash2 } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { RESIZE_MIN_WIDTH, RESIZE_MIN_HEIGHT } from '../lib/constants';
import { NodeLabel } from './shared/NodeLabel';

export interface ImageNodeData {
  imagePath: string;
  imageUrl: string;
  filename: string;
  originalName: string;
}

function ImageNodeInner({ id, data, selected }: { id: string; data: ImageNodeData; selected?: boolean }) {
  const { deleteElements, setNodes, getNode } = useReactFlow();
  const aspectAppliedRef = useRef(false);
  const topBarRef = useRef<HTMLDivElement | null>(null);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    if (aspectAppliedRef.current) return;
    const img = e.currentTarget;
    const ratio = img.naturalWidth / img.naturalHeight;
    if (!ratio || !isFinite(ratio)) return;
    const node = getNode(id);
    if (!node) return;
    const currentWidth = node.width ?? (node.measured?.width ?? 300);
    const topBarH = topBarRef.current?.offsetHeight ?? 0;
    const newHeight = Math.round(currentWidth / ratio + topBarH);
    aspectAppliedRef.current = true;
    setNodes((nodes) =>
      nodes.map((n) =>
        n.id === id ? { ...n, width: currentWidth, height: newHeight, style: { ...(n.style ?? {}), width: currentWidth, height: newHeight } } : n,
      ),
    );
  }, [id, getNode, setNodes]);

  const handleDelete = async () => {
    try {
      await fetch('/playground/api/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: data.filename }),
      });
    } catch (error) {
      console.error('Error deleting image file:', error);
    }
    deleteElements({ nodes: [{ id }] });
  };

  return (
    <div
      className="flex flex-col"
      style={{
        minWidth: RESIZE_MIN_WIDTH,
        minHeight: RESIZE_MIN_HEIGHT,
        width: '100%',
        height: '100%',
        fontFamily: 'var(--pg-font-sans)',
      }}
    >
      {/* Resize handle — bottom-right corner, only when selected */}
      <NodeResizeControl
        position="bottom-right"
        minWidth={RESIZE_MIN_WIDTH}
        minHeight={RESIZE_MIN_HEIGHT}
        keepAspectRatio
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

      {/* ── Top bar — label only when selected ── */}
      <div ref={topBarRef} className={`flex items-center justify-between px-0.5 pb-1.5 cursor-grab transition-opacity ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-1.5">
          <NodeLabel color="#10B981">{data.originalName}</NodeLabel>
        </div>
      </div>

      {/* ── Frame + right-side vertical toolbar ── */}
      <div className="relative flex items-start flex-1 min-h-0">
        {/* Image frame */}
        <div
          data-screenshot-target
          className={`app-theme overflow-hidden rounded-xl transition-all w-full h-full ${
            selected ? 'ring-2 ring-emerald-400' : ''
          }`}
        >
          <div
            className="flex items-center justify-center p-2 w-full h-full"
          >
            <img
              src={data.imageUrl}
              alt={data.originalName}
              className="max-w-full max-h-full object-contain"
              draggable={false}
              onLoad={handleImageLoad}
            />
          </div>
        </div>

        {/* Right-side vertical action toolbar — visible when selected */}
        <div className={`absolute top-0 left-full pl-2 flex flex-col items-center gap-2 nodrag transition-opacity ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleDelete}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-stone-200 text-stone-400 hover:text-red-500 hover:border-red-300 transition-colors"
                aria-label="Delete image"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right"><p>Delete image</p></TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

const ImageNode = memo(ImageNodeInner);
export default ImageNode;
