'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Loader2, Sparkles } from 'lucide-react';

interface SkeletonIterationNodeProps {
  data: {
    iterationNumber: number;
    componentName: string;
    totalIterations: number;
  };
}

function SkeletonIterationNode({ data }: SkeletonIterationNodeProps) {
  return (
    <div className="bg-white border-2 border-dashed border-amber-300 rounded-lg shadow-sm overflow-hidden min-w-[280px] max-w-[400px]">
      {/* Node header */}
      <div className="px-3 py-2 bg-gradient-to-r from-amber-50 to-white border-b border-amber-200 flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span className="text-xs font-medium text-gray-700">
              Iteration #{data.iterationNumber}
            </span>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">{data.componentName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-50 rounded border border-amber-200 flex items-center gap-1">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Generating...
          </span>
        </div>
      </div>

      {/* Skeleton content area */}
      <div className="p-4 flex flex-col items-center justify-center min-h-[150px] bg-gradient-to-br from-gray-50 to-white">
        {/* Shimmer effect container */}
        <div className="w-full space-y-3">
          {/* Skeleton lines with Tailwind animate-pulse */}
          <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto animate-pulse" style={{ animationDelay: '150ms' }} />
          <div className="h-8 bg-gray-200 rounded w-full animate-pulse" style={{ animationDelay: '300ms' }} />
          <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto animate-pulse" style={{ animationDelay: '450ms' }} />
        </div>
        
        {/* Progress indicator */}
        <div className="mt-4 flex items-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">
            Creating variation {data.iterationNumber} of {data.totalIterations}...
          </span>
        </div>
      </div>

      {/* Actions placeholder */}
      <div className="px-2 py-1 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-0.5">
        <div className="h-5 w-14 bg-gray-200 rounded animate-pulse" />
        <div className="h-5 w-14 bg-gray-200 rounded animate-pulse" style={{ animationDelay: '150ms' }} />
      </div>

      {/* Target handle - incoming edge from parent (left side) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
      />
      {/* Source handle - for consistency with IterationNode tree structure (right side) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
      />
    </div>
  );
}

export default memo(SkeletonIterationNode);
