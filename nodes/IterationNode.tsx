'use client';

import { memo, useState, Suspense, useMemo, useRef, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Check, Trash2, Sparkles, Loader2, Fullscreen, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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

// ---------------------------------------------------------------------------
// IterationNode
// ---------------------------------------------------------------------------

function IterationNode({ id, data, selected = false }: IterationNodeProps) {
  const { deleteElements } = useReactFlow();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAdopting, setIsAdopting] = useState(false);
  const [isGlobalGenerating, setIsGlobalGenerating] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Interactivity is driven purely by React Flow selection
  const isInteractive = !!selected;

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

  // Shared async props loading
  const { resolvedProps, isLoadingProps, propsError } = useAsyncProps(registryId);

  // Get static props from parent component in registry (fallback)
  const staticProps = useMemo(() => {
    if (flatRegistry[registryId]) {
      return flatRegistry[registryId].props || {};
    }
    return {};
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

  const config = SIZE_CONFIG[size];
  const isLargeComponent = size !== 'default';
  const displayDims = getDisplayDimensions(size);

  // Shared scroll capture hook
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
    
    // Generate and copy the adopt prompt
    const adoptPrompt = generateAdoptPrompt(registryId, data.filename);
    
    try {
      await navigator.clipboard.writeText(adoptPrompt);
      console.log('[IterationNode] Adopt prompt copied to clipboard');
    } catch (err) {
      console.error('[IterationNode] Failed to copy adopt prompt:', err);
    }
    
    // Call the adopt callback if provided
    data.onAdopt?.(data.filename, data.componentName);
    
    // Reset after a moment
    setTimeout(() => setIsAdopting(false), COPIED_FEEDBACK_DURATION);
  };

  return (
    <div 
      className={`bg-white border-2 border-dashed rounded-lg shadow-sm overflow-hidden ${
        isLargeComponent ? '' : 'min-w-[280px] max-w-[400px]'
      } ${selected ? 'border-orange-400' : 'border-gray-300'}`}
      style={isLargeComponent ? { width: displayDims.width } : undefined}
    >
      {/* Node header - draggable area */}
      <div className="px-3 py-2 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-1">
          {/* Collapse/expand toggle -- only shown when node has children */}
          {data.hasChildren && (
            <button
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent(ITERATION_COLLAPSE_TOGGLE_EVENT, { detail: { nodeId: id } }),
                );
              }}
              className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors nodrag"
              aria-label={data.isCollapsed ? 'Expand children' : 'Collapse children'}
            >
              <ChevronRight
                className={`w-3 h-3 transition-transform ${data.isCollapsed ? '' : 'rotate-90'}`}
              />
            </button>
          )}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span className="text-xs font-medium text-gray-700">
                Iteration #{data.iterationNumber}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">{data.componentName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 nodrag">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  const slug = data.filename.replace(/\.tsx$/, '');
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
          <IterateDialog
            componentId={registryId}
            componentName={data.componentName}
            parentNodeId={id}
            sourceFilename={data.filename}
            isGlobalGenerating={isGlobalGenerating}
          />
          {isLargeComponent && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded border border-gray-200">
              {config.label} ({Math.round(config.scale * 100)}%)
            </span>
          )}
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
          className={`bg-gray-100 overflow-auto ${isInteractive ? 'nodrag nowheel nopan' : ''}`}
          style={{
            width: displayDims.width,
            height: displayDims.height,
          }}
          onWheel={isInteractive ? handleWheel : undefined}
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
                <p className="text-[9px] text-amber-500 mt-1">Not registered in index</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={`p-4 flex items-center justify-center min-h-[100px] bg-gradient-to-br from-gray-50 to-white overflow-hidden ${isInteractive ? 'nodrag nowheel nopan' : ''}`}>
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
              {isAdopting ? 'Copied!' : 'Adopt'}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy adopt prompt to clipboard</p>
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

      {/* Target handle - incoming edge from parent (left side) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
      />
      {/* Source handle - outgoing edges to child iterations (right side) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
      />
    </div>
  );
}

export default memo(IterationNode);
