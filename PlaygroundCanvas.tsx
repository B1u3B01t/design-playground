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
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { RefreshCw, LayoutGrid, Eraser, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import {
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  FULLSCREEN_NODE_EVENT,
  PLAYGROUND_AUTO_ARRANGE_EVENT,
  STORAGE_KEY,
  POLL_INTERVAL,
  POLL_DURATION,
  ITERATION_HORIZONTAL_SPACING,
  ITERATION_VERTICAL_OFFSET,
  ARRANGE_START_X,
  ARRANGE_START_Y,
  ARRANGE_VERTICAL_GAP,
  ARRANGE_GROUP_GAP,
  DEFAULT_ITERATION_NODE_WIDTH,
  DEFAULT_ITERATION_NODE_HEIGHT,
  DEFAULT_COMPONENT_NODE_WIDTH,
  DEFAULT_COMPONENT_NODE_HEIGHT,
  ITERATION_EDGE_STYLE,
  SKELETON_EDGE_STYLE,
  FITVIEW_FULLSCREEN_ENTER,
  FITVIEW_FULLSCREEN_EXIT,
  FITVIEW_AFTER_ARRANGE,
  FULLSCREEN_ENTER_DELAY,
  FULLSCREEN_EXIT_DELAY,
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
  TREE_COLUMN_WIDTH,
  type GenerationStartPayload,
  type GenerationCompletePayload,
  type GenerationErrorPayload,
} from './lib/constants';

const nodeTypes = {
  component: ComponentNode,
  iteration: IterationNode,
  skeleton: SkeletonIterationNode,
};

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
      return JSON.parse(stored);
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
  const [generationInfo, setGenerationInfo] = useState<GenerationInfo | null>(null);
  const generationInfoRef = useRef<GenerationInfo | null>(null);
  const [lastGenerationDuration, setLastGenerationDuration] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('0m:00s');
  
  // Keep refs in sync with state
  useEffect(() => {
    generationInfoRef.current = generationInfo;
  }, [generationInfo]);
  
  // Running timer during generation
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
    
    return () => clearInterval(intervalId);
  }, [isGenerating, generationInfo?.startTime]);
  
  // Fullscreen is now handled via a separate route in a new tab
  const isFullscreen = false;
  if (initialState && !initialized.current) {
    nodeIdCounterRef.current = initialState.nodeIdCounter;
    initialized.current = true;
  }
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialState?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialState?.edges || []);
  const { screenToFlowPosition, fitView } = useReactFlow();

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
    const spacing = ITERATION_HORIZONTAL_SPACING;
    const verticalOffset = ITERATION_VERTICAL_OFFSET;
    
    // Center the iterations below the parent
    const totalWidth = (totalIterations - 1) * spacing;
    const startX = parentX - totalWidth / 2;
    
    return {
      x: startX + (iterationNumber - 1) * spacing,
      y: parentY + verticalOffset,
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
      console.log('[Playground] Scanning for iterations...');
      const response = await fetch('/playground/api/iterations');
      if (!response.ok) {
        console.error('[Playground] Failed to fetch iterations:', response.status);
        return;
      }
      
      const { iterations } = await response.json() as { iterations: IterationFile[] };
      console.log('[Playground] Found iterations from API:', iterations);
      
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
        console.log('[Playground] No new iterations to add');
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
          console.log(`[Playground] No parent found for ${iter.filename} (source: ${iter.sourceIteration}, parentId: ${iter.parentId})`);
          continue;
        }
        
        // Position temporarily -- auto-arrange will fix positions
        const sourceNode = nodesRef.current.find(n => n.id === sourceNodeId) || newNodes.find(n => n.id === sourceNodeId);
        const position = sourceNode
          ? { x: sourceNode.position.x + ITERATION_HORIZONTAL_SPACING, y: sourceNode.position.y }
          : { x: 400, y: 200 };
        
        const nodeId = getNodeId();
        pendingNodesByFilename.set(iter.filename, nodeId);
        
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
        console.log(`[Playground] Adding ${newNodes.length} new iteration nodes to canvas`);
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
    const handleGenerationStart = (e: CustomEvent<GenerationStartPayload>) => {
      const { componentId, componentName, parentNodeId, iterationCount } = e.detail;
      
      console.log('[Playground] Generation started:', { componentId, componentName, iterationCount });
      
      // Find the parent node (use ref for current nodes)
      const parentNode = nodesRef.current.find(n => n.id === parentNodeId);
      if (!parentNode) {
        console.error('[Playground] Parent node not found:', parentNodeId);
        return;
      }

      // Create skeleton nodes
      const skeletonNodes: Node[] = [];
      const skeletonEdges: Edge[] = [];
      const skeletonNodeIds: string[] = [];

      for (let i = 1; i <= iterationCount; i++) {
        const position = calculateIterationPosition(parentNode, i, iterationCount);
        const nodeId = getNodeId();
        skeletonNodeIds.push(nodeId);

        skeletonNodes.push({
          id: nodeId,
          type: 'skeleton',
          position,
          data: {
            iterationNumber: i,
            componentName,
            parentNodeId, // Include parentNodeId for auto-arrange grouping
            totalIterations: iterationCount,
          },
        });

        skeletonEdges.push({
          id: `edge_${parentNodeId}_${nodeId}`,
          source: parentNodeId,
          target: nodeId,
          type: 'smoothstep',
          animated: true, // Animated edges for skeleton nodes
          style: SKELETON_EDGE_STYLE,
        });
      }

      // Add skeleton nodes to canvas
      setNodes(nds => [...nds, ...skeletonNodes]);
      setEdges(eds => [...eds, ...skeletonEdges]);

      // Update generation state
      setIsGenerating(true);
      setLastGenerationDuration(null); // Clear previous duration
      setGenerationInfo({
        componentId,
        componentName,
        parentNodeId,
        iterationCount,
        skeletonNodeIds,
        startTime: Date.now(),
      });

      // Auto-arrange nodes after skeleton nodes are added (with small delay for state update)
      // We need to trigger this after React processes the state update
      setTimeout(() => {
        // Dispatch a custom event to trigger auto-arrange with fitView
        window.dispatchEvent(new CustomEvent(PLAYGROUND_AUTO_ARRANGE_EVENT, { detail: { fitView: true } }));
      }, SKELETON_ARRANGE_DELAY);
    };

    const handleGenerationComplete = (e: CustomEvent<GenerationCompletePayload>) => {
      console.log('[Playground] Generation completed:', e.detail);
      
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
        console.log('[Playground] Generation took:', formatted);
      }
      
      // Remove skeleton nodes
      if (info) {
        console.log('[Playground] Removing skeleton nodes:', info.skeletonNodeIds);
        setNodes(nds => nds.filter(n => !info.skeletonNodeIds.includes(n.id)));
        setEdges(eds => eds.filter(e => !info.skeletonNodeIds.some(id => e.target === id)));
      }

      // Reset generation state
      setIsGenerating(false);
      setGenerationInfo(null);

      // Trigger iteration scan to fetch newly created iterations
      // Small delay to allow filesystem to sync
      setTimeout(() => {
        scanForIterations(false);
        // Auto-arrange after new iterations are added
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent(PLAYGROUND_AUTO_ARRANGE_EVENT, { detail: { fitView: true } }));
        }, POST_GENERATION_ARRANGE_DELAY);
      }, POST_GENERATION_SCAN_DELAY);
    };

    const handleGenerationError = (e: CustomEvent<GenerationErrorPayload>) => {
      const detail = e.detail || {};
      const errorMessage = detail.error || 'Unknown error occurred';
      const componentId = detail.componentId || 'unknown';
      const parentNodeId = detail.parentNodeId || 'unknown';
      
      console.error('[Playground] Generation error:', {
        error: errorMessage,
        componentId,
        parentNodeId,
        fullDetail: detail,
      });
      
      // Use ref to get latest generation info
      const info = generationInfoRef.current;
      
      // Remove skeleton nodes
      if (info) {
        console.log('[Playground] Removing skeleton nodes (error):', info.skeletonNodeIds);
        setNodes(nds => nds.filter(n => !info.skeletonNodeIds.includes(n.id)));
        setEdges(eds => eds.filter(e => !info.skeletonNodeIds.some(id => e.target === id)));
      }

      // Reset generation state
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
  }, [calculateIterationPosition, getNodeId, setNodes, setEdges, scanForIterations]);

  // Fullscreen fitView behavior is no longer used; nodes open in a new tab instead

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
    [screenToFlowPosition, setNodes]
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

  // Clear all nodes and edges (called after AlertDialog confirmation)
  const confirmClearAllNodes = useCallback(() => {
    stopPolling();
    
    setNodes([]);
    setEdges([]);
    setKnownIterations([]);
    setCollapsedNodeIds(new Set());
    
    localStorage.removeItem(STORAGE_KEY);
    
    setShowClearDialog(false);
  }, [setNodes, setEdges, stopPolling]);

  return (
    <TooltipProvider>
      <div ref={reactFlowWrapper} className="w-full h-full">
        <ReactFlow
          nodes={visibleNodes}
          edges={visibleEdges}
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
          panOnScroll={!isFullscreen}
          zoomOnScroll={false}
          zoomOnPinch={!isFullscreen}
          panOnDrag={false}
          selectionOnDrag={!isFullscreen}
          selectionMode="partial"
          nodesDraggable={!isFullscreen}
          nodesConnectable={!isFullscreen}
          elementsSelectable={!isFullscreen}
        >
          {/* Hide controls in fullscreen mode */}
          {!isFullscreen && (
            <Panel position="top-right" className="flex items-center gap-2">
              {/* Generation status indicator with running timer */}
              {isGenerating && generationInfo && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-medium">
                    Generating {generationInfo.iterationCount} iterations for {generationInfo.componentName}...
                  </span>
                  <span className="text-xs text-amber-500 font-mono">
                    {elapsedTime}
                  </span>
                </div>
              )}
              {/* Last generation duration */}
              {!isGenerating && lastGenerationDuration && (
                <span className="text-xs text-gray-400 font-mono">
                  {lastGenerationDuration}
                </span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => autoArrangeNodes()}
                    className="p-2 rounded-lg border bg-white border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Auto-arrange nodes: components left, iterations right</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => scanForIterations(false)}
                    disabled={isScanning}
                    className={`p-2 rounded-lg border transition-colors ${
                      isPolling 
                        ? 'bg-amber-50 border-amber-200 text-amber-700' 
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    } disabled:opacity-50`}
                  >
                    <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isPolling ? 'Auto-scanning for 120s (resets on find)' : 'Scan for new iterations'}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowClearDialog(true)}
                    className="p-2 rounded-lg border bg-white border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Eraser className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Clear canvas</p>
                </TooltipContent>
              </Tooltip>
            </Panel>
          )}
          {!isFullscreen && (
            <Controls
              className="!bg-white !border-gray-200 !rounded-lg !shadow-sm [&>button]:!bg-white [&>button]:!border-gray-200 [&>button]:!text-gray-600 [&>button:hover]:!bg-gray-50"
            />
          )}
          {!isFullscreen && (
            <MiniMap
              className="!bg-white !border-gray-200 !rounded-lg !shadow-sm"
              nodeColor={(node) => {
                if (node.type === 'skeleton') return MINIMAP_SKELETON_COLOR;
                if (node.type === 'iteration') return MINIMAP_ITERATION_COLOR;
                return MINIMAP_COMPONENT_COLOR;
              }}
              maskColor={MINIMAP_MASK_COLOR}
            />
          )}
        <Background
          variant={BackgroundVariant.Dots}
          gap={BACKGROUND_GAP}
          size={BACKGROUND_DOT_SIZE}
          color={BACKGROUND_COLOR}
        />
      </ReactFlow>

      {/* Clear canvas confirmation dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the canvas?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all component and iteration nodes from the canvas. Iteration files on disk will not be deleted.
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
            <AlertDialogTitle>Delete iteration with children?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteDialogNode?.data.filename as string}</strong> has child iterations. Choose how to handle them:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteWithMode('reparent')}
              className="bg-blue-600 hover:bg-blue-700 focus:ring-blue-600"
            >
              Keep children (reparent)
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => handleDeleteWithMode('cascade')}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete all descendants
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}
