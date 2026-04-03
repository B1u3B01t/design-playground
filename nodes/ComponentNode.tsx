'use client';

import { memo, useState, useCallback, useRef, useEffect, type ComponentType } from 'react';
import { useNodeId, useReactFlow, NodeResizeControl } from '@xyflow/react';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { resolveRegistryItem } from '../registry';
import { CancelGenerationButton } from './shared/IterateDialogParts';
import IterateDialog from './shared/IterateDialog';
import { SizeButtons } from './shared/SizeButtons';

import { useAsyncProps, useScrollCapture, useHtmlContent } from '../hooks/useNodeShared';
import { useTunnelShare } from '../hooks/useTunnelShare';
import ComponentErrorBoundary from './ComponentErrorBoundary';
import {
  COMPONENT_SIZE_CHANGE_EVENT,
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  EDIT_COMPLETE_EVENT,
  JSX_COMPONENT_ADDED_EVENT,
  SIZE_CONFIG,
  getDisplayDimensions,
  RESIZE_MIN_WIDTH,
  RESIZE_MIN_HEIGHT,
  type ComponentSize,
} from '../lib/constants';

interface ComponentNodeProps {
  data: {
    componentId: string;
    /** Persisted across reloads — reflects the last user-chosen size */
    size?: ComponentSize;
    /** Whether this node has been freeform-resized */
    customResized?: boolean;
    /** Render mode: 'react' (default), 'html' for iframe-based, or 'jsx' for on-canvas pasted components */
    renderMode?: 'react' | 'html' | 'jsx';
    /** HTML page folder name (when renderMode is 'html') */
    htmlFolder?: string;
    /** On-canvas JSX component filename in canvas-components/ (when renderMode is 'jsx') */
    jsxFile?: string;
  };
  selected?: boolean;
}

function ComponentNode({ data, selected = false }: ComponentNodeProps) {
  const componentId = data.componentId;
  const isHtml = data.renderMode === 'html';
  const isJsx  = data.renderMode === 'jsx';
  const registryItem = (isHtml || isJsx) ? null : resolveRegistryItem(componentId);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isGlobalGenerating, setIsGlobalGenerating] = useState(false);
  const [iframeKey, setIframeKey] = useState(() => Date.now());

  // On-canvas JSX component — loaded dynamically, updates when HMR re-evaluates index.ts
  const [JsxComponent, setJsxComponent] = useState<ComponentType<any> | null>(null);
  const [jsxError, setJsxError] = useState<string | null>(null);
  const [jsxLoadAttempt, setJsxLoadAttempt] = useState(0);

  // Re-trigger load when a new JSX component is written to disk
  useEffect(() => {
    if (!isJsx) return;
    const handler = () => setJsxLoadAttempt(n => n + 1);
    window.addEventListener(JSX_COMPONENT_ADDED_EVENT, handler);
    return () => window.removeEventListener(JSX_COMPONENT_ADDED_EVENT, handler);
  }, [isJsx]);

  useEffect(() => {
    if (!isJsx || !data.jsxFile) return;
    let cancelled = false;

    import('@/app/playground/canvas-components')
      .then(mod => {
        if (cancelled) return;
        const comp = mod.getOnCanvasComponent(data.jsxFile!);
        if (comp) {
          setJsxComponent(() => comp);
          setJsxError(null);
        }
      })
      .catch(err => {
        if (!cancelled) setJsxError(String(err));
      });

    return () => { cancelled = true; };
  }, [isJsx, data.jsxFile, jsxLoadAttempt]);

  const { resolvedProps, isLoadingProps, propsError } = useAsyncProps((isHtml || isJsx) ? '' : componentId);
  const handleWheel = useScrollCapture(scrollContainerRef);

  const nodeId = useNodeId();
  const { updateNodeData, setNodes } = useReactFlow();
  const isInteractive = !!selected;

  const { share: handleShare, state: shareState } = useTunnelShare(isHtml ? (data.htmlFolder || componentId) : componentId);

  // Prefer the persisted size from node data (survives reload), then registry default
  const [size, setSize] = useState<ComponentSize>(data.size || registryItem?.size || ((isHtml || isJsx) ? 'laptop' : 'default'));
  const [isResizing, setIsResizing] = useState(false);
  const [isCustomResized, setIsCustomResized] = useState(!!data.customResized);

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
      if (detail?.nodeId === nodeId) {
        setIframeKey(Date.now());
      }
    };
    window.addEventListener(EDIT_COMPLETE_EVENT, handler);
    return () => window.removeEventListener(EDIT_COMPLETE_EVENT, handler);
  }, [isHtml, nodeId]);

  const handleResizeStart = useCallback(() => {
    setIsResizing(true);
    setSize('default');
  }, []);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setIsCustomResized(true);
    if (nodeId) updateNodeData(nodeId, { customResized: true, size: 'default' });
  }, [nodeId, updateNodeData]);

  const handleSizeChange = (newSize: ComponentSize) => {
    setSize(newSize);
    setIsCustomResized(false);
    if (nodeId) {
      updateNodeData(nodeId, { size: newSize, customResized: false });
      // Clear any width/height that NodeResizeControl may have set on the node
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, width: undefined, height: undefined, style: { ...n.style, width: undefined, height: undefined } }
            : n,
        ),
      );
    }
    window.dispatchEvent(new CustomEvent(COMPONENT_SIZE_CHANGE_EVENT, {
      detail: { nodeId, size: newSize },
    }));
  };

  if (!isHtml && !isJsx && !registryItem) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 min-w-[200px]">
        <p className="text-red-600 text-sm">Unknown component: {componentId}</p>
      </div>
    );
  }

  const Component = isJsx ? JsxComponent : registryItem?.Component;
  const props = registryItem?.props;
  const label = isHtml
    ? (data.htmlFolder || componentId)
    : isJsx
      ? (data.jsxFile?.replace('.tsx', '') || componentId)
      : (registryItem?.label || componentId);
  const effectiveProps = (resolvedProps ?? props ?? {}) as Record<string, unknown>;
  const config = SIZE_CONFIG[size];
  const isPreset = size !== 'default';
  const isFillMode = isResizing || isCustomResized;
  const isLargeComponent = isPreset || isFillMode;
  const displayDims = getDisplayDimensions(size);
  const htmlSrc = isHtml ? `/${data.htmlFolder}/index.html?t=${iframeKey}` : '';
  const htmlContent = useHtmlContent(htmlSrc, isHtml);

  return (
    <div
      className={`flex flex-col ${isLargeComponent ? '' : 'min-w-[200px]'}`}
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

      {/* ── Top bar — always visible label, controls only when selected ── */}
      <div className="flex items-center justify-between px-0.5 pb-1.5 cursor-grab">
        {/* Left: label (always) + size buttons (selected only) */}
        <div className="flex items-center gap-1.5">
          <span
            className="text-[11px] font-medium select-none leading-none"
            style={{
              fontFamily: 'var(--font-geist-mono), monospace',
              color: isHtml ? '#F97316' : isJsx ? '#7C3AED' : '#0B99FF',
            }}
          >
            {label}
          </span>
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
                    ? `/${data.htmlFolder}/index.html`
                    : isJsx
                      ? undefined
                      : `/playground/iterations/${componentId}`;
                  if (url) window.open(url, '_blank', 'noopener,noreferrer');
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
            selected ? `ring-2 ${isHtml ? 'ring-orange-400' : isJsx ? 'ring-purple-400' : 'ring-[#0B99FF]'}` : ''
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
                  : { minWidth: '400px', minHeight: '300px', width: isPreset ? displayDims.width : undefined, height: isPreset ? displayDims.height : undefined }
              }
            >
              <iframe
                key={iframeKey}
                srcDoc={htmlContent || undefined}
                src={htmlContent ? undefined : htmlSrc}
                className="w-full h-full border-0"
                style={isPreset
                  ? { width: config.width, height: config.height, transform: `scale(${config.scale})`, transformOrigin: 'top left' }
                  : { width: '100%', height: '100%' }
                }
                sandbox="allow-scripts allow-same-origin"
                title={data.htmlFolder}
              />
              {/* Pointer overlay prevents iframe from capturing clicks when not selected */}
              {!isInteractive && <div className="absolute inset-0" data-iframe-overlay />}
            </div>
          ) : isFillMode ? (
            /* Freeform / active resize: fill the node with centered content */
            <div
              ref={scrollContainerRef}
              className={`grid place-items-center p-[5%] overflow-auto w-full h-full ${isInteractive ? 'nodrag nowheel nopan' : ''}`}
              onWheel={isInteractive ? handleWheel : undefined}
            >
              {jsxError ? (
                <div className="text-xs text-red-500 p-4">{jsxError}</div>
              ) : isLoadingProps && !Object.keys(effectiveProps).length ? (
                <div className="text-xs text-gray-500">Loading live data…</div>
              ) : propsError && !Object.keys(effectiveProps).length ? (
                <div className="text-xs text-red-600">Failed to load data: {propsError}</div>
              ) : Component ? (
                <ComponentErrorBoundary componentName={label}>
                  <Component {...effectiveProps} />
                </ComponentErrorBoundary>
              ) : isJsx ? (
                <div className="text-xs text-stone-400">Loading component…</div>
              ) : null}
            </div>
          ) : isPreset ? (
            /* Preset mode (Desktop/Mobile): fixed viewport with zoom scaling */
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
                {jsxError ? (
                  <div className="p-6 text-xs text-red-500">{jsxError}</div>
                ) : isLoadingProps && !Object.keys(effectiveProps).length ? (
                  <div className="p-6 text-xs text-gray-500">Loading live data…</div>
                ) : propsError && !Object.keys(effectiveProps).length ? (
                  <div className="p-6 text-xs text-red-600">Failed to load data: {propsError}</div>
                ) : Component ? (
                  <ComponentErrorBoundary componentName={label}>
                    <Component {...effectiveProps} />
                  </ComponentErrorBoundary>
                ) : isJsx ? (
                  <div className="p-6 text-xs text-stone-400">Loading component…</div>
                ) : null}
              </div>
            </div>
          ) : (
            /* Auto mode: intrinsic sizing */
            <div className={`grid place-items-center p-4 ${isInteractive ? 'nodrag nowheel nopan' : ''}`}>
              {jsxError ? (
                <div className="text-xs text-red-500">{jsxError}</div>
              ) : isLoadingProps && !Object.keys(effectiveProps).length ? (
                <div className="text-xs text-gray-500">Loading live data…</div>
              ) : propsError && !Object.keys(effectiveProps).length ? (
                <div className="text-xs text-red-600">Failed to load data: {propsError}</div>
              ) : Component ? (
                <ComponentErrorBoundary componentName={label}>
                  <Component {...effectiveProps} />
                </ComponentErrorBoundary>
              ) : isJsx ? (
                <div className="text-xs text-stone-400">Loading component…</div>
              ) : null}
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
                  componentName={isHtml ? (data.htmlFolder || componentId) : label.replace(/\s*\(.*\)/, '')}
                  parentNodeId={nodeId ?? ''}
                  isGlobalGenerating={isGlobalGenerating}
                  renderMode={data.renderMode as 'react' | 'html' | 'jsx' | undefined}
                  htmlFolder={data.htmlFolder}
                  jsxFile={data.jsxFile}
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
