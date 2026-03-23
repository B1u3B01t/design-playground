'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { useNodeId, useReactFlow } from '@xyflow/react';
import { Monitor, Smartphone, ArrowUpRight, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { resolveRegistryItem } from '../registry';
import { CancelGenerationButton } from './shared/IterateDialogParts';
import IterateDialog from './shared/IterateDialog';

import { useAsyncProps, useScrollCapture } from '../hooks/useNodeShared';
import { useTunnelShare } from '../hooks/useTunnelShare';
import ComponentErrorBoundary from './ComponentErrorBoundary';
import {
  COMPONENT_SIZE_CHANGE_EVENT,
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  SIZE_CONFIG,
  getDisplayDimensions,
  type ComponentSize,
} from '../lib/constants';

interface ComponentNodeProps {
  data: {
    componentId: string;
    /** Persisted across reloads — reflects the last user-chosen size */
    size?: ComponentSize;
  };
  selected?: boolean;
}

// Icon-only size switcher: Auto · Desktop · Mobile
function SizeButtons({
  currentSize,
  onSizeChange,
}: {
  currentSize: ComponentSize;
  onSizeChange: (size: ComponentSize) => void;
}) {
  const sizes: { key: ComponentSize; icon: React.ReactNode; label: string }[] = [
    {
      key: 'default',
      label: 'Auto',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      ),
    },
    { key: 'laptop', label: 'Desktop', icon: <Monitor className="w-3 h-3" /> },
    { key: 'mobile', label: 'Mobile',  icon: <Smartphone className="w-3 h-3" /> },
  ];

  return (
    <div className="flex items-center gap-0.5">
      {sizes.map(({ key, icon, label }) => (
        <Tooltip key={key}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onSizeChange(key)}
              className={`p-1 rounded transition-colors ${
                currentSize === key
                  ? 'text-[#0B99FF] bg-blue-50'
                  : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
              }`}
              aria-label={label}
            >
              {icon}
            </button>
          </TooltipTrigger>
          <TooltipContent><p>{label}</p></TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function ComponentNode({ data, selected = false }: ComponentNodeProps) {
  const componentId = data.componentId;
  const registryItem = resolveRegistryItem(componentId);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isGlobalGenerating, setIsGlobalGenerating] = useState(false);

  const { resolvedProps, isLoadingProps, propsError } = useAsyncProps(componentId);
  const handleWheel = useScrollCapture(scrollContainerRef);

  const nodeId = useNodeId();
  const { updateNodeData } = useReactFlow();
  const isInteractive = !!selected;

  const { share: handleShare, state: shareState } = useTunnelShare(componentId);

  // Prefer the persisted size from node data (survives reload), then registry default
  const [size, setSize] = useState<ComponentSize>(data.size || registryItem?.size || 'default');

  useEffect(() => {
    const on  = () => setIsGlobalGenerating(true);
    const off = () => setIsGlobalGenerating(false);
    window.addEventListener(GENERATION_START_EVENT,    on);
    window.addEventListener(GENERATION_COMPLETE_EVENT, off);
    window.addEventListener(GENERATION_ERROR_EVENT,    off);
    return () => {
      window.removeEventListener(GENERATION_START_EVENT,    on);
      window.removeEventListener(GENERATION_COMPLETE_EVENT, off);
      window.removeEventListener(GENERATION_ERROR_EVENT,    off);
    };
  }, []);

  const handleSizeChange = (newSize: ComponentSize) => {
    setSize(newSize);
    // Persist size in node data so it survives reload and is readable by child iterations
    if (nodeId) updateNodeData(nodeId, { size: newSize });
    // Broadcast using nodeId so each iteration can track its own parent
    window.dispatchEvent(new CustomEvent(COMPONENT_SIZE_CHANGE_EVENT, {
      detail: { nodeId, size: newSize },
    }));
  };

  if (!registryItem) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 min-w-[200px]">
        <p className="text-red-600 text-sm">Unknown component: {componentId}</p>
      </div>
    );
  }

  const { Component, props, label } = registryItem;
  const effectiveProps = (resolvedProps ?? props ?? {}) as Record<string, unknown>;
  const config = SIZE_CONFIG[size];
  const isLargeComponent = size !== 'default';
  const displayDims = getDisplayDimensions(size);

  return (
    <div
      className={`flex flex-col ${isLargeComponent ? '' : 'min-w-[200px]'}`}
      style={{
        ...(isLargeComponent ? { width: displayDims.width } : {}),
        fontFamily: 'var(--font-geist-sans), Geist, system-ui, sans-serif',
      }}
    >
      {/* ── Top bar — always visible label, controls only when selected ── */}
      <div className="flex items-center justify-between px-0.5 pb-1.5 nodrag cursor-default">
        {/* Left: label (always) + size buttons (selected only) */}
        <div className="flex items-center gap-1.5">
          <span
            className="text-[11px] font-medium select-none leading-none"
            style={{
              fontFamily: 'var(--font-geist-mono), monospace',
              color: '#0B99FF',
            }}
          >
            {componentId}
          </span>
          <div className={`flex items-center gap-1.5 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="w-px h-3 bg-stone-200 shrink-0" />
            <SizeButtons currentSize={size} onSizeChange={handleSizeChange} />
          </div>
        </div>

        {/* Right: expand icon — invisible when not selected, always occupies space */}
        <div className={`transition-opacity ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  window.open(`/playground/iterations/${componentId}`, '_blank', 'noopener,noreferrer');
                }}
                className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                aria-label="Open in new tab"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent><p>Open in new tab</p></TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ── Frame + right-side vertical toolbar ── */}
      <div className="relative flex items-start">
        {/* Component frame */}
        <div
          className={`app-theme bg-background overflow-hidden rounded-xl transition-all ${
            selected ? 'ring-2 ring-[#0B99FF]' : ''
          }`}
        >
          {isLargeComponent ? (
            <div
              ref={scrollContainerRef}
              className={`bg-gray-100 overflow-x-hidden overflow-y-auto ${isInteractive ? 'nodrag nowheel nopan' : ''}`}
              style={{ width: displayDims.width, height: displayDims.height }}
              onWheel={isInteractive ? handleWheel : undefined}
            >
              <div
                className="bg-background"
                style={{ width: config.width, minHeight: config.height, zoom: config.scale }}
              >
                {isLoadingProps && !Object.keys(effectiveProps).length ? (
                  <div className="p-6 text-xs text-gray-500">Loading live data…</div>
                ) : propsError && !Object.keys(effectiveProps).length ? (
                  <div className="p-6 text-xs text-red-600">Failed to load data: {propsError}</div>
                ) : (
                  <ComponentErrorBoundary componentName={label}>
                    <Component {...effectiveProps} />
                  </ComponentErrorBoundary>
                )}
              </div>
            </div>
          ) : (
            <div className={`grid place-items-center p-4 ${isInteractive ? 'nodrag nowheel nopan' : ''}`}>
              {isLoadingProps && !Object.keys(effectiveProps).length ? (
                <div className="text-xs text-gray-500">Loading live data…</div>
              ) : propsError && !Object.keys(effectiveProps).length ? (
                <div className="text-xs text-red-600">Failed to load data: {propsError}</div>
              ) : (
                <ComponentErrorBoundary componentName={label}>
                  <Component {...effectiveProps} />
                </ComponentErrorBoundary>
              )}
            </div>
          )}
        </div>

        {/* Right-side vertical action toolbar — always in DOM, invisible when not selected */}
        <div className={`absolute top-0 left-full pl-2 flex flex-col items-center gap-2 nodrag transition-opacity ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {isGlobalGenerating ? (
              <CancelGenerationButton />
            ) : (
              <>
                {/* Iterate — circle blue button with bolt */}
                <IterateDialog
                  componentId={componentId}
                  componentName={label.replace(/\s*\(.*\)/, '')}
                  parentNodeId={nodeId ?? ''}
                  isGlobalGenerating={isGlobalGenerating}
                />

                {/* Share public link */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleShare}
                      disabled={shareState === 'connecting'}
                      className={`w-8 h-8 flex items-center justify-center rounded-full bg-white border transition-colors disabled:opacity-50 ${
                        shareState === 'copied'
                          ? 'border-green-300 text-green-600'
                          : shareState === 'error'
                            ? 'border-red-300 text-red-500'
                            : 'border-stone-200 text-stone-400 hover:text-stone-700 hover:border-stone-300'
                      }`}
                      aria-label="Copy public link"
                    >
                      {shareState === 'connecting' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : shareState === 'copied' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>
                      {shareState === 'connecting' ? 'Starting tunnel…' :
                       shareState === 'copied' ? 'Link copied!' :
                       shareState === 'error' ? 'Tunnel failed' :
                       'Copy public link'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
      </div>

    </div>
  );
}

export default memo(ComponentNode);
