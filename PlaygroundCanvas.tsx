'use client';

import { useCallback, useRef, useEffect, useState, DragEvent } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  useReactFlow,
  Node,
  Edge,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TooltipProvider } from './ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

import ComponentNode from './nodes/ComponentNode';
import IterationNode from './nodes/IterationNode';
import SkeletonIterationNode from './nodes/SkeletonIterationNode';
import DragGhostNode from './nodes/DragGhostNode';
import {
  generateIterationPrompt,
  generateIterationFromIterationPrompt,
  generateElementIterationPrompt,
  generateElementIterationFromIterationPrompt,
} from './registry';
import { loadSelectedModel } from './nodes/shared/IterateDialogParts';
import {
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  GENERATION_QUEUED_EVENT,
  PLAYGROUND_AUTO_ARRANGE_EVENT,
  DRAG_ITERATE_EVENT,
  DRAG_ITERATE_UNDO_DURATION_MS,
  DRAG_ITERATE_TOAST_DURATION_MS,
  STORAGE_KEY,
  POLL_INTERVAL,
  POLL_DURATION,
  ITERATION_HORIZONTAL_SPACING,
  ARRANGE_START_X,
  ARRANGE_START_Y,
  ARRANGE_VERTICAL_GAP,
  ARRANGE_HORIZONTAL_GAP,
  ARRANGE_GROUP_GAP,
  DEFAULT_ITERATION_NODE_WIDTH,
  DEFAULT_ITERATION_NODE_HEIGHT,
  DEFAULT_COMPONENT_NODE_WIDTH,
  DEFAULT_COMPONENT_NODE_HEIGHT,
  ITERATION_EDGE_STYLE,
  SKELETON_EDGE_STYLE,
  FITVIEW_AFTER_ARRANGE,
  ARRANGE_FITVIEW_DELAY,
  POST_GENERATION_SCAN_DELAY,
  POST_GENERATION_ARRANGE_DELAY,
  SKELETON_ARRANGE_DELAY,
  MINIMAP_SKELETON_COLOR,
  MINIMAP_ITERATION_COLOR,
  MINIMAP_COMPONENT_COLOR,
  MINIMAP_MASK_COLOR,
  BACKGROUND_GAP,
  BACKGROUND_DOT_SIZE,
  BACKGROUND_COLOR,
  DND_DATA_KEY,
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  ITERATION_COLLAPSE_TOGGLE_EVENT,
  PLAYGROUND_CLEAR_EVENT,
  PAN_TO_POSITION_EVENT,
  TREE_COLUMN_WIDTH,
  DRAG_GHOST_GAP,
  DEFAULT_EMPTY_ITERATION_INSTRUCTIONS,
  DEFAULT_STYLING_MODE,
  CURSOR_CHAT_DEFAULT_COUNT,
  CURSOR_CHAT_DEFAULT_DEPTH,
  type StylingMode,
  type GenerationStartPayload,
  type GenerationCompletePayload,
  type GenerationErrorPayload,
  type GenerationQueuedPayload,
  type DragIteratePayload,
  type CursorChatSubmitPayload,
} from './lib/constants';
import type { PlaygroundSkill } from './skills';
import CursorChat from './CursorChat';
import ElementHighlight from './ElementHighlight';
import { useElementSelection } from './hooks/useElementSelection';
import { toast } from 'sonner';

const nodeTypes = {
  component: ComponentNode,
  iteration: IterationNode,
  skeleton: SkeletonIterationNode,
  'drag-ghost': DragGhostNode,
};

const DEFAULT_SKILL_IDS = ['design-variations', 'frontend-design'] as const;
let cachedDefaultSkillPrompt: string | null = null;

async function loadDefaultSkillPrompt(): Promise<string | null> {
  if (cachedDefaultSkillPrompt !== null) return cachedDefaultSkillPrompt;
  try {
    const response = await fetch('/playground/api/skills');
    if (!response.ok) {
      cachedDefaultSkillPrompt = '';
      return cachedDefaultSkillPrompt;
    }
    const data = (await response.json()) as { skills?: PlaygroundSkill[] };
    const skills = data.skills || [];
    const parts: string[] = [];
    for (const id of DEFAULT_SKILL_IDS) {
      const skill = skills.find((s) => s.id === id);
      const body = skill?.systemPrompt?.trim();
      if (body) parts.push(body);
    }
    cachedDefaultSkillPrompt = parts.length ? parts.join('\n\n') : '';
    return cachedDefaultSkillPrompt;
  } catch {
    cachedDefaultSkillPrompt = '';
    return cachedDefaultSkillPrompt;
  }
}

interface IterationFile {
  filename: string;
  componentName: string;
  iterationNumber: number;
  parentId: string;
  description: string;
  sourceIteration: string | null;
}

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  nodeIdCounter: number;
  knownIterations: string[];
  collapsedNodeIds?: string[];
}

function loadCanvasState(): CanvasState | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const state = JSON.parse(stored) as CanvasState;
      // Strip skeleton nodes that may have been persisted mid-generation;
      // generationInfo is not stored so they can never be cleaned up.
      const skeletonIds = new Set(
        state.nodes.filter(n => n.type === 'skeleton').map(n => n.id),
      );
      if (skeletonIds.size > 0) {
        state.nodes = state.nodes.filter(n => n.type !== 'skeleton');
        state.edges = state.edges.filter(
          e => !skeletonIds.has(e.source) && !skeletonIds.has(e.target),
        );
      }
      return state;
    }
  } catch (e) {
    console.error('Failed to load canvas state:', e);
  }
  return null;
}

function saveCanvasState(nodes: Node[], edges: Edge[], counter: number, knownIterations: string[], collapsedNodeIds: string[]) {
  if (typeof window === 'undefined') return;
  try {
    const state: CanvasState = { nodes, edges, nodeIdCounter: counter, knownIterations, collapsedNodeIds };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save canvas state:', e);
  }
}

// Re-export event names so existing imports keep working
export { ITERATION_PROMPT_COPIED_EVENT, ITERATION_FETCH_EVENT } from './lib/constants';
import { ITERATION_PROMPT_COPIED_EVENT, ITERATION_FETCH_EVENT } from './lib/constants';

// Track generation info for status display
interface GenerationInfo {
  componentId: string;
  componentName: string;
  parentNodeId: string;
  iterationCount: number;
  skeletonNodeIds: string[];
  startTime: number; // Timestamp when generation started
  /** Skeleton positions for post-generation repositioning (always set) */
  skeletonPositions?: { x: number; y: number }[];
  /** Grid layout positions for each skeleton node (ordered by variant number) */
  gridPositions?: { x: number; y: number }[];
  /** Parent node cell size so real iteration nodes can match ghost/skeleton sizing */
  gridCellSize?: { width: number; height: number };
}

export default function PlaygroundCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const initialState = loadCanvasState();
  const [knownIterations, setKnownIterations] = useState<string[]>(initialState?.knownIterations || []);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(
    new Set(initialState?.collapsedNodeIds || []),
  );
  const collapsedNodeIdsRef = useRef<Set<string>>(new Set(initialState?.collapsedNodeIds || []));
  const [isScanning, setIsScanning] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Node ID counter as a ref (survives re-renders, initialized from localStorage)
  const nodeIdCounterRef = useRef<number>(initialState?.nodeIdCounter || 0);
  const getNodeId = useCallback(() => `node_${++nodeIdCounterRef.current}`, []);
  
  // Refs to always have current values inside polling callbacks (avoids stale closures)
  const nodesRef = useRef<Node[]>(initialState?.nodes || []);
  const knownIterationsRef = useRef<string[]>(initialState?.knownIterations || []);
  
  // Keep collapsed ref in sync
  useEffect(() => {
    collapsedNodeIdsRef.current = collapsedNodeIds;
  }, [collapsedNodeIds]);
  
  // Delete cascade/reparent dialog
  const [deleteDialogNode, setDeleteDialogNode] = useState<Node | null>(null);
  
  // Clear canvas confirmation dialog
  const [showClearDialog, setShowClearDialog] = useState(false);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratingRef = useRef(false);
  const [generationInfo, setGenerationInfo] = useState<GenerationInfo | null>(null);
  const generationInfoRef = useRef<GenerationInfo | null>(null);
  const [lastGenerationDuration, setLastGenerationDuration] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('0m:00s');
  
  // Keep refs in sync with state
  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);
  useEffect(() => {
    generationInfoRef.current = generationInfo;
  }, [generationInfo]);
  
  if (initialState && !initialized.current) {
    nodeIdCounterRef.current = initialState.nodeIdCounter;
    initialized.current = true;
  }

  const [nodes, setNodes, onNodesChange] = useNodesState(initialState?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialState?.edges || []);
  const { screenToFlowPosition, fitView, setCenter } = useReactFlow();

  // Running timer during generation + safety timeout for orphaned skeletons
  useEffect(() => {
    if (!isGenerating || !generationInfo?.startTime) {
      return;
    }

    // Update elapsed time every second
    const updateElapsed = () => {
      const durationMs = Date.now() - generationInfo.startTime;
      const totalSeconds = Math.floor(durationMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setElapsedTime(`${minutes}m:${seconds.toString().padStart(2, '0')}s`);
    };

    // Initial update
    updateElapsed();

    // Update every second
    const intervalId = setInterval(updateElapsed, 1000);

    // Safety: auto-clean skeleton nodes after 10 minutes if generation hangs
    const safetyTimeout = setTimeout(() => {
      const info = generationInfoRef.current;
      if (info) {
        setNodes(nds => nds.filter(n => !info.skeletonNodeIds.includes(n.id)));
        setEdges(eds => eds.filter(e => !info.skeletonNodeIds.some(sid => e.target === sid)));
      }
      setIsGenerating(false);
      setGenerationInfo(null);
    }, 10 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(safetyTimeout);
    };
  }, [isGenerating, generationInfo?.startTime, setNodes, setEdges]);

  // Reconcile UI loading state with backend generation status in case events are missed
  useEffect(() => {
    if (!isGenerating) return;

    let cancelled = false;

    const pollStatus = async () => {
      if (cancelled) return;

      try {
        const response = await fetch('/playground/api/generate?action=status');
        if (!response.ok) return;

        const data = (await response.json()) as {
          success: boolean;
          isGenerating: boolean;
          hasProcess: boolean;
        };

        // If the backend reports that no generation is running but the UI
        // still thinks it is, force-complete to clear any lingering skeletons.
        if (!data.isGenerating && generationInfoRef.current) {
          const info = generationInfoRef.current;
          window.dispatchEvent(
            new CustomEvent<GenerationCompletePayload>(GENERATION_COMPLETE_EVENT, {
              detail: {
                componentId: info.componentId,
                parentNodeId: info.parentNodeId,
                output: '',
              },
            }),
          );
          return;
        }
      } catch {
        // Best-effort reconciliation only; ignore polling errors.
      }

      // Continue polling while the UI still believes generation is active.
      if (!cancelled && isGenerating) {
        setTimeout(pollStatus, 5000);
      }
    };

    pollStatus();

    return () => {
      cancelled = true;
    };
  }, [isGenerating]);

  // Keep refs in sync with state (for use inside polling/interval callbacks)
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  
  useEffect(() => {
    knownIterationsRef.current = knownIterations;
  }, [knownIterations]);

  // Save to localStorage whenever nodes or edges change
  useEffect(() => {
    saveCanvasState(nodes, edges, nodeIdCounterRef.current, knownIterations, Array.from(collapsedNodeIds));
  }, [nodes, edges, knownIterations, collapsedNodeIds]);

  // Find parent node for a given component (reads from ref to avoid stale closure)
  const findParentNode = useCallback((componentName: string, parentId?: string): Node | undefined => {
    // Convert component name to possible registry IDs
    const possibleIds = [
      componentName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, ''),
      componentName.toLowerCase(),
      `${componentName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}-expanded`,
      `${componentName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}-minimal`,
    ];
    
    // Add parentId if provided
    if (parentId) {
      possibleIds.push(parentId);
    }

    return nodesRef.current.find(node => {
      if (node.type !== 'component') return false;
      const componentId = node.data.componentId as string | undefined;
      if (!componentId) return false;
      // Check exact match first, then includes
      return possibleIds.some(id => componentId === id || componentId.includes(id));
    });
  }, []);

  // Find an iteration node by its filename (for tree-aware connections)
  const findIterationNodeByFilename = useCallback((filename: string): Node | undefined => {
    return nodesRef.current.find(
      (n) => (n.type === 'iteration') && (n.data.filename as string) === filename,
    );
  }, []);

  // Calculate position for iteration node
  const calculateIterationPosition = useCallback((parentNode: Node, iterationNumber: number, totalIterations: number): { x: number; y: number } => {
    const parentX = parentNode.position.x;
    const parentY = parentNode.position.y;
    const parentW = parentNode.measured?.width ?? (parentNode.type === 'component' ? DEFAULT_COMPONENT_NODE_WIDTH : DEFAULT_ITERATION_NODE_WIDTH);

    // Find existing child nodes (iterations + skeletons) of this parent
    const existingChildren = nodesRef.current.filter(
      n =>
        (n.type === 'iteration' || n.type === 'skeleton') &&
        n.data.parentNodeId === parentNode.id
    );

    // Place to the right of the parent, or after the rightmost existing child
    let startX: number;
    if (existingChildren.length > 0) {
      const rightmostEdge = Math.max(
        ...existingChildren.map(n => {
          const w = n.measured?.width ?? DEFAULT_ITERATION_NODE_WIDTH;
          return n.position.x + w;
        })
      );
      startX = rightmostEdge + ARRANGE_HORIZONTAL_GAP;
    } else {
      startX = parentX + parentW + ARRANGE_HORIZONTAL_GAP;
    }

    return {
      x: startX + (iterationNumber - 1) * ITERATION_HORIZONTAL_SPACING,
      y: parentY,
    };
  }, []);

  // Handle iteration deletion callback
  const handleIterationDelete = useCallback((filename: string) => {
    setKnownIterations(prev => prev.filter(f => f !== filename));
  }, []);

  // Handle iteration adoption
  const handleIterationAdopt = useCallback((filename: string) => {
    // Copy the import path to clipboard
    const importPath = `@/app/playground/iterations/${filename.replace('.tsx', '')}`;
    navigator.clipboard.writeText(importPath).catch(() => {});
  }, []);

  // Stop polling - defined first so it can be referenced
  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  // Reset the poll timeout (extends watching duration)
  const resetPollTimeout = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }
    pollTimeoutRef.current = setTimeout(() => {
      stopPolling();
    }, POLL_DURATION);
  }, [stopPolling]);

  // Scan for iterations (single check) -- tree-aware: connects to parent iteration or component
  const scanForIterations = useCallback(async (resetTimeoutOnFind = false) => {
    setIsScanning(true);
    try {
      const response = await fetch('/playground/api/iterations');
      if (!response.ok) {
        console.error('[Playground] Failed to fetch iterations:', response.status);
        return;
      }
      
      const { iterations } = await response.json() as { iterations: IterationFile[] };
      
      const currentNodes = nodesRef.current;
      const currentKnownIterations = knownIterationsRef.current;
      
      // Build set of known filenames (from state + existing nodes)
      const existingFilenames = new Set([
        ...currentKnownIterations,
        ...currentNodes
          .filter(n => n.type === 'iteration' && n.data.filename)
          .map(n => n.data.filename as string)
      ]);
      
      const newIterations = iterations.filter(
        (iter: IterationFile) => !existingFilenames.has(iter.filename)
      );
      
      if (newIterations.length === 0) {
        return;
      }
      
      // Create nodes and edges for new iterations (tree-aware)
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];
      const newKnownFilenames: string[] = [];
      
      // We may need to look up newly added nodes too (for chaining within one scan)
      const pendingNodesByFilename = new Map<string, string>(); // filename -> nodeId
      
      for (const iter of newIterations) {
        let sourceNodeId: string | undefined;
        
        // Tree-aware: if sourceIteration exists, connect to the parent iteration node
        if (iter.sourceIteration) {
          // First check existing nodes
          const sourceIterNode = findIterationNodeByFilename(iter.sourceIteration);
          if (sourceIterNode) {
            sourceNodeId = sourceIterNode.id;
          } else {
            // Check if it was just added in this batch
            sourceNodeId = pendingNodesByFilename.get(iter.sourceIteration);
          }
        }
        
        // Fallback: connect to the component node
        if (!sourceNodeId) {
          const parentNode = findParentNode(iter.componentName, iter.parentId);
          if (parentNode) {
            sourceNodeId = parentNode.id;
          }
        }
        
        if (!sourceNodeId) {
          continue;
        }
        
        // Position temporarily -- auto-arrange will fix positions
        const sourceNode = nodesRef.current.find(n => n.id === sourceNodeId) || newNodes.find(n => n.id === sourceNodeId);
        const position = sourceNode
          ? { x: sourceNode.position.x + ITERATION_HORIZONTAL_SPACING, y: sourceNode.position.y }
          : { x: 400, y: 200 };
        
        const nodeId = getNodeId();
        pendingNodesByFilename.set(iter.filename, nodeId);
        
        const parentSize = (sourceNode?.data?.size as string | undefined) as import('./lib/constants').ComponentSize | undefined;

        // Inherit the registry ID from the parent node so we never have to
        // guess it from the component name in the iteration file comment.
        // ComponentNode stores it as `componentId`; IterationNode stores it as `registryId`.
        const inheritedRegistryId =
          (sourceNode?.data?.componentId as string | undefined) ??
          (sourceNode?.data?.registryId as string | undefined);

        newNodes.push({
          id: nodeId,
          type: 'iteration',
          position,
          data: {
            componentName: iter.componentName,
            iterationNumber: iter.iterationNumber,
            filename: iter.filename,
            description: iter.description,
            parentNodeId: sourceNodeId,
            parentSize,
            registryId: inheritedRegistryId,
            onDelete: handleIterationDelete,
            onAdopt: handleIterationAdopt,
          },
        });
        
        newEdges.push({
          id: `edge_${sourceNodeId}_${nodeId}`,
          source: sourceNodeId,
          target: nodeId,
          type: 'smoothstep',
          animated: false,
          style: ITERATION_EDGE_STYLE,
        });
        
        newKnownFilenames.push(iter.filename);
      }
      
      if (newNodes.length > 0) {
        setNodes(nds => [...nds, ...newNodes]);
        setEdges(eds => [...eds, ...newEdges]);
        setKnownIterations(prev => [...prev, ...newKnownFilenames]);
        
        if (resetTimeoutOnFind) {
          resetPollTimeout();
        }
      }
    } catch (error) {
      console.error('Error scanning iterations:', error);
    } finally {
      setIsScanning(false);
    }
  }, [findParentNode, findIterationNodeByFilename, getNodeId, handleIterationDelete, handleIterationAdopt, setNodes, setEdges, resetPollTimeout]);

  // Start temporary polling (after prompt copy)
  const startPolling = useCallback(() => {
    if (isPolling) return;
    
    setIsPolling(true);
    
    // Poll immediately
    scanForIterations(true);
    
    // Set up interval - pass true to reset timeout on find
    pollIntervalRef.current = setInterval(() => {
      scanForIterations(true);
    }, POLL_INTERVAL);
    
    // Stop polling after duration
    pollTimeoutRef.current = setTimeout(() => {
      stopPolling();
    }, POLL_DURATION);
  }, [isPolling, scanForIterations, stopPolling]);

  // Listen for prompt copied event to start polling
  useEffect(() => {
    const handlePromptCopied = () => {
      startPolling();
    };

    const handleFetchRequest = () => {
      // Manual fetch - scan immediately and reset timeout if polling
      scanForIterations(true);
    };

    window.addEventListener(ITERATION_PROMPT_COPIED_EVENT, handlePromptCopied);
    window.addEventListener(ITERATION_FETCH_EVENT, handleFetchRequest);
    return () => {
      window.removeEventListener(ITERATION_PROMPT_COPIED_EVENT, handlePromptCopied);
      window.removeEventListener(ITERATION_FETCH_EVENT, handleFetchRequest);
      stopPolling();
    };
  }, [startPolling, stopPolling, scanForIterations]);

  // Initial scan on mount (once)
  useEffect(() => {
    scanForIterations(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps = run once on mount

  // Handle generation lifecycle events
  useEffect(() => {
    /**
     * Check whether a rectangle overlaps any existing canvas node.
     * Returns true if there is a collision.
     */
    const rectsOverlap = (
      a: { x: number; y: number; w: number; h: number },
      b: { x: number; y: number; w: number; h: number },
      padding = 20,
    ) =>
      a.x < b.x + b.w + padding &&
      a.x + a.w + padding > b.x &&
      a.y < b.y + b.h + padding &&
      a.y + a.h + padding > b.y;

    /**
     * Given a set of candidate skeleton rects, shift the entire group
     * downward until none of them overlap any existing node on the canvas.
     * Also avoids overlapping previously placed skeletons in the same batch.
     */
    const resolveOverlaps = (
      rects: { x: number; y: number; w: number; h: number }[],
      existingNodes: Node[],
    ) => {
      const SHIFT_STEP = 80; // px to shift down per iteration
      const MAX_ATTEMPTS = 20;

      // Build bounding boxes for all existing canvas nodes
      const obstacles = existingNodes.map(n => ({
        x: n.position.x,
        y: n.position.y,
        w: n.measured?.width ?? (n.type === 'component' ? DEFAULT_COMPONENT_NODE_WIDTH : DEFAULT_ITERATION_NODE_WIDTH),
        h: n.measured?.height ?? (n.type === 'component' ? DEFAULT_COMPONENT_NODE_HEIGHT : DEFAULT_ITERATION_NODE_HEIGHT),
      }));

      let attempts = 0;
      let hasCollision = true;

      while (hasCollision && attempts < MAX_ATTEMPTS) {
        hasCollision = false;
        for (const rect of rects) {
          for (const obs of obstacles) {
            if (rectsOverlap(rect, obs)) {
              hasCollision = true;
              break;
            }
          }
          if (hasCollision) break;
        }

        if (hasCollision) {
          // Shift all candidate rects down
          for (const rect of rects) {
            rect.y += SHIFT_STEP;
          }
          attempts++;
        }
      }

      return rects;
    };

    const handleGenerationStart = (e: CustomEvent<GenerationStartPayload>) => {
      const { componentId, componentName, parentNodeId, iterationCount, gridLayout } = e.detail;


      // Find the parent node (use ref for current nodes)
      const parentNode = nodesRef.current.find(n => n.id === parentNodeId);
      if (!parentNode) {
        console.error('[Playground] Parent node not found:', parentNodeId);
        return;
      }

      // Parent node dimensions (used for grid sizing and skeleton sizing)
      const cellW =
        parentNode.measured?.width ??
        (parentNode.type === 'component'
          ? DEFAULT_COMPONENT_NODE_WIDTH
          : DEFAULT_ITERATION_NODE_WIDTH);
      const cellH =
        parentNode.measured?.height ??
        (parentNode.type === 'component'
          ? DEFAULT_COMPONENT_NODE_HEIGHT
          : DEFAULT_ITERATION_NODE_HEIGHT);

      // Create skeleton nodes
      const skeletonNodes: Node[] = [];
      const skeletonEdges: Edge[] = [];
      const skeletonNodeIds: string[] = [];

      // Build candidate positions for all skeletons first
      const candidateRects: { x: number; y: number; w: number; h: number }[] = [];

      for (let i = 1; i <= iterationCount; i++) {
        let x: number;
        let y: number;

        if (gridLayout) {
          // Grid layout from drag-to-iterate: position skeleton nodes at the
          // same positions as ghost cells, matching each variation number.
          // The parent node occupies cell (0,0). Variants are numbered
          // left-to-right, top-to-bottom, skipping (0,0).
          const { rows, cols } = gridLayout;
          const gap = DRAG_GHOST_GAP;

          // Find the (row, col) for variant number i (skipping 0,0)
          let variantIndex = 0;
          let targetRow = 0;
          let targetCol = 0;
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (r === 0 && c === 0) continue; // skip original
              variantIndex++;
              if (variantIndex === i) {
                targetRow = r;
                targetCol = c;
                break;
              }
            }
            if (variantIndex === i) break;
          }

          x = parentNode.position.x + targetCol * (cellW + gap);
          y = parentNode.position.y + targetRow * (cellH + gap);
        } else {
          // Dialog flow: center iterations horizontally below the parent
          const GAP_H = 40;
          const GAP_V = 60;
          const parentCenterX = parentNode.position.x + cellW / 2;
          const totalSpan = iterationCount * cellW + (iterationCount - 1) * GAP_H;
          const startX = parentCenterX - totalSpan / 2;
          x = startX + (i - 1) * (cellW + GAP_H);
          y = parentNode.position.y + cellH + GAP_V;
        }

        candidateRects.push({ x, y, w: cellW, h: cellH });
      }

      // Resolve overlaps with existing canvas nodes (excludes parent which is above)
      const existingNodes = nodesRef.current.filter(n => n.id !== parentNodeId);
      resolveOverlaps(candidateRects, existingNodes);

      for (let i = 0; i < iterationCount; i++) {
        const position = { x: candidateRects[i].x, y: candidateRects[i].y };
        const nodeId = getNodeId();
        skeletonNodeIds.push(nodeId);

        skeletonNodes.push({
          id: nodeId,
          type: 'skeleton',
          position,
          data: {
            iterationNumber: i + 1,
            componentName,
            parentNodeId,
            totalIterations: iterationCount,
            // Always size skeleton nodes to match parent so button and drag flows are consistent
            width: cellW,
            height: cellH,
          },
        });

        skeletonEdges.push({
          id: `edge_${parentNodeId}_${nodeId}`,
          source: parentNodeId,
          target: nodeId,
          type: 'smoothstep',
          animated: true,
          style: SKELETON_EDGE_STYLE,
        });
      }

      // Add skeleton nodes to canvas
      setNodes(nds => [...nds, ...skeletonNodes]);
      setEdges(eds => [...eds, ...skeletonEdges]);

      // Update generation state — sync ref eagerly so that a fast
      // GENERATION_COMPLETE_EVENT can read the skeleton IDs before React
      // renders and the useEffect-based ref sync fires.
      const newInfo: GenerationInfo = {
        componentId,
        componentName,
        parentNodeId,
        iterationCount,
        skeletonNodeIds,
        startTime: Date.now(),
        skeletonPositions: skeletonNodes.map(n => ({ x: n.position.x, y: n.position.y })),
        gridPositions: gridLayout
          ? skeletonNodes.map(n => ({ x: n.position.x, y: n.position.y }))
          : undefined,
        gridCellSize: gridLayout ? { width: cellW, height: cellH } : undefined,
      };
      generationInfoRef.current = newInfo;
      setIsGenerating(true);
      setLastGenerationDuration(null);
      setGenerationInfo(newInfo);
    };

    const handleGenerationComplete = (): void => {

      // Use ref to get latest generation info
      const info = generationInfoRef.current;

      // Calculate and store duration
      if (info?.startTime) {
        const durationMs = Date.now() - info.startTime;
        const totalSeconds = Math.floor(durationMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const formatted = `${minutes}m:${seconds.toString().padStart(2, '0')}s`;
        setLastGenerationDuration(formatted);
      }

      // Capture skeleton positions before clearing generation state
      const savedPositions = info?.skeletonPositions ?? info?.gridPositions;
      const savedParentNodeId = info?.parentNodeId;

      // Remove skeleton nodes
      if (info) {
        setNodes(nds => nds.filter(n => !info.skeletonNodeIds.includes(n.id)));
        setEdges(eds => eds.filter(e => !info.skeletonNodeIds.some(id => e.target === id)));
      }

      // Reset generation state — eagerly sync ref so concurrent callers
      // (e.g. status polling) see the cleared state immediately.
      generationInfoRef.current = null;
      setIsGenerating(false);
      setGenerationInfo(null);

      // Trigger iteration scan to fetch newly created iterations
      // Small delay to allow filesystem to sync
      setTimeout(async () => {
        const nodesBefore = new Set(nodesRef.current.map(n => n.id));
        await scanForIterations(false);

        if (savedPositions && savedParentNodeId) {
          // Reposition newly created iteration nodes to match
          // where skeleton nodes were displayed.
          // Use a short delay to let React process the state update from scanForIterations.
          setTimeout(() => {
            const newNodes = nodesRef.current.filter(
              n => !nodesBefore.has(n.id) && n.type === 'iteration',
            );
            if (newNodes.length > 0) {
              // Sort new nodes by iteration number so positions map 1:1 to grid cells
              const sorted = [...newNodes].sort((a, b) => {
                const aNum = (a.data.iterationNumber as number) || 0;
                const bNum = (b.data.iterationNumber as number) || 0;
                return aNum - bNum;
              });

              setNodes(nds =>
                nds.map(n => {
                  const idx = sorted.findIndex(sn => sn.id === n.id);
                  if (idx !== -1 && idx < savedPositions.length) {
                    return { ...n, position: savedPositions[idx] };
                  }
                  return n;
                }),
              );
            }
          }, 150);
        }
      }, POST_GENERATION_SCAN_DELAY);
    };

    const handleGenerationError = (e: CustomEvent<GenerationErrorPayload>) => {
      const detail = e.detail || {};
      const errorMessage = detail.error || 'Unknown error occurred';
      const componentId = detail.componentId || 'unknown';
      const parentNodeId = detail.parentNodeId || 'unknown';
      const logPayload = {
        error: errorMessage,
        componentId,
        parentNodeId,
        fullDetail: detail,
      };

      // Use ref to get latest generation info to distinguish dialog vs drag-to-iterate flows.
      const info = generationInfoRef.current;
      const isDragFlow = !!info?.gridPositions;

      if (errorMessage === 'Cancelled by user') {
        console.info('[Playground] Generation cancelled by user.', logPayload);
      } else if (errorMessage.includes('generation is already in progress')) {
        console.info('[Playground] Generation already in progress.', logPayload);
      } else {
        console.error('[Playground] Generation error:', errorMessage, logPayload);
        toast.error(errorMessage, { duration: 6000 });
      }
      
      // Remove skeleton nodes
      if (info) {
        setNodes(nds => nds.filter(n => !info.skeletonNodeIds.includes(n.id)));
        setEdges(eds => eds.filter(e => !info.skeletonNodeIds.some(id => e.target === id)));
      }

      // Reset generation state — eagerly sync ref
      generationInfoRef.current = null;
      setIsGenerating(false);
      setGenerationInfo(null);
    };

    window.addEventListener(GENERATION_START_EVENT, handleGenerationStart as EventListener);
    window.addEventListener(GENERATION_COMPLETE_EVENT, handleGenerationComplete as EventListener);
    window.addEventListener(GENERATION_ERROR_EVENT, handleGenerationError as EventListener);

    return () => {
      window.removeEventListener(GENERATION_START_EVENT, handleGenerationStart as EventListener);
      window.removeEventListener(GENERATION_COMPLETE_EVENT, handleGenerationComplete as EventListener);
      window.removeEventListener(GENERATION_ERROR_EVENT, handleGenerationError as EventListener);
    };
    // Using refs for nodes and generationInfo so we don't need them in deps
  }, [getNodeId, setNodes, setEdges, scanForIterations]);

  // ---------------------------------------------------------------------------
  // Drag-to-iterate handler
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleDragIterate = async (e: CustomEvent<DragIteratePayload>) => {
      const {
        componentId,
        componentName,
        parentNodeId,
        iterationCount,
        model,
        sourceFilename,
      } = e.detail;

      // Build the prompt
      let prompt: string;
      const defaultSkillPrompt = await loadDefaultSkillPrompt();

      // Fetch next available iteration number
      // Compare with spaces stripped since filenames use "PricingCard" not "Pricing Card"
      const cleanName = componentName.replace(/\s+/g, '');
      let startNumber = 1;
      try {
        const response = await fetch('/playground/api/iterations');
        if (response.ok) {
          const { iterations } = await response.json();
          const componentIterations = iterations.filter(
            (i: { componentName: string }) => i.componentName === cleanName
          );
          const maxNumber = componentIterations.reduce(
            (max: number, i: { iterationNumber: number }) =>
              Math.max(max, i.iterationNumber),
            0
          );
          startNumber = maxNumber + 1;
        }
      } catch { /* use default */ }

      if (sourceFilename) {
        try {
          prompt = generateIterationFromIterationPrompt(
            componentId,
            sourceFilename,
            iterationCount,
            startNumber,
            'shell',
            DEFAULT_EMPTY_ITERATION_INSTRUCTIONS,
            defaultSkillPrompt || undefined,
          );
        } catch {
          prompt = generateIterationPrompt(
            componentId,
            iterationCount,
            startNumber,
            'shell',
            DEFAULT_EMPTY_ITERATION_INSTRUCTIONS,
            defaultSkillPrompt || undefined,
          );
        }
      } else {
        prompt = generateIterationPrompt(
          componentId,
          iterationCount,
          startNumber,
          'shell',
          DEFAULT_EMPTY_ITERATION_INSTRUCTIONS,
          defaultSkillPrompt || undefined,
        );
      }

      // Guard: prompt must be non-empty before we proceed
      if (!prompt) {
        window.dispatchEvent(
          new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
            detail: {
              componentId,
              parentNodeId,
              error: `Component "${componentId}" is not registered. Add it to the registry or re-run discovery before iterating.`,
            },
          }),
        );
        return;
      }

      // Dispatch generation start (creates skeleton nodes in grid layout)
      window.dispatchEvent(
        new CustomEvent<GenerationStartPayload>(GENERATION_START_EVENT, {
          detail: {
            componentId,
            componentName,
            parentNodeId,
            iterationCount,
            gridLayout: { rows: e.detail.rows, cols: e.detail.cols },
          },
        }),
      );

      // Call the generate API
      try {
        const response = await fetch('/playground/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            componentId,
            iterationCount,
            model: model || undefined,
          }),
        });

        let data;
        try {
          data = await response.json();
        } catch {
          window.dispatchEvent(
            new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
              detail: {
                componentId,
                parentNodeId,
                error: 'Failed to parse response',
              },
            }),
          );
          return;
        }

        if (!response.ok || !data.success) {
          const error =
            typeof data?.error === 'string' ? data.error : 'Generation failed';
          window.dispatchEvent(
            new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
              detail: { componentId, parentNodeId, error },
            }),
          );
        } else {
          window.dispatchEvent(
            new CustomEvent<GenerationCompletePayload>(
              GENERATION_COMPLETE_EVENT,
              { detail: { componentId, parentNodeId, output: '' } },
            ),
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        window.dispatchEvent(
          new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
            detail: { componentId, parentNodeId, error: msg },
          }),
        );
      }
    };

    const listener = ((e: Event) =>
      handleDragIterate(e as CustomEvent<DragIteratePayload>)) as EventListener;
    window.addEventListener(DRAG_ITERATE_EVENT, listener);
    return () => window.removeEventListener(DRAG_ITERATE_EVENT, listener);
  }, []);

  // ---------------------------------------------------------------------------
  // Cursor Chat submit handler + queue
  // ---------------------------------------------------------------------------
  const elementSelection = useElementSelection();
  const generationQueueRef = useRef<CursorChatSubmitPayload[]>([]);

  const handleCursorChatSubmit = useCallback(async (payload: CursorChatSubmitPayload) => {
    // If generation already in progress, queue it
    if (isGeneratingRef.current) {
      generationQueueRef.current.push(payload);
      window.dispatchEvent(
        new CustomEvent<GenerationQueuedPayload>(GENERATION_QUEUED_EVENT, {
          detail: {
            componentId: payload.targetComponentId || 'cursor-chat-freeform',
            model: payload.model || 'auto',
            flowPosition: payload.canvasPosition ?? null,
          },
        }),
      );
      toast('Queued — will run after current generation', { duration: 3000 });
      return;
    }

    const {
      text,
      skillPrompts,
      model: payloadModel,
      targetNodeId,
      targetComponentId,
      targetComponentName,
      targetType,
      sourceFilename,
    } = payload;

    // Combine skill prompts
    let combinedSkillPrompt: string | undefined;
    if (skillPrompts.length > 0) {
      combinedSkillPrompt = skillPrompts.join('\n\n');
    } else {
      // Use default skills when no explicit skills selected
      const defaultPrompt = await loadDefaultSkillPrompt();
      combinedSkillPrompt = defaultPrompt || undefined;
    }

    const customInstructions = text || DEFAULT_EMPTY_ITERATION_INSTRUCTIONS;
    const hasElementSelections = (payload.elementSelections?.length ?? 0) > 0;
    const stylingMode: StylingMode = payload.skillIds?.includes('no-bound-explore')
      ? 'inline-css' : DEFAULT_STYLING_MODE;

    if (targetNodeId && targetComponentId && targetComponentName && targetType) {
      // --- WITH TARGET NODE ---
      let prompt: string;
      const componentId = targetComponentId;
      const componentName = targetComponentName;
      const iterationCount = payload.iterationCount ?? CURSOR_CHAT_DEFAULT_COUNT;

      // Fetch next available iteration number once for all paths
      // Compare with spaces stripped since filenames use "PricingCard" not "Pricing Card"
      const cleanName = componentName.replace(/\s+/g, '');
      let startNumber = 1;
      try {
        const response = await fetch('/playground/api/iterations');
        if (response.ok) {
          const { iterations } = await response.json();
          const componentIterations = iterations.filter(
            (i: { componentName: string }) => i.componentName === cleanName
          );
          const maxNumber = componentIterations.reduce(
            (max: number, i: { iterationNumber: number }) =>
              Math.max(max, i.iterationNumber),
            0
          );
          startNumber = maxNumber + 1;
        }
      } catch { /* use default */ }

      if (targetType === 'iteration' && sourceFilename) {
        // Iterate from iteration
        if (hasElementSelections) {
          prompt = generateElementIterationFromIterationPrompt(
            componentId,
            sourceFilename,
            startNumber,
            iterationCount,
            CURSOR_CHAT_DEFAULT_DEPTH,
            payload.elementSelections,
            customInstructions,
            combinedSkillPrompt,
            stylingMode,
          );
        } else {
          prompt = generateIterationFromIterationPrompt(
            componentId,
            sourceFilename,
            iterationCount,
            startNumber,
            CURSOR_CHAT_DEFAULT_DEPTH,
            customInstructions,
            combinedSkillPrompt,
            stylingMode,
          );
        }
      } else {
        // Component iteration
        if (hasElementSelections) {
          prompt = generateElementIterationPrompt(
            componentId,
            startNumber,
            iterationCount,
            CURSOR_CHAT_DEFAULT_DEPTH,
            payload.elementSelections,
            customInstructions,
            combinedSkillPrompt,
            stylingMode,
          );
        } else {
          prompt = generateIterationPrompt(
            componentId,
            iterationCount,
            startNumber,
            CURSOR_CHAT_DEFAULT_DEPTH,
            customInstructions,
            combinedSkillPrompt,
            stylingMode,
          );
        }
      }

      // Dispatch generation start (creates skeleton nodes)
      window.dispatchEvent(
        new CustomEvent<GenerationStartPayload>(GENERATION_START_EVENT, {
          detail: {
            componentId,
            componentName,
            parentNodeId: targetNodeId,
            iterationCount,
            model: payloadModel || undefined,
            flowPosition: payload.canvasPosition,
          },
        }),
      );

      // Call the generate API
      try {
        const response = await fetch('/playground/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            componentId,
            iterationCount,
            model: payloadModel || undefined,
          }),
        });

        let data;
        try {
          data = await response.json();
        } catch {
          window.dispatchEvent(
            new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
              detail: { componentId, parentNodeId: targetNodeId, error: 'Failed to parse response' },
            }),
          );
          return;
        }

        if (!response.ok || !data.success) {
          const error = typeof data?.error === 'string' ? data.error : 'Generation failed';
          window.dispatchEvent(
            new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
              detail: { componentId, parentNodeId: targetNodeId, error },
            }),
          );
        } else {
          window.dispatchEvent(
            new CustomEvent<GenerationCompletePayload>(GENERATION_COMPLETE_EVENT, {
              detail: { componentId, parentNodeId: targetNodeId, output: '' },
            }),
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        window.dispatchEvent(
          new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
            detail: { componentId, parentNodeId: targetNodeId, error: msg },
          }),
        );
      }
    } else {
      // --- FREEFORM (no target) ---
      // Manage isGenerating directly — do NOT dispatch GENERATION_START_EVENT
      // because the event handler requires a valid parentNodeId to find a parent node.
      const freeformInfo: GenerationInfo = {
        componentId: 'cursor-chat-freeform',
        componentName: 'Freeform',
        parentNodeId: '',
        iterationCount: 0,
        skeletonNodeIds: [],
        startTime: Date.now(),
      };
      generationInfoRef.current = freeformInfo;
      setIsGenerating(true);
      setGenerationInfo(freeformInfo);

      try {
        const response = await fetch('/playground/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: customInstructions,
            componentId: 'cursor-chat-freeform',
            iterationCount: 0,
            model: payloadModel || undefined,
          }),
        });

        const data = await response.json().catch(() => ({ success: false }));
        if (!response.ok || !data.success) {
          console.error('[CursorChat] Freeform generation failed:', data?.error);
        }
      } catch (err) {
        console.error('[CursorChat] Freeform generation error:', err);
      } finally {
        generationInfoRef.current = null;
        setIsGenerating(false);
        setGenerationInfo(null);

        // Drain queue
        setTimeout(() => {
          if (generationQueueRef.current.length > 0) {
            const next = generationQueueRef.current.shift()!;
            handleCursorChatSubmit(next);
          }
        }, POST_GENERATION_SCAN_DELAY + 500);
      }
    }
  }, [setIsGenerating, setGenerationInfo, scanForIterations]);

  // Also drain queue after normal generation completes
  // (hook into generation complete/error to check queue)
  useEffect(() => {
    const drainQueue = () => {
      setTimeout(() => {
        if (generationQueueRef.current.length > 0) {
          const next = generationQueueRef.current.shift()!;
          handleCursorChatSubmit(next);
        }
      }, POST_GENERATION_SCAN_DELAY + 500);
    };

    window.addEventListener(GENERATION_COMPLETE_EVENT, drainQueue);
    window.addEventListener(GENERATION_ERROR_EVENT, drainQueue);
    return () => {
      window.removeEventListener(GENERATION_COMPLETE_EVENT, drainQueue);
      window.removeEventListener(GENERATION_ERROR_EVENT, drainQueue);
    };
  }, [handleCursorChatSubmit]);

  // Fullscreen fitView behavior is no longer used; nodes open in a new tab instead

  // Pan-to-position event listener (for presence bubble clicks)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ x: number; y: number }>).detail;
      if (detail?.x != null && detail?.y != null) {
        setCenter(detail.x, detail.y, { duration: 400, zoom: 1 });
      }
    };
    window.addEventListener(PAN_TO_POSITION_EVENT, handler);
    return () => window.removeEventListener(PAN_TO_POSITION_EVENT, handler);
  }, [setCenter]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const componentId = event.dataTransfer.getData(DND_DATA_KEY);
      if (!componentId) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: getNodeId(),
        type: 'component',
        position,
        data: { componentId },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, getNodeId]
  );

  const handlePaneClick = useCallback(() => {
    // No-op: clicking the pane does not change fullscreen state
  }, []);

  // Handle node deletion - check for children first
  const onNodesDelete = useCallback(async (deletedNodes: Node[]) => {
    for (const node of deletedNodes) {
      if (node.type === 'iteration' && node.data.filename) {
        // Check if this node has children
        const childEdges = edges.filter(e => e.source === node.id);
        if (childEdges.length > 0) {
          // Has children -- show cascade/reparent dialog instead of deleting immediately
          setDeleteDialogNode(node);
          return; // Don't delete yet, wait for dialog action
        }

        // No children -- simple delete
        try {
          await fetch('/playground/api/iterations', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: node.data.filename }),
          });
          setKnownIterations(prev => prev.filter(f => f !== node.data.filename));
        } catch (error) {
          console.error('Error deleting iteration file:', error);
        }
      }
    }
  }, [edges]);

  // Handle cascade or reparent deletion
  const handleDeleteWithMode = useCallback(async (mode: 'cascade' | 'reparent') => {
    const node = deleteDialogNode;
    if (!node || !node.data.filename) return;

    try {
      const resp = await fetch('/playground/api/iterations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: node.data.filename, mode }),
      });

      if (!resp.ok) {
        console.error('[Playground] Delete failed:', resp.status);
        setDeleteDialogNode(null);
        return;
      }

      const { deletedFiles } = (await resp.json()) as { deletedFiles: string[] };

      if (mode === 'cascade') {
        // Remove the node and all descendants from canvas
        const deletedSet = new Set(deletedFiles);

        // Find all node IDs to remove (match by filename)
        const nodeIdsToRemove = new Set<string>();
        nodes.forEach(n => {
          if (n.id === node.id) nodeIdsToRemove.add(n.id);
          if (n.data.filename && deletedSet.has(n.data.filename as string)) {
            nodeIdsToRemove.add(n.id);
          }
        });

        setNodes(nds => nds.filter(n => !nodeIdsToRemove.has(n.id)));
        setEdges(eds => eds.filter(e => !nodeIdsToRemove.has(e.source) && !nodeIdsToRemove.has(e.target)));
        setKnownIterations(prev => prev.filter(f => !deletedSet.has(f)));
        
        // Clean up collapsed state
        setCollapsedNodeIds(prev => {
          const next = new Set(prev);
          nodeIdsToRemove.forEach(id => next.delete(id));
          return next;
        });
      } else {
        // Reparent: reconnect children to the deleted node's parent
        const parentEdge = edges.find(e => e.target === node.id);
        const parentId = parentEdge?.source;

        // Get child node IDs
        const childEdges = edges.filter(e => e.source === node.id);
        const childNodeIds = childEdges.map(e => e.target);

        // Remove the deleted node
        setNodes(nds => nds.filter(n => n.id !== node.id));

        // Remove all edges to/from deleted node, and add new edges from parent to children
        setEdges(eds => {
          const filtered = eds.filter(e => e.source !== node.id && e.target !== node.id);
          if (parentId) {
            const newEdges = childNodeIds.map(childId => ({
              id: `edge_${parentId}_${childId}`,
              source: parentId,
              target: childId,
              type: 'smoothstep',
              animated: false,
              style: ITERATION_EDGE_STYLE,
            }));
            return [...filtered, ...newEdges];
          }
          return filtered;
        });

        setKnownIterations(prev => prev.filter(f => f !== node.data.filename));
        
        // Clean up collapsed state for deleted node
        setCollapsedNodeIds(prev => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
      }
    } catch (error) {
      console.error('[Playground] Delete error:', error);
    } finally {
      setDeleteDialogNode(null);
    }
  }, [deleteDialogNode, nodes, edges, setNodes, setEdges]);

  // ---------------------------------------------------------------------------
  // Auto-arrange: tree-expanding-rightward layout
  // Each component is a root. Its iterations (and their sub-iterations) expand rightward.
  // ---------------------------------------------------------------------------
  const autoArrangeNodes = useCallback((andFitView: boolean = false) => {
    const componentNodes = nodes.filter(n => n.type === 'component');
    if (componentNodes.length === 0) return;

    const START_X = ARRANGE_START_X;
    const START_Y = ARRANGE_START_Y;
    const VERTICAL_GAP = ARRANGE_VERTICAL_GAP;
    const GROUP_GAP = ARRANGE_GROUP_GAP;
    const COL_WIDTH = TREE_COLUMN_WIDTH;

    // Helper to get node dimensions
    const getNodeSize = (node: Node): { width: number; height: number } => {
      const measured = node.measured;
      if (measured?.width && measured?.height) {
        return { width: measured.width, height: measured.height };
      }
      if (node.type === 'iteration' || node.type === 'skeleton') {
        return { width: DEFAULT_ITERATION_NODE_WIDTH, height: DEFAULT_ITERATION_NODE_HEIGHT };
      }
      return { width: DEFAULT_COMPONENT_NODE_WIDTH, height: DEFAULT_COMPONENT_NODE_HEIGHT };
    };

    // Build adjacency list from edges (parent -> children)
    const childrenMap = new Map<string, string[]>();
    edges.forEach(edge => {
      const existing = childrenMap.get(edge.source) || [];
      existing.push(edge.target);
      childrenMap.set(edge.source, existing);
    });

    // Build a set of all visible node IDs (respect collapse state)
    const collapsed = collapsedNodeIdsRef.current;
    const hiddenNodeIds = new Set<string>();
    const markDescendantsHidden = (parentId: string) => {
      const children = childrenMap.get(parentId) || [];
      for (const childId of children) {
        hiddenNodeIds.add(childId);
        markDescendantsHidden(childId);
      }
    };
    collapsed.forEach(nodeId => markDescendantsHidden(nodeId));

    const nodeMap = new Map<string, Node>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    // Compute subtree height recursively (only counting visible nodes)
    const subtreeHeightCache = new Map<string, number>();
    const computeSubtreeHeight = (nodeId: string): number => {
      if (subtreeHeightCache.has(nodeId)) return subtreeHeightCache.get(nodeId)!;
      
      const node = nodeMap.get(nodeId);
      if (!node) { subtreeHeightCache.set(nodeId, 0); return 0; }
      
      const nodeHeight = getNodeSize(node).height;
      const children = (childrenMap.get(nodeId) || []).filter(id => !hiddenNodeIds.has(id));
      
      if (children.length === 0) {
        subtreeHeightCache.set(nodeId, nodeHeight);
        return nodeHeight;
      }
      
      // Sum of children subtree heights + gaps
      let totalChildrenHeight = 0;
      children.forEach((childId, idx) => {
        totalChildrenHeight += computeSubtreeHeight(childId);
        if (idx < children.length - 1) totalChildrenHeight += VERTICAL_GAP;
      });
      
      const height = Math.max(nodeHeight, totalChildrenHeight);
      subtreeHeightCache.set(nodeId, height);
      return height;
    };

    // Position map
    const positionMap = new Map<string, { x: number; y: number }>();

    // Recursively position a subtree starting from nodeId at depth and yStart
    const positionSubtree = (nodeId: string, depth: number, yStart: number) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;
      
      const nodeHeight = getNodeSize(node).height;
      const subtreeH = computeSubtreeHeight(nodeId);
      const x = START_X + depth * COL_WIDTH;
      
      const children = (childrenMap.get(nodeId) || []).filter(id => !hiddenNodeIds.has(id));
      
      if (children.length === 0) {
        // Leaf: center within its allocation
        positionMap.set(nodeId, { x, y: yStart + (subtreeH - nodeHeight) / 2 });
        return;
      }
      
      // Position children first so we know their span
      let childY = yStart;
      children.forEach((childId, idx) => {
        const childSubtreeH = computeSubtreeHeight(childId);
        positionSubtree(childId, depth + 1, childY);
        childY += childSubtreeH;
        if (idx < children.length - 1) childY += VERTICAL_GAP;
      });
      
      // Total children span (for centering parent)
      let totalChildrenHeight = 0;
      children.forEach((childId, idx) => {
        totalChildrenHeight += computeSubtreeHeight(childId);
        if (idx < children.length - 1) totalChildrenHeight += VERTICAL_GAP;
      });
      
      // Center parent vertically relative to children span
      const parentY = yStart + (totalChildrenHeight - nodeHeight) / 2;
      positionMap.set(nodeId, { x, y: parentY });
    };

    // Process each component tree
    let currentGroupY = START_Y;
    componentNodes.forEach(componentNode => {
      const subtreeH = computeSubtreeHeight(componentNode.id);
      positionSubtree(componentNode.id, 0, currentGroupY);
      currentGroupY += subtreeH + GROUP_GAP;
    });

    // Position orphan nodes (not reachable from any component)
    const positionedIds = new Set(positionMap.keys());
    const orphans = nodes.filter(n => !positionedIds.has(n.id) && !hiddenNodeIds.has(n.id));
    if (orphans.length > 0) {
      let orphanY = currentGroupY;
      orphans.forEach(node => {
        const size = getNodeSize(node);
        positionMap.set(node.id, { x: START_X + COL_WIDTH, y: orphanY });
        orphanY += size.height + VERTICAL_GAP;
      });
    }

    // Apply positions
    setNodes(currentNodes =>
      currentNodes.map(node => {
        const newPosition = positionMap.get(node.id);
        if (newPosition) {
          return { ...node, position: newPosition };
        }
        return node;
      }),
    );

    if (andFitView) {
      setTimeout(() => {
        fitView(FITVIEW_AFTER_ARRANGE);
      }, ARRANGE_FITVIEW_DELAY);
    }
  }, [nodes, edges, setNodes, fitView]);

  // Handle auto-arrange event (triggered after skeleton nodes are added)
  useEffect(() => {
    const handleAutoArrange = (e: CustomEvent<{ fitView: boolean }>) => {
      autoArrangeNodes(e.detail.fitView);
    };

    window.addEventListener(PLAYGROUND_AUTO_ARRANGE_EVENT, handleAutoArrange as EventListener);
    return () => {
      window.removeEventListener(PLAYGROUND_AUTO_ARRANGE_EVENT, handleAutoArrange as EventListener);
    };
  }, [autoArrangeNodes]);

  // ---------------------------------------------------------------------------
  // Collapse/expand toggle event
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleCollapseToggle = (e: CustomEvent<{ nodeId: string }>) => {
      const { nodeId } = e.detail;
      setCollapsedNodeIds(prev => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        return next;
      });
    };

    window.addEventListener(ITERATION_COLLAPSE_TOGGLE_EVENT, handleCollapseToggle as EventListener);
    return () => {
      window.removeEventListener(ITERATION_COLLAPSE_TOGGLE_EVENT, handleCollapseToggle as EventListener);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Clear event from PlaygroundHeader
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleClear = () => setShowClearDialog(true);
    window.addEventListener(PLAYGROUND_CLEAR_EVENT, handleClear);
    return () => window.removeEventListener(PLAYGROUND_CLEAR_EVENT, handleClear);
  }, []);

  // ---------------------------------------------------------------------------
  // Compute hasChildren + isCollapsed for iteration nodes and filter visible
  // ---------------------------------------------------------------------------
  const { visibleNodes, visibleEdges } = (() => {
    // Build adjacency from current edges
    const childrenMap = new Map<string, string[]>();
    edges.forEach(edge => {
      const existing = childrenMap.get(edge.source) || [];
      existing.push(edge.target);
      childrenMap.set(edge.source, existing);
    });

    // Determine hidden nodes (descendants of collapsed nodes)
    const hiddenSet = new Set<string>();
    const markDescendantsHidden = (parentId: string) => {
      const children = childrenMap.get(parentId) || [];
      for (const childId of children) {
        hiddenSet.add(childId);
        markDescendantsHidden(childId);
      }
    };
    collapsedNodeIds.forEach(nodeId => markDescendantsHidden(nodeId));

    // Annotate iteration nodes with hasChildren + isCollapsed
    const annotatedNodes = nodes
      .filter(n => !hiddenSet.has(n.id))
      .map(n => {
        if (n.type === 'iteration') {
          const children = childrenMap.get(n.id) || [];
          const hasChildren = children.length > 0;
          const isCollapsed = collapsedNodeIds.has(n.id);
          if (hasChildren !== n.data.hasChildren || isCollapsed !== n.data.isCollapsed) {
            return { ...n, data: { ...n.data, hasChildren, isCollapsed } };
          }
        }
        return n;
      });

    const vEdges = edges.filter(e => !hiddenSet.has(e.target) && !hiddenSet.has(e.source));
    return { visibleNodes: annotatedNodes, visibleEdges: vEdges };
  })();

  // Clear all nodes and edges, and delete all iteration files from disk
  const confirmClearAllNodes = useCallback(async () => {
    stopPolling();

    // Best-effort: cancel any active generation process so subsequent runs
    // don't hit "generation already in progress" conflicts after clearing.
    try {
      await fetch('/playground/api/generate', {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('[Playground] Error cancelling generation during clear:', error);
    }

    try {
      // Fetch all known iteration files from the API, not just ones currently on the canvas
      const response = await fetch('/playground/api/iterations');
      if (response.ok) {
        const data = (await response.json()) as { iterations?: { filename: string }[] };
        const iterationFilenames = (data.iterations ?? []).map((iter) => iter.filename);

        await Promise.all(
          iterationFilenames.map(async (filename) => {
            try {
              await fetch('/playground/api/iterations', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, mode: 'cascade' as const }),
              });
            } catch (error) {
              console.error(`Error deleting iteration file ${filename}:`, error);
            }
          }),
        );
      }
    } catch (error) {
      console.error('Error clearing iteration files:', error);
    }

    setNodes([]);
    setEdges([]);
    setKnownIterations([]);
    setCollapsedNodeIds(new Set());

    localStorage.removeItem(STORAGE_KEY);

    setShowClearDialog(false);
  }, [setNodes, setEdges, setKnownIterations, setCollapsedNodeIds, stopPolling]);

  return (
    <TooltipProvider>
      <div ref={reactFlowWrapper} className="w-full h-full">
        <ReactFlow
          nodes={visibleNodes}
          edges={[]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodesDelete={onNodesDelete}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-50"
          proOptions={{ hideAttribution: true }}
          minZoom={CANVAS_MIN_ZOOM}
          maxZoom={CANVAS_MAX_ZOOM}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          panOnDrag={false}
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
        >
          <Controls
            className="!bg-white !border-stone-200 !rounded-lg !shadow-sm [&>button]:!bg-white [&>button]:!border-stone-200 [&>button]:!text-stone-600 [&>button:hover]:!bg-stone-50"
          />
          <MiniMap
            className="!bg-white !border-stone-200 !rounded-lg !shadow-sm"
            nodeColor={(node) => {
              if (node.type === 'skeleton') return MINIMAP_SKELETON_COLOR;
              if (node.type === 'iteration') return MINIMAP_ITERATION_COLOR;
              if (node.type === 'drag-ghost') return '#0B99FF';
              return MINIMAP_COMPONENT_COLOR;
            }}
            maskColor={MINIMAP_MASK_COLOR}
          />
        <Background
          variant={BackgroundVariant.Dots}
          gap={BACKGROUND_GAP}
          size={BACKGROUND_DOT_SIZE}
          color={BACKGROUND_COLOR}
        />
      </ReactFlow>

      {/* Element selection highlights */}
      <ElementHighlight
        isAltHeld={elementSelection.isAltHeld}
        hoveredElement={elementSelection.hoveredElement}
        hoveredRect={elementSelection.hoveredRect}
        hoveredInfo={elementSelection.hoveredInfo}
        selectedElements={elementSelection.selectedElements}
      />

      {/* Cursor Chat overlay */}
      <CursorChat
        isGenerating={isGenerating}
        onSubmit={handleCursorChatSubmit}
        selectedElements={elementSelection.selectedElements}
        onRemoveElement={(idx) => elementSelection.removeElement(idx)}
        onClearElements={elementSelection.clearSelection}
      />

      {/* Clear canvas confirmation dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear everything?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all components and variations from the canvas and permanently delete all generated variation files. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClearAllNodes}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Clear canvas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete iteration with children - cascade / reparent dialog */}
      <AlertDialog open={!!deleteDialogNode} onOpenChange={(open) => { if (!open) setDeleteDialogNode(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete variation with children?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteDialogNode?.data.filename as string}</strong> has child variations. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteWithMode('reparent')}
              className="bg-blue-600 hover:bg-blue-700 focus:ring-blue-600"
            >
              Keep children
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => handleDeleteWithMode('cascade')}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}
