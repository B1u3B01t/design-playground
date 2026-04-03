'use client';

import { memo, useState, useCallback, Suspense, useMemo, useRef, useEffect, type ComponentType } from 'react';
import { useReactFlow, NodeResizeControl } from '@xyflow/react';
import { toPng } from 'html-to-image';
import { Check, CheckCheck, Trash2, Loader2, ArrowUpRight, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { resolveRegistryItem, generateAdoptPrompt } from '../registry';
import { getIterationComponent } from '../iterations';
import { CancelGenerationButton } from './shared/IterateDialogParts';
import { SizeButtons } from './shared/SizeButtons';
import { loadOnCanvasComponentModule } from './oncanvas-loader';
import {
  COMPONENT_SIZE_CHANGE_EVENT,
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  EDIT_COMPLETE_EVENT,
  ITERATION_COLLAPSE_TOGGLE_EVENT,
  ADOPTION_COMPLETE_EVENT,
  ADOPTION_ERROR_EVENT,
  FIT_COMPONENT_NODES_EVENT,
  SIZE_CONFIG,
  getDisplayDimensions,
  RESIZE_MIN_WIDTH,
  RESIZE_MIN_HEIGHT,
  type ComponentSize,
  type GenerationStartPayload,
  type GenerationCompletePayload,
  type GenerationErrorPayload,
  type AdoptionCompletePayload,
  type AdoptionErrorPayload,
  JSX_COMPONENT_ADDED_EVENT,
} from '../lib/constants';
import { getProviderFields } from '../lib/generation-body';
import { generateHtmlAdoptPrompt } from '../lib/html-prompts';
import { generateJsxAdoptPrompt } from '../lib/jsx-prompts';
import { useAsyncProps, useScrollCapture, useHtmlContent } from '../hooks/useNodeShared';
import { useTunnelShare } from '../hooks/useTunnelShare';
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
    /** Registry ID inherited from the parent node at creation time */
    registryId?: string;
    /** Size of the parent ComponentNode at the time this iteration was created */
    parentSize?: ComponentSize;
    /** Whether this node has been freeform-resized */
    customResized?: boolean;
    hasChildren?: boolean;
    isCollapsed?: boolean;
    /** Whether this iteration has been adopted into the original component */
    adopted?: boolean;
    onDelete?: (filename: string) => void;
    onAdopt?: (filename: string, componentName: string) => void;
    /** Render mode: 'react' (default), 'html' for iframe-based, or 'jsx' for canvas-components */
    renderMode?: 'react' | 'html' | 'jsx';
    /** HTML page folder name (when renderMode is 'html') */
    htmlFolder?: string;
    /** HTML iteration folder (when renderMode is 'html') */
    htmlIterationFolder?: string;
    /** JSX filename (when renderMode is 'jsx') */
    jsxFile?: string;
  };
  selected?: boolean;
}

function IterationNode({ id, data, selected = false }: IterationNodeProps) {
  const { deleteElements, updateNodeData, setNodes } = useReactFlow();
  const [isDeleting, setIsDeleting] = useState(false);
  const [adoptionStatus, setAdoptionStatus] = useState<'idle' | 'adopting' | 'adopted' | 'error'>(
    () => data.adopted ? 'adopted' : 'idle',
  );
  const [showAdoptConfirm, setShowAdoptConfirm] = useState(false);
  const [adoptThumbnail, setAdoptThumbnail] = useState<string | null>(null);
  const [isGlobalGenerating, setIsGlobalGenerating] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [iframeKey, setIframeKey] = useState(() => Date.now());

  const isInteractive = !!selected;
  const isHtml = data.renderMode === 'html';
  const isJsx = data.renderMode === 'jsx';

  const iterationHtmlUrl = isHtml ? `/${data.htmlFolder}/${data.htmlIterationFolder}/index.html?t=${iframeKey}` : '';
  const htmlContent = useHtmlContent(iterationHtmlUrl, isHtml);

  const IterationComponent = useMemo(() => (isHtml || isJsx) ? null : getIterationComponent(data.filename), [data.filename, isHtml, isJsx]);

  // On-canvas JSX iteration — loaded dynamically from canvas-components
  const [JsxComponent, setJsxComponent] = useState<ComponentType<any> | null>(null);
  const [jsxLoadAttempt, setJsxLoadAttempt] = useState(0);

  useEffect(() => {
    if (!isJsx) return;
    const handler = () => setJsxLoadAttempt(n => n + 1);
    window.addEventListener(JSX_COMPONENT_ADDED_EVENT, handler);
    return () => window.removeEventListener(JSX_COMPONENT_ADDED_EVENT, handler);
  }, [isJsx]);

  useEffect(() => {
    if (!isJsx || !data.jsxFile) return;
    let cancelled = false;
    loadOnCanvasComponentModule()
      .then(mod => {
        if (cancelled) return;
        const comp = mod.getOnCanvasComponent(data.jsxFile!);
        if (comp) setJsxComponent(() => comp);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isJsx, data.jsxFile, jsxLoadAttempt]);

  const registryId = useMemo(
    () => (isHtml || isJsx) ? '' : (data.registryId
      ?? data.componentName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')),
    [data.registryId, data.componentName, isHtml, isJsx],
  );

  const iterationSlug = useMemo(() => isHtml
    ? `${data.htmlFolder}/${data.htmlIterationFolder}`
    : data.filename.replace(/\.tsx$/, ''),
    [data.filename, isHtml, data.htmlFolder, data.htmlIterationFolder]);
  const { share: handleShare, state: shareState } = useTunnelShare(iterationSlug);

  const { resolvedProps, isLoadingProps, propsError } = useAsyncProps((isHtml || isJsx) ? '' : registryId);
  const registryItem = useMemo(() => (isHtml || isJsx) ? null : resolveRegistryItem(registryId), [registryId, isHtml, isJsx]);
  const staticProps = useMemo(() => registryItem?.props || {}, [registryItem]);
  const effectiveProps = (resolvedProps ?? staticProps) as Record<string, unknown>;
  // Independent size — persisted in node data, initially from parent at creation time
  const [size, setSize] = useState<ComponentSize>(
    () => data.parentSize || resolveRegistryItem(registryId)?.size || ((isHtml || isJsx) ? 'laptop' : 'default'),
  );
  const [isResizing, setIsResizing] = useState(false);
  const [isCustomResized, setIsCustomResized] = useState(!!data.customResized);

  // Listen for parent size changes — only apply if not custom-resized
  useEffect(() => {
    const handleParentSizeChange = (e: CustomEvent<{ nodeId: string; size: ComponentSize }>) => {
      if (e.detail.nodeId === data.parentNodeId && !isCustomResized) {
        setSize(e.detail.size);
      }
    };
    window.addEventListener(COMPONENT_SIZE_CHANGE_EVENT, handleParentSizeChange as EventListener);
    return () => window.removeEventListener(COMPONENT_SIZE_CHANGE_EVENT, handleParentSizeChange as EventListener);
  }, [data.parentNodeId, isCustomResized]);

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

  // Listen for edit-complete to refresh iframe
  useEffect(() => {
    if (!isHtml) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.nodeId === id) {
        setIframeKey(Date.now());
      }
    };
    window.addEventListener(EDIT_COMPLETE_EVENT, handler);
    return () => window.removeEventListener(EDIT_COMPLETE_EVENT, handler);
  }, [isHtml, id]);

  const handleResizeStart = useCallback(() => {
    setIsResizing(true);
    setSize('default');
  }, []);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setIsCustomResized(true);
    updateNodeData(id, { customResized: true });
  }, [id, updateNodeData]);

  const handleSizeChange = (newSize: ComponentSize) => {
    setSize(newSize);
    setIsCustomResized(false);
    updateNodeData(id, { size: newSize, customResized: false });
    // Clear any width/height that NodeResizeControl may have set on the node
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? { ...n, width: undefined, height: undefined, style: { ...n.style, width: undefined, height: undefined } }
          : n,
      ),
    );
  };

  const config = SIZE_CONFIG[size];
  const isPreset = size !== 'default';
  const isFillMode = isResizing || isCustomResized;
  const isLargeComponent = isPreset || isFillMode;
  const displayDims = getDisplayDimensions(size);
  const handleWheel = useScrollCapture(scrollContainerRef);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      let response: Response;
      if (isJsx) {
        response = await fetch('/playground/api/oncanvas-components', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: data.jsxFile }),
        });
      } else if (isHtml) {
        response = await fetch('/playground/api/html-pages', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageFolder: data.htmlFolder, iterationFolder: data.htmlIterationFolder }),
        });
      } else {
        response = await fetch('/playground/api/iterations', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: data.filename }),
        });
      }
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

  // Capture thumbnail when adopt dialog opens
  const openAdoptConfirm = useCallback(() => {
    setShowAdoptConfirm(true);
    setAdoptThumbnail(null);
    // Capture a thumbnail of the iteration's rendered frame
    const nodeEl = document.querySelector(`[data-id="${id}"]`);
    const frameEl = nodeEl?.querySelector('[data-screenshot-target]');
    if (frameEl instanceof HTMLElement) {
      const rect = frameEl.getBoundingClientRect();
      // Temporarily patch cssRules to avoid SecurityError from cross-origin sheets
      const desc = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'cssRules');
      const descRules = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'rules');
      const safeGetter = function (this: CSSStyleSheet) {
        try { return desc!.get!.call(this); } catch { return [] as unknown as CSSRuleList; }
      };
      Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', { get: safeGetter, configurable: true });
      Object.defineProperty(CSSStyleSheet.prototype, 'rules', { get: safeGetter, configurable: true });
      const w = Math.ceil(rect.width);
      const h = Math.ceil(rect.height);
      toPng(frameEl, { pixelRatio: 1, width: w, height: h })
        .catch(() => null as string | null)
        .then(() => toPng(frameEl, { pixelRatio: 2, width: w, height: h }))
        .then((url) => { if (url) setAdoptThumbnail(url); })
        .catch(() => {})
        .finally(() => {
          if (desc) Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', desc);
          if (descRules) Object.defineProperty(CSSStyleSheet.prototype, 'rules', descRules);
        });
    }
  }, [id]);

  const handleAdoptConfirm = async () => {
    setShowAdoptConfirm(false);
    setAdoptionStatus('adopting');

    const toastId = `adopt-${id}`;

    // Generate the adopt prompt
    let adoptPrompt: string;
    if (isJsx && data.jsxFile) {
      const baseFile = data.jsxFile.replace(/\.iteration-\d+\.tsx$/, '.tsx');
      adoptPrompt = generateJsxAdoptPrompt(baseFile, data.jsxFile);
    } else if (isHtml && data.htmlFolder && data.htmlIterationFolder) {
      adoptPrompt = generateHtmlAdoptPrompt(data.htmlFolder, data.htmlIterationFolder);
    } else {
      adoptPrompt = generateAdoptPrompt(registryId, data.filename);
    }

    const componentId = isJsx ? `jsx:${data.componentName}` : isHtml ? `html:${data.htmlFolder}` : registryId;

    // Dispatch start event (for presence bubbles — editMode prevents skeleton nodes)
    window.dispatchEvent(
      new CustomEvent<GenerationStartPayload>(GENERATION_START_EVENT, {
        detail: {
          componentId,
          componentName: data.componentName,
          parentNodeId: data.parentNodeId,
          iterationCount: 0,
          editMode: true,
          adoptionMode: true,
          ...(isHtml ? { renderMode: 'html' as const, htmlFolder: data.htmlFolder } : {}),
          ...getProviderFields() as Pick<GenerationStartPayload, 'model' | 'provider'>,
        },
      }),
    );

    try {
      const response = await fetch('/playground/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: adoptPrompt,
          componentId: `adopt-${componentId}`,
          ...getProviderFields(),
          ...(isHtml ? { htmlFolder: data.htmlFolder } : {}),
        }),
      });

      const result = await response.json().catch(() => ({ success: false, error: 'Invalid response' }));

      if (!response.ok || !result.success) {
        const errorMsg = result?.error || 'Adoption failed';
        window.dispatchEvent(
          new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
            detail: { componentId, parentNodeId: data.parentNodeId, error: errorMsg },
          }),
        );
        window.dispatchEvent(
          new CustomEvent<AdoptionErrorPayload>(ADOPTION_ERROR_EVENT, {
            detail: { iterationNodeId: id, componentId, parentNodeId: data.parentNodeId, error: errorMsg },
          }),
        );
        toast.error(`Adoption failed: ${errorMsg}`, { id: toastId, duration: 6000 });
        setAdoptionStatus('error');
        setTimeout(() => setAdoptionStatus('idle'), 3000);
      } else {
        // Success — refresh the original component
        if (isHtml) {
          window.dispatchEvent(
            new CustomEvent(EDIT_COMPLETE_EVENT, { detail: { nodeId: data.parentNodeId } }),
          );
        }
        window.dispatchEvent(
          new CustomEvent<GenerationCompletePayload>(GENERATION_COMPLETE_EVENT, {
            detail: { componentId, parentNodeId: data.parentNodeId, output: result.output || '' },
          }),
        );
        window.dispatchEvent(
          new CustomEvent<AdoptionCompletePayload>(ADOPTION_COMPLETE_EVENT, {
            detail: { iterationNodeId: id, componentId, parentNodeId: data.parentNodeId },
          }),
        );
        toast.success('Variation adopted! The original component has been updated.', { id: toastId });
        setAdoptionStatus('adopted');
        updateNodeData(id, { adopted: true });
        data.onAdopt?.(data.filename, data.componentName);

        // Pan canvas to the original (parent) component so the user sees the update
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent(FIT_COMPONENT_NODES_EVENT, {
              detail: { componentId },
            }),
          );
        }, 600);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      window.dispatchEvent(
        new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
          detail: { componentId, parentNodeId: data.parentNodeId, error: errorMsg },
        }),
      );
      window.dispatchEvent(
        new CustomEvent<AdoptionErrorPayload>(ADOPTION_ERROR_EVENT, {
          detail: { iterationNodeId: id, componentId, parentNodeId: data.parentNodeId, error: errorMsg },
        }),
      );
      toast.error(`Adoption failed: ${errorMsg}`, { id: toastId, duration: 6000 });
      setAdoptionStatus('error');
      setTimeout(() => setAdoptionStatus('idle'), 3000);
    }
  };

  // e.g. "PricingCard" + 3 → "pricing-card #3", or "landing #1" for HTML, or "frame-5 #1" for JSX
  const iterationLabel = useMemo(() => {
    if (isJsx) return `${data.jsxFile?.replace(/\.iteration-\d+\.tsx$/, '').replace('.tsx', '') || data.componentName} #${data.iterationNumber}`;
    if (isHtml) return `${data.htmlFolder} #${data.iterationNumber}`;
    const key = data.componentName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    return `${key} #${data.iterationNumber}`;
  }, [data.componentName, data.iterationNumber, isHtml, isJsx, data.htmlFolder, data.jsxFile]);

  // Resolved renderable component: JSX (from canvas-components) or React (from iterations registry)
  const RenderComponent = isJsx ? JsxComponent : IterationComponent;

  return (
    <div
      className={`flex flex-col ${isLargeComponent ? '' : 'min-w-[280px]'}`}
      style={{
        ...(isPreset ? { width: displayDims.width } : {}),
        ...(isFillMode ? { width: '100%', height: '100%' } : {}),
        fontFamily: 'var(--font-geist-sans), Geist, system-ui, sans-serif',
      }}
    >
      {/* Resize handle — bottom-right corner, only when selected */}
      <NodeResizeControl
        position="bottom-right"
        minWidth={RESIZE_MIN_WIDTH}
        minHeight={RESIZE_MIN_HEIGHT}
        onResizeStart={handleResizeStart}
        onResizeEnd={handleResizeEnd}
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

      {/* ── Top bar — label always, controls only when selected ── */}
      <div className="flex items-center justify-between px-0.5 pb-1.5 cursor-grab">
        {/* Left: collapse toggle + label + size buttons */}
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
            style={{ fontFamily: 'var(--font-geist-mono), monospace', color: isJsx ? '#7C3AED' : isHtml ? '#F97316' : '#0B99FF' }}
          >
            {iterationLabel}
          </span>
          {adoptionStatus === 'adopted' && (
            <span className="text-[9px] font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5 leading-none select-none shrink-0">
              Adopted
            </span>
          )}
          {adoptionStatus === 'adopting' && (
            <span className="flex items-center gap-1 text-[9px] text-stone-400 select-none shrink-0">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              adopting
            </span>
          )}
          <div className={`flex items-center gap-1.5 transition-opacity nodrag ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="w-px h-3 bg-stone-200 shrink-0" />
            <SizeButtons currentSize={size} onSizeChange={handleSizeChange} />
          </div>
        </div>

        {/* Right: expand icon — invisible when not selected, always occupies space */}
        <div className={`transition-opacity nodrag ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  const url = isHtml
                    ? `/${data.htmlFolder}/${data.htmlIterationFolder}/index.html`
                    : `/playground/iterations/${data.filename.replace(/\.tsx$/, '')}`;
                  window.open(url, '_blank', 'noopener,noreferrer');
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
      <div className={`relative flex items-start ${isFillMode ? 'flex-1 min-h-0' : ''}`}>
        {/* Component frame */}
        <div
          data-screenshot-target
          className={`app-theme bg-background overflow-hidden rounded-xl ${isResizing ? '' : 'transition-all'} ${
            adoptionStatus === 'adopted' ? 'ring-2 ring-green-400'
              : selected ? `ring-2 ${isJsx ? 'ring-purple-400' : isHtml ? 'ring-orange-400' : 'ring-[#0B99FF]'}` : ''
          } ${isFillMode ? 'w-full h-full' : ''}`}
          style={isJsx ? { contain: 'paint' } : undefined}
        >
          {isHtml ? (
            /* HTML iframe rendering */
            <div
              className="relative"
              style={isPreset
                ? { width: displayDims.width, height: displayDims.height }
                : isFillMode
                  ? { width: '100%', height: '100%' }
                  : { minWidth: '400px', minHeight: '300px' }
              }
            >
              <iframe
                key={iframeKey}
                srcDoc={htmlContent || undefined}
                src={htmlContent ? undefined : iterationHtmlUrl}
                className="w-full h-full border-0"
                style={isPreset
                  ? { width: config.width, height: config.height, transform: `scale(${config.scale})`, transformOrigin: 'top left' }
                  : { width: '100%', height: '100%' }
                }
                sandbox="allow-scripts allow-same-origin"
                title={`${data.htmlFolder} #${data.iterationNumber}`}
              />
              {!isInteractive && <div className="absolute inset-0" data-iframe-overlay />}
            </div>
          ) : isFillMode ? (
            /* Freeform / active resize: fill the node with centered content */
            <div
              ref={scrollContainerRef}
              className={`grid place-items-center p-[5%] overflow-auto w-full h-full ${isInteractive ? 'nodrag nowheel nopan' : ''}`}
              onWheel={isInteractive ? handleWheel : undefined}
            >
              {RenderComponent ? (
                <Suspense fallback={<Loader2 className="w-5 h-5 animate-spin text-gray-400" />}>
                  <div className="w-full">
                    {isLoadingProps && !Object.keys(effectiveProps).length ? (
                      <div className="text-xs text-gray-500">Loading live data…</div>
                    ) : propsError && !Object.keys(effectiveProps).length ? (
                      <div className="text-xs text-red-600">Failed to load data: {propsError}</div>
                    ) : (
                      <ComponentErrorBoundary componentName={`${data.componentName} #${data.iterationNumber}`}>
                        <RenderComponent {...effectiveProps} />
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
          ) : isPreset ? (
            /* Preset mode (Desktop/Mobile): fixed viewport with zoom scaling */
            <div
              ref={scrollContainerRef}
              className={`bg-gray-100 overflow-x-hidden overflow-y-auto ${isInteractive ? 'nodrag nowheel nopan' : ''}`}
              style={{ width: displayDims.width, height: displayDims.height }}
              onWheel={isInteractive ? handleWheel : undefined}
            >
              {RenderComponent ? (
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  }
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
                      <ComponentErrorBoundary componentName={`${data.componentName} #${data.iterationNumber}`}>
                        <RenderComponent {...effectiveProps} />
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
            /* Auto mode: intrinsic sizing */
            <div className={`grid place-items-center min-h-[100px] p-4 ${isInteractive ? 'nodrag nowheel nopan' : ''}`}>
              {RenderComponent ? (
                <Suspense fallback={<Loader2 className="w-5 h-5 animate-spin text-gray-400" />}>
                  <div className="w-full">
                    {isLoadingProps && !Object.keys(effectiveProps).length ? (
                      <div className="text-xs text-gray-500">Loading live data…</div>
                    ) : propsError && !Object.keys(effectiveProps).length ? (
                      <div className="text-xs text-red-600">Failed to load data: {propsError}</div>
                    ) : (
                      <ComponentErrorBoundary componentName={`${data.componentName} #${data.iterationNumber}`}>
                        <RenderComponent {...effectiveProps} />
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
            {/* Iterate or cancel */}
            {isGlobalGenerating ? (
              <CancelGenerationButton />
            ) : (
              <IterateDialog
                componentId={isJsx ? `jsx:${data.componentName}` : isHtml ? `html:${data.htmlFolder}` : registryId}
                componentName={data.componentName}
                parentNodeId={id}
                sourceFilename={data.filename}
                isGlobalGenerating={isGlobalGenerating}
                renderMode={data.renderMode}
                htmlFolder={data.htmlFolder}
                htmlIterationFolder={data.htmlIterationFolder}
                jsxFile={data.jsxFile}
              />
            )}

            {/* Use this (adopt) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={openAdoptConfirm}
                  disabled={adoptionStatus === 'adopting' || isGlobalGenerating}
                  className={`w-8 h-8 flex items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${
                    adoptionStatus === 'adopted'
                      ? 'bg-green-50 border-green-300 text-green-600'
                      : adoptionStatus === 'error'
                        ? 'bg-red-50 border-red-300 text-red-500'
                        : 'bg-white border-stone-200 text-stone-400 hover:text-green-600 hover:border-green-300'
                  }`}
                  aria-label={
                    adoptionStatus === 'adopting' ? 'Adopting...'
                      : adoptionStatus === 'adopted' ? 'Adopted'
                        : 'Adopt this variation'
                  }
                >
                  {adoptionStatus === 'adopting' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : adoptionStatus === 'adopted' ? (
                    <CheckCheck className="w-3.5 h-3.5" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>
                  {adoptionStatus === 'adopting' ? 'Adopting variation...'
                    : adoptionStatus === 'adopted' ? 'Adopted'
                      : isGlobalGenerating ? 'Cannot adopt during generation'
                        : 'Adopt this variation'}
                </p>
              </TooltipContent>
            </Tooltip>

            {/* Adopt confirmation dialog */}
            <AlertDialog open={showAdoptConfirm} onOpenChange={setShowAdoptConfirm}>
              <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>Adopt this variation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {isHtml
                      ? 'This will overwrite the original index.html with this variation. You can revert using git if needed.'
                      : "This will replace the original component's UI with this variation's layout and styling. Props, hooks, and logic will be preserved."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {/* Iteration preview thumbnail */}
                {adoptThumbnail ? (
                  <div className="rounded-lg border border-stone-200 overflow-hidden bg-stone-50">
                    <img
                      src={adoptThumbnail}
                      alt={`Preview of ${iterationLabel}`}
                      className="w-full max-h-[240px] object-contain object-top"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-stone-200 bg-stone-50">
                    <span className="text-xs text-stone-400">Capturing preview…</span>
                  </div>
                )}
                <p className="text-xs text-stone-500 text-center -mt-1">
                  {iterationLabel}
                </p>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleAdoptConfirm}
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    Adopt
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

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
          </div>
      </div>

    </div>
  );
}

export default memo(IterationNode);
