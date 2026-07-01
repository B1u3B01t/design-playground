// Canvas localStorage persistence + shared canvas types.
//
// Extracted from PlaygroundCanvas so the multiplayer flow providers (canvas-flow.tsx) can
// seed single-player state from the same source PlaygroundCanvas reads. Behavior is identical
// to the original inline implementation.

import type { Node, Edge } from '@xyflow/react';
import { STORAGE_KEY } from './constants';
import type { DrawStroke } from './draw-types';
import { createOnboardingCanvasState } from './onboarding-seed';

/** Track generation info for status display + resuming after a page reload. */
export interface GenerationInfo {
  componentId: string;
  componentName: string;
  parentNodeId: string;
  iterationCount: number;
  /** First iteration number in this batch */
  startNumber?: number;
  skeletonNodeIds: string[];
  startTime: number; // Timestamp when generation started
  /** Skeleton positions for post-generation repositioning (always set) */
  skeletonPositions?: { x: number; y: number }[];
  /** Grid layout positions for each skeleton node (ordered by variant number) */
  gridPositions?: { x: number; y: number }[];
  /** Parent node cell size so real iteration nodes can match ghost/skeleton sizing */
  gridCellSize?: { width: number; height: number };
  /** Render mode for this generation */
  renderMode?: 'react' | 'html' | 'jsx';
  /** HTML page folder (when renderMode is 'html') */
  htmlFolder?: string;
  /** Base or iteration filename in canvas-components/ (when renderMode is 'jsx') */
  jsxFile?: string;
}

export interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  nodeIdCounter: number;
  knownIterations: string[];
  collapsedNodeIds?: string[];
  /** Persisted generation info for resuming after page reload */
  generationInfo?: GenerationInfo | null;
  /** Persisted viewport (pan/zoom) */
  viewport?: { x: number; y: number; zoom: number };
  /** Freehand strokes in flow coordinates on the canvas */
  canvasDrawings?: DrawStroke[];
}

/** Map an iteration node to its dedup key (html path, jsx file, or react filename). */
export function getIterationKeyFromNode(n: Node): string | null {
  if (n.type !== 'iteration') return null;
  if (n.data.renderMode === 'html' && n.data.htmlFolder && n.data.htmlIterationFolder) {
    return `${n.data.htmlFolder}/${n.data.htmlIterationFolder}`;
  }
  if (n.data.renderMode === 'jsx' && n.data.jsxFile) {
    return n.data.jsxFile as string;
  }
  if (n.data.filename) {
    return n.data.filename as string;
  }
  return null;
}

/** Keys for iteration nodes currently on the canvas. */
export function getIterationKeysOnCanvas(nodes: Node[]): Set<string> {
  const keys = new Set<string>();
  for (const n of nodes) {
    const key = getIterationKeyFromNode(n);
    if (key) keys.add(key);
  }
  return keys;
}

/** Drop knownIterations entries that have no matching canvas node. */
export function pruneKnownIterations(knownIterations: string[], nodes: Node[]): string[] {
  const onCanvas = getIterationKeysOnCanvas(nodes);
  return knownIterations.filter((k) => onCanvas.has(k));
}

export function loadCanvasState(storageKey: string = STORAGE_KEY): CanvasState | null {
  if (typeof window === 'undefined') return null;
  try {
    let stored = localStorage.getItem(storageKey);
    // One-time migration: the canvas used to live under a single unscoped key that
    // every project on this origin shared. Adopt that legacy data for the first
    // project that loads, then drop it so it can't leak into other projects.
    if (!stored && storageKey !== STORAGE_KEY) {
      const legacy = localStorage.getItem(STORAGE_KEY);
      if (legacy) {
        localStorage.setItem(storageKey, legacy);
        localStorage.removeItem(STORAGE_KEY);
        stored = legacy;
      }
    }
    if (!stored) {
      // First run on this canvas (no persisted state): seed the onboarding demo
      // scene so users can try the core loop immediately without waiting for repo
      // discovery. Once these nodes render they get persisted like any other state
      // (saveCanvasState runs on mount in solo mode), so it never re-seeds — and if
      // the user deletes the demo nodes, that deletion persists too.
      return createOnboardingCanvasState();
    }
    if (stored) {
      const state = JSON.parse(stored) as CanvasState;
      const skeletonIds = new Set(
        state.nodes.filter(n => n.type === 'skeleton').map(n => n.id),
      );
      // Strip skeleton nodes unless we have generationInfo to resume
      const hasValidGenInfo = state.generationInfo &&
        (Date.now() - state.generationInfo.startTime <= 10 * 60 * 1000);
      if (skeletonIds.size > 0 && !hasValidGenInfo) {
        state.nodes = state.nodes.filter(n => n.type !== 'skeleton');
        state.edges = state.edges.filter(
          e => !skeletonIds.has(e.source) && !skeletonIds.has(e.target),
        );
        state.generationInfo = null;
      }
      if (state.knownIterations?.length) {
        state.knownIterations = pruneKnownIterations(state.knownIterations, state.nodes);
      }
      return state;
    }
  } catch (e) {
    console.error('Failed to load canvas state:', e);
  }
  return null;
}

export function saveCanvasState(
  storageKey: string,
  nodes: Node[],
  edges: Edge[],
  counter: number,
  knownIterations: string[],
  collapsedNodeIds: string[],
  generationInfo?: GenerationInfo | null,
  viewport?: { x: number; y: number; zoom: number },
  canvasDrawings?: DrawStroke[],
) {
  if (typeof window === 'undefined') return;
  try {
    const state: CanvasState = {
      nodes, edges, nodeIdCounter: counter, knownIterations, collapsedNodeIds,
      // Only persist generationInfo when skeletons are present
      generationInfo: nodes.some(n => n.type === 'skeleton') ? generationInfo : null,
      viewport,
      canvasDrawings,
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save canvas state:', e);
  }
}
