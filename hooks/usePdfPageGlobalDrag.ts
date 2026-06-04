'use client';

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Node } from '@xyflow/react';
import type { PdfNodeData } from '../nodes/PdfNode';
import {
  applyMergePdfNodes,
  applyMovePdfPage,
  applyReorderPdfPage,
} from '../lib/pdf-page-move';
import {
  computePageInsertIndex,
  getInsertionLineTop,
  parsePdfPageDragPayload,
  type PdfPageDragPayload,
} from '../lib/pdf-page-order';
import { usePlaygroundPdfDragStore } from '../lib/playground-pdf-drag-store';

function getPdfTotalPages(pdfData: PdfNodeData): number {
  if (pdfData.totalPages) return pdfData.totalPages;
  const nums = [
    ...(pdfData.pageOrder ?? []),
    ...(pdfData.hiddenPages ?? []),
    ...(typeof pdfData.extractedPage === 'number' ? [pdfData.extractedPage] : []),
  ];
  return Math.max(1, ...nums, 1);
}

function applyPageDrop(
  nodes: Node[],
  payload: PdfPageDragPayload,
  targetNodeId: string,
  insertIndex: number,
  getTargetPageCount: (id: string) => number,
): Node[] {
  const targetNode = nodes.find((n) => n.id === targetNodeId);
  if (!targetNode || targetNode.type !== 'pdf') return nodes;
  const targetData = targetNode.data as PdfNodeData;
  if (typeof targetData.extractedPage === 'number') return nodes;

  const sourceNode = nodes.find((n) => n.id === payload.sourceNodeId);
  const sourceData = sourceNode?.data as PdfNodeData | undefined;
  if (sourceData && sourceData.pdfUrl !== targetData.pdfUrl) return nodes;

  const targetTotal = getTargetPageCount(targetNodeId);

  if (payload.sourceNodeId === targetNodeId) {
    return applyReorderPdfPage(nodes, targetNodeId, payload.pageNum, insertIndex, targetTotal);
  }

  return applyMovePdfPage(
    nodes,
    payload.sourceNodeId,
    targetNodeId,
    payload.pageNum,
    insertIndex,
    targetTotal,
  ).nodes;
}

export function usePdfPageGlobalDrag(
  setNodes: Dispatch<SetStateAction<Node[]>>,
  getNode: (id: string) => Node | undefined,
) {
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      const payload = usePlaygroundPdfDragStore.getState().payload;
      if (!payload) return;

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const dropTarget = el?.closest('[data-pdf-drop-target]') as HTMLElement | null;

      if (!dropTarget) {
        usePlaygroundPdfDragStore.getState().setHover(null, null, null);
        return;
      }

      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

      const targetId = dropTarget.getAttribute('data-pdf-node-id');
      if (!targetId) return;

      const targetNode = getNode(targetId);
      if (!targetNode || targetNode.type !== 'pdf') return;
      const targetData = targetNode.data as PdfNodeData;
      if (typeof targetData.extractedPage === 'number') return;

      const insertIndex = computePageInsertIndex(dropTarget, e.clientY);
      const lineTop = getInsertionLineTop(dropTarget, insertIndex);
      usePlaygroundPdfDragStore.getState().setHover(targetId, insertIndex, lineTop);
    };

    const onDrop = (e: DragEvent) => {
      const store = usePlaygroundPdfDragStore.getState();
      const payload =
        store.payload ?? (e.dataTransfer ? parsePdfPageDragPayload(e.dataTransfer) : null);
      if (!payload) {
        store.clear();
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const dropTarget = el?.closest('[data-pdf-drop-target]') as HTMLElement | null;
      if (!dropTarget) {
        store.clear();
        return;
      }

      const targetId = dropTarget.getAttribute('data-pdf-node-id');
      if (!targetId) {
        store.clear();
        return;
      }

      const insertIndex = computePageInsertIndex(dropTarget, e.clientY);

      setNodes((nds) =>
        applyPageDrop(nds, payload, targetId, insertIndex, (nodeId) => {
          const n = nds.find((x) => x.id === nodeId) ?? getNode(nodeId);
          if (!n || n.type !== 'pdf') return 1;
          return getPdfTotalPages(n.data as PdfNodeData);
        }),
      );

      store.clear();
    };

    const onDragEnd = () => {
      usePlaygroundPdfDragStore.getState().clear();
    };

    window.addEventListener('dragover', onDragOver, true);
    window.addEventListener('drop', onDrop, true);
    window.addEventListener('dragend', onDragEnd, true);

    return () => {
      window.removeEventListener('dragover', onDragOver, true);
      window.removeEventListener('drop', onDrop, true);
      window.removeEventListener('dragend', onDragEnd, true);
    };
  }, [setNodes, getNode]);
}
