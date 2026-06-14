'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { NodeResizeControl, useNodeId, useReactFlow, type Node } from '@xyflow/react';
import { FileText, Trash2, Scan, GripVertical } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { RESIZE_MIN_WIDTH, RESIZE_MIN_HEIGHT } from '../lib/constants';
import { useScrollCapture } from '../hooks/useNodeShared';
import { useInteractiveNodeStore, useIsInteractiveNode } from '../lib/interactive-node-store';
import { NodeLabel, useInverseZoom } from './shared/NodeLabel';
import { useFrameHoverHint } from './shared/FrameHoverHint';
import { loadPdfJs, getPdfRenderPixelRatio, buildPdfViewerUrl } from '../lib/pdf-utils';
import { usePlaygroundDrawStore } from '../lib/playground-draw-store';
import type { DrawStroke, PdfDrawingsMap } from '../lib/draw-types';
import { DrawSurface } from './shared/DrawSurface';
import {
  getDisplayPages,
  hidePage,
  takePageDrawings,
  writePdfPageDragData,
  type PdfPageDragPayload,
} from '../lib/pdf-page-order';
import { usePlaygroundPdfDragStore } from '../lib/playground-pdf-drag-store';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { captureClient } from '../lib/telemetry/client';

export interface PdfNodeData extends Record<string, unknown> {
  pdfPath: string;
  pdfUrl: string;
  filename: string;
  originalName: string;
  /** When set, this node shows only a single extracted page. */
  extractedPage?: number;
  /** Pages pulled out or moved away (1-based indices in the PDF file). */
  hiddenPages?: number[];
  /** Custom display order of pages (1-based); overrides default sequence. */
  pageOrder?: number[];
  /** Cached page count from the PDF file (set on load). */
  totalPages?: number;
  /** Ink strokes per page (keys are page numbers as strings). */
  drawings?: PdfDrawingsMap;
}

interface PdfPageViewProps {
  pdfDoc: PDFDocumentProxy;
  pageNum: number;
  containerWidth: number;
  pageStrokes: DrawStroke[];
  onPageStrokesChange: (strokes: DrawStroke[]) => void;
  drawEnabled: boolean;
  strokeSelectionEnabled: boolean;
  selectedStrokeId: string | null;
  onSelectStroke: (strokeId: string) => void;
  onClearStrokeSelection: () => void;
  onPullOut?: () => void;
  showPullOut?: boolean;
  draggable?: boolean;
  onPageDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onPageDragEnd?: () => void;
}

function PdfPageView({
  pdfDoc,
  pageNum,
  containerWidth,
  pageStrokes,
  onPageStrokesChange,
  drawEnabled,
  strokeSelectionEnabled,
  selectedStrokeId,
  onSelectStroke,
  onClearStrokeSelection,
  onPullOut,
  showPullOut,
  draggable = false,
  onPageDragStart,
  onPageDragEnd,
}: PdfPageViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageLayoutHeight, setPageLayoutHeight] = useState(416);
  const [pageSize, setPageSize] = useState({ width: 300, height: 400 });
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;

    async function renderPage() {
      setRendering(true);
      try {
        const pdfjs = await loadPdfJs();
        const page = await pdfDoc.getPage(pageNum);
        const baseViewport = page.getViewport({ scale: 1 });
        const displayScale = (containerWidth - 24) / baseViewport.width;
        const viewport = page.getViewport({ scale: displayScale });
        const pixelRatio = getPdfRenderPixelRatio();

        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const cssWidth = Math.floor(viewport.width);
        const cssHeight = Math.floor(viewport.height);

        canvas.width = Math.floor(cssWidth * pixelRatio);
        canvas.height = Math.floor(cssHeight * pixelRatio);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        setPageSize({ width: cssWidth, height: cssHeight });
        setPageLayoutHeight(cssHeight + 16);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const transform =
          pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : undefined;

        const task = page.render({
          canvas,
          canvasContext: ctx,
          viewport,
          transform,
        });
        renderTask = task;
        await task.promise;
        if (cancelled) return;
      } catch (err) {
        if (!cancelled) console.error('[PdfPageView] render error:', err);
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNum, containerWidth]);

  return (
    <div
      data-pdf-page-item
      data-pdf-page-num={pageNum}
      className="relative group/page mx-auto mb-4 last:mb-2 nodrag"
      style={{ width: containerWidth - 24 }}
    >
      <div className="absolute -top-2 left-2 z-20 px-1.5 py-0.5 rounded-md bg-stone-800/80 text-white text-[10px] font-medium tabular-nums">
        {pageNum}
      </div>

      {draggable && onPageDragStart && (
        <div
          draggable
          onDragStart={onPageDragStart}
          onDragEnd={onPageDragEnd}
          className="nodrag absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center w-8 h-5 rounded-md bg-white/95 border border-stone-200/90 text-stone-400 opacity-0 group-hover/page:opacity-100 hover:text-indigo-600 hover:border-indigo-300 shadow-sm cursor-grab active:cursor-grabbing transition-all"
          aria-label={`Drag page ${pageNum}`}
          title="Drag to reorder or move to another PDF"
        >
          <GripVertical className="w-3.5 h-3.5" strokeWidth={2} />
        </div>
      )}

      {showPullOut && onPullOut && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPullOut();
              }}
              className="nodrag absolute -top-2 right-2 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-white border border-stone-200 text-stone-500 opacity-0 group-hover/page:opacity-100 hover:text-indigo-600 hover:border-indigo-300 shadow-sm transition-all"
              aria-label={`Pull out page ${pageNum}`}
            >
              <Scan className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top"><p>Pull out page {pageNum}</p></TooltipContent>
        </Tooltip>
      )}

      <div
        className={`relative bg-white rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.08)] border border-stone-200/80 overflow-hidden ${rendering ? 'opacity-60' : ''}`}
        style={{ minHeight: pageLayoutHeight }}
      >
        <canvas
          ref={canvasRef}
          className="pdf-page-canvas block"
          draggable={false}
        />
        <DrawSurface
          strokes={pageStrokes}
          onStrokesChange={onPageStrokesChange}
          enabled={drawEnabled}
          selectionEnabled={strokeSelectionEnabled}
          selectedStrokeId={selectedStrokeId}
          onSelectStroke={onSelectStroke}
          onClearSelection={onClearStrokeSelection}
          width={pageSize.width}
          height={pageSize.height}
          normalized
          className="absolute inset-0 z-10"
        />
      </div>
    </div>
  );
}

function PdfNodeInner({ id, data, selected }: { id: string; data: PdfNodeData; selected?: boolean }) {
  const { deleteElements, setNodes, getNode, updateNodeData } = useReactFlow();
  const nodeId = useNodeId();
  const labelInvScale = useInverseZoom();
  const hidePlayButton = labelInvScale * 14 > 14 + 6;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(360);
  const hoverTargetId = usePlaygroundPdfDragStore((s) => s.hoverTargetNodeId);
  const hoverInsertIndex = usePlaygroundPdfDragStore((s) => s.hoverInsertIndex);
  const hoverLineTop = usePlaygroundPdfDragStore((s) => s.hoverLineTop);
  const isDropHover = hoverTargetId === id && hoverInsertIndex !== null;

  const isInteractive = useIsInteractiveNode(nodeId);
  const drawToolActive = usePlaygroundDrawStore((s) => s.drawToolActive);
  const strokeSelectEnabled = usePlaygroundDrawStore((s) => s.strokeSelectEnabled);
  const strokeSelection = usePlaygroundDrawStore((s) => s.strokeSelection);
  const setStrokeSelection = usePlaygroundDrawStore((s) => s.setStrokeSelection);
  const drawEnabled = drawToolActive && (selected || isInteractive);
  const strokeSelectionEnabled = strokeSelectEnabled && (selected || isInteractive);
  const setInteractiveNodeId = useInteractiveNodeStore((s) => s.setInteractiveNodeId);
  const handleWheel = useScrollCapture(scrollContainerRef);
  const hoverHint = useFrameHoverHint(!isInteractive && !drawToolActive);

  const handlePageStrokesChange = useCallback(
    (pageNum: number, strokes: DrawStroke[]) => {
      const key = String(pageNum);
      const next = { ...(data.drawings ?? {}), [key]: strokes };
      updateNodeData(id, { drawings: next });
    },
    [id, data.drawings, updateNodeData],
  );

  const handleFrameDoubleClick = useCallback(() => {
    if (nodeId) setInteractiveNodeId(nodeId);
  }, [nodeId, setInteractiveNodeId]);

  useEffect(() => {
    if (!selected && isInteractive) setInteractiveNodeId(null);
  }, [selected, isInteractive, setInteractiveNodeId]);

  useEffect(() => {
    if (drawToolActive && selected && nodeId) {
      setInteractiveNodeId(nodeId);
    }
  }, [drawToolActive, selected, nodeId, setInteractiveNodeId]);

  useEffect(() => {
    if (!isInteractive) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInteractiveNodeId(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isInteractive, setInteractiveNodeId]);

  const isExtracted = typeof data.extractedPage === 'number';
  const label = isExtracted
    ? `${data.originalName} — p.${data.extractedPage}`
    : data.originalName;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const pdfjs = await loadPdfJs();
        const res = await fetch(data.pdfUrl);
        const buffer = await res.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setPageCount(doc.numPages);
        // totalPages unset = first load of a freshly imported PDF (it persists
        // in node data afterwards, so remounts don't re-count the import).
        if (data.totalPages === undefined) {
          captureClient('feature_used', { feature: 'pdf_import', page_count: doc.numPages });
        }
        updateNodeData(id, { totalPages: doc.numPages });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load PDF');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [data.pdfUrl, id, updateNodeData]);

  const handlePullOutPage = useCallback(
    (pageNum: number) => {
      const node = getNode(id);
      if (!node) return;

      const { taken, rest } = takePageDrawings(data.drawings, pageNum);
      updateNodeData(id, { ...hidePage(data, pageNum), drawings: rest });

      const nodeWidth = node.width ?? (node.measured?.width ?? 400);
      const newNode: Node = {
        id: `pdf-${Date.now()}-${pageNum}`,
        type: 'pdf',
        position: {
          x: node.position.x + nodeWidth + 48,
          y: node.position.y + (pageNum - 1) * 32,
        },
        style: { width: 480, height: 640 },
        data: {
          pdfPath: data.pdfPath,
          pdfUrl: data.pdfUrl,
          filename: data.filename,
          originalName: data.originalName,
          extractedPage: pageNum,
          drawings: taken,
        },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [id, getNode, setNodes, data, updateNodeData],
  );

  const buildPageDragPayload = useCallback(
    (pageNum: number): PdfPageDragPayload => ({
      sourceNodeId: id,
      pageNum,
      pdfPath: data.pdfPath,
      pdfUrl: data.pdfUrl,
      filename: data.filename,
      originalName: data.originalName,
    }),
    [id, data],
  );

  const handlePageDragStart = useCallback(
    (pageNum: number, e: React.DragEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const payload = buildPageDragPayload(pageNum);
      writePdfPageDragData(e.dataTransfer, payload);
      usePlaygroundPdfDragStore.getState().setPayload(payload);
    },
    [buildPageDragPayload],
  );

  const handlePageDragEnd = useCallback(() => {
    usePlaygroundPdfDragStore.getState().clear();
  }, []);

  const handleDelete = async () => {
    try {
      await fetch('/playground/api/pdfs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: data.filename }),
      });
    } catch (err) {
      console.error('Error deleting PDF file:', err);
    }
    deleteElements({ nodes: [{ id }] });
  };

  const pagesToRender = isExtracted
    ? [data.extractedPage!]
    : getDisplayPages(data, pageCount);

  const handleOpenInNewTab = useCallback(() => {
    const pages = pagesToRender.length > 0
      ? pagesToRender
      : typeof data.extractedPage === 'number'
        ? [data.extractedPage]
        : [];
    const url = buildPdfViewerUrl({
      pdfUrl: data.pdfUrl,
      name: label,
      pages,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [data.pdfUrl, data.extractedPage, label, pagesToRender]);

  const pageDragEnabled = !drawToolActive;

  return (
    <div
      className="flex flex-col"
      style={{
        minWidth: RESIZE_MIN_WIDTH,
        minHeight: RESIZE_MIN_HEIGHT,
        width: '100%',
        height: '100%',
        fontFamily: 'var(--font-geist-sans), Geist, system-ui, sans-serif',
      }}
    >
      <NodeResizeControl
        position="bottom-right"
        minWidth={280}
        minHeight={320}
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

      <div
        ref={topBarRef}
        className={`flex items-center justify-between px-0.5 pb-1.5 cursor-grab transition-opacity ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="nodrag shrink-0 p-0 leading-none rounded-[5px] transition-colors"
                style={{
                  color: selected ? '#6366F1' : '#A8A29E',
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
          <FileText className="w-3 h-3 text-indigo-500 shrink-0" />
          <NodeLabel color="#6366F1">{label}</NodeLabel>
        </div>
        {!isExtracted && (
          <span className="text-[10px] text-stone-400 tabular-nums shrink-0">
            {pagesToRender.length} {pagesToRender.length === 1 ? 'page' : 'pages'}
            {pagesToRender.length !== pageCount && pageCount > 0
              ? ` / ${pageCount}`
              : ''}
          </span>
        )}
      </div>

      {hoverHint.tooltip}

      <div className="relative flex items-start flex-1 min-h-0">
        <div
          ref={containerRef}
          data-screenshot-target
          data-interactive={isInteractive ? 'true' : undefined}
          onDoubleClick={handleFrameDoubleClick}
          onMouseMove={hoverHint.onMouseMove}
          onMouseLeave={hoverHint.onMouseLeave}
          className={`app-theme flex-1 min-h-0 rounded-xl transition-all ${
            selected ? 'ring-2 ring-indigo-400' : ''
          } ${isInteractive ? 'ring-offset-2' : ''}`}
        >
          <div
            ref={scrollContainerRef}
            data-pdf-drop-target
            data-pdf-node-id={id}
            onWheel={isInteractive ? handleWheel : undefined}
            className={`relative h-full overflow-x-hidden bg-stone-100/50 rounded-xl p-3 nodrag ${
              isInteractive
                ? 'nowheel nopan overflow-y-auto'
                : 'overflow-hidden'
            } ${isDropHover ? 'ring-2 ring-indigo-300/60 ring-inset' : ''}`}
          >
            {isDropHover && hoverLineTop !== null && (
              <div
                className="pdf-page-insertion-line pointer-events-none absolute left-3 right-3 z-30"
                style={{ top: hoverLineTop }}
                aria-hidden
              />
            )}
            {loading && (
              <div className="flex items-center justify-center h-full min-h-[200px] text-stone-400 text-sm">
                Loading PDF…
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center h-full min-h-[200px] text-red-500 text-sm px-4 text-center">
                {error}
              </div>
            )}
            {!loading && !error && pdfDoc && pagesToRender.length === 0 && (
              <div className="flex items-center justify-center h-full min-h-[120px] text-stone-400 text-sm px-4 text-center">
                All pages pulled out — drag pages here to add them back
              </div>
            )}
            {!loading && !error && pdfDoc && pagesToRender.map((pageNum) => {
              const pageKey = String(pageNum);
              const pdfStrokeSelected =
                strokeSelection?.scope === 'pdf' &&
                strokeSelection.nodeId === id &&
                strokeSelection.pageKey === pageKey;
              return (
                <PdfPageView
                  key={pageNum}
                  pdfDoc={pdfDoc}
                  pageNum={pageNum}
                  containerWidth={containerWidth}
                  pageStrokes={data.drawings?.[pageKey] ?? []}
                  onPageStrokesChange={(strokes) => handlePageStrokesChange(pageNum, strokes)}
                  drawEnabled={drawEnabled}
                  strokeSelectionEnabled={strokeSelectionEnabled}
                  selectedStrokeId={pdfStrokeSelected ? strokeSelection.strokeId : null}
                  onSelectStroke={(strokeId) => {
                    setStrokeSelection({ scope: 'pdf', nodeId: id, pageKey, strokeId });
                    setNodes((nds) =>
                      nds.map((n) => ({
                        ...n,
                        selected: n.id === id,
                      })),
                    );
                  }}
                  onClearStrokeSelection={() => setStrokeSelection(null)}
                  onPullOut={() => handlePullOutPage(pageNum)}
                  showPullOut={!isExtracted}
                  draggable={pageDragEnabled}
                  onPageDragStart={(e) => handlePageDragStart(pageNum, e)}
                  onPageDragEnd={handlePageDragEnd}
                />
              );
            })}
          </div>
        </div>

        <div
          className={`absolute top-0 left-full pl-2 flex flex-col items-center gap-2 nodrag transition-opacity ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleDelete}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-stone-200 text-stone-400 hover:text-red-500 hover:border-red-300 transition-colors"
                aria-label="Delete PDF"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right"><p>Delete PDF</p></TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

const PdfNode = memo(PdfNodeInner);
export default PdfNode;
