import { create } from 'zustand';
import type { PdfPageDragPayload } from './pdf-page-order';

interface PlaygroundPdfDragStore {
  payload: PdfPageDragPayload | null;
  hoverTargetNodeId: string | null;
  hoverInsertIndex: number | null;
  hoverLineTop: number | null;
  setPayload: (payload: PdfPageDragPayload | null) => void;
  setHover: (
    targetNodeId: string | null,
    insertIndex: number | null,
    lineTop: number | null,
  ) => void;
  clear: () => void;
}

export const usePlaygroundPdfDragStore = create<PlaygroundPdfDragStore>((set) => ({
  payload: null,
  hoverTargetNodeId: null,
  hoverInsertIndex: null,
  hoverLineTop: null,
  setPayload: (payload) => set({ payload }),
  setHover: (hoverTargetNodeId, hoverInsertIndex, hoverLineTop) =>
    set({ hoverTargetNodeId, hoverInsertIndex, hoverLineTop }),
  clear: () =>
    set({
      payload: null,
      hoverTargetNodeId: null,
      hoverInsertIndex: null,
      hoverLineTop: null,
    }),
}));
