'use client';

import { memo, useState, Suspense, useMemo, useRef, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Check, Trash2, Loader2, ArrowUpRight, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { flatRegistry, generateAdoptPrompt } from '../registry';
import { getIterationComponent } from '../iterations';
import {
  COMPONENT_SIZE_CHANGE_EVENT,
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  ITERATION_COLLAPSE_TOGGLE_EVENT,
  SIZE_CONFIG,
  getDisplayDimensions,
  COPIED_FEEDBACK_DURATION,
  type ComponentSize,
} from '../lib/constants';
import { useAsyncProps, useScrollCapture } from '../hooks/useNodeShared';
import ComponentErrorBoundary from './ComponentErrorBoundary';
import IterateDialog from './shared/IterateDialog';

interface IterationNodeProps {
  id: string;
  data: {
    componentName: string;
    iterationNumber: number;
    filename: string;
    description: string;
    parentNodeId: string;
    hasChildren?: boolean;
    isCollapsed?: boolean;
    onDelete?: (filename: string) => void;
    onAdopt?: (filename: string, componentName: string) => void;
  };
  selected?: boolean;
}

function IterationNode({ id, data, selected = false }: IterationNodeProps) {
  const { deleteElements } = useReactFlow();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAdopting, setIsAdopting] = useState(false);
  const [isGlobalGenerating, setIsGlobalGenerating] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isInteractive = !!selected;

  const IterationComponent = useMemo(() => getIterationComponent(data.filename), [data.filename]);

  const registryId = useMemo(() => {
    const possibleIds = [
      data.componentName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, ''),
      `${data.componentName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}-expanded`,
      `${data.componentName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}-minimal`,
    ];
    for (const regId of possibleIds) {
      if (flatRegistry[regId]) return regId;
    }
    return possibleIds[0];
  }, [data.componentName]);

  const { resolvedProps, isLoadingProps, propsError } = useAsyncProps(registryId);
  const staticProps = useMemo(() => flatRegistry[registryId]?.props || {}, [registryId]);
  const effectiveProps = (resolvedProps ?? staticProps) as Record<string, unknown>;

  const [size, setSize] = useState<ComponentSize>(() => flatRegistry[registryId]?.size || 'default');

  useEffect(() => {
    const handleSizeChange = (e: CustomEvent<{ componentId: string; size: ComponentSize }>) => {
      if (e.detail.componentId === registryId) setSize(e.detail.size);
    };
    window.addEventListener(COMPONENT_SIZE_CHANGE_EVENT, handleSizeChange as EventListener);
    return () => window.removeEventListener(COMPONENT_SIZE_CHANGE_EVENT, handleSizeChange as EventListener);
  }, [registryId]);

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

  const config = SIZE_CONFIG[size];
  const isLargeComponent = size !== 'default';
  const displayDims = getDisplayDimensions(size);
  const handleWheel = useScrollCapture(scrollContainerRef);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const response = await fetch('/playground/api/iterations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: data.filename }),
      });
      if (response.ok) {
        deleteElements({ nodes: [{ id }] });
        data.onDelete?.(data.filename);
      } else {
        setIsDeleting(false);
      }
    } catch {
      setIsDeleting(false);
    }
  };

  const handleAdopt = async () => {
    if (isAdopting) return;
    setIsAdopting(true);
    const adoptPrompt = generateAdoptPrompt(registryId, data.filename);
    try {
      await navigator.clipboard.writeText(adoptPrompt);
    } catch (err) {
      console.error('[IterationNode] Failed to copy adopt prompt:', err);
    }
    data.onAdopt?.(data.filename, data.componentName);
    setTimeout(() => setIsAdopting(false), COPIED_FEEDBACK_DURATION);
  };

  // e.g. "PricingCard" + 3 → "pricing-card #3"
  const iterationLabel = useMemo(() => {
    const key = data.componentName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    return `${key} #${data.iterationNumber}`;
  }, [data.componentName, data.iterationNumber]);

  return (
    <div
      className={`flex flex-col ${isLargeComponent ? '' : 'min-w-[280px] max-w-[400px]'}`}
      style={{
        ...(isLargeComponent ? { width: displayDims.width } : {}),
        fontFamily: 'var(--font-geist-sans), Geist, system-ui, sans-serif',
      }}
    >
      {/* ── Top bar — label always, controls only when selected ── */}
      <div className="flex items-center justify-between px-0.5 pb-1.5 nodrag cursor-default">
        {/* Left: collapse toggle + label */}
        <div className="flex items-center gap-1.5 min-w-0">
          {data.hasChildren && (
            <button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent(ITERATION_COLLAPSE_TOGGLE_EVENT, { detail: { nodeId: id } }),
                )
              }
              className="p-0.5 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors shrink-0"
              aria-label={data.isCollapsed ? 'Expand children' : 'Collapse children'}
            >
              <ChevronRight className={`w-3 h-3 transition-transform ${data.isCollapsed ? '' : 'rotate-90'}`} />
            </button>
          )}
          <span
            className="text-[11px] font-medium select-none leading-none truncate"
            style={{ fontFamily: 'var(--font-geist-mono), monospace', color: '#0B99FF' }}
          >
            {iterationLabel}
          </span>
        </div>

        {/* Right: expand icon — invisible when not selected, always occupies space */}
        <div className={`transition-opacity ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  const slug = data.filename.replace(/\.tsx$/, '');
                  window.open(`/playground/iterations/${slug}`, '_blank', 'noopener,noreferrer');
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
          className={`bg-white overflow-hidden rounded-xl transition-all ${
            selected ? 'ring-2 ring-[#0B99FF]' : ''
          }`}
        >
          {isLargeComponent ? (
            <div
              ref={scrollContainerRef}
              className={`bg-gray-100 overflow-auto ${isInteractive ? 'nodrag nowheel nopan' : ''}`}
              style={{ width: displayDims.width, height: displayDims.height }}
              onWheel={isInteractive ? handleWheel : undefined}
            >
              {IterationComponent ? (
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  }
                >
                  <div
                    className="bg-white"
                    style={{ width: config.width, minHeight: config.height, zoom: config.scale }}
                  >
                    {isLoadingProps && !Object.keys(effectiveProps).length ? (
                      <div className="p-6 text-xs text-gray-500">Loading live data…</div>
                    ) : propsError && !Object.keys(effectiveProps).length ? (
                      <div className="p-6 text-xs text-red-600">Failed to load data: {propsError}</div>
                    ) : (
                      <ComponentErrorBoundary componentName={`${data.componentName} #${data.iterationNumber}`}>
                        <IterationComponent {...effectiveProps} />
                      </ComponentErrorBoundary>
                    )}
                  </div>
                </Suspense>
              ) : (
                <div className="flex items-center justify-center h-full text-center">
                  <div>
                    <p className="text-[10px] text-gray-400">{data.filename}</p>
                    <p className="text-[9px] text-amber-500 mt-1">Waiting for registration — try refreshing</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={`p-4 flex items-center justify-center min-h-[100px] ${isInteractive ? 'nodrag nowheel nopan' : ''}`}>
              {IterationComponent ? (
                <Suspense fallback={<Loader2 className="w-5 h-5 animate-spin text-gray-400" />}>
                  <div className="w-full">
                    {isLoadingProps && !Object.keys(effectiveProps).length ? (
                      <div className="text-xs text-gray-500">Loading live data…</div>
                    ) : propsError && !Object.keys(effectiveProps).length ? (
                      <div className="text-xs text-red-600">Failed to load data: {propsError}</div>
                    ) : (
                      <ComponentErrorBoundary componentName={`${data.componentName} #${data.iterationNumber}`}>
                        <IterationComponent {...effectiveProps} />
                      </ComponentErrorBoundary>
                    )}
                  </div>
                </Suspense>
              ) : (
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">{data.filename}</p>
                  <p className="text-[9px] text-amber-500 mt-1">Waiting for registration — try refreshing</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right-side vertical action toolbar — always in DOM, invisible when not selected */}
        <div className={`absolute top-0 left-full pl-2 flex flex-col items-center gap-2 nodrag transition-opacity ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Iterate */}
            <IterateDialog
              componentId={registryId}
              componentName={data.componentName}
              parentNodeId={id}
              sourceFilename={data.filename}
              isGlobalGenerating={isGlobalGenerating}
            />

            {/* Use this (adopt) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleAdopt}
                  disabled={isAdopting}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-stone-200 text-stone-400 hover:text-green-600 hover:border-green-300 transition-colors disabled:opacity-50"
                  aria-label={isAdopting ? 'Copied!' : 'Use this variation'}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{isAdopting ? 'Prompt copied!' : 'Use this variation'}</p>
              </TooltipContent>
            </Tooltip>

            {/* Delete */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-stone-200 text-stone-400 hover:text-red-500 hover:border-red-300 transition-colors disabled:opacity-50"
                  aria-label="Delete variation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right"><p>Delete variation</p></TooltipContent>
            </Tooltip>
          </div>
      </div>

      {/* Target handle — incoming from parent */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-[#0B99FF] !border-2 !border-white"
      />
      {/* Source handle — outgoing to child iterations */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-[#0B99FF] !border-2 !border-white"
      />
    </div>
  );
}

export default memo(IterationNode);
