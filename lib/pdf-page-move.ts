import type { Node } from '@xyflow/react';
import type { PdfDrawingsMap } from './draw-types';
import type { PdfNodeData } from '../nodes/PdfNode';
import {
  getDisplayPages,
  hidePage,
  insertPageAtIndex,
  mergeDrawings,
  takePageDrawings,
  unhidePage,
} from './pdf-page-order';

export function applyReorderPdfPage(
  nodes: Node[],
  nodeId: string,
  pageNum: number,
  insertIndex: number,
  totalPages: number,
): Node[] {
  const node = nodes.find((n) => n.id === nodeId);
  if (node?.type !== 'pdf') return nodes;
  const data = node.data as PdfNodeData;
  const pages = getDisplayPages(data, totalPages);
  const newOrder = insertPageAtIndex(pages, pageNum, insertIndex);
  return nodes.map((n) =>
    n.id === nodeId ? { ...n, data: { ...data, pageOrder: newOrder } } : n,
  );
}

export interface MovePdfPageResult {
  nodes: Node[];
  deleteSourceNodeId?: string;
}

export function applyMovePdfPage(
  nodes: Node[],
  sourceNodeId: string,
  targetNodeId: string,
  pageNum: number,
  insertIndex: number,
  targetTotalPages: number,
): MovePdfPageResult {
  if (sourceNodeId === targetNodeId) return { nodes };

  const sourceNode = nodes.find((n) => n.id === sourceNodeId);
  const targetNode = nodes.find((n) => n.id === targetNodeId);
  if (sourceNode?.type !== 'pdf' || targetNode?.type !== 'pdf') return { nodes };

  const sourceData = sourceNode.data as PdfNodeData;
  const targetData = targetNode.data as PdfNodeData;
  if (typeof targetData.extractedPage === 'number') return { nodes };
  if (sourceData.pdfUrl !== targetData.pdfUrl) return { nodes };

  const targetPages = getDisplayPages(targetData, targetTotalPages);
  const newOrder = insertPageAtIndex(targetPages, pageNum, insertIndex);

  const { taken, rest } = takePageDrawings(sourceData.drawings, pageNum);
  const targetDrawings = mergeDrawings(targetData.drawings, taken);

  let deleteSourceNodeId: string | undefined;
  let nextSourceData: PdfNodeData;

  if (typeof sourceData.extractedPage === 'number') {
    deleteSourceNodeId = sourceNodeId;
    nextSourceData = sourceData;
  } else {
    nextSourceData = { ...hidePage(sourceData, pageNum), drawings: rest };
  }

  const nextTargetData: PdfNodeData = {
    ...unhidePage(targetData, pageNum),
    pageOrder: newOrder,
    drawings: targetDrawings,
  };

  const nextNodes = nodes.map((n) => {
    if (n.id === targetNodeId) return { ...n, data: nextTargetData };
    if (n.id === sourceNodeId && !deleteSourceNodeId) return { ...n, data: nextSourceData };
    return n;
  });

  const filtered = deleteSourceNodeId
    ? nextNodes.filter((n) => n.id !== deleteSourceNodeId)
    : nextNodes;

  return { nodes: filtered, deleteSourceNodeId };
}

/** Merge all display pages from a multi-page source node into a target at insertIndex. */
export function applyMergePdfNodes(
  nodes: Node[],
  sourceNodeId: string,
  targetNodeId: string,
  insertIndex: number,
  sourceTotalPages: number,
  targetTotalPages: number,
): MovePdfPageResult {
  if (sourceNodeId === targetNodeId) return { nodes };

  const sourceNode = nodes.find((n) => n.id === sourceNodeId);
  const targetNode = nodes.find((n) => n.id === targetNodeId);
  if (sourceNode?.type !== 'pdf' || targetNode?.type !== 'pdf') return { nodes };

  const sourceData = sourceNode.data as PdfNodeData;
  const targetData = targetNode.data as PdfNodeData;
  if (typeof targetData.extractedPage === 'number') return { nodes };
  if (sourceData.pdfUrl !== targetData.pdfUrl) return { nodes };

  const pagesToMove = getDisplayPages(sourceData, sourceTotalPages);
  if (pagesToMove.length === 0) return { nodes };

  let order = getDisplayPages(targetData, targetTotalPages);
  let insertAt = insertIndex;
  let mergedDrawings: PdfDrawingsMap | undefined = { ...targetData.drawings };

  for (const pageNum of pagesToMove) {
    order = insertPageAtIndex(order, pageNum, insertAt);
    const key = String(pageNum);
    if (sourceData.drawings?.[key]) {
      mergedDrawings = { ...mergedDrawings, [key]: sourceData.drawings[key] };
    }
    insertAt += 1;
  }

  let restoredTarget = targetData;
  for (const page of pagesToMove) {
    restoredTarget = unhidePage(restoredTarget, page);
  }

  const nextTargetData: PdfNodeData = {
    ...restoredTarget,
    pageOrder: order,
    drawings: mergedDrawings,
  };

  const nextNodes = nodes
    .filter((n) => n.id !== sourceNodeId)
    .map((n) => (n.id === targetNodeId ? { ...n, data: nextTargetData } : n));

  return { nodes: nextNodes, deleteSourceNodeId: sourceNodeId };
}
