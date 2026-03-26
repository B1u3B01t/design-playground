'use client';

import { memo } from 'react';
import { Loader2 } from 'lucide-react';

interface SkeletonIterationNodeProps {
  data: {
    iterationNumber: number;
    componentName: string;
    totalIterations: number;
    /** Explicit width to match parent node size (flow-space px) */
    width?: number;
    /** Explicit height to match parent node size (flow-space px) */
    height?: number;
  };
}

function SkeletonIterationNode({ data }: SkeletonIterationNodeProps) {
  const hasExplicitSize = data.width != null && data.height != null;

  return (
    <div
      className="flex flex-col"
      style={
        hasExplicitSize
          ? { width: data.width, height: data.height, fontFamily: 'var(--font-geist-sans), Geist, system-ui, sans-serif' }
          : { minWidth: 280, fontFamily: 'var(--font-geist-sans), Geist, system-ui, sans-serif' }
      }
    >
      {/* Top bar — mirrors ComponentNode's label bar */}
      <div className="flex items-center justify-between px-0.5 pb-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[11px] font-medium select-none leading-none"
            style={{ fontFamily: 'var(--font-geist-mono), monospace', color: '#0B99FF' }}
          >
            {data.componentName}
          </span>
          <div className="w-px h-3 bg-stone-200 shrink-0" />
          <span className="text-[11px] text-stone-400 select-none leading-none" style={{ fontFamily: 'var(--font-geist-mono), monospace' }}>
            #{data.iterationNumber}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-stone-400 select-none">
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
          <span>generating</span>
        </div>
      </div>

      {/* Frame — mirrors ComponentNode's white rounded frame */}
      <div
        data-screenshot-target
        className="bg-white overflow-hidden rounded-xl border border-stone-200/60"
        style={hasExplicitSize ? { flex: 1 } : { minHeight: 150 }}
      >
        <div className="w-full h-full p-4 flex flex-col justify-center gap-3">
          <div className="h-3 bg-stone-100 rounded-md w-3/4 animate-pulse" />
          <div className="h-3 bg-stone-100 rounded-md w-1/2 animate-pulse" style={{ animationDelay: '150ms' }} />
          <div className="h-8 bg-stone-100 rounded-md w-full animate-pulse" style={{ animationDelay: '300ms' }} />
          <div className="h-3 bg-stone-100 rounded-md w-2/3 animate-pulse" style={{ animationDelay: '450ms' }} />
        </div>
      </div>
    </div>
  );
}

export default memo(SkeletonIterationNode);
