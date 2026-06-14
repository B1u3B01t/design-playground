'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { loadPdfJs, getPdfRenderPixelRatio } from '../lib/pdf-utils';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface PdfViewerClientProps {
  pdfUrl: string;
  name: string;
  pages: number[] | null;
}

export default function PdfViewerClient({ pdfUrl, name, pages }: PdfViewerClientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageList, setPageList] = useState<number[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(800);

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
        const res = await fetch(pdfUrl);
        if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`);
        const buffer = await res.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
        if (cancelled) return;
        const list =
          pages ??
          Array.from({ length: doc.numPages }, (_, i) => i + 1);
        setPdfDoc(doc);
        setPageList(list);
        setPageIndex(0);
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
  }, [pdfUrl, pages]);

  const currentPage = pageList[pageIndex] ?? null;

  useEffect(() => {
    if (!pdfDoc || currentPage === null) return;

    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;

    async function renderPage() {
      try {
        const page = await pdfDoc!.getPage(currentPage);
        const baseViewport = page.getViewport({ scale: 1 });
        const maxWidth = Math.max(320, containerWidth - 48);
        const displayScale = maxWidth / baseViewport.width;
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
      } catch (err) {
        if (!cancelled) console.error('[PdfViewer] render error:', err);
      }
    }

    renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, currentPage, containerWidth]);

  const goPrev = useCallback(() => {
    setPageIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setPageIndex((i) => Math.min(pageList.length - 1, i + 1));
  }, [pageList.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goPrev, goNext]);

  const canGoPrev = pageIndex > 0;
  const canGoNext = pageIndex < pageList.length - 1;

  return (
    <div className="fixed inset-0 flex flex-col bg-stone-100 text-stone-800">
      <header className="flex items-center justify-between gap-4 px-4 h-12 border-b border-stone-200 bg-white/90 backdrop-blur-sm shrink-0">
        <h1 className="text-sm font-medium truncate">{name}</h1>
        {!loading && !error && pageList.length > 0 && (
          <span className="text-xs text-stone-500 tabular-nums shrink-0">
            {pageIndex + 1} / {pageList.length}
            {currentPage !== null && pageList.length > 1 ? ` (p.${currentPage})` : ''}
          </span>
        )}
      </header>

      <div ref={containerRef} className="relative flex-1 min-h-0 flex items-center justify-center p-6">
        {loading && (
          <p className="text-sm text-stone-400">Loading PDF…</p>
        )}
        {error && (
          <p className="text-sm text-red-500 px-4 text-center">{error}</p>
        )}
        {!loading && !error && pageList.length === 0 && (
          <p className="text-sm text-stone-400">No pages to display</p>
        )}
        {!loading && !error && pageList.length > 0 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition-colors hover:bg-stone-50 disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="max-h-full overflow-auto">
              <canvas ref={canvasRef} className="block shadow-md rounded-sm bg-white" />
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition-colors hover:bg-stone-50 disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Next page"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
