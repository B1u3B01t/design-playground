'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, useNodeId } from '@xyflow/react';
import { ChevronDown, Check, Copy, Monitor, Tablet, Smartphone, Maximize2, Fullscreen } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { flatRegistry, generateIterationPrompt, ComponentSize } from '../registry';
import { ITERATION_PROMPT_COPIED_EVENT } from '../PlaygroundCanvas';
import { usePlaygroundContext } from '../PlaygroundClient';

const PROPS_CACHE_TTL_MS = 60_000;
const propsCache = new Map<string, { ts: number; props: Record<string, unknown> }>();

// Event for size changes - IterationNodes listen for this
export const COMPONENT_SIZE_CHANGE_EVENT = 'playground:component-size-change';

// Size configurations for different component display sizes
export const sizeConfig: Record<ComponentSize, { width: number; height: number; scale: number; label: string }> = {
  default: { width: 0, height: 0, scale: 1, label: 'Auto' },
  laptop: { width: 1280, height: 720, scale: 0.6, label: 'Laptop' },
  tablet: { width: 768, height: 1024, scale: 0.5, label: 'Tablet' },
  mobile: { width: 375, height: 812, scale: 0.7, label: 'Mobile' },
};

// Calculate display dimensions (scaled)
export function getDisplayDimensions(size: ComponentSize) {
  const config = sizeConfig[size];
  if (size === 'default') return { width: 'auto', height: 'auto' };
  return {
    width: Math.round(config.width * config.scale),
    height: Math.round(config.height * config.scale),
  };
}

interface ComponentNodeProps {
  data: {
    componentId: string;
  };
}

function SizeDropdown({ 
  currentSize, 
  onSizeChange 
}: { 
  currentSize: ComponentSize; 
  onSizeChange: (size: ComponentSize) => void;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sizes: { key: ComponentSize; icon: React.ReactNode; label: string }[] = [
    { key: 'default', icon: <Maximize2 className="w-3 h-3" />, label: 'Auto' },
    { key: 'laptop', icon: <Monitor className="w-3 h-3" />, label: 'Laptop' },
    { key: 'tablet', icon: <Tablet className="w-3 h-3" />, label: 'Tablet' },
    { key: 'mobile', icon: <Smartphone className="w-3 h-3" />, label: 'Mobile' },
  ];

  const currentConfig = sizeConfig[currentSize];
  const currentIcon = sizes.find(s => s.key === currentSize)?.icon;

  return (
    <div ref={dropdownRef} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] text-gray-500 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            {currentIcon}
            <span>{currentConfig.label}</span>
            {currentSize !== 'default' && (
              <span className="text-gray-400">({Math.round(currentConfig.scale * 100)}%)</span>
            )}
            <ChevronDown className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Change viewport size</p>
        </TooltipContent>
      </Tooltip>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden z-50">
          {sizes.map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => {
                onSizeChange(key);
                setOpen(false);
              }}
              className={`w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2 ${currentSize === key ? 'bg-gray-50' : ''}`}
            >
              {icon}
              <span>{label}</span>
              {currentSize === key && <Check className="w-3 h-3 text-green-500 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IterationCountDropdown({ 
  count, 
  onChange 
}: { 
  count: number; 
  onChange: (count: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = [1, 2, 3, 4];

  return (
    <div ref={dropdownRef} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-0.5 px-1 py-0.5 text-[10px] text-gray-500 hover:text-gray-700 transition-colors"
          >
            <span>{count}x</span>
            <ChevronDown className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Number of iterations</p>
        </TooltipContent>
      </Tooltip>

      {open && (
        <div className="absolute top-full right-0 mt-0.5 w-12 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden z-50">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`w-full px-2 py-1 text-[10px] text-left text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-between ${
                count === option ? 'bg-gray-50' : ''
              }`}
            >
              <span>{option}x</span>
              {count === option && <Check className="w-2.5 h-2.5 text-green-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DepthDropdown({ 
  depth, 
  onChange 
}: { 
  depth: 'shell' | '1-level' | 'all'; 
  onChange: (depth: 'shell' | '1-level' | 'all') => void;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options: { key: 'shell' | '1-level' | 'all'; label: string }[] = [
    { key: 'shell', label: 'Shell only' },
    { key: '1-level', label: '1 level deep' },
    { key: 'all', label: 'All levels' },
  ];

  const currentLabel = options.find(o => o.key === depth)?.label || 'Shell only';

  return (
    <div ref={dropdownRef} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-0.5 px-2 py-1 text-[10px] text-gray-600 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
          >
            <span className="max-w-[80px] truncate">{currentLabel}</span>
            <ChevronDown className={`w-2.5 h-2.5 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Iteration depth</p>
        </TooltipContent>
      </Tooltip>

      {open && (
        <div className="absolute top-full left-0 mt-0.5 w-32 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden z-50">
          {options.map((option) => (
            <button
              key={option.key}
              onClick={() => {
                onChange(option.key);
                setOpen(false);
              }}
              className={`w-full px-2 py-1.5 text-[10px] text-left text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-between ${
                depth === option.key ? 'bg-gray-50' : ''
              }`}
            >
              <span>{option.label}</span>
              {depth === option.key && <Check className="w-2.5 h-2.5 text-green-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IterateDialog({ componentId }: { componentId: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [iterationCount, setIterationCount] = useState(4);
  const [depth, setDepth] = useState<'shell' | '1-level' | 'all'>('shell');
  const [customInstructions, setCustomInstructions] = useState('');

  const handleCopyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      // Dispatch event to start polling for new iterations
      window.dispatchEvent(new CustomEvent(ITERATION_PROMPT_COPIED_EVENT));
      // Close modal immediately after copying
      setOpen(false);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  };

  const handleGenerate = async () => {
    const prompt = generateIterationPrompt(componentId, iterationCount, depth, customInstructions || undefined);
    await handleCopyPrompt(prompt);
  };

  const handleDefaultCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const defaultPrompt = generateIterationPrompt(componentId, 4, 'shell', undefined);
    await handleCopyPrompt(defaultPrompt);
  };

  return (
    <>
      <button
        onClick={(e) => {
          if (e.shiftKey) {
            handleDefaultCopy(e);
          } else {
            setOpen(true);
          }
        }}
        className="flex items-center gap-1 px-2 py-1 text-xs font-mono text-white bg-black hover:bg-gray-800 rounded transition-colors"
      >
        <span>Iterate</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate Iterations</DialogTitle>
            <DialogDescription>
              Describe what kind of iterations you want to explore. Be specific about layout, style, or behavior changes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Custom Instructions */}
            <div>
              <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-2">
                Custom Instructions
              </label>
              <textarea
                id="instructions"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g., 'Try a horizontal card layout with image on the left', 'Experiment with darker color schemes and bolder typography', 'Create a more compact spacing with tighter gaps'..."
                className="w-full min-h-[120px] px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
              />
              <p className="mt-1 text-xs text-gray-500">
                Describe the specific changes you want to explore. Leave empty for general variations.
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label htmlFor="count" className="text-xs text-gray-600 whitespace-nowrap">
                  Iterations:
                </label>
                <IterationCountDropdown count={iterationCount} onChange={setIterationCount} />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="depth" className="text-xs text-gray-600 whitespace-nowrap">
                  Depth:
                </label>
                <DepthDropdown depth={depth} onChange={setDepth} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              className="px-4 py-2 text-sm text-white bg-black hover:bg-gray-800 rounded-md transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Generate & Copy Prompt</span>
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ComponentNode({ data }: ComponentNodeProps) {
  const componentId = data.componentId;
  const registryItem = flatRegistry[componentId];
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [resolvedProps, setResolvedProps] = useState<Record<string, unknown> | null>(null);
  const [isLoadingProps, setIsLoadingProps] = useState(false);
  const [propsError, setPropsError] = useState<string | null>(null);
  
  // Fullscreen support
  const nodeId = useNodeId();
  const { fullscreenNodeId, enterFullscreen } = usePlaygroundContext();
  const isFullscreen = fullscreenNodeId === nodeId;
  
  // Local size state - initialized from registry
  const [size, setSize] = useState<ComponentSize>(registryItem?.size || 'default');

  // Emit event when size changes so IterationNodes can update
  const handleSizeChange = (newSize: ComponentSize) => {
    setSize(newSize);
    window.dispatchEvent(new CustomEvent(COMPONENT_SIZE_CHANGE_EVENT, {
      detail: { componentId, size: newSize }
    }));
  };

  // Handle wheel events to allow scrolling inside the component
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = container;
    const isScrollableY = scrollHeight > clientHeight;
    const isScrollableX = scrollWidth > clientWidth;
    
    // Check if we can scroll in the direction the user is scrolling
    const canScrollUp = scrollTop > 0;
    const canScrollDown = scrollTop < scrollHeight - clientHeight;
    const canScrollLeft = scrollLeft > 0;
    const canScrollRight = scrollLeft < scrollWidth - clientWidth;

    const isScrollingDown = e.deltaY > 0;
    const isScrollingUp = e.deltaY < 0;
    const isScrollingRight = e.deltaX > 0;
    const isScrollingLeft = e.deltaX < 0;

    // Stop propagation if we can scroll in the intended direction
    const shouldCapture = 
      (isScrollableY && ((isScrollingDown && canScrollDown) || (isScrollingUp && canScrollUp))) ||
      (isScrollableX && ((isScrollingRight && canScrollRight) || (isScrollingLeft && canScrollLeft)));

    if (shouldCapture) {
      e.stopPropagation();
    }
  };

  // Async props loader (Option D): fetch props via registryItem.getProps (playground-only)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setPropsError(null);

      if (!registryItem?.getProps) {
        setResolvedProps(null);
        setIsLoadingProps(false);
        return;
      }

      const cacheKey = componentId;
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
  }, [componentId, registryItem]);

  if (!registryItem) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 min-w-[200px]">
        <p className="text-red-600 text-sm">Unknown component: {componentId}</p>
        <Handle type="source" position={Position.Right} className="!bg-red-500" />
      </div>
    );
  }

  const { Component, props, label } = registryItem;
  const effectiveProps = (resolvedProps ?? props ?? {}) as Record<string, unknown>;
  const config = sizeConfig[size];
  const isLargeComponent = size !== 'default';
  const displayDims = getDisplayDimensions(size);

  return (
    <div 
      className={`bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden ${isLargeComponent ? '' : 'min-w-[200px]'}`}
      style={isLargeComponent ? { width: displayDims.width } : undefined}
    >
      {/* Node header - draggable area, nodrag on interactive elements only */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-700">{label}</span>
          <span className="text-[10px] text-gray-400 font-mono">{componentId}</span>
        </div>
        <div className="flex items-center gap-2 nodrag">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => nodeId && enterFullscreen(nodeId)}
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
          <SizeDropdown currentSize={size} onSizeChange={handleSizeChange} />
          <IterateDialog componentId={componentId} />
        </div>
      </div>

      {/* Rendered component - nodrag/nowheel/nopan classes tell ReactFlow to let component handle events */}
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
          {/* Device frame - use CSS zoom for proper scroll behavior */}
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
              <Component {...effectiveProps} />
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 flex items-center justify-center nodrag nowheel nopan">
          {isLoadingProps && !Object.keys(effectiveProps).length ? (
            <div className="text-xs text-gray-500">Loading live data…</div>
          ) : propsError && !Object.keys(effectiveProps).length ? (
            <div className="text-xs text-red-600">Failed to load data: {propsError}</div>
          ) : (
            <Component {...effectiveProps} />
          )}
        </div>
      )}

      {/* Handles for connections - on the right side */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />
    </div>
  );
}

export default memo(ComponentNode);
