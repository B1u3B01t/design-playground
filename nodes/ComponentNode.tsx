'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, useNodeId } from '@xyflow/react';
import { ChevronDown, Check, Monitor, Tablet, Smartphone, Maximize2, Fullscreen } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { flatRegistry } from '../registry';
import { CancelGenerationButton } from './shared/IterateDialogParts';
import IterateDialog from './shared/IterateDialog';

import { useAsyncProps, useScrollCapture } from '../hooks/useNodeShared';
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
  };
  selected?: boolean;
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

  const currentConfig = SIZE_CONFIG[currentSize];
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

function ComponentNode({ data, selected = false }: ComponentNodeProps) {
  const componentId = data.componentId;
  const registryItem = flatRegistry[componentId];
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isGlobalGenerating, setIsGlobalGenerating] = useState(false);
  
  // Shared hooks
  const { resolvedProps, isLoadingProps, propsError } = useAsyncProps(componentId);
  const handleWheel = useScrollCapture(scrollContainerRef);
  
  // Node identity (for IterateDialog parent)
  const nodeId = useNodeId();
  const isInteractive = !!selected;
  
  // Local size state - initialized from registry
  const [size, setSize] = useState<ComponentSize>(registryItem?.size || 'default');

  // Listen for global generation state changes
  useEffect(() => {
    const handleGenerationStart = () => setIsGlobalGenerating(true);
    const handleGenerationEnd = () => setIsGlobalGenerating(false);

    window.addEventListener(GENERATION_START_EVENT, handleGenerationStart);
    window.addEventListener(GENERATION_COMPLETE_EVENT, handleGenerationEnd);
    window.addEventListener(GENERATION_ERROR_EVENT, handleGenerationEnd);

    return () => {
      window.removeEventListener(GENERATION_START_EVENT, handleGenerationStart);
      window.removeEventListener(GENERATION_COMPLETE_EVENT, handleGenerationEnd);
      window.removeEventListener(GENERATION_ERROR_EVENT, handleGenerationEnd);
    };
  }, []);

  // Emit event when size changes so IterationNodes can update
  const handleSizeChange = (newSize: ComponentSize) => {
    setSize(newSize);
    window.dispatchEvent(new CustomEvent(COMPONENT_SIZE_CHANGE_EVENT, {
      detail: { componentId, size: newSize }
    }));
  };

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
  const config = SIZE_CONFIG[size];
  const isLargeComponent = size !== 'default';
  const displayDims = getDisplayDimensions(size);

  return (
    <div 
      className={`bg-white rounded-lg shadow-md overflow-hidden ${
        isLargeComponent ? '' : 'min-w-[200px]'
      } ${selected ? 'border-2 border-orange-400 shadow-orange-200' : 'border border-gray-200'}`}
      style={isLargeComponent ? { width: displayDims.width } : undefined}
    >
      {/* Node header - draggable area, nodrag on interactive elements only */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-700">{label}</span>
          <span className="text-[10px] text-gray-400 font-mono">{componentId}</span>
        </div>
        <div className="flex items-center gap-2 nodrag">
          {isGlobalGenerating ? (
            <CancelGenerationButton />
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      const slug = componentId;
                      const url = `/playground/iterations/${slug}`;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    className="p-1 rounded transition-colors text-gray-500 hover:text-gray-700 hover:bg-gray-100"
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
              <IterateDialog componentId={componentId} componentName={label.replace(/\s*\(.*\)/, '')} parentNodeId={nodeId ?? ''} isGlobalGenerating={isGlobalGenerating} />
            </>
          )}
        </div>
      </div>

      {/* Rendered component - nodrag/nowheel/nopan classes tell ReactFlow to let component handle events */}
      {isLargeComponent ? (
        <div 
          ref={scrollContainerRef}
          className={`bg-gray-100 overflow-auto ${isInteractive ? 'nodrag nowheel nopan' : ''}`}
          style={{
            width: displayDims.width,
            height: displayDims.height,
          }}
          onWheel={isInteractive ? handleWheel : undefined}
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
              <ComponentErrorBoundary componentName={label}>
                <Component {...effectiveProps} />
              </ComponentErrorBoundary>
            )}
          </div>
        </div>
      ) : (
        <div className={`p-4 flex items-center justify-center ${isInteractive ? 'nodrag nowheel nopan' : ''}`}>
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
