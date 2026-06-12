'use client';

import { memo, useState, useCallback, useRef, useEffect, type ComponentType, type MouseEvent } from 'react';
import { useNodeId, useReactFlow, NodeResizeControl } from '@xyflow/react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { resolveRegistryItem } from '../registry';
import { findFlowDescriptorForComponent } from '../lib/flows/registry';
import { FLOW_DECOMPOSE_EVENT, type FlowDecomposePayload } from '../lib/constants';
import IterateDialog from './shared/IterateDialog';
import { SizeButtons } from './shared/SizeButtons';
import { NodeLabel, useInverseZoom } from './shared/NodeLabel';
import { loadOnCanvasComponentModule } from './oncanvas-loader';

import { useAsyncProps, useScrollCapture, useHtmlContent } from '../hooks/useNodeShared';
import { useTunnelShare } from '../hooks/useTunnelShare';
import ComponentErrorBoundary from './ComponentErrorBoundary';
import { useInteractiveNodeStore, useIsInteractiveNode } from '../lib/interactive-node-store';
import { useFrameHoverHint } from './shared/FrameHoverHint';
import {
  COMPONENT_SIZE_CHANGE_EVENT,
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  EDIT_COMPLETE_EVENT,
  JSX_COMPONENT_ADDED_EVENT,
  DESIGN_SYSTEM_GENERATED_EVENT,
  DESIGN_SYSTEM_SHOWCASE_RAW_URL,
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
    /** Render mode: 'react' (default), 'html' for saved HTML, 'jsx' for pasted TSX, 'embed' for pasted URLs, 'design-system' for the generated showcase */
    renderMode?: 'react' | 'html' | 'jsx' | 'embed' | 'design-system';
    /** HTML page folder name (when renderMode is 'html') */
    htmlFolder?: string;
    /** On-canvas JSX component filename in canvas-components/ (when renderMode is 'jsx') */
    jsxFile?: string;
    /** Remote page URL (when renderMode is 'embed') */
    embedUrl?: string;
  };
  selected?: boolean;
}

function ComponentNode({ data, selected = false }: ComponentNodeProps) {
  const labelInvScale = useInverseZoom();
  // Hide the play button once its visual width (14px × inv) overruns its
  // layout slot (14 + 6 gap) so it doesn't visually overlap the label.
  const hidePlayButton = labelInvScale * 14 > 14 + 6;
  const componentId = data.componentId;
  const isHtml = data.renderMode === 'html';
  const isJsx = data.renderMode === 'jsx';
  const isEmbed = data.renderMode === 'embed';
  const isDesignSystem = data.renderMode === 'design-system';
  const registryItem = isHtml || isJsx || isEmbed || isDesignSystem ? null : resolveRegistryItem(componentId);
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
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Poll the module barrel until the new file shows up. HMR can take a few
    // seconds to recompile after the file is written to disk; without polling,
    // freshly pasted frames stay stuck on "Loading component…" until refresh.
    const attempt = (delay: number) => {
      loadOnCanvasComponentModule()
        .then(mod => {
          if (cancelled) return;
          const comp = mod.getOnCanvasComponent(data.jsxFile!);
          if (comp) {
            setJsxComponent(() => comp);
            setJsxError(null);
            return;
          }
          if (delay <= 8000) {
            timer = setTimeout(() => attempt(Math.min(delay * 1.5, 2000)), delay);
          }
        })
        .catch(err => {
          if (!cancelled) setJsxError(String(err));
        });
    };
    attempt(300);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isJsx, data.jsxFile, jsxLoadAttempt]);

  const { resolvedProps, isLoadingProps, propsError } = useAsyncProps(
    isHtml || isJsx || isEmbed || isDesignSystem ? '' : componentId,
  );
  const handleWheel = useScrollCapture(scrollContainerRef);

  const nodeId = useNodeId();
  const { updateNodeData, setNodes, getNode } = useReactFlow();
  const flowDescriptor = !isHtml && !isJsx && !isEmbed && !isDesignSystem
    ? findFlowDescriptorForComponent(componentId)
    : null;

  const handleDecompose = useCallback(() => {
    if (!nodeId || !flowDescriptor) return;
    const node = getNode(nodeId);
    if (!node) return;
    const payload: FlowDecomposePayload = {
      parentNodeId: nodeId,
      componentId,
      anchor: { x: node.position.x, y: node.position.y },
    };
    window.dispatchEvent(new CustomEvent(FLOW_DECOMPOSE_EVENT, { detail: payload }));
  }, [nodeId, flowDescriptor, getNode, componentId]);
  const isInteractive = useIsInteractiveNode(nodeId);
  const setInteractiveNodeId = useInteractiveNodeStore((s) => s.setInteractiveNodeId);

  const handleFrameDoubleClick = useCallback(() => {
    if (nodeId) setInteractiveNodeId(nodeId);
  }, [nodeId, setInteractiveNodeId]);

  const hoverHint = useFrameHoverHint(!isInteractive);

  // Clear interactive mode if this node becomes deselected
  useEffect(() => {
    if (!selected && isInteractive) setInteractiveNodeId(null);
  }, [selected, isInteractive, setInteractiveNodeId]);

  // Listen for Escape inside same-origin iframe to exit interactive mode
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (!isInteractive) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInteractiveNodeId(null);
    };
    window.addEventListener('keydown', handleEsc);
    const iframe = iframeRef.current;
    let innerDoc: Document | null = null;
    try {
      innerDoc = iframe?.contentDocument ?? null;
      innerDoc?.addEventListener('keydown', handleEsc);
    } catch {
      // cross-origin iframe — skip
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      try { innerDoc?.removeEventListener('keydown', handleEsc); } catch { /* noop */ }
    };
  }, [isInteractive, setInteractiveNodeId]);

  const sharePath = isHtml
    ? `/${data.htmlFolder || componentId}/index.html`
    : componentId;
  const { share: handleTunnelShare, state: shareState, disabledTooltip: shareDisabledTooltip } = useTunnelShare(sharePath);

  const [embedLinkCopied, setEmbedLinkCopied] = useState(false);
  const handleShare = useCallback(async () => {
    if (isEmbed && data.embedUrl) {
      try {
        await navigator.clipboard.writeText(data.embedUrl);
        setEmbedLinkCopied(true);
        window.setTimeout(() => setEmbedLinkCopied(false), 2000);
      } catch {
        /* ignore */
      }
      return;
    }
    await handleTunnelShare();
  }, [isEmbed, data.embedUrl, handleTunnelShare]);

  const effectiveShareState = isEmbed ? (embedLinkCopied ? 'copied' : 'idle') : shareState;

  // Prefer the persisted size from node data (survives reload), then registry default
  const [size, setSize] = useState<ComponentSize>(
    data.size || registryItem?.size || (isHtml || isEmbed || isDesignSystem ? 'laptop' : 'default'),
  );
  const [isResizing, setIsResizing] = useState(false);
  const [isCustomResized, setIsCustomResized] = useState(!!data.customResized);
  const [isRenamingHtml, setIsRenamingHtml] = useState(false);
  const [htmlRenameValue, setHtmlRenameValue] = useState('');
  const htmlRenameInputRef = useRef<HTMLInputElement>(null);

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

  const htmlSrc = isHtml
    ? `/${data.htmlFolder}/index.html?t=${iframeKey}`
    : isDesignSystem
      ? `${DESIGN_SYSTEM_SHOWCASE_RAW_URL}&t=${iframeKey}`
      : '';
  const htmlContent = useHtmlContent(htmlSrc, isHtml || isDesignSystem);

  // Refresh the design-system iframe when a new showcase is generated.
  useEffect(() => {
    if (!isDesignSystem) return;
    const handler = () => setIframeKey(Date.now());
    window.addEventListener(DESIGN_SYSTEM_GENERATED_EVENT, handler);
    return () => window.removeEventListener(DESIGN_SYSTEM_GENERATED_EVENT, handler);
  }, [isDesignSystem]);

  const embedUrlLabel = (() => {
    if (!isEmbed || !data.embedUrl) return 'Embed';
    const withoutScheme = data.embedUrl.replace(/^https?:\/\//i, '').trim();
    const noTrailingSlash = withoutScheme.replace(/\/+$/, '');
    return noTrailingSlash || 'Embed';
  })();

  const Component = isJsx ? JsxComponent : registryItem?.Component;
  const props = registryItem?.props;
  const label = isHtml
    ? (data.htmlFolder || componentId)
    : isJsx
      ? (data.jsxFile?.replace('.tsx', '') || componentId)
      : isEmbed
        ? embedUrlLabel
        : isDesignSystem
          ? 'Design System'
          : (registryItem?.label || componentId);
  const effectiveProps = (resolvedProps ?? props ?? {}) as Record<string, unknown>;
  const config = SIZE_CONFIG[size];
  const isPreset = size !== 'default';
  const isFillMode = isResizing || isCustomResized;
  const isLargeComponent = isPreset || isFillMode;
  const displayDims = getDisplayDimensions(size);

  const beginHtmlRename = useCallback((e: MouseEvent<HTMLSpanElement>) => {
    if (!isHtml) return;
    e.preventDefault();
    e.stopPropagation();
    setHtmlRenameValue(data.htmlFolder || componentId);
    setIsRenamingHtml(true);
  }, [isHtml, data.htmlFolder, componentId]);

  const cancelHtmlRename = useCallback(() => {
    setIsRenamingHtml(false);
    setHtmlRenameValue('');
  }, []);

  const commitHtmlRename = useCallback(async () => {
    if (!isHtml) return;
    const oldFolder = data.htmlFolder?.trim();
    const nextName = htmlRenameValue.trim();
    if (!oldFolder || !nextName) {
      cancelHtmlRename();
      return;
    }
    if (oldFolder.toLowerCase() === nextName.toLowerCase()) {
      cancelHtmlRename();
      return;
    }

    try {
      const res = await fetch('/playground/api/html-pages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageFolder: oldFolder, newName: nextName }),
      });
      const result = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !result?.success || !result?.page?.folder) {
        toast.error(result?.error || 'Failed to rename riff');
        return;
      }

      const newFolder = result.page.folder as string;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === 'component') {
            const nodeData = n.data as ComponentNodeProps['data'];
            if (nodeData.renderMode === 'html' && nodeData.htmlFolder === oldFolder) {
              return {
                ...n,
                data: {
                  ...nodeData,
                  componentId: `html:${newFolder}`,
                  htmlFolder: newFolder,
                },
              };
            }
            return n;
          }

          if (n.type === 'iteration') {
            const nodeData = n.data as Record<string, unknown>;
            if (nodeData.renderMode === 'html' && nodeData.htmlFolder === oldFolder) {
              return {
                ...n,
                data: {
                  ...nodeData,
                  htmlFolder: newFolder,
                  componentName: newFolder,
                },
              };
            }
          }
          return n;
        }),
      );
      window.dispatchEvent(new CustomEvent('playground:html-pages-updated'));
      cancelHtmlRename();
    } catch {
      toast.error('Failed to rename riff');
    }
  }, [isHtml, data.htmlFolder, htmlRenameValue, setNodes, cancelHtmlRename]);

  useEffect(() => {
    if (isRenamingHtml) {
      requestAnimationFrame(() => {
        htmlRenameInputRef.current?.focus();
        htmlRenameInputRef.current?.select();
      });
    }
  }, [isRenamingHtml]);

  if (!isHtml && !isJsx && !isEmbed && !isDesignSystem && !registryItem) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 min-w-[200px]">
        <p className="text-red-600 text-sm">Unknown component: {componentId}</p>
      </div>
    );
  }

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
        {/* Left: open-in-new-tab + label (always visible) */}
        <div className="flex items-center gap-1.5">
          {!isJsx && !isDesignSystem && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    const url = isEmbed
                      ? data.embedUrl
                      : isHtml
                        ? `/${data.htmlFolder}/index.html`
                        : `/playground/iterations/${componentId}`;
                    if (url) window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                  className="nodrag shrink-0 p-0 leading-none rounded-[5px] transition-colors"
                  style={{
                    color: selected
                      ? (isHtml ? '#F97316' : isEmbed ? '#0D9488' : '#0B99FF')
                      : '#A8A29E',
                    display: 'inline-block',
                    transform: `scale(${labelInvScale})`,
                    transformOrigin: 'left bottom',
                    willChange: 'transform',
                    visibility: hidePlayButton ? 'hidden' : 'visible',
                    pointerEvents: hidePlayButton ? 'none' : undefined,
                  }}
                  aria-label="Open in new tab"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="2" width="20" height="20" rx="5" fill="currentColor" />
                    <path d="M10 8 L16 12 L10 16 Z" fill="white" />
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent><p>Open in new tab</p></TooltipContent>
            </Tooltip>
          )}
          <NodeLabel color={isHtml ? '#F97316' : isJsx ? '#7C3AED' : isEmbed ? '#0D9488' : isDesignSystem ? '#C026D3' : '#0B99FF'}>
            {isHtml ? (
              isRenamingHtml ? (
                <input
                  ref={htmlRenameInputRef}
                  value={htmlRenameValue}
                  onChange={(e) => setHtmlRenameValue(e.target.value)}
                  onBlur={() => { void commitHtmlRename(); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void commitHtmlRename();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelHtmlRename();
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="nodrag rounded-sm border border-orange-300 bg-white/90 px-1 py-0 text-[11px] text-stone-700 outline-none focus:border-orange-400"
                />
              ) : (
                <span
                  className="nodrag"
                  onPointerDown={(e) => e.stopPropagation()}
                  onDoubleClick={beginHtmlRename}
                  title="Double-click to rename riff"
                >
                  {label}
                </span>
              )
            ) : (
              label
            )}
          </NodeLabel>
        </div>

        {/* Right: size controls — invisible when not selected */}
        <div className={`flex items-center gap-1.5 transition-opacity nodrag ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <SizeButtons currentSize={size} onSizeChange={handleSizeChange} />
        </div>
      </div>

      {/* ── Frame + right-side vertical toolbar ── */}
      <div className={`relative flex items-start ${isFillMode ? 'flex-1 min-h-0' : ''}`}>
        {/* Component frame */}
        <div
          data-screenshot-target
          data-interactive={isInteractive ? 'true' : undefined}
          onDoubleClick={handleFrameDoubleClick}
          onMouseMove={hoverHint.onMouseMove}
          onMouseLeave={hoverHint.onMouseLeave}
          className={`relative app-theme bg-background overflow-hidden rounded-xl ${isResizing ? '' : 'transition-all'} ${
            selected
              ? `ring-2 ${isHtml ? 'ring-orange-400' : isJsx ? 'ring-purple-400' : isEmbed ? 'ring-teal-400' : isDesignSystem ? 'ring-fuchsia-400' : 'ring-[#0B99FF]'}`
              : ''
          } ${isInteractive ? 'ring-offset-2' : ''} ${isFillMode ? 'w-full h-full' : ''}`}
          style={isJsx ? { contain: 'paint' } : undefined}
        >
          {isHtml || isEmbed || isDesignSystem ? (
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
                ref={iframeRef}
                key={isEmbed ? data.embedUrl : iframeKey}
                {...(isEmbed
                  ? { src: data.embedUrl }
                  : { srcDoc: htmlContent || undefined, src: htmlContent ? undefined : htmlSrc })}
                className="w-full h-full border-0"
                style={isPreset
                  ? { width: config.width, height: config.height, transform: `scale(${config.scale})`, transformOrigin: 'top left' }
                  : { width: '100%', height: '100%' }
                }
                sandbox={
                  isEmbed
                    ? 'allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads'
                    : 'allow-scripts allow-same-origin'
                }
                title={isEmbed ? label : data.htmlFolder}
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
                className={isJsx ? 'bg-white' : 'bg-background'}
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
            <div
              className={`grid place-items-center p-4 ${isInteractive ? 'nodrag nowheel nopan' : ''}`}
              style={isJsx ? { minWidth: '400px', minHeight: '400px' } : undefined}
            >
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
          {/* Click-blocker for non-iframe (JSX/React) render modes — gates
              link/button activity on a double-click, mirroring the iframe
              overlay above. Already redundant for iframe/embed cases (which
              keep their own scoped overlay) but harmless. Element-select
              mode disables this via `[data-iframe-overlay] { pointer-events:
              none !important }` in playground-global.css. */}
          {!isInteractive && <div className="absolute inset-0" data-iframe-overlay />}
        </div>

        {hoverHint.tooltip}

        {/* Right-side vertical action toolbar — always in DOM, invisible when not selected */}
        <div className={`absolute top-0 left-full pl-2 flex flex-col items-center gap-2 nodrag transition-opacity ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {!isEmbed && !isDesignSystem ? (
                  <IterateDialog
                    componentId={componentId}
                    componentName={isHtml ? (data.htmlFolder || componentId) : label.replace(/\s*\(.*\)/, '')}
                    parentNodeId={nodeId ?? ''}
                    isGlobalGenerating={isGlobalGenerating}
                    renderMode={data.renderMode as 'react' | 'html' | 'jsx' | undefined}
                    htmlFolder={data.htmlFolder}
                    jsxFile={data.jsxFile}
                  />
                ) : null}

                {flowDescriptor && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleDecompose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-stone-200 text-stone-400 hover:text-purple-600 hover:border-purple-300 transition-colors"
                        aria-label="Decompose into stages"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="6" height="6" rx="1.5" />
                          <rect x="15" y="4" width="6" height="6" rx="1.5" />
                          <rect x="3" y="14" width="6" height="6" rx="1.5" />
                          <rect x="15" y="14" width="6" height="6" rx="1.5" />
                          <path d="M9 7h6M9 17h6M6 10v4M18 10v4" />
                        </svg>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Decompose into {flowDescriptor.stages.length} stages</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {!isDesignSystem && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleShare}
                      disabled={!isEmbed && (shareState === 'connecting' || shareState === 'disabled')}
                      className={`w-8 h-8 flex items-center justify-center rounded-full bg-white border transition-colors disabled:opacity-50 ${
                        effectiveShareState === 'copied'
                          ? 'border-green-300 text-green-600'
                          : effectiveShareState === 'error'
                            ? 'border-red-300 text-red-500'
                            : 'border-stone-200 text-stone-400 hover:text-stone-700 hover:border-stone-300'
                      }`}
                      aria-label={isEmbed ? 'Copy page URL' : 'Copy public link'}
                    >
                      {effectiveShareState === 'connecting' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : effectiveShareState === 'copied' ? (
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
                      {isEmbed
                        ? (effectiveShareState === 'copied' ? 'URL copied!' : 'Copy page URL')
                        : shareState === 'disabled'
                          ? shareDisabledTooltip
                          : effectiveShareState === 'connecting'
                            ? 'Starting tunnel…'
                            : effectiveShareState === 'copied'
                              ? 'Link copied!'
                              : effectiveShareState === 'error'
                                ? 'Tunnel failed'
                                : 'Copy public link'}
                    </p>
                  </TooltipContent>
                </Tooltip>
                )}
          </div>
      </div>

    </div>
  );
}

export default memo(ComponentNode);
