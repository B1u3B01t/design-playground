import type { PdfDrawingsMap } from './draw-types';
import type { PdfNodeData } from '../nodes/PdfNode';

export const PDF_PAGE_DRAG_MIME = 'application/x-playground-pdf-page';

export interface PdfPageDragPayload {
  sourceNodeId: string;
  pageNum: number;
  pdfPath: string;
  pdfUrl: string;
  filename: string;
  originalName: string;
}

const PDF_PAGE_DRAG_PLAIN_PREFIX = 'playground-pdf-page:';

export function writePdfPageDragData(dt: DataTransfer, payload: PdfPageDragPayload): void {
  const json = JSON.stringify(payload);
  dt.setData(PDF_PAGE_DRAG_MIME, json);
  dt.setData('text/plain', `${PDF_PAGE_DRAG_PLAIN_PREFIX}${json}`);
  dt.effectAllowed = 'move';
}

export function parsePdfPageDragPayload(dt: DataTransfer): PdfPageDragPayload | null {
  let raw = '';
  try {
    raw = dt.getData(PDF_PAGE_DRAG_MIME);
  } catch {
    /* Safari may throw for custom types */
  }
  if (!raw) {
    try {
      const plain = dt.getData('text/plain');
      if (plain.startsWith(PDF_PAGE_DRAG_PLAIN_PREFIX)) {
        raw = plain.slice(PDF_PAGE_DRAG_PLAIN_PREFIX.length);
      }
    } catch {
      /* ignore */
    }
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PdfPageDragPayload;
  } catch {
    return null;
  }
}

export function isPdfPageDragEvent(dt: DataTransfer): boolean {
  const types = Array.from(dt.types);
  return (
    types.includes(PDF_PAGE_DRAG_MIME) ||
    types.includes('text/plain') ||
    types.some((t) => t.toLowerCase() === PDF_PAGE_DRAG_MIME.toLowerCase())
  );
}

/** 1-based page numbers shown in this node (in order). */
export function getDisplayPages(data: PdfNodeData, totalPages: number): number[] {
  if (typeof data.extractedPage === 'number') return [data.extractedPage];
  const hidden = new Set(data.hiddenPages ?? []);
  if (data.pageOrder?.length) {
    return data.pageOrder.filter((p) => p >= 1 && p <= totalPages && !hidden.has(p));
  }
  return Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => !hidden.has(p));
}

export function insertPageAtIndex(pages: number[], pageNum: number, insertIndex: number): number[] {
  const next = pages.filter((p) => p !== pageNum);
  const idx = Math.max(0, Math.min(insertIndex, next.length));
  next.splice(idx, 0, pageNum);
  return next;
}

export function hidePage(data: PdfNodeData, pageNum: number): PdfNodeData {
  const hidden = new Set(data.hiddenPages ?? []);
  hidden.add(pageNum);
  let pageOrder = data.pageOrder;
  if (pageOrder?.length) {
    pageOrder = pageOrder.filter((p) => p !== pageNum);
  }
  return { ...data, hiddenPages: Array.from(hidden), pageOrder };
}

/** Restore a pulled-out / moved-away page so it can appear in the list again. */
export function unhidePage(data: PdfNodeData, pageNum: number): PdfNodeData {
  const hidden = (data.hiddenPages ?? []).filter((p) => p !== pageNum);
  return {
    ...data,
    hiddenPages: hidden.length > 0 ? hidden : undefined,
  };
}

export function takePageDrawings(
  drawings: PdfDrawingsMap | undefined,
  pageNum: number,
): { taken: PdfDrawingsMap | undefined; rest: PdfDrawingsMap | undefined } {
  const key = String(pageNum);
  if (!drawings?.[key]) return { taken: undefined, rest: drawings };
  const taken = { [key]: drawings[key] };
  const rest = { ...drawings };
  delete rest[key];
  return { taken, rest: Object.keys(rest).length ? rest : undefined };
}

export function mergeDrawings(
  base: PdfDrawingsMap | undefined,
  added: PdfDrawingsMap | undefined,
): PdfDrawingsMap | undefined {
  if (!added) return base;
  return { ...base, ...added };
}

export function computePageInsertIndex(container: HTMLElement, clientY: number): number {
  const pages = container.querySelectorAll('[data-pdf-page-item]');
  if (pages.length === 0) return 0;
  for (let i = 0; i < pages.length; i++) {
    const rect = pages[i].getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (clientY < mid) return i;
  }
  return pages.length;
}

export function getInsertionLineTop(container: HTMLElement, insertIndex: number): number {
  const pages = container.querySelectorAll('[data-pdf-page-item]');
  const containerRect = container.getBoundingClientRect();
  const scrollTop = container.scrollTop;

  if (pages.length === 0) return 12;

  if (insertIndex >= pages.length) {
    const last = pages[pages.length - 1] as HTMLElement;
    const rect = last.getBoundingClientRect();
    return rect.bottom - containerRect.top + scrollTop + 4;
  }

  const target = pages[insertIndex] as HTMLElement;
  const rect = target.getBoundingClientRect();
  return rect.top - containerRect.top + scrollTop - 2;
}
