'use client';

import { useCallback, useRef, useEffect, useState, DragEvent, type CSSProperties } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
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
import { loadCanvasState, saveCanvasState, type GenerationInfo } from './lib/canvas-persistence';
import { useCanvasFlow } from './lib/canvas-flow';
import { useMultiplayer } from './lib/multiplayer-context';
import { CanvasPresenceLayer } from './lib/presence';
import { CommentsLayer } from './lib/comments';

import ComponentNode from './nodes/ComponentNode';
import IterationNode from './nodes/IterationNode';
import SkeletonIterationNode from './nodes/SkeletonIterationNode';
import DragGhostNode from './nodes/DragGhostNode';
import ImageNode from './nodes/ImageNode';
import TextNode from './nodes/TextNode';
import { matchesAction } from './lib/keybindings';
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
import { createPagePrompt, RESERVED_TOP_LEVEL_SLUGS } from './prompts/create-page.prompt';
import { generateHtmlIterationPrompt, generateHtmlIterationFromIterationPrompt } from './lib/html-prompts';
import { generateJsxIterationPrompt, generateJsxIterationFromIterationPrompt } from './lib/jsx-prompts';
import { captureAndSaveScreenshot, getScreenshotFilename } from './lib/captureAndSaveScreenshot';
import { loadSelectedModel } from './nodes/shared/IterateDialogParts';
import {
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  GENERATION_QUEUED_EVENT,
  GENERATION_AGENT_PREVIEW_EVENT,
  PLAYGROUND_AUTO_ARRANGE_EVENT,
  DRAG_ITERATE_EVENT,
  DRAG_ITERATE_UNDO_DURATION_MS,
  DRAG_ITERATE_TOAST_DURATION_MS,
  STORAGE_KEY,

  POLL_INTERVAL,
  POLL_DURATION,

  ARRANGE_START_X,
  ARRANGE_START_Y,
  ARRANGE_HORIZONTAL_GAP,
  ARRANGE_BENTO_TILE_GAP_X,
  ARRANGE_BENTO_TILE_GAP_Y,
  ARRANGE_BENTO_CLUSTER_MAX_WIDTH,
  ARRANGE_BENTO_CLUSTER_GAP_X,
  ARRANGE_BENTO_CLUSTER_GAP_Y,
  ARRANGE_BENTO_CLUSTER_ROW_MAX_WIDTH,
  ARRANGE_LABEL_PADDING_X_BASE,
  ARRANGE_LABEL_PADDING_Y_BASE,
  ARRANGE_COLLISION_MIN_SEPARATION,
  ARRANGE_COLLISION_MAX_PASSES,
  NODE_LABEL_SCALE_THRESHOLD,
  NODE_LABEL_MAX_INV_SCALE,
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
  CANVAS_BACKGROUND_COLOR,
  BACKGROUND_COLOR,
  DND_DATA_KEY,
  HTML_ID_PREFIX,
  JSX_ID_PREFIX,
  DESIGN_SYSTEM_SHOWCASE_ID,
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
  type GenerationAgentPreviewPayload,
  type DragIteratePayload,
  type CursorChatSubmitPayload,
  type JsxComponentInfo,
} from './lib/constants';
import type { PlaygroundSkill } from './skills';
import CursorChat from './CursorChat';
import ElementHighlight from './ElementHighlight';
import { useElementSelection } from './hooks/useElementSelection';
import { useNodeSelection } from './hooks/useNodeSelection';
import { useInteractiveNodeStore } from './lib/interactive-node-store';
import { useDynamicBackground } from './hooks/useDynamicBackground';
import { toast } from 'sonner';
import { wrapHtmlFragment, parsePastedHttpUrl } from './lib/html-utils';
import { looksLikeJsx, wrapJsxComponent } from './lib/jsx-utils';

const nodeTypes = {
  component: ComponentNode,
  iteration: IterationNode,
  skeleton: SkeletonIterationNode,
  'drag-ghost': DragGhostNode,
  image: ImageNode,
  text: TextNode,
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
      const sp = skill?.skillPath?.trim();
      if (sp) parts.push(sp);
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

// CanvasState, loadCanvasState, saveCanvasState moved to ./lib/canvas-persistence

// Re-export event names so existing imports keep working
export { ITERATION_PROMPT_COPIED_EVENT, ITERATION_FETCH_EVENT } from './lib/constants';
import { ITERATION_PROMPT_COPIED_EVENT, ITERATION_FETCH_EVENT } from './lib/constants';

// GenerationInfo moved to ./lib/canvas-persistence

interface PlaygroundCanvasProps {
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
}

export default function PlaygroundCanvas({ sidebarVisible, onToggleSidebar }: PlaygroundCanvasProps) {
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(null);
  const [createHtmlDialog, setCreateHtmlDialog] = useState<{ screenX: number; screenY: number } | null>(null);
  const [newHtmlPageName, setNewHtmlPageName] = useState('');
  const [createHtmlError, setCreateHtmlError] = useState('');
  const newHtmlInputRef = useRef<HTMLInputElement>(null);

  const [createPageDialog, setCreatePageDialog] = useState<{ screenX: number; screenY: number } | null>(null);
  const [newPageDescription, setNewPageDescription] = useState('');
  const [createPageError, setCreatePageError] = useState('');
  const [creatingPage, setCreatingPage] = useState(false);
  const newPageInputRef = useRef<HTMLTextAreaElement>(null);

  // Canvas tool mode: 'select' is default pointer, 'text' is click-to-place text
  const [activeTool, setActiveTool] = useState<'select' | 'text'>('select');
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Delete cascade/reparent dialog
  const [deleteDialogNode, setDeleteDialogNode] = useState<Node | null>(null);
  
  // Clear canvas confirmation dialog
  const [showClearDialog, setShowClearDialog] = useState(false);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratingRef = useRef(false);
  const [generationInfo, setGenerationInfo] = useState<GenerationInfo | null>(null);
  const generationInfoRef = useRef<GenerationInfo | null>(null);
  const generationStartedAtMsRef = useRef(0);
  const inactiveStatusStreakRef = useRef(0);
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

  const multiplayer = useMultiplayer();
  const {
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    isLoading: isFlowLoading,
  } = useCanvasFlow();
  const { screenToFlowPosition, fitView, setCenter, getViewport } = useReactFlow();

  // Multiplayer: the host seeds a fresh room once from its local canvas (see effect below).
  const seedDataRef = useRef(initialState);
  const didSeedRef = useRef(false);

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
    const STARTUP_GRACE_MS = 2000;
    const REQUIRED_INACTIVE_POLLS = 2;

    const pollStatus = async () => {
      if (cancelled) return;

      try {
        const response = await fetch('/playground/api/generate?action=status');
        if (!response.ok) return;

        const data = (await response.json()) as {
          success: boolean;
          isGenerating: boolean;
          hasProcess: boolean;
          lockfilePresent?: boolean;
          lockPid?: number | null;
          lockPidAlive?: boolean;
          generationActive?: boolean;
        };

        const generationActive = data.generationActive ?? data.isGenerating;
        if (generationActive) {
          inactiveStatusStreakRef.current = 0;
        } else if (generationInfoRef.current) {
          const now = Date.now();
          const generationStartedAt = generationStartedAtMsRef.current || generationInfoRef.current.startTime;
          const stillInStartupGrace = now - generationStartedAt < STARTUP_GRACE_MS;
          if (!stillInStartupGrace) {
            inactiveStatusStreakRef.current += 1;
          }
        }

        // If backend confirms generation is inactive for consecutive polls,
        // force-complete to clear any lingering skeletons.
        if (
          inactiveStatusStreakRef.current >= REQUIRED_INACTIVE_POLLS &&
          generationInfoRef.current
        ) {
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
          inactiveStatusStreakRef.current = 0;
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

  // Save to localStorage whenever nodes or edges change (single-player only — in multiplayer
  // the Liveblocks room is the source of truth, so we don't persist canvas state locally).
  useEffect(() => {
    if (multiplayer.enabled) return;
    saveCanvasState(nodes, edges, nodeIdCounterRef.current, knownIterations, Array.from(collapsedNodeIds), generationInfoRef.current, getViewport());
  }, [multiplayer.enabled, nodes, edges, knownIterations, collapsedNodeIds, getViewport]);

  // Save viewport on page unload (captures pan/zoom changes that don't trigger node updates)
  useEffect(() => {
    if (multiplayer.enabled) return;
    const handler = () => {
      saveCanvasState(nodesRef.current, edges, nodeIdCounterRef.current, knownIterationsRef.current, Array.from(collapsedNodeIdsRef.current), generationInfoRef.current, getViewport());
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [multiplayer.enabled, edges, getViewport]);

  // Multiplayer: the host seeds a fresh (empty) room once from its local canvas, so an existing
  // local design becomes the shared starting point. Guests and non-empty rooms are left as-is.
  useEffect(() => {
    if (!multiplayer.enabled || !multiplayer.isHost || didSeedRef.current) return;
    if (isFlowLoading) return;
    didSeedRef.current = true;
    const seed = seedDataRef.current;
    if (nodes.length === 0 && seed?.nodes?.length) {
      setNodes(seed.nodes);
      if (seed.edges?.length) setEdges(seed.edges);
    }
  }, [multiplayer.enabled, multiplayer.isHost, isFlowLoading, nodes.length, setNodes, setEdges]);

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
      // JSX on-canvas iteration scanning (canvas-components/frame-*.iteration-*.tsx)
      // ------------------------------------------------------------------
      if (info?.renderMode === 'jsx' && info.jsxFile) {
        const baseFilename = info.jsxFile.replace(/\.iteration-\d+\.tsx$/, '.tsx');
        try {
          const jsxResponse = await fetch('/playground/api/oncanvas-components');
          if (jsxResponse.ok) {
            const { components } = await jsxResponse.json() as { components: JsxComponentInfo[] };
            const comp = components.find(c => c.filename === baseFilename);
            if (comp && comp.iterations.length > 0) {
              const currentNodes = nodesRef.current;
              const currentKnownIterations = knownIterationsRef.current;
              const existingJsxKeys = new Set([
                ...currentKnownIterations,
                ...currentNodes
                  .filter(n => n.type === 'iteration' && n.data.renderMode === 'jsx' && n.data.jsxFile)
                  .map(n => n.data.jsxFile as string),
              ]);

              const newJsxIterations = comp.iterations.filter(
                it => !existingJsxKeys.has(it.filename),
              );

              if (newJsxIterations.length > 0) {
                const remainingSkeletonIds = info
                  ? info.skeletonNodeIds.filter(id => currentNodes.some(n => n.id === id))
                  : [];
                const skeletonsToRemove: string[] = [];
                const newNodes: Node[] = [];
                const newEdges: Edge[] = [];
                const newKnownFilenames: string[] = [];

                newJsxIterations.sort((a, b) => a.iterationNumber - b.iterationNumber);

                for (const it of newJsxIterations) {
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
                      const srcW = sourceNode.measured?.width ?? DEFAULT_ITERATION_NODE_WIDTH;
                      position = { x: sourceNode.position.x + srcW + ARRANGE_HORIZONTAL_GAP, y: sourceNode.position.y };
                    } else {
                      position = { x: 400, y: 200 };
                    }
                  } else if (sourceNode) {
                    const srcW = sourceNode.measured?.width ?? DEFAULT_ITERATION_NODE_WIDTH;
                    position = { x: sourceNode.position.x + srcW + ARRANGE_HORIZONTAL_GAP, y: sourceNode.position.y };
                  } else {
                    position = { x: 400, y: 200 };
                  }

                  const nodeId = getNodeId();
                  const parentSize = (sourceNode?.data?.size as string | undefined) as import('./lib/constants').ComponentSize | undefined;
                  const registryId =
                    (sourceNode?.data?.componentId as string | undefined) ??
                    `${JSX_ID_PREFIX}${comp.label}`;

                  newNodes.push({
                    id: nodeId,
                    type: 'iteration',
                    position,
                    data: {
                      componentName: comp.label,
                      iterationNumber: it.iterationNumber,
                      filename: it.filename,
                      description: '',
                      parentNodeId: sourceNodeId || undefined,
                      parentSize,
                      registryId,
                      renderMode: 'jsx',
                      jsxFile: it.filename,
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

                  newKnownFilenames.push(it.filename);
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
          console.error('Error scanning JSX iterations:', error);
        }
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
        } else if (data.type === 'agent-preview' && data.componentId != null) {
          window.dispatchEvent(
            new CustomEvent<GenerationAgentPreviewPayload>(GENERATION_AGENT_PREVIEW_EVENT, {
              detail: {
                componentId: String(data.componentId),
                text: typeof data.text === 'string' ? data.text : '',
              },
            }),
          );
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
      const {
        componentId,
        componentName,
        parentNodeId,
        iterationCount,
        gridLayout,
        renderMode: genRenderMode,
        htmlFolder: genHtmlFolder,
        jsxFile: genJsxFile,
        editMode: isEditMode,
      } = e.detail;
      generationStartedAtMsRef.current = Date.now();
      inactiveStatusStreakRef.current = 0;

      // Edit mode: presence bubble is handled via the event, but no skeletons
      if (isEditMode) {
        setIsGenerating(true);
        isGeneratingRef.current = true;
        generationInfoRef.current = {
          componentId,
          componentName,
          parentNodeId: '',
          iterationCount: 0,
          skeletonNodeIds: [],
          startTime: Date.now(),
          renderMode: genRenderMode,
          htmlFolder: genHtmlFolder,
          jsxFile: genJsxFile,
        };
        setGenerationInfo(generationInfoRef.current);
        // Subscribe to SSE for agent-preview (Claude stream-json) — same as iterate/freeform
        startGenerationEventSource();
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
          jsxFile: genJsxFile,
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
        jsxFile: genJsxFile,
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
      inactiveStatusStreakRef.current = 0;
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
      inactiveStatusStreakRef.current = 0;

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
  }, [getNodeId, setNodes, setEdges, scanForIterations, startGenerationEventSource]);

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
        jsxFile: dragJsxFile,
      } = e.detail;
      const isDragHtml = dragRenderMode === 'html' && !!dragHtmlFolder;
      const isDragJsx = dragRenderMode === 'jsx' && !!dragJsxFile;

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
        } else if (isDragJsx && dragJsxFile) {
          const baseFilename = dragJsxFile.replace(/\.iteration-\d+\.tsx$/, '.tsx');
          const response = await fetch('/playground/api/oncanvas-components');
          if (response.ok) {
            const { components } = await response.json() as { components: JsxComponentInfo[] };
            const comp = components.find(c => c.filename === baseFilename);
            const maxNumber = comp?.iterations.reduce(
              (max: number, i: { iterationNumber: number }) => Math.max(max, i.iterationNumber),
              0,
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
      } else if (isDragJsx && dragJsxFile) {
        const baseFile = dragJsxFile.replace(/\.iteration-\d+\.tsx$/, '.tsx');
        if (sourceFilename) {
          prompt = generateJsxIterationFromIterationPrompt(
            baseFile,
            sourceFilename,
            iterationCount,
            startNumber,
            DEFAULT_EMPTY_ITERATION_INSTRUCTIONS,
            defaultSkillPrompt || undefined,
            screenshotPath ?? undefined,
          );
        } else {
          prompt = generateJsxIterationPrompt(
            baseFile,
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
                : isDragJsx
                  ? 'Could not build prompt for this JSX frame (missing jsxFile or canvas-components data).'
                  : `Component "${componentId}" is not registered. Add it to the registry or re-run discovery before iterating.`,
            },
          }),
        );
        return;
      }

      const dragPf = getProviderFields();
      // Dispatch generation start (creates skeleton nodes in grid layout)
      window.dispatchEvent(
        new CustomEvent<GenerationStartPayload>(GENERATION_START_EVENT, {
          detail: {
            componentId,
            componentName,
            parentNodeId,
            iterationCount,
            model: model || undefined,
            provider: dragPf.provider as GenerationStartPayload['provider'],
            gridLayout: { rows: e.detail.rows, cols: e.detail.cols },
            ...(isDragHtml
              ? { renderMode: 'html' as const, htmlFolder: dragHtmlFolder }
              : isDragJsx && dragJsxFile
                ? { renderMode: 'jsx' as const, jsxFile: dragJsxFile }
                : {}),
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
            ...(isDragJsx && dragJsxFile ? { jsxFile: dragJsxFile } : {}),
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
      const queuePf = getProviderFields();
      window.dispatchEvent(
        new CustomEvent<GenerationQueuedPayload>(GENERATION_QUEUED_EVENT, {
          detail: {
            componentId: payload.targetComponentId || 'cursor-chat-freeform',
            model: payload.model || 'auto',
            provider: queuePf.provider as GenerationQueuedPayload['provider'],
            flowPosition: payload.canvasPosition ?? null,
          },
        }),
      );
      return;
    }

    const chatMode = payload.chatMode ?? (payload.editMode ? 'edit' : 'explore');
    const isRawMode = chatMode === 'raw';
    const rawPrompt = payload.text.trim();

    if (payload.renderMode === 'embed' && payload.targetNodeId) {
      toast.error(
        'URL embed frames cannot be the chat target. Place chat on a React, HTML, or JSX frame, or use the embed only as a reference (shift-select).',
      );
      return;
    }

    if (isRawMode && !rawPrompt) return;

    // ── Edit Mode: modify file in-place, no iterations ──
    if (chatMode === 'edit' && payload.targetNodeId) {
      const isHtmlEdit = payload.renderMode === 'html';
      const isJsxEdit = payload.renderMode === 'jsx' && !!payload.jsxFile;
      const editComponentId = payload.targetComponentId || 'edit-mode';
      const editComponentName = payload.targetComponentName || editComponentId;
      let filePath: string;

      if (isHtmlEdit) {
        if (payload.htmlIterationFolder) {
          filePath = `public/${payload.htmlPageSlug}/${payload.htmlIterationFolder}/index.html`;
        } else {
          filePath = `public/${payload.htmlPageSlug}/index.html`;
        }
      } else if (isJsxEdit) {
        filePath = `src/app/playground/canvas-components/${payload.jsxFile}`;
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
              if (node.type === 'text') {
                const textNode = nodesRef.current.find((n) => n.id === node.nodeId);
                return { ...node, textContent: (textNode?.data as Record<string, unknown>)?.text as string || '', screenshotPath: undefined, sourcePath: undefined };
              }
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

      const editPf = getProviderFields();
      // Dispatch GENERATION_START_EVENT so the presence bubble appears
      window.dispatchEvent(
        new CustomEvent<GenerationStartPayload>(GENERATION_START_EVENT, {
          detail: {
            componentId: editComponentId,
            componentName: editComponentName,
            parentNodeId: payload.targetNodeId,
            iterationCount: 0,
            model: payload.model || undefined,
            provider: editPf.provider as GenerationStartPayload['provider'],
            flowPosition: payload.canvasPosition,
            editMode: true,
            ...(isHtmlEdit ? { renderMode: 'html' as const, htmlFolder: payload.htmlPageSlug } : {}),
            ...(isJsxEdit && payload.jsxFile
              ? { renderMode: 'jsx' as const, jsxFile: payload.jsxFile }
              : {}),
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
            ...(isJsxEdit && payload.jsxFile ? { jsxFile: payload.jsxFile } : {}),
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
          } else if (isJsxEdit) {
            window.dispatchEvent(new Event(JSX_COMPONENT_ADDED_EVENT));
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

    // Combine skill prompts (raw mode bypasses all prompt composition)
    let combinedSkillPrompt: string | undefined;
    if (isRawMode) {
      combinedSkillPrompt = undefined;
    } else if (skillPrompts.length > 0) {
      combinedSkillPrompt = skillPrompts.join('\n\n');
    } else if (!text) {
      // Use default skills only when no explicit skills selected and text is empty
      const defaultPrompt = await loadDefaultSkillPrompt();
      combinedSkillPrompt = defaultPrompt || undefined;
    }

    const customInstructions = isRawMode
      ? rawPrompt
      : (text || DEFAULT_EMPTY_ITERATION_INSTRUCTIONS);
    const hasElementSelections = (payload.elementSelections?.length ?? 0) > 0;
    const stylingMode: StylingMode = payload.skillIds?.includes('no-bound-explore')
      ? 'inline-css' : DEFAULT_STYLING_MODE;

    // Build reference nodes section from shift-drag selection (skipped in raw mode)
    let referenceNodesSection = '';
    if (!isRawMode && payload.referenceNodes && payload.referenceNodes.length > 0) {
      // Filter out the target node from references (no need to reference itself)
      const refNodes = payload.referenceNodes.filter((n) => n.nodeId !== targetNodeId);

      if (refNodes.length > 0) {
        // Capture screenshots for each reference node
        const refNodesWithScreenshots = await Promise.all(
          refNodes.map(async (node) => {
            // Text nodes pass their content directly — no screenshot needed
            if (node.type === 'text') {
              const textNode = nodesRef.current.find((n) => n.id === node.nodeId);
              return {
                ...node,
                textContent: (textNode?.data as Record<string, unknown>)?.text as string || '',
                screenshotPath: undefined,
                sourcePath: undefined,
              };
            }
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
    const isJsxTarget = payload.renderMode === 'jsx' && !!payload.jsxFile;
    const canvasGenPf = getProviderFields();

    if (targetNodeId && targetComponentId && targetComponentName && targetType) {
      // --- WITH TARGET NODE ---
      let prompt = rawPrompt;
      const componentId = targetComponentId;
      const componentName = targetComponentName;
      const iterationCount = payload.iterationCount ?? CURSOR_CHAT_DEFAULT_COUNT;
      let startNumber = 1;
      let screenshotPath: string | undefined;

      if (isRawMode) {
        prompt = rawPrompt;
      } else {
        // Fetch next available iteration number
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
          } else if (isJsxTarget && payload.jsxFile) {
            const baseFilename = payload.jsxFile.replace(/\.iteration-\d+\.tsx$/, '.tsx');
            const response = await fetch('/playground/api/oncanvas-components');
            if (response.ok) {
              const { components } = await response.json() as { components: JsxComponentInfo[] };
              const comp = components.find(c => c.filename === baseFilename);
              const maxNumber = comp?.iterations.reduce(
                (max: number, i: { iterationNumber: number }) => Math.max(max, i.iterationNumber),
                0,
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
        screenshotPath = (await captureAndSaveScreenshot(targetNodeId, screenshotFilename)) ?? undefined;
      }

      if (!isRawMode && isHtmlTarget && payload.htmlPageSlug) {
        // HTML iteration
        if (targetType === 'iteration' && payload.htmlIterationFolder) {
          prompt = generateHtmlIterationFromIterationPrompt(
            payload.htmlPageSlug,
            payload.htmlIterationFolder,
            iterationCount,
            startNumber,
            customInstructions,
            combinedSkillPrompt,
            screenshotPath,
          );
        } else {
          prompt = generateHtmlIterationPrompt(
            payload.htmlPageSlug,
            iterationCount,
            startNumber,
            customInstructions,
            combinedSkillPrompt,
            screenshotPath,
          );
        }
      } else if (!isRawMode && isJsxTarget && payload.jsxFile) {
        const baseFile = payload.jsxFile.replace(/\.iteration-\d+\.tsx$/, '.tsx');
        if (targetType === 'iteration' && sourceFilename) {
          prompt = generateJsxIterationFromIterationPrompt(
            baseFile,
            sourceFilename,
            iterationCount,
            startNumber,
            customInstructions,
            combinedSkillPrompt,
            screenshotPath,
          );
        } else {
          prompt = generateJsxIterationPrompt(
            baseFile,
            iterationCount,
            startNumber,
            customInstructions,
            combinedSkillPrompt,
            screenshotPath,
          );
        }
      } else if (!isRawMode && targetType === 'iteration' && sourceFilename) {
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
            screenshotPath,
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
            screenshotPath,
            referenceNodesSection,
          );
        }
      } else if (!isRawMode) {
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
            screenshotPath,
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
            screenshotPath,
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
            provider: canvasGenPf.provider as GenerationStartPayload['provider'],
            flowPosition: payload.canvasPosition,
            ...(isHtmlTarget ? { renderMode: 'html' as const, htmlFolder: payload.htmlPageSlug } : {}),
            ...(isJsxTarget && payload.jsxFile
              ? { renderMode: 'jsx' as const, jsxFile: payload.jsxFile }
              : {}),
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
            ...canvasGenPf,
            ...(isHtmlTarget ? { htmlFolder: payload.htmlPageSlug } : {}),
            ...(isJsxTarget && payload.jsxFile ? { jsxFile: payload.jsxFile } : {}),
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
            provider: canvasGenPf.provider as GenerationStartPayload['provider'],
            flowPosition: payload.canvasPosition ?? undefined,
          },
        }),
      );

      // Build prompt — use freeform-reference template if reference nodes exist
      let freeformPrompt: string;
      if (isRawMode) {
        freeformPrompt = rawPrompt;
      } else if (referenceNodesSection) {
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
            ...canvasGenPf,
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

        // Check for HTML file drops
        const htmlFiles = Array.from(files).filter((f) =>
          /\.(html?|htm)$/i.test(f.name)
        );
        if (htmlFiles.length > 0) {
          const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });

          (async () => {
            // Determine next frame number
            let frameNumber = 1;
            const [htmlRes, jsxRes] = await Promise.all([
              fetch('/playground/api/html-pages').catch(() => null),
              fetch('/playground/api/oncanvas-components').catch(() => null),
            ]);
            if (htmlRes?.ok) {
              const { pages } = await htmlRes.json() as { pages: { folder: string }[] };
              for (const page of pages) {
                const match = page.folder.match(/^frame-(\d+)$/);
                if (match) frameNumber = Math.max(frameNumber, parseInt(match[1], 10) + 1);
              }
            }
            if (jsxRes?.ok) {
              const { components } = await jsxRes.json() as { components: { filename: string }[] };
              for (const comp of components) {
                const match = comp.filename.match(/^frame-(\d+)\.tsx$/);
                if (match) frameNumber = Math.max(frameNumber, parseInt(match[1], 10) + 1);
              }
            }

            for (let idx = 0; idx < htmlFiles.length; idx++) {
              const file = htmlFiles[idx];
              try {
                const text = await file.text();
                const wrappedHtml = wrapHtmlFragment(text);
                const frameName = `frame-${frameNumber + idx}`;

                const res = await fetch('/playground/api/html-pages', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: frameName, content: wrappedHtml }),
                });
                const data = await res.json();

                if (!res.ok) {
                  console.error('[Playground] HTML file drop failed:', data.error);
                  toast.error(data.error || 'Failed to create frame from dropped HTML');
                  continue;
                }

                const pageId = data.page.id as string;
                const folder = data.page.folder as string;

                const newNode: Node = {
                  id: getNodeId(),
                  type: 'component',
                  position: { x: position.x + idx * 320, y: position.y },
                  data: {
                    componentId: pageId,
                    renderMode: 'html' as const,
                    htmlFolder: folder,
                  },
                };
                setNodes((nds) => nds.concat(newNode));
              } catch (err) {
                console.error('[Playground] HTML file drop failed:', err);
                toast.error('Failed to create frame from dropped HTML');
              }
            }
          })();
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
      const isJsxFrame = componentId.startsWith(JSX_ID_PREFIX);
      const isDesignSystem = componentId === DESIGN_SYSTEM_SHOWCASE_ID;
      const parentNodeId = getNodeId();
      const newNode: Node = {
        id: parentNodeId,
        type: 'component',
        position,
        data: {
          componentId,
          ...(isHtml ? {
            renderMode: 'html' as const,
            htmlFolder: componentId.slice(HTML_ID_PREFIX.length),
          } : {}),
          ...(isDesignSystem ? {
            renderMode: 'design-system' as const,
          } : {}),
        },
      };

      setNodes((nds) => nds.concat(newNode));

      // After dropping a frame, also bring any of its iterations that are not
      // already on the canvas, attached to this newly placed parent.
      if (isHtml || isJsxFrame) {
        (async () => {
          try {
            const currentNodes = nodesRef.current;
            const parentW = DEFAULT_COMPONENT_NODE_WIDTH;
            const stepW = (isHtml ? DEFAULT_COMPONENT_NODE_WIDTH : DEFAULT_ITERATION_NODE_WIDTH) + ARRANGE_HORIZONTAL_GAP;
            const baseX = position.x + parentW + ARRANGE_HORIZONTAL_GAP;
            const newNodes: Node[] = [];
            const newEdges: Edge[] = [];
            const newKnownFilenames: string[] = [];

            if (isHtml) {
              const htmlFolder = componentId.slice(HTML_ID_PREFIX.length);
              const res = await fetch('/playground/api/html-pages');
              if (!res.ok) return;
              const { pages } = await res.json() as { pages: { folder: string; iterations: { folder: string; number: number }[] }[] };
              const page = pages.find(p => p.folder === htmlFolder);
              if (!page || page.iterations.length === 0) return;

              const existingKeys = new Set([
                ...knownIterationsRef.current,
                ...currentNodes
                  .filter(n => n.type === 'iteration' && n.data.renderMode === 'html')
                  .map(n => `${n.data.htmlFolder}/${n.data.htmlIterationFolder}` as string),
              ]);

              const missing = page.iterations
                .filter(it => !existingKeys.has(`${htmlFolder}/${it.folder}`))
                .sort((a, b) => a.number - b.number);

              missing.forEach((iter, idx) => {
                const nodeId = getNodeId();
                newNodes.push({
                  id: nodeId,
                  type: 'iteration',
                  position: { x: baseX + idx * stepW, y: position.y },
                  data: {
                    componentName: htmlFolder,
                    iterationNumber: iter.number,
                    filename: `${htmlFolder}/iteration-${iter.number}`,
                    description: '',
                    parentNodeId,
                    renderMode: 'html',
                    htmlFolder,
                    htmlIterationFolder: iter.folder,
                    onDelete: handleIterationDelete,
                    onAdopt: handleIterationAdopt,
                  },
                });
                newEdges.push({
                  id: `edge_${parentNodeId}_${nodeId}`,
                  source: parentNodeId,
                  target: nodeId,
                  type: 'smoothstep',
                  animated: false,
                  style: ITERATION_EDGE_STYLE,
                });
                newKnownFilenames.push(`${htmlFolder}/${iter.folder}`);
              });
            } else {
              const baseFilename = `${componentId.slice(JSX_ID_PREFIX.length)}.tsx`;
              const res = await fetch('/playground/api/oncanvas-components');
              if (!res.ok) return;
              const { components } = await res.json() as { components: JsxComponentInfo[] };
              const comp = components.find(c => c.filename === baseFilename);
              if (!comp || comp.iterations.length === 0) return;

              const existingKeys = new Set([
                ...knownIterationsRef.current,
                ...currentNodes
                  .filter(n => n.type === 'iteration' && n.data.renderMode === 'jsx' && n.data.jsxFile)
                  .map(n => n.data.jsxFile as string),
              ]);

              const missing = comp.iterations
                .filter(it => !existingKeys.has(it.filename))
                .sort((a, b) => a.iterationNumber - b.iterationNumber);

              missing.forEach((it, idx) => {
                const nodeId = getNodeId();
                newNodes.push({
                  id: nodeId,
                  type: 'iteration',
                  position: { x: baseX + idx * stepW, y: position.y },
                  data: {
                    componentName: comp.label,
                    iterationNumber: it.iterationNumber,
                    filename: it.filename,
                    description: '',
                    parentNodeId,
                    renderMode: 'jsx',
                    jsxFile: it.filename,
                    onDelete: handleIterationDelete,
                    onAdopt: handleIterationAdopt,
                  },
                });
                newEdges.push({
                  id: `edge_${parentNodeId}_${nodeId}`,
                  source: parentNodeId,
                  target: nodeId,
                  type: 'smoothstep',
                  animated: false,
                  style: ITERATION_EDGE_STYLE,
                });
                newKnownFilenames.push(it.filename);
              });
            }

            if (newNodes.length > 0) {
              setNodes(nds => [...nds, ...newNodes]);
              setEdges(eds => [...eds, ...newEdges]);
              knownIterationsRef.current = [...knownIterationsRef.current, ...newKnownFilenames];
              setKnownIterations(prev => [...prev, ...newKnownFilenames]);
            }
          } catch (err) {
            console.error('[Playground] Failed to load iterations for dropped frame:', err);
          }
        })();
      }
    },
    [screenToFlowPosition, setNodes, setEdges, getNodeId, handleIterationDelete, handleIterationAdopt]
  );

  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    setContextMenu(null);
    useInteractiveNodeStore.getState().setInteractiveNodeId(null);

    if (activeTool === 'text') {
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newNode = {
        id: getNodeId(),
        type: 'text' as const,
        position,
        style: { width: 250, height: 150 },
        selected: true,
        data: { text: '', autofocus: true },
      };
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })).concat(newNode));
      setActiveTool('select');
    }
  }, [activeTool, screenToFlowPosition, getNodeId, setNodes]);

  // Right-click context menu on canvas pane
  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  // Right-click context menu on a node — also select the node so the
  // z-order actions in the menu have a clear target.
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setNodes((nds) => nds.map((n) => (n.id === node.id ? { ...n, selected: true } : n)));
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
  }, [setNodes]);

  // Re-stack selected nodes (or the right-clicked node) along the z-axis.
  const handleZOrder = useCallback((op: 'front' | 'back' | 'forward' | 'backward') => {
    setNodes((nds) => {
      const targetIds = new Set<string>();
      for (const n of nds) if (n.selected) targetIds.add(n.id);
      if (targetIds.size === 0 && contextMenu?.nodeId) targetIds.add(contextMenu.nodeId);
      if (targetIds.size === 0) return nds;

      const z = (n: Node) => n.zIndex ?? 0;
      const others = nds.filter((n) => !targetIds.has(n.id));
      const targets = nds.filter((n) => targetIds.has(n.id));

      if (op === 'front') {
        const max = nds.reduce((m, n) => Math.max(m, z(n)), 0);
        const next = max + 1;
        return nds.map((n) => (targetIds.has(n.id) ? { ...n, zIndex: next } : n));
      }
      if (op === 'back') {
        const min = nds.reduce((m, n) => Math.min(m, z(n)), 0);
        const next = min - 1;
        return nds.map((n) => (targetIds.has(n.id) ? { ...n, zIndex: next } : n));
      }
      // one-step: swap zIndex with the nearest non-selected neighbor.
      const dir: 1 | -1 = op === 'forward' ? 1 : -1;
      const targetZs = targets.map(z);
      const refZ = dir === 1 ? Math.max(...targetZs) : Math.min(...targetZs);
      const candidates = others
        .map(z)
        .filter((zz) => (dir === 1 ? zz > refZ : zz < refZ))
        .sort((a, b) => (dir === 1 ? a - b : b - a));
      if (candidates.length === 0) {
        // already at the extreme — bump past it so a subsequent action still has effect.
        const next = refZ + dir;
        return nds.map((n) => (targetIds.has(n.id) ? { ...n, zIndex: next } : n));
      }
      const swapZ = candidates[0];
      const next = dir === 1 ? swapZ + 1 : swapZ - 1;
      return nds.map((n) => (targetIds.has(n.id) ? { ...n, zIndex: next } : n));
    });
  }, [setNodes, contextMenu]);

  // Close context menu on any click outside
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  // "T" shortcut — toggle text-placement tool mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!matchesAction(e, 'canvas.add-text')) return;
      const active = document.activeElement;
      if (active) {
        const tag = active.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        if ((active as HTMLElement).isContentEditable) return;
        if (active.closest('[role="dialog"]') || active.closest('[data-radix-popper-content-wrapper]')) return;
      }
      e.preventDefault();
      setActiveTool((prev) => (prev === 'text' ? 'select' : 'text'));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Z-order shortcuts: Cmd/Ctrl + ] / [ (with Shift for front/back).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      let op: 'front' | 'back' | 'forward' | 'backward' | null = null;
      if (matchesAction(e, 'canvas.bring-to-front')) op = 'front';
      else if (matchesAction(e, 'canvas.send-to-back')) op = 'back';
      else if (matchesAction(e, 'canvas.bring-forward')) op = 'forward';
      else if (matchesAction(e, 'canvas.send-backward')) op = 'backward';
      if (!op) return;
      const active = document.activeElement;
      if (active) {
        const tag = active.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        if ((active as HTMLElement).isContentEditable) return;
        if (active.closest('[role="dialog"]') || active.closest('[data-radix-popper-content-wrapper]')) return;
      }
      e.preventDefault();
      handleZOrder(op);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleZOrder]);

  // Suppress browser history swipe (macOS trackpad two-finger swipe-back/forward).
  // React's onWheel is passive — preventDefault() is a no-op there — so we
  // attach the listener imperatively with { passive: false }. We only block
  // horizontal-dominant wheel events; vertical scroll and React Flow's
  // panOnScroll are untouched.
  useEffect(() => {
    const wrapper = reactFlowWrapper.current;
    if (!wrapper) return;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
      }
    };

    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', handleWheel);
  }, []);

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

      // --- Single-line URL paste → remote iframe embed (no file on disk) ---
      const plainOneLine = rawPlain.replace(/\r\n/g, '\n').trim();
      const pastedHttpUrl = plainOneLine && !plainOneLine.includes('\n') ? parsePastedHttpUrl(plainOneLine) : null;
      if (pastedHttpUrl) {
        e.preventDefault();
        const wrapperBounds = wrapper.getBoundingClientRect();
        const position = screenToFlowPosition({
          x: wrapperBounds.left + wrapperBounds.width / 2,
          y: wrapperBounds.top + wrapperBounds.height / 2,
        });
        const embedComponentId = `url-embed:${crypto.randomUUID()}`;
        const newNode: Node = {
          id: getNodeId(),
          type: 'component',
          position,
          style: { width: DEFAULT_COMPONENT_NODE_WIDTH, height: DEFAULT_COMPONENT_NODE_HEIGHT },
          data: {
            componentId: embedComponentId,
            renderMode: 'embed' as const,
            embedUrl: pastedHttpUrl,
          },
        };
        setNodes((nds) => nds.concat(newNode));
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

  // Focus textarea when create-page dialog opens
  useEffect(() => {
    if (createPageDialog && newPageInputRef.current) {
      requestAnimationFrame(() => newPageInputRef.current?.focus());
    }
  }, [createPageDialog]);

  // Create new Next.js page from context menu
  const handleCreatePage = useCallback(async () => {
    const description = newPageDescription.trim();
    if (!description) return;
    setCreatePageError('');
    setCreatingPage(true);

    const skillPromptText = (await loadDefaultSkillPrompt()) ?? '';
    const skillSection = skillPromptText ? formatSkillSection(skillPromptText) : '';
    const prompt = createPagePrompt({
      skillSection,
      description,
      stylingConstraint: getStylingConstraint(DEFAULT_STYLING_MODE),
      reservedSlugs: RESERVED_TOP_LEVEL_SLUGS.join(', '),
    });

    const componentId = 'cursor-chat-new-page';
    const pf = getProviderFields();
    const toastId = `create-page-${Date.now()}`;
    toast.loading('Creating new page…', { id: toastId, duration: Infinity });

    window.dispatchEvent(
      new CustomEvent<GenerationStartPayload>(GENERATION_START_EVENT, {
        detail: {
          componentId,
          componentName: 'New Page',
          parentNodeId: '',
          iterationCount: 0,
          model: undefined,
          provider: pf.provider as GenerationStartPayload['provider'],
        },
      }),
    );

    try {
      const response = await fetch('/playground/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          componentId,
          iterationCount: 0,
          ...pf,
        }),
      });
      const data = await response.json().catch(() => ({ success: false }));
      if (!response.ok || !data.success) {
        const errMsg = data?.error || `Page creation failed (${response.status})`;
        toast.error(errMsg, { id: toastId, duration: 6000 });
        setCreatePageError(errMsg);
        window.dispatchEvent(
          new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
            detail: { componentId, parentNodeId: '', error: errMsg },
          }),
        );
        return;
      }
      toast.success('Page created — drag from sidebar to canvas', { id: toastId, duration: 5000 });
      window.dispatchEvent(
        new CustomEvent<GenerationCompletePayload>(GENERATION_COMPLETE_EVENT, {
          detail: { componentId, parentNodeId: '', output: '' },
        }),
      );
      setCreatePageDialog(null);
      setNewPageDescription('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(msg, { id: toastId, duration: 6000 });
      setCreatePageError(msg);
      window.dispatchEvent(
        new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
          detail: { componentId, parentNodeId: '', error: msg },
        }),
      );
    } finally {
      setCreatingPage(false);
    }
  }, [newPageDescription]);

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
  // Auto-arrange: bento cluster layout
  // Each component and all of its visible descendants are laid out as a local bento cluster.
  // Component clusters are then packed left-to-right in rows with spacing between clusters.
  // ---------------------------------------------------------------------------
  const autoArrangeNodes = useCallback((andFitView: boolean = false) => {
    const componentNodes = nodes.filter(n => n.type === 'component');

    const START_X = ARRANGE_START_X;
    const START_Y = ARRANGE_START_Y;
    const TILE_GAP_X = ARRANGE_BENTO_TILE_GAP_X;
    const TILE_GAP_Y = ARRANGE_BENTO_TILE_GAP_Y;
    const CLUSTER_MAX_WIDTH = ARRANGE_BENTO_CLUSTER_MAX_WIDTH;
    const CLUSTER_GAP_X = ARRANGE_BENTO_CLUSTER_GAP_X;
    const CLUSTER_GAP_Y = ARRANGE_BENTO_CLUSTER_GAP_Y;
    const CLUSTER_ROW_MAX_WIDTH = ARRANGE_BENTO_CLUSTER_ROW_MAX_WIDTH;
    const COLLISION_MIN_SEPARATION = ARRANGE_COLLISION_MIN_SEPARATION;
    const COLLISION_MAX_PASSES = ARRANGE_COLLISION_MAX_PASSES;
    const LABEL_PADDING_X_BASE = ARRANGE_LABEL_PADDING_X_BASE;
    const LABEL_PADDING_Y_BASE = ARRANGE_LABEL_PADDING_Y_BASE;
    const zoom = Math.max(getViewport().zoom, 0.0001);

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
    const getEffectiveNodeFootprint = (node: Node): { width: number; height: number } => {
      const base = getNodeSize(node);
      const inverseLabelScale = Math.min(
        NODE_LABEL_MAX_INV_SCALE,
        Math.max(1, NODE_LABEL_SCALE_THRESHOLD / zoom),
      );
      const zoomGrowth = Math.max(0, inverseLabelScale - 1);
      const extraX = LABEL_PADDING_X_BASE * zoomGrowth;
      const extraY = LABEL_PADDING_Y_BASE * zoomGrowth;
      return {
        width: base.width + extraX,
        height: base.height + extraY,
      };
    };

    const nodeOrder = new Map<string, number>();
    nodes.forEach((node, index) => nodeOrder.set(node.id, index));
    const sortByStableNodeOrder = (a: string, b: string) =>
      (nodeOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (nodeOrder.get(b) ?? Number.MAX_SAFE_INTEGER);

    // Build adjacency list from edges (parent -> children)
    const childrenMap = new Map<string, string[]>();
    edges.forEach(edge => {
      const existing = childrenMap.get(edge.source) || [];
      existing.push(edge.target);
      childrenMap.set(edge.source, existing);
    });
    childrenMap.forEach((children, parentId) => {
      childrenMap.set(parentId, children.sort(sortByStableNodeOrder));
    });

    // Build visibility map based on collapsed state
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

    const collectVisibleClusterNodeIds = (rootNodeId: string): string[] => {
      const collected: string[] = [];
      const visited = new Set<string>();
      const queue: string[] = [rootNodeId];

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId) || hiddenNodeIds.has(currentId)) continue;
        const currentNode = nodeMap.get(currentId);
        if (!currentNode) continue;

        visited.add(currentId);
        collected.push(currentId);
        const children = (childrenMap.get(currentId) || []).filter(childId => !hiddenNodeIds.has(childId));
        queue.push(...children);
      }

      return collected;
    };

    const getDepthByNodeId = (rootNodeId: string, clusterNodeIds: Set<string>): Map<string, number> => {
      const depthByNodeId = new Map<string, number>();
      const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: rootNodeId, depth: 0 }];

      while (queue.length > 0) {
        const { nodeId, depth } = queue.shift()!;
        if (depthByNodeId.has(nodeId) || !clusterNodeIds.has(nodeId)) continue;

        depthByNodeId.set(nodeId, depth);
        const children = (childrenMap.get(nodeId) || []).filter(childId => clusterNodeIds.has(childId));
        children.forEach(childId => queue.push({ nodeId: childId, depth: depth + 1 }));
      }

      return depthByNodeId;
    };

    const layoutClusterBento = (
      rootNodeId: string,
      clusterNodeIds: string[],
      anchorRootAtTopLeft: boolean,
    ): {
      positions: Map<string, { x: number; y: number }>;
      width: number;
      height: number;
    } => {
      const localPositions = new Map<string, { x: number; y: number }>();
      if (clusterNodeIds.length === 0) {
        return { positions: localPositions, width: 0, height: 0 };
      }

      const nodeIdSet = new Set(clusterNodeIds);
      const depthByNodeId = getDepthByNodeId(rootNodeId, nodeIdSet);

      const orderedTiles = clusterNodeIds
        .filter(nodeId => !anchorRootAtTopLeft || nodeId !== rootNodeId)
        .sort((a, b) => {
          const depthDelta = (depthByNodeId.get(a) ?? Number.MAX_SAFE_INTEGER) -
            (depthByNodeId.get(b) ?? Number.MAX_SAFE_INTEGER);
          if (depthDelta !== 0) return depthDelta;
          return sortByStableNodeOrder(a, b);
        });

      let cursorX = 0;
      let cursorY = 0;
      let rowHeight = 0;
      let maxRight = 0;
      let maxBottom = 0;

      const placeTile = (nodeId: string, x: number, y: number) => {
        const node = nodeMap.get(nodeId);
        if (!node) return;
        const size = getEffectiveNodeFootprint(node);
        localPositions.set(nodeId, { x, y });
        maxRight = Math.max(maxRight, x + size.width);
        maxBottom = Math.max(maxBottom, y + size.height);
      };

      if (anchorRootAtTopLeft && nodeIdSet.has(rootNodeId)) {
        const rootNode = nodeMap.get(rootNodeId);
        if (rootNode) {
          const rootSize = getEffectiveNodeFootprint(rootNode);
          placeTile(rootNodeId, 0, 0);
          cursorX = rootSize.width + TILE_GAP_X;
          rowHeight = rootSize.height;
        }
      }

      orderedTiles.forEach(tileNodeId => {
        const tileNode = nodeMap.get(tileNodeId);
        if (!tileNode) return;

        const tileSize = getEffectiveNodeFootprint(tileNode);
        const wouldOverflow = cursorX > 0 && cursorX + tileSize.width > CLUSTER_MAX_WIDTH;
        if (wouldOverflow) {
          cursorY += rowHeight + TILE_GAP_Y;
          cursorX = 0;
          rowHeight = 0;
        }

        placeTile(tileNodeId, cursorX, cursorY);
        rowHeight = Math.max(rowHeight, tileSize.height);
        cursorX += tileSize.width + TILE_GAP_X;
      });

      return {
        positions: localPositions,
        width: maxRight,
        height: maxBottom,
      };
    };

    const clusterLayouts: Array<{
      clusterId: string;
      positions: Map<string, { x: number; y: number }>;
      width: number;
      height: number;
    }> = [];
    const assignedNodeIds = new Set<string>();

    componentNodes.forEach(componentNode => {
      const clusterNodeIds = collectVisibleClusterNodeIds(componentNode.id)
        .filter(nodeId => !assignedNodeIds.has(nodeId));
      if (clusterNodeIds.length === 0) return;

      clusterNodeIds.forEach(nodeId => assignedNodeIds.add(nodeId));
      const layout = layoutClusterBento(componentNode.id, clusterNodeIds, true);
      clusterLayouts.push({
        clusterId: componentNode.id,
        positions: layout.positions,
        width: layout.width,
        height: layout.height,
      });
    });

    // Keep non-hidden, non-component leftovers in a fallback bento cluster.
    const orphanNodeIds = nodes
      .map(node => node.id)
      .filter(nodeId => !hiddenNodeIds.has(nodeId) && !assignedNodeIds.has(nodeId));
    if (orphanNodeIds.length > 0) {
      orphanNodeIds.forEach(nodeId => assignedNodeIds.add(nodeId));
      const layout = layoutClusterBento(orphanNodeIds[0], orphanNodeIds, false);
      clusterLayouts.push({
        clusterId: '__orphans__',
        positions: layout.positions,
        width: layout.width,
        height: layout.height,
      });
    }

    const clusterOrigins = new Map<string, { x: number; y: number }>();
    let clusterCursorX = START_X;
    let clusterCursorY = START_Y;
    let currentRowHeight = 0;
    const maxClusterRowRight = START_X + CLUSTER_ROW_MAX_WIDTH;

    clusterLayouts.forEach(clusterLayout => {
      const shouldWrapRow = clusterCursorX > START_X &&
        clusterCursorX + clusterLayout.width > maxClusterRowRight;
      if (shouldWrapRow) {
        clusterCursorX = START_X;
        clusterCursorY += currentRowHeight + CLUSTER_GAP_Y;
        currentRowHeight = 0;
      }

      clusterOrigins.set(clusterLayout.clusterId, { x: clusterCursorX, y: clusterCursorY });
      clusterCursorX += clusterLayout.width + CLUSTER_GAP_X;
      currentRowHeight = Math.max(currentRowHeight, clusterLayout.height);
    });

    const positionMap = new Map<string, { x: number; y: number }>();
    clusterLayouts.forEach(clusterLayout => {
      const origin = clusterOrigins.get(clusterLayout.clusterId);
      if (!origin) return;

      clusterLayout.positions.forEach((localPosition, nodeId) => {
        positionMap.set(nodeId, {
          x: origin.x + localPosition.x,
          y: origin.y + localPosition.y,
        });
      });
    });

    const effectiveSizeByNodeId = new Map<string, { width: number; height: number }>();
    positionMap.forEach((_, nodeId) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;
      effectiveSizeByNodeId.set(nodeId, getEffectiveNodeFootprint(node));
    });
    const positionedNodeIds = Array.from(positionMap.keys()).sort(sortByStableNodeOrder);
    const hasOverlap = (
      aPos: { x: number; y: number },
      aSize: { width: number; height: number },
      bPos: { x: number; y: number },
      bSize: { width: number; height: number },
    ) => {
      const aRight = aPos.x + aSize.width + COLLISION_MIN_SEPARATION;
      const aBottom = aPos.y + aSize.height + COLLISION_MIN_SEPARATION;
      const bRight = bPos.x + bSize.width + COLLISION_MIN_SEPARATION;
      const bBottom = bPos.y + bSize.height + COLLISION_MIN_SEPARATION;
      return aPos.x < bRight && aRight > bPos.x && aPos.y < bBottom && aBottom > bPos.y;
    };
    const resolveCollisions = () => {
      for (let pass = 0; pass < COLLISION_MAX_PASSES; pass += 1) {
        let movedAny = false;
        for (let i = 0; i < positionedNodeIds.length; i += 1) {
          const leftNodeId = positionedNodeIds[i];
          const leftPos = positionMap.get(leftNodeId);
          const leftSize = effectiveSizeByNodeId.get(leftNodeId);
          if (!leftPos || !leftSize) continue;
          for (let j = i + 1; j < positionedNodeIds.length; j += 1) {
            const rightNodeId = positionedNodeIds[j];
            const rightPos = positionMap.get(rightNodeId);
            const rightSize = effectiveSizeByNodeId.get(rightNodeId);
            if (!rightPos || !rightSize) continue;
            if (!hasOverlap(leftPos, leftSize, rightPos, rightSize)) continue;

            const pushX = (leftPos.x + leftSize.width + COLLISION_MIN_SEPARATION) - rightPos.x;
            const pushY = (leftPos.y + leftSize.height + COLLISION_MIN_SEPARATION) - rightPos.y;
            if (pushX <= 0 || pushY <= 0) continue;

            if (pushX <= pushY) {
              positionMap.set(rightNodeId, { x: rightPos.x + pushX, y: rightPos.y });
            } else {
              positionMap.set(rightNodeId, { x: rightPos.x, y: rightPos.y + pushY });
            }
            movedAny = true;
          }
        }
        if (!movedAny) break;
      }
    };
    resolveCollisions();

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
  }, [nodes, edges, setNodes, fitView, getViewport]);

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

  // Image upload via toolbar button (reuses same logic as drag-drop)
  const handleImageFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const wrapper = reactFlowWrapper.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const position = screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
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

    // Reset input so the same file can be re-selected
    e.target.value = '';
  }, [screenToFlowPosition, getNodeId, setNodes]);

  // Activate cursor chat (same as pressing C)
  const handleActivateCursorChat = useCallback(() => {
    setActiveTool('select');
    window.dispatchEvent(new CustomEvent('playground:toolbar-activate-chat'));
  }, []);

  // Escape or V key resets to select mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (activeTool !== 'select' && (e.key === 'Escape' || e.key === 'v' || e.key === 'V')) {
        const active = document.activeElement;
        if (active) {
          const tag = active.tagName.toLowerCase();
          if (tag === 'input' || tag === 'textarea') return;
          if ((active as HTMLElement).isContentEditable) return;
          if (active.closest('[role="dialog"]') || active.closest('[data-radix-popper-content-wrapper]')) return;
        }
        setActiveTool('select');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTool]);

  return (
    <TooltipProvider>
      <div
        ref={reactFlowWrapper}
        className={`w-full h-full${activeTool === 'text' ? ' playground-text-tool' : ''}`}
      >
        {/* XY Flow reads pane fill from `--xy-background-color`; Tailwind bg-* often loses to `.react-flow` in the cascade. */}
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
          onNodeContextMenu={handleNodeContextMenu}
          nodeTypes={nodeTypes}
          {...(initialState?.viewport
            ? { defaultViewport: initialState.viewport }
            : { fitView: true })}
          style={{ '--xy-background-color': CANVAS_BACKGROUND_COLOR } as CSSProperties}
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
        <Background
          variant={BackgroundVariant.Dots}
          gap={dynamicBg.gap}
          size={dynamicBg.size}
          bgColor={CANVAS_BACKGROUND_COLOR}
          color={BACKGROUND_COLOR}
        />
        {multiplayer.enabled && <CanvasPresenceLayer />}
        {multiplayer.enabled && <CommentsLayer />}
      </ReactFlow>

      {/* Hidden file input for image upload */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageFileSelect}
      />

      {/* Match PlaygroundClient: left-6 (1.5rem); vertically centered */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2 bg-white rounded-2xl border border-stone-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-2">
        {/* Sidebar toggle (hexagon) */}
        <button
          onClick={onToggleSidebar}
          className={`group flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${
            sidebarVisible ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'
          }`}
          aria-label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          title="Toggle sidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-box-icon lucide-box"
          >
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="m3.3 7 8.7 5 8.7-5" />
            <path d="M12 22V12" />
          </svg>
        </button>

        <div className="h-px w-5 bg-stone-200 my-0.5" />

        {/* Select / Cursor (default) */}
        <button
          onClick={() => setActiveTool('select')}
          className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${
            activeTool === 'select' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'
          }`}
          aria-label="Select tool"
          title="Select (V)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 3l14 9-7 1-4 7z" />
          </svg>
        </button>

        {/* Text tool */}
        <button
          onClick={() => setActiveTool((prev) => (prev === 'text' ? 'select' : 'text'))}
          className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${
            activeTool === 'text' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'
          }`}
          aria-label="Text tool"
          title="Text (T)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
        </button>

        {/* Image upload */}
        <button
          onClick={() => imageInputRef.current?.click()}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-50 transition-colors"
          aria-label="Upload image"
          title="Image"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>

        {/* Cursor Chat — teardrop bubble shape, mirrors CursorChat avatar */}
        <button
          onClick={handleActivateCursorChat}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-50 transition-colors group/chat"          aria-label="Cursor Chat"
          title="Cursor Chat (C)"
        >
          <span
            className="flex items-center justify-center w-[22px] h-[22px] bg-stone-900 text-white transition-transform group-hover/chat:scale-105"
            style={{ borderRadius: '50% 50% 50% 4px' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </span>
        </button>
      </div>

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
          className="fixed z-50 min-w-[180px] bg-[#1C1C1E] rounded-2xl shadow-2xl py-2 animate-in fade-in-0 zoom-in-95 duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[13px] text-stone-200 hover:bg-white/10 transition-colors text-left"
            onClick={(e) => {
              e.stopPropagation();
              setCreateHtmlDialog({ screenX: contextMenu.x, screenY: contextMenu.y });
              setContextMenu(null);
              setNewHtmlPageName('');
              setCreateHtmlError('');
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-stone-500 shrink-0">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            Start Riffing
          </button>
          <button
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[13px] text-stone-200 hover:bg-white/10 transition-colors text-left"
            onClick={(e) => {
              e.stopPropagation();
              setCreatePageDialog({ screenX: contextMenu.x, screenY: contextMenu.y });
              setContextMenu(null);
              setNewPageDescription('');
              setCreatePageError('');
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-stone-500 shrink-0">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
            Create a new Page
          </button>
          {(contextMenu.nodeId || nodes.some((n) => n.selected)) && (
            <>
              <div className="my-1 mx-3 h-px bg-white/10" />
              <button
                className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[13px] text-stone-200 hover:bg-white/10 transition-colors text-left"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZOrder('front');
                  setContextMenu(null);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-stone-500 shrink-0">
                  <rect x="7" y="7" width="13" height="13" rx="2" />
                  <path d="M4 16V6a2 2 0 0 1 2-2h10" />
                </svg>
                Bring to Front
              </button>
              <button
                className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[13px] text-stone-200 hover:bg-white/10 transition-colors text-left"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZOrder('forward');
                  setContextMenu(null);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-stone-500 shrink-0">
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M4 14V6a2 2 0 0 1 2-2h8" />
                </svg>
                Bring Forward
              </button>
              <button
                className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[13px] text-stone-200 hover:bg-white/10 transition-colors text-left"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZOrder('backward');
                  setContextMenu(null);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-stone-500 shrink-0">
                  <rect x="4" y="4" width="11" height="11" rx="2" />
                  <path d="M20 10v8a2 2 0 0 1-2 2h-8" />
                </svg>
                Send Backward
              </button>
              <button
                className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[13px] text-stone-200 hover:bg-white/10 transition-colors text-left"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZOrder('back');
                  setContextMenu(null);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-stone-500 shrink-0">
                  <rect x="4" y="4" width="13" height="13" rx="2" />
                  <path d="M20 8v10a2 2 0 0 1-2 2H8" />
                </svg>
                Send to Back
              </button>
            </>
          )}
        </div>
      )}

      {/* Create new page dialog */}
      {createPageDialog && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-start"
          onClick={() => {
            if (creatingPage) return;
            setCreatePageDialog(null);
            setNewPageDescription('');
            setCreatePageError('');
          }}
        >
          <div
            className="bg-white rounded-2xl border border-stone-200 shadow-xl p-4 w-[360px] animate-in fade-in-0 zoom-in-95 duration-150"
            style={{ position: 'fixed', left: createPageDialog.screenX, top: createPageDialog.screenY }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[13px] font-semibold text-stone-800 mb-1">New Page</h3>
            <p className="text-[11px] text-stone-500 mb-3">Describe the page. The AI will pick a slug, scaffold it, and register it in the Pages section.</p>
            <textarea
              ref={newPageInputRef}
              rows={4}
              placeholder="A landing page for our pricing plans, with a 3-tier comparison table…"
              value={newPageDescription}
              onChange={(e) => { setNewPageDescription(e.target.value); setCreatePageError(''); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleCreatePage(); }
                if (e.key === 'Escape' && !creatingPage) { setCreatePageDialog(null); setNewPageDescription(''); setCreatePageError(''); }
              }}
              disabled={creatingPage}
              className="w-full px-3 py-2 text-[13px] bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-colors resize-none disabled:opacity-50"
            />
            {createPageError && (
              <p className="text-[11px] text-red-500 mt-1.5">{createPageError}</p>
            )}
            <div className="flex justify-between items-center gap-2 mt-3">
              <span className="text-[10px] text-stone-400">⌘↵ to submit</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setCreatePageDialog(null); setNewPageDescription(''); setCreatePageError(''); }}
                  disabled={creatingPage}
                  className="px-3 py-1.5 text-[12px] text-stone-500 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePage}
                  disabled={!newPageDescription.trim() || creatingPage}
                  className="px-3 py-1.5 text-[12px] bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {creatingPage ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
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
            <h3 className="text-[13px] font-semibold text-stone-800 mb-3">Name your Riff</h3>
            <input
              ref={newHtmlInputRef}
              type="text"
              placeholder="Enter the name"
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
