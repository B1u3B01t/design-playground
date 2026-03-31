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
import { getProviderFields } from './lib/generation-body';

import ComponentNode from './nodes/ComponentNode';
import IterationNode from './nodes/IterationNode';
import SkeletonIterationNode from './nodes/SkeletonIterationNode';
import DragGhostNode from './nodes/DragGhostNode';
import ImageNode from './nodes/ImageNode';
import {
  generateIterationPrompt,
  generateIterationFromIterationPrompt,
  generateElementIterationPrompt,
  generateElementIterationFromIterationPrompt,
  resolveRegistryItem,
} from './registry';
import {
  formatReferenceNodesSection,
  formatSkillSection,
  formatCustomInstructionsSection,
  getStylingConstraint,
} from './prompts/shared-sections';
import { freeformReferencePrompt } from './prompts/freeform-reference.prompt';
import { editPrompt } from './prompts/edit.prompt';
import { generateHtmlIterationPrompt, generateHtmlIterationFromIterationPrompt } from './lib/html-prompts';
import { captureAndSaveScreenshot, getScreenshotFilename } from './lib/captureAndSaveScreenshot';
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
  MINIMAP_IMAGE_COLOR,
  MINIMAP_MASK_COLOR,
  BACKGROUND_COLOR,
  DND_DATA_KEY,
  HTML_ID_PREFIX,
  JSX_ID_PREFIX,
  JSX_COMPONENT_ADDED_EVENT,
  EDIT_COMPLETE_EVENT,
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  ITERATION_COLLAPSE_TOGGLE_EVENT,
  PLAYGROUND_CLEAR_EVENT,
  PAN_TO_POSITION_EVENT,
  FIT_COMPONENT_NODES_EVENT,
  DRAG_GHOST_GAP,
  DEFAULT_EMPTY_ITERATION_INSTRUCTIONS,
  DEFAULT_STYLING_MODE,
  CURSOR_CHAT_DEFAULT_COUNT,
  CURSOR_CHAT_DEFAULT_DEPTH,
  CURSOR_CHAT_OPEN_EVENT,
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
import { useNodeSelection } from './hooks/useNodeSelection';
import { useDynamicBackground } from './hooks/useDynamicBackground';
import { toast } from 'sonner';
import { wrapHtmlFragment } from './lib/html-utils';
import { looksLikeJsx, wrapJsxComponent } from './lib/jsx-utils';

const nodeTypes = {
  component: ComponentNode,
  iteration: IterationNode,
  skeleton: SkeletonIterationNode,
  'drag-ghost': DragGhostNode,
  image: ImageNode,
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
  /** Persisted generation info for resuming after page reload */
  generationInfo?: GenerationInfo | null;
  /** Persisted viewport (pan/zoom) */
  viewport?: { x: number; y: number; zoom: number };
}

function loadCanvasState(): CanvasState | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
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
      return state;
    }
  } catch (e) {
    console.error('Failed to load canvas state:', e);
  }
  return null;
}

function saveCanvasState(
  nodes: Node[],
  edges: Edge[],
  counter: number,
  knownIterations: string[],
  collapsedNodeIds: string[],
  generationInfo?: GenerationInfo | null,
  viewport?: { x: number; y: number; zoom: number },
) {
  if (typeof window === 'undefined') return;
  try {
    const state: CanvasState = {
      nodes, edges, nodeIdCounter: counter, knownIterations, collapsedNodeIds,
      // Only persist generationInfo when skeletons are present
      generationInfo: nodes.some(n => n.type === 'skeleton') ? generationInfo : null,
      viewport,
    };
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
  /** Render mode for this generation */
  renderMode?: 'react' | 'html';
  /** HTML page folder (when renderMode is 'html') */
  htmlFolder?: string;
}

export default function PlaygroundCanvas() {
  const dynamicBg = useDynamicBackground();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const initialState = loadCanvasState();
  const [knownIterations, setKnownIterations] = useState<string[]>(initialState?.knownIterations || []);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(
    new Set(initialState?.collapsedNodeIds || []),
  );
  const collapsedNodeIdsRef = useRef<Set<string>>(new Set(initialState?.collapsedNodeIds || []));
  const [isScanning, setIsScanning] = useState(false);
  const scanLockRef = useRef(false);
  const scanQueuedRef = useRef(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const generationEventSourceRef = useRef<EventSource | null>(null);
  
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
  
  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [createHtmlDialog, setCreateHtmlDialog] = useState<{ screenX: number; screenY: number } | null>(null);
  const [newHtmlPageName, setNewHtmlPageName] = useState('');
  const [createHtmlError, setCreateHtmlError] = useState('');
  const newHtmlInputRef = useRef<HTMLInputElement>(null);

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
  const { screenToFlowPosition, fitView, setCenter, getViewport } = useReactFlow();

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
    saveCanvasState(nodes, edges, nodeIdCounterRef.current, knownIterations, Array.from(collapsedNodeIds), generationInfoRef.current, getViewport());
  }, [nodes, edges, knownIterations, collapsedNodeIds, getViewport]);

  // Save viewport on page unload (captures pan/zoom changes that don't trigger node updates)
  useEffect(() => {
    const handler = () => {
      saveCanvasState(nodesRef.current, edges, nodeIdCounterRef.current, knownIterationsRef.current, Array.from(collapsedNodeIdsRef.current), generationInfoRef.current, getViewport());
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [edges, getViewport]);

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
  const calculateIterationPosition = useCallback((parentNode: Node, iterationNumber: number, _totalIterations: number): { x: number; y: number } => {
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

    // Use actual parent width + gap so large nodes don't overlap
    const stepW = parentW + ARRANGE_HORIZONTAL_GAP;

    return {
      x: startX + (iterationNumber - 1) * stepW,
      y: parentY,
    };
  }, []);

  // Handle iteration deletion callback
  const handleIterationDelete = useCallback((filename: string) => {
    setKnownIterations(prev => prev.filter(f => f !== filename));
  }, []);

  // Handle iteration adoption — IterationNode now owns the full adoption flow
  // (agent execution, toasts, presence bubbles). This callback is kept for
  // any canvas-level bookkeeping needed after a successful adoption.
  const handleIterationAdopt = useCallback((_filename: string, _componentName: string) => {
    // No-op: IterationNode handles everything via events + API calls
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
  // During active generation, progressively replaces skeleton nodes with real iteration nodes.
  const scanForIterations = useCallback(async (resetTimeoutOnFind = false) => {
    if (scanLockRef.current) {
      scanQueuedRef.current = true;
      return;
    }
    scanLockRef.current = true;
    setIsScanning(true);
    try {
      // ------------------------------------------------------------------
      // HTML iteration scanning (when active generation is for HTML)
      // ------------------------------------------------------------------
      const info = generationInfoRef.current;
      if (info?.renderMode === 'html' && info.htmlFolder) {
        const htmlFolder = info.htmlFolder;
        try {
          const htmlResponse = await fetch('/playground/api/html-pages');
          if (htmlResponse.ok) {
            const { pages } = await htmlResponse.json() as { pages: { folder: string; iterations: { folder: string; number: number }[] }[] };
            const page = pages.find((p: { folder: string }) => p.folder === htmlFolder);
            if (page) {
              const currentNodes = nodesRef.current;
              const currentKnownIterations = knownIterationsRef.current;
              const existingHtmlKeys = new Set([
                ...currentKnownIterations,
                ...currentNodes
                  .filter(n => n.type === 'iteration' && n.data.renderMode === 'html')
                  .map(n => `${n.data.htmlFolder}/${n.data.htmlIterationFolder}` as string),
              ]);

              const newHtmlIterations = page.iterations.filter(
                (iter: { folder: string; number: number }) => !existingHtmlKeys.has(`${htmlFolder}/${iter.folder}`)
              );

              if (newHtmlIterations.length > 0) {
                const remainingSkeletonIds = info
                  ? info.skeletonNodeIds.filter(id => currentNodes.some(n => n.id === id))
                  : [];
                const skeletonsToRemove: string[] = [];
                const newNodes: Node[] = [];
                const newEdges: Edge[] = [];
                const newKnownFilenames: string[] = [];

                newHtmlIterations.sort((a: { number: number }, b: { number: number }) => a.number - b.number);

                for (const iter of newHtmlIterations) {
                  const sourceNodeId = info.parentNodeId
                    ? (currentNodes.find(n => n.id === info.parentNodeId)?.id || undefined)
                    : undefined;
                  const sourceNode = sourceNodeId
                    ? (currentNodes.find(n => n.id === sourceNodeId) || newNodes.find(n => n.id === sourceNodeId))
                    : undefined;

                  let position: { x: number; y: number };
                  if (remainingSkeletonIds.length > 0) {
                    const skeletonId = remainingSkeletonIds.shift()!;
                    const skeletonNode = currentNodes.find(n => n.id === skeletonId);
                    if (skeletonNode) {
                      position = { ...skeletonNode.position };
                      skeletonsToRemove.push(skeletonId);
                    } else if (sourceNode) {
                      const srcW = sourceNode.measured?.width ?? DEFAULT_COMPONENT_NODE_WIDTH;
                      position = { x: sourceNode.position.x + srcW + ARRANGE_HORIZONTAL_GAP, y: sourceNode.position.y };
                    } else {
                      position = { x: 400, y: 200 };
                    }
                  } else if (sourceNode) {
                    const srcW = sourceNode.measured?.width ?? DEFAULT_COMPONENT_NODE_WIDTH;
                    position = { x: sourceNode.position.x + srcW + ARRANGE_HORIZONTAL_GAP, y: sourceNode.position.y };
                  } else {
                    position = { x: 400, y: 200 };
                  }

                  const nodeId = getNodeId();
                  const parentSize = (sourceNode?.data?.size as string | undefined) as import('./lib/constants').ComponentSize | undefined;

                  newNodes.push({
                    id: nodeId,
                    type: 'iteration',
                    position,
                    data: {
                      componentName: htmlFolder,
                      iterationNumber: iter.number,
                      filename: `${htmlFolder}/iteration-${iter.number}`,
                      description: '',
                      parentNodeId: sourceNodeId || undefined,
                      parentSize,
                      renderMode: 'html',
                      htmlFolder,
                      htmlIterationFolder: iter.folder,
                      onDelete: handleIterationDelete,
                      onAdopt: handleIterationAdopt,
                    },
                  });

                  if (sourceNodeId) {
                    newEdges.push({
                      id: `edge_${sourceNodeId}_${nodeId}`,
                      source: sourceNodeId,
                      target: nodeId,
                      type: 'smoothstep',
                      animated: false,
                      style: ITERATION_EDGE_STYLE,
                    });
                  }

                  newKnownFilenames.push(`${htmlFolder}/${iter.folder}`);
                }

                if (newNodes.length > 0) {
                  const skeletonSet = new Set(skeletonsToRemove);
                  setNodes(nds => [
                    ...nds.filter(n => !skeletonSet.has(n.id)),
                    ...newNodes,
                  ]);
                  setEdges(eds => [
                    ...eds.filter(e => !skeletonSet.has(e.target)),
                    ...newEdges,
                  ]);
                  knownIterationsRef.current = [...knownIterationsRef.current, ...newKnownFilenames];
                  setKnownIterations(prev => [...prev, ...newKnownFilenames]);
                  if (resetTimeoutOnFind) resetPollTimeout();
                }
              }
            }
          }
        } catch (error) {
          console.error('Error scanning HTML iterations:', error);
        }
        // For HTML generations, skip the React iteration scan
        return;
      }

      // ------------------------------------------------------------------
      // React iteration scanning
      // ------------------------------------------------------------------
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

      // Progressive skeleton replacement: during active generation, find
      // remaining skeleton nodes so we can position real nodes at their
      // locations and remove them one-by-one.
      const reactInfo = generationInfoRef.current;
      const remainingSkeletonIds = reactInfo
        ? reactInfo.skeletonNodeIds.filter(id => currentNodes.some(n => n.id === id))
        : [];
      // Track which skeletons to remove during this scan
      const skeletonsToRemove: string[] = [];

      // Create nodes and edges for new iterations (tree-aware)
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];
      const newKnownFilenames: string[] = [];

      // We may need to look up newly added nodes too (for chaining within one scan)
      const pendingNodesByFilename = new Map<string, string>(); // filename -> nodeId

      // Sort new iterations by number so they map to skeleton positions in order
      newIterations.sort((a, b) => a.iterationNumber - b.iterationNumber);

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

        // Position: during active generation, use the next skeleton's position;
        // otherwise fall back to source node offset or default.
        const sourceNode = sourceNodeId
          ? (nodesRef.current.find(n => n.id === sourceNodeId) || newNodes.find(n => n.id === sourceNodeId))
          : undefined;

        let position: { x: number; y: number };

        if (remainingSkeletonIds.length > 0) {
          // Progressive reveal: take the next skeleton's position
          const skeletonId = remainingSkeletonIds.shift()!;
          const skeletonNode = currentNodes.find(n => n.id === skeletonId);
          if (skeletonNode) {
            position = { ...skeletonNode.position };
            skeletonsToRemove.push(skeletonId);
          } else {
            // Skeleton already gone — fall back using actual source width
            if (sourceNode) {
              const srcW = sourceNode.measured?.width ?? (sourceNode.type === 'component' ? DEFAULT_COMPONENT_NODE_WIDTH : DEFAULT_ITERATION_NODE_WIDTH);
              position = { x: sourceNode.position.x + srcW + ARRANGE_HORIZONTAL_GAP, y: sourceNode.position.y };
            } else {
              position = { x: 400, y: 200 };
            }
          }
        } else if (sourceNode) {
          const srcW = sourceNode.measured?.width ?? (sourceNode.type === 'component' ? DEFAULT_COMPONENT_NODE_WIDTH : DEFAULT_ITERATION_NODE_WIDTH);
          position = { x: sourceNode.position.x + srcW + ARRANGE_HORIZONTAL_GAP, y: sourceNode.position.y };
        } else {
          // Orphan iteration (e.g. freeform generation) — use skeleton position if available
          const skeletonPos = reactInfo?.skeletonPositions?.[0];
          position = skeletonPos ?? { x: 400, y: 200 };
        }

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
            parentNodeId: sourceNodeId || undefined,
            parentSize,
            registryId: inheritedRegistryId,
            onDelete: handleIterationDelete,
            onAdopt: handleIterationAdopt,
          },
        });

        // Only create edges when there's a valid source node
        if (sourceNodeId) {
          newEdges.push({
            id: `edge_${sourceNodeId}_${nodeId}`,
            source: sourceNodeId,
            target: nodeId,
            type: 'smoothstep',
            animated: false,
            style: ITERATION_EDGE_STYLE,
          });
        }

        newKnownFilenames.push(iter.filename);
      }

      if (newNodes.length > 0) {
        const skeletonSet = new Set(skeletonsToRemove);
        // Add new real nodes and remove replaced skeletons in a single update
        setNodes(nds => [
          ...nds.filter(n => !skeletonSet.has(n.id)),
          ...newNodes,
        ]);
        setEdges(eds => [
          ...eds.filter(e => !skeletonSet.has(e.target)),
          ...newEdges,
        ]);
        knownIterationsRef.current = [...knownIterationsRef.current, ...newKnownFilenames];
        setKnownIterations(prev => [...prev, ...newKnownFilenames]);

        if (resetTimeoutOnFind) {
          resetPollTimeout();
        }
      }
    } catch (error) {
      console.error('Error scanning iterations:', error);
    } finally {
      scanLockRef.current = false;
      setIsScanning(false);
      if (scanQueuedRef.current) {
        scanQueuedRef.current = false;
        scanForIterations(resetTimeoutOnFind);
      }
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

  // SSE helpers for progressive iteration detection during generation.
  // The server watches tree.json via fs.watch and pushes events when it changes.
  const startGenerationEventSource = useCallback(() => {
    stopGenerationEventSource();
    const es = new EventSource('/playground/api/generate?action=events');
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'iteration-added') {
          scanForIterations(false);
        } else if (data.type === 'done') {
          es.close();
        }
      } catch { /* ignore parse errors */ }
    };
    es.onerror = () => {
      // Connection lost — server will close when generation ends.
      // The final scan in handleGenerationComplete catches anything missed.
      es.close();
    };
    generationEventSourceRef.current = es;
  }, [scanForIterations]);

  const stopGenerationEventSource = useCallback(() => {
    if (generationEventSourceRef.current) {
      generationEventSourceRef.current.close();
      generationEventSourceRef.current = null;
    }
  }, []);

  // Resume generation after page reload — restore persisted generationInfo,
  // keep skeleton nodes on canvas, and reconnect SSE.
  useEffect(() => {
    const persisted = initialState?.generationInfo;
    if (!persisted) return;

    // Verify skeletons actually exist in the loaded nodes
    const currentSkeletons = nodesRef.current.filter(
      n => n.type === 'skeleton' && persisted.skeletonNodeIds.includes(n.id),
    );
    if (currentSkeletons.length === 0) return;

    // Restore generation state
    generationInfoRef.current = persisted;
    setIsGenerating(true);
    setGenerationInfo(persisted);

    // Reconnect SSE and kick off an immediate scan to pick up any
    // iterations that landed while the page was reloading
    startGenerationEventSource();
    scanForIterations(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          // Shift all candidate rects to the right
          for (const rect of rects) {
            rect.x += SHIFT_STEP;
          }
          attempts++;
        }
      }

      return rects;
    };

    const handleGenerationStart = (e: CustomEvent<GenerationStartPayload>) => {
      const { componentId, componentName, parentNodeId, iterationCount, gridLayout, renderMode: genRenderMode, htmlFolder: genHtmlFolder, editMode: isEditMode } = e.detail;

      // Edit mode: presence bubble is handled via the event, but no skeletons
      if (isEditMode) {
        setIsGenerating(true);
        isGeneratingRef.current = true;
        generationInfoRef.current = { componentId, componentName, parentNodeId: '', iterationCount: 0, skeletonNodeIds: [], startTime: Date.now(), renderMode: genRenderMode, htmlFolder: genHtmlFolder };
        setGenerationInfo(generationInfoRef.current);
        return;
      }

      // Freeform generations have no parent — create a standalone skeleton
      if (!parentNodeId) {
        const flowPos = e.detail.flowPosition ?? { x: 400, y: 200 };
        const skeletonId = getNodeId();
        const skeletonNode: Node = {
          id: skeletonId,
          type: 'skeleton',
          position: flowPos,
          data: {
            iterationNumber: 1,
            componentName,
            parentNodeId: '',
            totalIterations: 1,
            width: DEFAULT_COMPONENT_NODE_WIDTH,
            height: DEFAULT_COMPONENT_NODE_HEIGHT,
          },
        };

        setNodes(nds => [...nds, skeletonNode]);

        const newInfo: GenerationInfo = {
          componentId,
          componentName,
          parentNodeId: '',
          iterationCount: 1,
          skeletonNodeIds: [skeletonId],
          startTime: Date.now(),
          skeletonPositions: [{ x: flowPos.x, y: flowPos.y }],
          renderMode: genRenderMode,
          htmlFolder: genHtmlFolder,
        };
        generationInfoRef.current = newInfo;
        setIsGenerating(true);
        setGenerationInfo(newInfo);


        // Subscribe to server-sent events for progressive iteration detection
        startGenerationEventSource();
        return;
      }

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
          // Grid layout from drag-to-iterate: anchor grid to the right of parent
          const { cols } = gridLayout;
          const gap = DRAG_GHOST_GAP;
          const parentW = parentNode.measured?.width
            ?? (parentNode.type === 'component' ? DEFAULT_COMPONENT_NODE_WIDTH : DEFAULT_ITERATION_NODE_WIDTH);

          const gridOriginX = parentNode.position.x + parentW + ARRANGE_HORIZONTAL_GAP;
          const gridOriginY = parentNode.position.y;

          // Fill grid left-to-right, top-to-bottom
          const col = (i - 1) % cols;
          const row = Math.floor((i - 1) / cols);

          x = gridOriginX + col * (cellW + gap);
          y = gridOriginY + row * (cellH + gap);
        } else {
          // Dialog flow: place iterations to the right of the parent
          const pos = calculateIterationPosition(parentNode, i, iterationCount);
          x = pos.x;
          y = pos.y;
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
        renderMode: genRenderMode,
        htmlFolder: genHtmlFolder,
      };
      generationInfoRef.current = newInfo;
      setIsGenerating(true);
      setLastGenerationDuration(null);
      setGenerationInfo(newInfo);

      // Subscribe to server-sent events for progressive iteration detection
      startGenerationEventSource();
    };

    const handleGenerationComplete = (): void => {
      // Close the SSE connection for progressive iteration detection
      stopGenerationEventSource();

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
      // Close the SSE connection for progressive iteration detection
      stopGenerationEventSource();

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
      stopGenerationEventSource();
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
        renderMode: dragRenderMode,
        htmlFolder: dragHtmlFolder,
      } = e.detail;
      const isDragHtml = dragRenderMode === 'html' && !!dragHtmlFolder;

      // Build the prompt
      let prompt: string;
      const defaultSkillPrompt = await loadDefaultSkillPrompt();

      // Fetch next available iteration number
      let startNumber = 1;
      try {
        if (isDragHtml) {
          const response = await fetch('/playground/api/html-pages');
          if (response.ok) {
            const { pages } = await response.json();
            const page = pages.find((p: { folder: string }) => p.folder === dragHtmlFolder);
            const maxNumber = page?.iterations.reduce(
              (max: number, i: { number: number }) => Math.max(max, i.number), 0
            ) ?? 0;
            startNumber = maxNumber + 1;
          }
        } else {
          const cleanName = componentName.replace(/\s+/g, '');
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
        }
      } catch { /* use default */ }

      // Capture screenshot of the source node
      const screenshotFilename = getScreenshotFilename(componentName, sourceFilename);
      const screenshotPath = await captureAndSaveScreenshot(parentNodeId, screenshotFilename);

      if (isDragHtml) {
        // HTML mode prompt
        if (sourceFilename && sourceFilename.includes('iteration-')) {
          const iterFolder = sourceFilename.split('/').pop() || sourceFilename;
          prompt = generateHtmlIterationFromIterationPrompt(
            dragHtmlFolder,
            iterFolder,
            iterationCount,
            startNumber,
            DEFAULT_EMPTY_ITERATION_INSTRUCTIONS,
            defaultSkillPrompt || undefined,
            screenshotPath ?? undefined,
          );
        } else {
          prompt = generateHtmlIterationPrompt(
            dragHtmlFolder,
            iterationCount,
            startNumber,
            DEFAULT_EMPTY_ITERATION_INSTRUCTIONS,
            defaultSkillPrompt || undefined,
            screenshotPath ?? undefined,
          );
        }
      } else if (sourceFilename) {
        try {
          prompt = generateIterationFromIterationPrompt(
            componentId,
            sourceFilename,
            iterationCount,
            startNumber,
            'shell',
            DEFAULT_EMPTY_ITERATION_INSTRUCTIONS,
            defaultSkillPrompt || undefined,
            undefined,
            // screenshotPath ?? undefined,
          );
        } catch {
          prompt = generateIterationPrompt(
            componentId,
            iterationCount,
            startNumber,
            'shell',
            DEFAULT_EMPTY_ITERATION_INSTRUCTIONS,
            defaultSkillPrompt || undefined,
            undefined,
            // screenshotPath ?? undefined,
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
          undefined,
          // screenshotPath ?? undefined,
        );
      }

      // Guard: prompt must be non-empty before we proceed
      if (!prompt) {
        window.dispatchEvent(
          new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
            detail: {
              componentId,
              parentNodeId,
              error: isDragHtml
                ? `HTML page "${dragHtmlFolder}" not found.`
                : `Component "${componentId}" is not registered. Add it to the registry or re-run discovery before iterating.`,
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
            ...(isDragHtml ? { renderMode: 'html' as const, htmlFolder: dragHtmlFolder } : {}),
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
            ...getProviderFields(),
            ...(isDragHtml ? { htmlFolder: dragHtmlFolder } : {}),
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
  const nodeSelection = useNodeSelection();
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
      return;
    }

    // ── Edit Mode: modify file in-place, no iterations ──
    if (payload.editMode && payload.targetNodeId) {
      const isHtmlEdit = payload.renderMode === 'html';
      const editComponentId = payload.targetComponentId || 'edit-mode';
      const editComponentName = payload.targetComponentName || editComponentId;
      let filePath: string;

      if (isHtmlEdit) {
        if (payload.htmlIterationFolder) {
          filePath = `public/${payload.htmlPageSlug}/${payload.htmlIterationFolder}/index.html`;
        } else {
          filePath = `public/${payload.htmlPageSlug}/index.html`;
        }
      } else if (payload.targetType === 'iteration' && payload.sourceFilename) {
        filePath = `src/app/playground/iterations/${payload.sourceFilename}`;
      } else {
        const item = resolveRegistryItem(editComponentId);
        filePath = item?.sourcePath || `src/app/playground/iterations/${editComponentId}`;
      }

      // Gather skill prompts (same logic as normal path)
      let editSkillPrompt: string | undefined;
      if (payload.skillPrompts.length > 0) {
        editSkillPrompt = payload.skillPrompts.join('\n\n');
      } else if (!payload.text) {
        const defaultPrompt = await loadDefaultSkillPrompt();
        editSkillPrompt = defaultPrompt || undefined;
      }

      // Capture screenshot of the target node
      const editScreenshotFilename = getScreenshotFilename(editComponentName, payload.sourceFilename);
      const editScreenshotPath = await captureAndSaveScreenshot(payload.targetNodeId, editScreenshotFilename);

      // Build reference nodes section
      let editRefSection = '';
      if (payload.referenceNodes && payload.referenceNodes.length > 0) {
        const refNodes = payload.referenceNodes.filter((n) => n.nodeId !== payload.targetNodeId);
        if (refNodes.length > 0) {
          const refNodesWithScreenshots = await Promise.all(
            refNodes.map(async (node) => {
              if (node.type === 'image') {
                return { ...node, screenshotPath: node.imagePath, sourcePath: undefined };
              }
              const ssFilename = getScreenshotFilename(node.componentName, node.sourceFilename);
              const ssPath = await captureAndSaveScreenshot(node.nodeId, ssFilename);
              let sourcePath: string | undefined;
              if (node.type === 'component') {
                const regItem = resolveRegistryItem(node.componentId);
                sourcePath = regItem?.sourcePath;
              }
              return { ...node, screenshotPath: ssPath ?? undefined, sourcePath };
            }),
          );
          editRefSection = formatReferenceNodesSection(refNodesWithScreenshots);
        }
      }

      const prompt = editPrompt({
        filePath,
        customInstructions: payload.text || 'Improve the design',
        skillPrompt: editSkillPrompt,
        screenshotPath: editScreenshotPath ?? undefined,
        referenceNodesSection: editRefSection || undefined,
        elementSelections: payload.elementSelections,
      });

      // Dispatch GENERATION_START_EVENT so the presence bubble appears
      window.dispatchEvent(
        new CustomEvent<GenerationStartPayload>(GENERATION_START_EVENT, {
          detail: {
            componentId: editComponentId,
            componentName: editComponentName,
            parentNodeId: payload.targetNodeId,
            iterationCount: 0,
            model: payload.model || undefined,
            flowPosition: payload.canvasPosition,
            editMode: true,
            ...(isHtmlEdit ? { renderMode: 'html' as const, htmlFolder: payload.htmlPageSlug } : {}),
          },
        }),
      );

      try {
        const response = await fetch('/playground/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            componentId: editComponentId,
            model: payload.model || undefined,
            ...getProviderFields(),
            ...(isHtmlEdit ? { htmlFolder: payload.htmlPageSlug } : {}),
          }),
        });
        const data = await response.json().catch(() => ({ success: false }));
        if (!response.ok || !data.success) {
          console.error('[EditMode] Generation failed:', data?.error, 'status:', response.status, 'data:', data);
          toast.error(data?.error || `Edit failed (${response.status})`, { duration: 6000 });
          window.dispatchEvent(
            new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
              detail: { componentId: editComponentId, parentNodeId: payload.targetNodeId, error: data?.error || 'Edit failed' },
            }),
          );
        } else {
          if (isHtmlEdit) {
            // Dispatch edit complete to refresh iframes
            window.dispatchEvent(new CustomEvent(EDIT_COMPLETE_EVENT, {
              detail: { nodeId: payload.targetNodeId },
            }));
          }
          window.dispatchEvent(
            new CustomEvent<GenerationCompletePayload>(GENERATION_COMPLETE_EVENT, {
              detail: { componentId: editComponentId, parentNodeId: payload.targetNodeId, output: '' },
            }),
          );
        }
      } catch (err) {
        console.error('[EditMode] Error:', err);
        toast.error(err instanceof Error ? err.message : 'Unknown error', { duration: 6000 });
        window.dispatchEvent(
          new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
            detail: { componentId: editComponentId, parentNodeId: payload.targetNodeId, error: String(err) },
          }),
        );
      }
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
    } else if (!text) {
      // Use default skills only when no explicit skills selected and text is empty
      const defaultPrompt = await loadDefaultSkillPrompt();
      combinedSkillPrompt = defaultPrompt || undefined;
    }

    const customInstructions = text || DEFAULT_EMPTY_ITERATION_INSTRUCTIONS;
    const hasElementSelections = (payload.elementSelections?.length ?? 0) > 0;
    const stylingMode: StylingMode = payload.skillIds?.includes('no-bound-explore')
      ? 'inline-css' : DEFAULT_STYLING_MODE;

    // Build reference nodes section from shift-drag selection
    let referenceNodesSection = '';
    if (payload.referenceNodes && payload.referenceNodes.length > 0) {
      // Filter out the target node from references (no need to reference itself)
      const refNodes = payload.referenceNodes.filter((n) => n.nodeId !== targetNodeId);

      if (refNodes.length > 0) {
        // Capture screenshots for each reference node
        const refNodesWithScreenshots = await Promise.all(
          refNodes.map(async (node) => {
            // Image nodes already have the image — no need to capture a screenshot
            if (node.type === 'image') {
              return {
                ...node,
                screenshotPath: node.imagePath,
                sourcePath: undefined,
              };
            }
            const screenshotFilename = getScreenshotFilename(
              node.componentName,
              node.sourceFilename,
            );
            const screenshotPath = await captureAndSaveScreenshot(
              node.nodeId,
              screenshotFilename,
            );
            // Resolve source path from registry for component nodes
            let sourcePath: string | undefined;
            if (node.type === 'component') {
              const item = resolveRegistryItem(node.componentId);
              sourcePath = item?.sourcePath;
            }
            return {
              ...node,
              screenshotPath: screenshotPath ?? undefined,
              sourcePath,
            };
          }),
        );
        referenceNodesSection = formatReferenceNodesSection(refNodesWithScreenshots);
      }
    }

    const isHtmlTarget = payload.renderMode === 'html' && !!payload.htmlPageSlug;

    if (targetNodeId && targetComponentId && targetComponentName && targetType) {
      // --- WITH TARGET NODE ---
      let prompt: string;
      const componentId = targetComponentId;
      const componentName = targetComponentName;
      const iterationCount = payload.iterationCount ?? CURSOR_CHAT_DEFAULT_COUNT;

      // Fetch next available iteration number
      let startNumber = 1;
      try {
        if (isHtmlTarget) {
          const response = await fetch('/playground/api/html-pages');
          if (response.ok) {
            const { pages } = await response.json();
            const page = pages.find((p: { folder: string }) => p.folder === payload.htmlPageSlug);
            const maxNumber = page?.iterations.reduce(
              (max: number, i: { number: number }) => Math.max(max, i.number), 0
            ) ?? 0;
            startNumber = maxNumber + 1;
          }
        } else {
          const cleanName = componentName.replace(/\s+/g, '');
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
        }
      } catch { /* use default */ }

      // Capture screenshot of the target node
      const screenshotFilename = getScreenshotFilename(componentName, sourceFilename);
      const screenshotPath = await captureAndSaveScreenshot(targetNodeId, screenshotFilename);

      if (isHtmlTarget && payload.htmlPageSlug) {
        // HTML iteration
        if (targetType === 'iteration' && payload.htmlIterationFolder) {
          prompt = generateHtmlIterationFromIterationPrompt(
            payload.htmlPageSlug,
            payload.htmlIterationFolder,
            iterationCount,
            startNumber,
            customInstructions,
            combinedSkillPrompt,
            screenshotPath ?? undefined,
          );
        } else {
          prompt = generateHtmlIterationPrompt(
            payload.htmlPageSlug,
            iterationCount,
            startNumber,
            customInstructions,
            combinedSkillPrompt,
            screenshotPath ?? undefined,
          );
        }
      } else if (targetType === 'iteration' && sourceFilename) {
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
            screenshotPath ?? undefined,
            referenceNodesSection,
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
            screenshotPath ?? undefined,
            referenceNodesSection,
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
            screenshotPath ?? undefined,
            referenceNodesSection,
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
            screenshotPath ?? undefined,
            referenceNodesSection,
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
            ...(isHtmlTarget ? { renderMode: 'html' as const, htmlFolder: payload.htmlPageSlug } : {}),
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
            ...getProviderFields(),
            ...(isHtmlTarget ? { htmlFolder: payload.htmlPageSlug } : {}),
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
      const freeformComponentId = 'cursor-chat-freeform';

      // Dispatch start event — creates skeleton node + presence bubble
      window.dispatchEvent(
        new CustomEvent<GenerationStartPayload>(GENERATION_START_EVENT, {
          detail: {
            componentId: freeformComponentId,
            componentName: 'Freeform',
            parentNodeId: '',
            iterationCount: 0,
            model: payloadModel || 'auto',
            flowPosition: payload.canvasPosition ?? undefined,
          },
        }),
      );

      // Build prompt — use freeform-reference template if reference nodes exist
      let freeformPrompt: string;
      if (referenceNodesSection) {
        freeformPrompt = freeformReferencePrompt({
          skillSection: combinedSkillPrompt ? formatSkillSection(combinedSkillPrompt) : '',
          referenceNodesSection,
          customInstructionsSection: formatCustomInstructionsSection(customInstructions),
          stylingConstraint: getStylingConstraint(stylingMode),
        });
      } else {
        freeformPrompt = customInstructions;
      }

      try {
        const response = await fetch('/playground/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: freeformPrompt,
            componentId: 'cursor-chat-freeform',
            iterationCount: 0,
            model: payloadModel || undefined,
            ...getProviderFields(),
          }),
        });

        const data = await response.json().catch(() => ({ success: false }));
        if (!response.ok || !data.success) {
          console.error('[CursorChat] Freeform generation failed:', data?.error);
          window.dispatchEvent(
            new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
              detail: { componentId: freeformComponentId, parentNodeId: '', error: data?.error || 'Generation failed' },
            }),
          );
        } else {
          window.dispatchEvent(
            new CustomEvent<GenerationCompletePayload>(GENERATION_COMPLETE_EVENT, {
              detail: { componentId: freeformComponentId, parentNodeId: '', output: '' },
            }),
          );
        }
      } catch (err) {
        console.error('[CursorChat] Freeform generation error:', err);
        const msg = err instanceof Error ? err.message : 'Unknown error';
        window.dispatchEvent(
          new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
            detail: { componentId: freeformComponentId, parentNodeId: '', error: msg },
          }),
        );
      } finally {
        // State cleanup and queue draining handled by GENERATION_COMPLETE/ERROR event handlers
        // Only clear state here as a safety net if events didn't fire (e.g. network error before dispatch)
        if (generationInfoRef.current?.componentId === freeformComponentId) {
          generationInfoRef.current = null;
          setIsGenerating(false);
          setGenerationInfo(null);
        }
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

  // Fit viewport around all nodes for a given component (presence bubble click)
  useEffect(() => {
    const handler = (e: Event) => {
      const { componentId } = (e as CustomEvent<{ componentId: string }>).detail;
      if (!componentId) return;

      // Find the parent component node and all its iteration/skeleton children
      const parentNode = nodesRef.current.find(
        n => n.type === 'component' && (n.data.componentId as string)?.includes(componentId),
      );
      const childNodes = nodesRef.current.filter(
        n => (n.type === 'iteration' || n.type === 'skeleton') &&
          parentNode && n.data.parentNodeId === parentNode.id,
      );

      const nodeIds = [
        ...(parentNode ? [parentNode.id] : []),
        ...childNodes.map(n => n.id),
      ];

      if (nodeIds.length > 0) {
        fitView({ nodes: nodeIds.map(id => ({ id })), duration: 400, padding: 0.15 });
      }
    };
    window.addEventListener(FIT_COMPONENT_NODES_EVENT, handler);
    return () => window.removeEventListener(FIT_COMPONENT_NODES_EVENT, handler);
  }, [fitView]);

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

      // Check for image file drops
      const files = event.dataTransfer.files;
      if (files.length > 0) {
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          imageFiles.forEach((file, idx) => {
            const reader = new FileReader();
            reader.onload = async () => {
              const base64 = reader.result as string;
              try {
                const res = await fetch('/playground/api/images', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ imageBase64: base64, originalName: file.name }),
                });
                const data = await res.json();
                if (data.success) {
                  const newNode: Node = {
                    id: getNodeId(),
                    type: 'image',
                    position: { x: position.x + idx * 320, y: position.y },
                    style: { width: 300, height: 250 },
                    data: {
                      imagePath: data.path,
                      imageUrl: data.url,
                      filename: data.filename,
                      originalName: file.name,
                    },
                  };
                  setNodes((nds) => nds.concat(newNode));
                }
              } catch (err) {
                console.error('[Playground] Image upload failed:', err);
              }
            };
            reader.readAsDataURL(file);
          });
          return;
        }
      }

      const componentId = event.dataTransfer.getData(DND_DATA_KEY);
      if (!componentId) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const isHtml = componentId.startsWith(HTML_ID_PREFIX);
      const newNode: Node = {
        id: getNodeId(),
        type: 'component',
        position,
        data: {
          componentId,
          ...(isHtml ? {
            renderMode: 'html' as const,
            htmlFolder: componentId.slice(HTML_ID_PREFIX.length),
          } : {}),
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, getNodeId]
  );

  const handlePaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Right-click context menu on canvas pane
  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  // Close context menu on any click outside
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  // Paste images or HTML from clipboard onto the canvas
  useEffect(() => {
    const wrapper = reactFlowWrapper.current;
    if (!wrapper) return;

    const handlePaste = async (e: ClipboardEvent) => {
      // Don't intercept pastes into text inputs
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          (active as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      // --- Image paste (takes priority) ---
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (!file) continue;
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = reader.result as string;
            try {
              const res = await fetch('/playground/api/images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageBase64: base64,
                  originalName: file.name || `pasted-image.${file.type.split('/')[1] || 'png'}`,
                }),
              });
              const data = await res.json();
              if (data.success) {
                const wrapperBounds = wrapper.getBoundingClientRect();
                const position = screenToFlowPosition({
                  x: wrapperBounds.left + wrapperBounds.width / 2,
                  y: wrapperBounds.top + wrapperBounds.height / 2,
                });
                const newNode: Node = {
                  id: getNodeId(),
                  type: 'image',
                  position,
                  style: { width: 300, height: 250 },
                  data: {
                    imagePath: data.path,
                    imageUrl: data.url,
                    filename: data.filename,
                    originalName: file.name || 'Pasted Image',
                  },
                };
                setNodes((nds) => nds.concat(newNode));
              }
            } catch (err) {
              console.error('[Playground] Image paste upload failed:', err);
            }
          };
          reader.readAsDataURL(file);
          return;
        }
      }

      // --- JSX paste (checked before HTML since JSX also contains HTML tags) ---
      const rawPlain = (e.clipboardData?.getData('text/plain') || '').trim();
      if (rawPlain && looksLikeJsx(rawPlain)) {
        e.preventDefault();
        try {
          // Determine next frame number by scanning existing JSX components and HTML pages
          let frameNumber = 1;
          const [jsxRes, htmlRes] = await Promise.all([
            fetch('/playground/api/oncanvas-components').catch(() => null),
            fetch('/playground/api/html-pages').catch(() => null),
          ]);
          if (jsxRes?.ok) {
            const { components } = await jsxRes.json() as { components: { filename: string }[] };
            for (const comp of components) {
              const match = comp.filename.match(/^frame-(\d+)\.tsx$/);
              if (match) frameNumber = Math.max(frameNumber, parseInt(match[1], 10) + 1);
            }
          }
          if (htmlRes?.ok) {
            const { pages } = await htmlRes.json() as { pages: { folder: string }[] };
            for (const page of pages) {
              const match = page.folder.match(/^frame-(\d+)$/);
              if (match) frameNumber = Math.max(frameNumber, parseInt(match[1], 10) + 1);
            }
          }

          const frameName = `frame-${frameNumber}`;
          const componentName = `Frame${frameNumber}`;
          const filename = `${frameName}.tsx`;
          const wrappedJsx = wrapJsxComponent(rawPlain, componentName);

          const res = await fetch('/playground/api/oncanvas-components', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, content: wrappedJsx }),
          });
          const data = await res.json();

          if (!res.ok) {
            console.error('[Playground] JSX paste failed:', data.error);
            toast.error(data.error || 'Failed to create frame from pasted JSX');
            return;
          }

          const wrapperBounds = wrapper.getBoundingClientRect();
          const position = screenToFlowPosition({
            x: wrapperBounds.left + wrapperBounds.width / 2,
            y: wrapperBounds.top + wrapperBounds.height / 2,
          });

          const newNode: Node = {
            id: getNodeId(),
            type: 'component',
            position,
            data: {
              componentId: `${JSX_ID_PREFIX}${frameName}`,
              renderMode: 'jsx' as const,
              jsxFile: filename,
            },
          };
          setNodes((nds) => nds.concat(newNode));

          // Delay event dispatch to give the bundler (HMR) time to recompile
          // the updated barrel index after the new file is written to disk.
          // Retry a few times in case the first attempt is too early.
          const dispatchWithRetry = (attempts: number, delay: number) => {
            setTimeout(() => {
              window.dispatchEvent(new Event(JSX_COMPONENT_ADDED_EVENT));
              if (attempts > 1) {
                dispatchWithRetry(attempts - 1, delay * 2);
              }
            }, delay);
          };
          dispatchWithRetry(3, 500);
        } catch (err) {
          console.error('[Playground] JSX paste failed:', err);
          toast.error('Failed to create frame from pasted JSX');
        }
        return;
      }

      // --- HTML paste ---
      const rawHtml = (e.clipboardData?.getData('text/html') || '').trim();
      const looksLikeHtmlContent = (s: string) => /<[a-z][\s\S]*>/i.test(s);

      let pastedHtml: string | null = null;
      if (rawHtml && looksLikeHtmlContent(rawHtml)) {
        pastedHtml = rawHtml;
      } else if (rawPlain && looksLikeHtmlContent(rawPlain)) {
        pastedHtml = rawPlain;
      }
      if (!pastedHtml) return;

      e.preventDefault();

      try {
        // Determine next frame number by scanning existing HTML pages and JSX components
        let frameNumber = 1;
        const [htmlRes2, jsxRes2] = await Promise.all([
          fetch('/playground/api/html-pages').catch(() => null),
          fetch('/playground/api/oncanvas-components').catch(() => null),
        ]);
        if (htmlRes2?.ok) {
          const { pages } = await htmlRes2.json() as { pages: { folder: string }[] };
          for (const page of pages) {
            const match = page.folder.match(/^frame-(\d+)$/);
            if (match) frameNumber = Math.max(frameNumber, parseInt(match[1], 10) + 1);
          }
        }
        if (jsxRes2?.ok) {
          const { components } = await jsxRes2.json() as { components: { filename: string }[] };
          for (const comp of components) {
            const match = comp.filename.match(/^frame-(\d+)\.tsx$/);
            if (match) frameNumber = Math.max(frameNumber, parseInt(match[1], 10) + 1);
          }
        }

        const frameName = `frame-${frameNumber}`;
        const wrappedHtml = wrapHtmlFragment(pastedHtml);

        const res = await fetch('/playground/api/html-pages', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: frameName, content: wrappedHtml }),
        });
        const data = await res.json();

        if (!res.ok) {
          console.error('[Playground] HTML paste failed:', data.error);
          toast.error(data.error || 'Failed to create frame from pasted HTML');
          return;
        }

        const wrapperBounds = wrapper.getBoundingClientRect();
        const position = screenToFlowPosition({
          x: wrapperBounds.left + wrapperBounds.width / 2,
          y: wrapperBounds.top + wrapperBounds.height / 2,
        });

        const pageId = data.page.id as string;
        const folder = data.page.folder as string;

        const newNode: Node = {
          id: getNodeId(),
          type: 'component',
          position,
          data: {
            componentId: pageId,
            renderMode: 'html' as const,
            htmlFolder: folder,
          },
        };
        setNodes((nds) => nds.concat(newNode));
      } catch (err) {
        console.error('[Playground] HTML paste failed:', err);
        toast.error('Failed to create frame from pasted HTML');
      }
    };

    wrapper.addEventListener('paste', handlePaste);
    return () => wrapper.removeEventListener('paste', handlePaste);
  }, [screenToFlowPosition, getNodeId, setNodes]);

  // Create HTML page from context menu
  const handleCreateHtmlPage = useCallback(async () => {
    const name = newHtmlPageName.trim();
    if (!name) return;
    setCreateHtmlError('');
    try {
      const res = await fetch('/playground/api/html-pages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateHtmlError(data.error || 'Failed to create page');
        return;
      }

      // Place the new node where the user right-clicked
      const position = screenToFlowPosition({
        x: createHtmlDialog!.screenX,
        y: createHtmlDialog!.screenY,
      });
      const pageId = data.page.id as string;
      const folder = data.page.folder as string;
      const newNode: Node = {
        id: getNodeId(),
        type: 'component',
        position,
        data: {
          componentId: pageId,
          renderMode: 'html' as const,
          htmlFolder: folder,
        },
      };
      const screenX = createHtmlDialog!.screenX;
      const screenY = createHtmlDialog!.screenY;
      setNodes((nds) => nds.concat(newNode));
      setCreateHtmlDialog(null);
      setNewHtmlPageName('');

      // Auto-open cursor chat in edit mode on the new node
      requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent(CURSOR_CHAT_OPEN_EVENT, {
            detail: {
              targetNode: {
                nodeId: newNode.id,
                componentId: pageId,
                componentName: folder,
                type: 'component' as const,
                renderMode: 'html' as const,
                htmlPageSlug: folder,
              },
              screenX,
              screenY,
              editMode: true,
            },
          })
        );
      });
    } catch {
      setCreateHtmlError('Failed to create page');
    }
  }, [newHtmlPageName, createHtmlDialog, screenToFlowPosition, getNodeId, setNodes]);

  // Focus input when dialog opens
  useEffect(() => {
    if (createHtmlDialog && newHtmlInputRef.current) {
      // Small delay to ensure the element is rendered
      requestAnimationFrame(() => newHtmlInputRef.current?.focus());
    }
  }, [createHtmlDialog]);

  // Handle node deletion - check for children first
  const onNodesDelete = useCallback(async (deletedNodes: Node[]) => {
    for (const node of deletedNodes) {
      if (node.type === 'image' && node.data.filename) {
        try {
          await fetch('/playground/api/images', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: node.data.filename }),
          });
        } catch (error) {
          console.error('Error deleting image file:', error);
        }
      } else if (node.type === 'iteration' && node.data.filename) {
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

    // Compute total vertical height of a node + its descendants stacked vertically
    const verticalSubtreeHeightCache = new Map<string, number>();
    const computeVerticalSubtreeHeight = (nodeId: string): number => {
      if (verticalSubtreeHeightCache.has(nodeId)) return verticalSubtreeHeightCache.get(nodeId)!;

      const node = nodeMap.get(nodeId);
      if (!node) { verticalSubtreeHeightCache.set(nodeId, 0); return 0; }

      const nodeHeight = getNodeSize(node).height;
      const children = (childrenMap.get(nodeId) || []).filter(id => !hiddenNodeIds.has(id));

      if (children.length === 0) {
        verticalSubtreeHeightCache.set(nodeId, nodeHeight);
        return nodeHeight;
      }

      let childrenHeight = 0;
      children.forEach((childId, idx) => {
        childrenHeight += computeVerticalSubtreeHeight(childId);
        if (idx < children.length - 1) childrenHeight += VERTICAL_GAP;
      });

      const height = nodeHeight + VERTICAL_GAP + childrenHeight;
      verticalSubtreeHeightCache.set(nodeId, height);
      return height;
    };

    // Position map
    const positionMap = new Map<string, { x: number; y: number }>();

    // Recursively position a node and its descendants vertically (children stacked below)
    const positionVerticalSubtree = (nodeId: string, x: number, yStart: number) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;

      positionMap.set(nodeId, { x, y: yStart });

      const nodeHeight = getNodeSize(node).height;
      const children = (childrenMap.get(nodeId) || []).filter(id => !hiddenNodeIds.has(id));

      let childY = yStart + nodeHeight + VERTICAL_GAP;
      children.forEach(childId => {
        positionVerticalSubtree(childId, x, childY);
        childY += computeVerticalSubtreeHeight(childId) + VERTICAL_GAP;
      });
    };

    // Process each component: components stacked vertically, iterations spread horizontally
    const H_GAP = ARRANGE_HORIZONTAL_GAP;
    let currentGroupY = START_Y;
    componentNodes.forEach(componentNode => {
      const compSize = getNodeSize(componentNode);

      // Place component node
      positionMap.set(componentNode.id, { x: START_X, y: currentGroupY });

      const iterations = (childrenMap.get(componentNode.id) || []).filter(id => !hiddenNodeIds.has(id));

      let iterX = START_X + compSize.width + H_GAP;
      let rowHeight = compSize.height;

      iterations.forEach(iterId => {
        const iterNode = nodeMap.get(iterId);
        if (!iterNode) return;
        const iterSize = getNodeSize(iterNode);

        // Place iteration at same Y as component, spread horizontally
        positionMap.set(iterId, { x: iterX, y: currentGroupY });

        // Place sub-children of this iteration vertically below it
        const subChildren = (childrenMap.get(iterId) || []).filter(id => !hiddenNodeIds.has(id));
        let subY = currentGroupY + iterSize.height + VERTICAL_GAP;
        subChildren.forEach(subChildId => {
          positionVerticalSubtree(subChildId, iterX, subY);
          subY += computeVerticalSubtreeHeight(subChildId) + VERTICAL_GAP;
        });

        // Row height = max of component height vs each iteration's full vertical subtree
        rowHeight = Math.max(rowHeight, computeVerticalSubtreeHeight(iterId));

        iterX += iterSize.width + H_GAP;
      });

      currentGroupY += rowHeight + GROUP_GAP;
    });

    // Position orphan nodes (not reachable from any component)
    const positionedIds = new Set(positionMap.keys());
    const orphans = nodes.filter(n => !positionedIds.has(n.id) && !hiddenNodeIds.has(n.id));
    if (orphans.length > 0) {
      let orphanY = currentGroupY;
      orphans.forEach(node => {
        const size = getNodeSize(node);
        positionMap.set(node.id, { x: START_X, y: orphanY });
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
          onPaneContextMenu={handlePaneContextMenu}
          nodeTypes={nodeTypes}
          {...(initialState?.viewport
            ? { defaultViewport: initialState.viewport }
            : { fitView: true })}
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
          {/* <Controls
            className="!bg-white !border-stone-200 !rounded-lg !shadow-sm [&>button]:!bg-white [&>button]:!border-stone-200 [&>button]:!text-stone-600 [&>button:hover]:!bg-stone-50"
          /> */}
          <MiniMap
            className="bg-white !border-stone-200 rounded-lg !shadow-sm !bottom-4 !right-4"
            nodeColor={(node) => {
              if (node.type === 'skeleton') return MINIMAP_SKELETON_COLOR;
              if (node.type === 'iteration') return MINIMAP_ITERATION_COLOR;
              if (node.type === 'drag-ghost') return '#0B99FF';
              if (node.type === 'image') return MINIMAP_IMAGE_COLOR;
              return MINIMAP_COMPONENT_COLOR;
            }}
            maskColor={MINIMAP_MASK_COLOR}
            position="bottom-right"
          />
        <Background
          variant={BackgroundVariant.Dots}
          gap={dynamicBg.gap}
          size={dynamicBg.size}
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
        selectedNodes={nodeSelection.selectedNodes}
        onRemoveNode={nodeSelection.removeNode}
        onClearNodes={nodeSelection.clearNodeSelection}
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

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[180px] bg-white rounded-2xl border border-stone-200 shadow-lg py-1 animate-in fade-in-0 zoom-in-95 duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-stone-700 hover:bg-stone-100 transition-colors text-left rounded-3xl"
            onClick={(e) => {
              e.stopPropagation();
              setCreateHtmlDialog({ screenX: contextMenu.x, screenY: contextMenu.y });
              setContextMenu(null);
              setNewHtmlPageName('');
              setCreateHtmlError('');
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            create new frame
          </button>
        </div>
      )}

      {/* Create HTML page dialog */}
      {createHtmlDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-start" onClick={() => { setCreateHtmlDialog(null); setNewHtmlPageName(''); setCreateHtmlError(''); }}>
          <div
            className="bg-white rounded-2xl border border-stone-200 shadow-xl p-4 w-[280px] animate-in fade-in-0 zoom-in-95 duration-150"
            style={{ position: 'fixed', left: createHtmlDialog.screenX, top: createHtmlDialog.screenY }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[13px] font-semibold text-stone-800 mb-3">New Frame</h3>
            <input
              ref={newHtmlInputRef}
              type="text"
              placeholder="page-name"
              value={newHtmlPageName}
              onChange={(e) => { setNewHtmlPageName(e.target.value); setCreateHtmlError(''); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleCreateHtmlPage(); }
                if (e.key === 'Escape') { setCreateHtmlDialog(null); setNewHtmlPageName(''); setCreateHtmlError(''); }
              }}
              className="w-full px-3 py-2 text-[13px] bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 transition-colors"
            />
            {createHtmlError && (
              <p className="text-[11px] text-red-500 mt-1.5">{createHtmlError}</p>
            )}
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => { setCreateHtmlDialog(null); setNewHtmlPageName(''); setCreateHtmlError(''); }}
                className="px-3 py-1.5 text-[12px] text-stone-500 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateHtmlPage}
                disabled={!newHtmlPageName.trim()}
                className="px-3 py-1.5 text-[12px] bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

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
