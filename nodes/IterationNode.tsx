'use client';

import { memo, useState, Suspense, useMemo, useRef, useEffect } from 'react';
import { Handle, Position, useReactFlow, useNodeId } from '@xyflow/react';
import { Check, Trash2, Sparkles, Loader2, Fullscreen } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { flatRegistry, ComponentSize } from '../registry';
import { getIterationComponent } from '../iterations';
import { COMPONENT_SIZE_CHANGE_EVENT, sizeConfig, getDisplayDimensions } from './ComponentNode';
import { usePlaygroundContext } from '../PlaygroundClient';

const PROPS_CACHE_TTL_MS = 60_000;
const propsCache = new Map<string, { ts: number; props: Record<string, unknown> }>();

interface IterationNodeProps {
  id: string;
  data: {
    componentName: string;
    iterationNumber: number;
    filename: string;
    mode: 'layout' | 'vibe' | 'unknown';
    description: string;
    parentNodeId: string;
    onDelete?: (filename: string) => void;
    onAdopt?: (filename: string, componentName: string) => void;
  };
}

function IterationNode({ id, data }: IterationNodeProps) {
  const { deleteElements } = useReactFlow();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAdopting, setIsAdopting] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Fullscreen support
  const { fullscreenNodeId, enterFullscreen } = usePlaygroundContext();
  const isFullscreen = fullscreenNodeId === id;

  // Get the iteration component from the static map
  const IterationComponent = useMemo(() => {
    return getIterationComponent(data.filename);
  }, [data.filename]);

  // Get registry ID for this component
  const registryId = useMemo(() => {
    const possibleIds = [
      data.componentName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, ''),
      `${data.componentName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}-expanded`,
      `${data.componentName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}-minimal`,
    ];

    for (const regId of possibleIds) {
      if (flatRegistry[regId]) {
        return regId;
      }
    }
    return possibleIds[0];
  }, [data.componentName]);

  // State for async props loading (same as ComponentNode)
  const [resolvedProps, setResolvedProps] = useState<Record<string, unknown> | null>(null);
  const [isLoadingProps, setIsLoadingProps] = useState(false);
  const [propsError, setPropsError] = useState<string | null>(null);

  // Get static props from parent component in registry (fallback)
  const staticProps = useMemo(() => {
    if (flatRegistry[registryId]) {
      return flatRegistry[registryId].props || {};
    }
    return {};
  }, [registryId]);

  // Async props loader: fetch props via registryItem.getProps
  useEffect(() => {
    let cancelled = false;
    const registryItem = flatRegistry[registryId];

    async function load() {
      setPropsError(null);

      if (!registryItem?.getProps) {
        setResolvedProps(null);
        setIsLoadingProps(false);
        return;
      }

      const cacheKey = registryId;
      const cached = propsCache.get(cacheKey);
      const now = Date.now();
      if (cached && now - cached.ts < PROPS_CACHE_TTL_MS) {
        setResolvedProps(cached.props);
        setIsLoadingProps(false);
        return;
      }

      setIsLoadingProps(true);
      try {
        const next = await Promise.resolve(registryItem.getProps());
        if (cancelled) return;
        propsCache.set(cacheKey, { ts: Date.now(), props: next });
        setResolvedProps(next);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load props';
        setPropsError(msg);
        setResolvedProps(null);
      } finally {
        if (!cancelled) setIsLoadingProps(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [registryId]);

  // Use resolved props if available, otherwise fall back to static props
  const effectiveProps = (resolvedProps ?? staticProps) as Record<string, unknown>;

  // Local size state - initialized from registry, updated via events
  const [size, setSize] = useState<ComponentSize>(() => {
    if (flatRegistry[registryId]) {
      return flatRegistry[registryId].size || 'default';
    }
    return 'default';
  });

  // Listen for size changes from parent component
  useEffect(() => {
    const handleSizeChange = (e: CustomEvent<{ componentId: string; size: ComponentSize }>) => {
      if (e.detail.componentId === registryId) {
        setSize(e.detail.size);
      }
    };

    window.addEventListener(COMPONENT_SIZE_CHANGE_EVENT, handleSizeChange as EventListener);
    return () => {
      window.removeEventListener(COMPONENT_SIZE_CHANGE_EVENT, handleSizeChange as EventListener);
    };
  }, [registryId]);

  const config = sizeConfig[size];
  const isLargeComponent = size !== 'default';
  const displayDims = getDisplayDimensions(size);

  // Handle wheel events to allow scrolling inside the component
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = container;
    const isScrollableY = scrollHeight > clientHeight;
    const isScrollableX = scrollWidth > clientWidth;
    
    const canScrollUp = scrollTop > 0;
    const canScrollDown = scrollTop < scrollHeight - clientHeight;
    const canScrollLeft = scrollLeft > 0;
    const canScrollRight = scrollLeft < scrollWidth - clientWidth;

    const isScrollingDown = e.deltaY > 0;
    const isScrollingUp = e.deltaY < 0;
    const isScrollingRight = e.deltaX > 0;
    const isScrollingLeft = e.deltaX < 0;

    const shouldCapture = 
      (isScrollableY && ((isScrollingDown && canScrollDown) || (isScrollingUp && canScrollUp))) ||
      (isScrollableX && ((isScrollingRight && canScrollRight) || (isScrollingLeft && canScrollLeft)));

    if (shouldCapture) {
      e.stopPropagation();
    }
  };

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
        // Remove node from canvas
        deleteElements({ nodes: [{ id }] });
        data.onDelete?.(data.filename);
      } else {
        console.error('Failed to delete iteration');
        setIsDeleting(false);
      }
    } catch (error) {
      console.error('Error deleting iteration:', error);
      setIsDeleting(false);
    }
  };

  const handleAdopt = async () => {
    if (isAdopting) return;
    setIsAdopting(true);
    
    // Call the adopt callback
    data.onAdopt?.(data.filename, data.componentName);
    
    // Reset after a moment
    setTimeout(() => setIsAdopting(false), 2000);
  };

  const modeColor = data.mode === 'layout' 
    ? 'bg-blue-50 border-blue-200 text-blue-700'
    : data.mode === 'vibe'
    ? 'bg-purple-50 border-purple-200 text-purple-700'
    : 'bg-gray-50 border-gray-200 text-gray-700';

  const modeIcon = data.mode === 'layout' ? '⊞' : data.mode === 'vibe' ? '✦' : '•';

  return (
    <div 
      className={`bg-white border-2 border-dashed border-gray-300 rounded-lg shadow-sm overflow-hidden ${isLargeComponent ? '' : 'min-w-[280px] max-w-[400px]'}`}
      style={isLargeComponent ? { width: displayDims.width } : undefined}
    >
      {/* Node header - draggable area */}
      <div className="px-3 py-2 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span className="text-xs font-medium text-gray-700">
              Iteration #{data.iterationNumber}
            </span>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">{data.componentName}</span>
        </div>
        <div className="flex items-center gap-2 nodrag">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => enterFullscreen(id)}
                className={`p-1 rounded transition-colors ${
                  isFullscreen 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                aria-label="View fullscreen"
              >
                <Fullscreen className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View fullscreen</p>
            </TooltipContent>
          </Tooltip>
          {isLargeComponent && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded border border-gray-200">
              {config.label} ({Math.round(config.scale * 100)}%)
            </span>
          )}
          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${modeColor}`}>
            {modeIcon} {data.mode}
          </span>
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
          <p className="text-[10px] font-mono text-gray-400 leading-snug break-words">{data.description}</p>
        </div>
      )}

      {/* Rendered iteration component - match ComponentNode sizing */}
      {isLargeComponent ? (
        <div 
          ref={scrollContainerRef}
          className="bg-gray-100 overflow-auto nodrag nowheel nopan"
          style={{
            width: displayDims.width,
            height: displayDims.height,
          }}
          onWheel={handleWheel}
        >
          {IterationComponent ? (
            <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>}>
              <div 
                className="bg-white"
                style={{
                  width: config.width,
                  minHeight: config.height,
                  zoom: config.scale,
                }}
              >
                {isLoadingProps && !Object.keys(effectiveProps).length ? (
                  <div className="p-6 text-xs text-gray-500">Loading live data…</div>
                ) : propsError && !Object.keys(effectiveProps).length ? (
                  <div className="p-6 text-xs text-red-600">Failed to load data: {propsError}</div>
                ) : (
                  <IterationComponent {...effectiveProps} />
                )}
              </div>
            </Suspense>
          ) : (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <div className="text-2xl mb-1 text-gray-300">{modeIcon}</div>
                <p className="text-[10px] text-gray-400">{data.filename}</p>
                <p className="text-[9px] text-amber-500 mt-1">Not registered in index</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 flex items-center justify-center min-h-[100px] bg-gradient-to-br from-gray-50 to-white overflow-hidden nodrag nowheel nopan">
          {IterationComponent ? (
            <Suspense fallback={<Loader2 className="w-5 h-5 animate-spin text-gray-400" />}>
              <div className="w-full">
                {isLoadingProps && !Object.keys(effectiveProps).length ? (
                  <div className="text-xs text-gray-500">Loading live data…</div>
                ) : propsError && !Object.keys(effectiveProps).length ? (
                  <div className="text-xs text-red-600">Failed to load data: {propsError}</div>
                ) : (
                  <IterationComponent {...effectiveProps} />
                )}
              </div>
            </Suspense>
          ) : (
            <div className="text-center">
              <div className="text-2xl mb-1 text-gray-300">{modeIcon}</div>
              <p className="text-[10px] text-gray-400">{data.filename}</p>
              <p className="text-[9px] text-amber-500 mt-1">Not registered in index</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-2 py-1 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-0.5 nodrag">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleAdopt}
              disabled={isAdopting}
              className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded transition-colors disabled:opacity-50"
            >
              <Check className="w-2.5 h-2.5" />
              {isAdopting ? 'Adopted!' : 'Adopt'}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Adopt this iteration</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-2.5 h-2.5" />
              {isDeleting ? '...' : 'Delete'}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete this iteration</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Handles for connections - on the left side */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
      />
    </div>
  );
}

export default memo(IterationNode);
