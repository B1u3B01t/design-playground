'use client';

import { memo } from 'react';
import { NodeResizeControl } from '@xyflow/react';
import { ImageIcon, Trash2 } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { RESIZE_MIN_WIDTH, RESIZE_MIN_HEIGHT } from '../lib/constants';

export interface ImageNodeData {
  imagePath: string;
  imageUrl: string;
  filename: string;
  originalName: string;
}

function ImageNodeInner({ id, data, selected }: { id: string; data: ImageNodeData; selected?: boolean }) {
  const { deleteElements } = useReactFlow();

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
      className="relative group"
      style={{
        minWidth: RESIZE_MIN_WIDTH,
        minHeight: RESIZE_MIN_HEIGHT,
      }}
    >
      <NodeResizeControl
        minWidth={RESIZE_MIN_WIDTH}
        minHeight={RESIZE_MIN_HEIGHT}
        style={{
          background: 'transparent',
          border: 'none',
        }}
      >
        <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize" />
      </NodeResizeControl>

      <div
        className={`relative overflow-hidden rounded-lg border-2 bg-white transition-colors ${
          selected ? 'border-blue-500 shadow-lg' : 'border-stone-200 hover:border-stone-300'
        }`}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-2 py-1 bg-stone-50 border-b border-stone-200">
          <div className="flex items-center gap-1.5 text-xs text-stone-500 truncate">
            <ImageIcon className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{data.originalName}</span>
          </div>
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 p-0.5 text-stone-400 hover:text-red-500 transition-all"
            title="Delete image"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Image */}
        <div
          data-screenshot-target
          className="flex items-center justify-center p-2"
          style={{ width: '100%', height: 'calc(100% - 28px)' }}
        >
          <img
            src={data.imageUrl}
            alt={data.originalName}
            className="max-w-full max-h-full object-contain"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}

const ImageNode = memo(ImageNodeInner);
export default ImageNode;
