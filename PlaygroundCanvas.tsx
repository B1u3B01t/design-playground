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

import ComponentNode, { 
  GENERATION_START_EVENT, 
  GENERATION_COMPLETE_EVENT, 
  GENERATION_ERROR_EVENT,
  GenerationStartPayload,
  GenerationCompletePayload,
  GenerationErrorPayload,
} from './nodes/ComponentNode';
import IterationNode from './nodes/IterationNode';
import SkeletonIterationNode from './nodes/SkeletonIterationNode';
import { FULLSCREEN_NODE_EVENT, usePlaygroundContext } from './PlaygroundClient';

const nodeTypes = {
  component: ComponentNode,
  iteration: IterationNode,
  skeleton: SkeletonIterationNode,
};

const STORAGE_KEY = 'playground-canvas-state';
const POLL_INTERVAL = 10000; // Poll every 10 seconds when active
const POLL_DURATION = 120000; // Poll for 120 seconds after prompt copy (resets on each find)

interface IterationFile {
  filename: string;
  componentName: string;
  iterationNumber: number;
  parentId: string;
  mode: 'layout' | 'vibe' | 'unknown';
  description: string;
}

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  nodeIdCounter: number;
  knownIterations: string[]; // Track which iteration files we've seen
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

function saveCanvasState(nodes: Node[], edges: Edge[], counter: number, knownIterations: string[]) {
  if (typeof window === 'undefined') return;
  try {
    const state: CanvasState = { nodes, edges, nodeIdCounter: counter, knownIterations };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save canvas state:', e);
  }
}

let nodeIdCounter = 0;
const getNodeId = () => `node_${++nodeIdCounter}`;

// Custom events for triggering iteration scan
export const ITERATION_PROMPT_COPIED_EVENT = 'iteration-prompt-copied';
export const ITERATION_FETCH_EVENT = 'iteration-fetch-requested';

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
  const [isScanning, setIsScanning] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationInfo, setGenerationInfo] = useState<GenerationInfo | null>(null);
  const generationInfoRef = useRef<GenerationInfo | null>(null);
  const [lastGenerationDuration, setLastGenerationDuration] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('0m:00s');
  
  // Keep ref in sync with state
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
  
  // Fullscreen state from context
  const { fullscreenNodeId } = usePlaygroundContext();
  const isFullscreen = fullscreenNodeId !== null;
  
  if (initialState && !initialized.current) {
    nodeIdCounter = initialState.nodeIdCounter;
    initialized.current = true;
  }
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialState?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialState?.edges || []);
  const { screenToFlowPosition } = useReactFlow();

  // Save to localStorage whenever nodes or edges change
  useEffect(() => {
    saveCanvasState(nodes, edges, nodeIdCounter, knownIterations);
  }, [nodes, edges, knownIterations]);

  // Find parent node for a given component
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

    return nodes.find(node => {
      if (node.type !== 'component') return false;
      const componentId = node.data.componentId as string | undefined;
      if (!componentId) return false;
      // Check exact match first, then includes
      return possibleIds.some(id => componentId === id || componentId.includes(id));
    });
  }, [nodes]);

  // Calculate position for iteration node
  const calculateIterationPosition = useCallback((parentNode: Node, iterationNumber: number, totalIterations: number): { x: number; y: number } => {
    const parentX = parentNode.position.x;
    const parentY = parentNode.position.y;
    const spacing = 420; // Horizontal spacing between iterations
    const verticalOffset = 350; // Distance below parent
    
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

  // Scan for iterations (single check)
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
      
      // Find new iterations we haven't seen
      // Check both knownIterations and existing nodes to avoid duplicates
      const existingFilenames = new Set([
        ...knownIterations,
        ...nodes
          .filter(n => n.type === 'iteration' && n.data.filename)
          .map(n => n.data.filename as string)
      ]);
      
      console.log('[Playground] Known iterations:', Array.from(existingFilenames));
      
      const newIterations = iterations.filter(
        (iter: IterationFile) => !existingFilenames.has(iter.filename)
      );
      
      console.log('[Playground] New iterations to add:', newIterations);
      
      if (newIterations.length === 0) {
        console.log('[Playground] No new iterations to add');
        return;
      }
      
      // Group iterations by component name
      const iterationsByComponent = new Map<string, IterationFile[]>();
      for (const iter of iterations) {
        const existing = iterationsByComponent.get(iter.componentName) || [];
        existing.push(iter);
        iterationsByComponent.set(iter.componentName, existing);
      }
      
      // Create nodes and edges for new iterations
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];
      const newKnownFilenames: string[] = [];
      
      for (const iter of newIterations) {
        const parentNode = findParentNode(iter.componentName, iter.parentId);
        
        if (!parentNode) {
          console.log(`No parent node found for ${iter.componentName} (parentId: ${iter.parentId}). Available component nodes:`, 
            nodes.filter(n => n.type === 'component').map(n => n.data.componentId));
          continue;
        }
        
        const componentIterations = iterationsByComponent.get(iter.componentName) || [];
        const position = calculateIterationPosition(
          parentNode,
          iter.iterationNumber,
          componentIterations.length
        );
        
        const nodeId = getNodeId();
        
        newNodes.push({
          id: nodeId,
          type: 'iteration',
          position,
          data: {
            componentName: iter.componentName,
            iterationNumber: iter.iterationNumber,
            filename: iter.filename,
            mode: iter.mode,
            description: iter.description,
            parentNodeId: parentNode.id,
            onDelete: handleIterationDelete,
            onAdopt: handleIterationAdopt,
          },
        });
        
        newEdges.push({
          id: `edge_${parentNode.id}_${nodeId}`,
          source: parentNode.id,
          target: nodeId,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#9ca3af', strokeWidth: 1.5 },
        });
        
        newKnownFilenames.push(iter.filename);
      }
      
      if (newNodes.length > 0) {
        console.log(`[Playground] ✓ Adding ${newNodes.length} new iteration nodes to canvas`);
        setNodes(nds => [...nds, ...newNodes]);
        setEdges(eds => [...eds, ...newEdges]);
        setKnownIterations(prev => [...prev, ...newKnownFilenames]);
        
        // Reset timeout when iterations are found - gives more time for remaining ones
        if (resetTimeoutOnFind) {
          resetPollTimeout();
        }
      } else {
        console.log('[Playground] No new nodes to add (all filtered out)');
      }
    } catch (error) {
      console.error('Error scanning iterations:', error);
    } finally {
      setIsScanning(false);
    }
  }, [nodes, knownIterations, findParentNode, calculateIterationPosition, handleIterationDelete, handleIterationAdopt, setNodes, setEdges, resetPollTimeout]);

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
      
      // Find the parent node
      const parentNode = nodes.find(n => n.id === parentNodeId);
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
          style: { stroke: '#f59e0b', strokeWidth: 1.5, strokeDasharray: '5,5' },
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
        window.dispatchEvent(new CustomEvent('PLAYGROUND_AUTO_ARRANGE', { detail: { fitView: true } }));
      }, 100);
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
          window.dispatchEvent(new CustomEvent('PLAYGROUND_AUTO_ARRANGE', { detail: { fitView: true } }));
        }, 200);
      }, 1000);
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
    // Using ref for generationInfo so we don't need it in deps
  }, [nodes, calculateIterationPosition, setNodes, setEdges, scanForIterations]);

  // Handle fullscreen node events
  const { fitView } = useReactFlow();
  
  useEffect(() => {
    const handleFullscreen = (e: CustomEvent<{ nodeId: string | null; action: 'enter' | 'exit' }>) => {
      if (e.detail.action === 'enter' && e.detail.nodeId) {
        // Fit view to the specific node - fill as much screen as possible
        setTimeout(() => {
          fitView({
            nodes: [{ id: e.detail.nodeId! }],
            padding: 0.02, // Minimal padding for maximum size
            duration: 400,
            maxZoom: 2, // Allow zooming in more for better fit
            minZoom: 0.1,
          });
        }, 350); // Wait for sidebar animation to complete
      } else if (e.detail.action === 'exit') {
        // Fit view to all nodes when exiting
        setTimeout(() => {
          fitView({
            padding: 0.2,
            duration: 300,
          });
        }, 100);
      }
    };

    window.addEventListener(FULLSCREEN_NODE_EVENT, handleFullscreen as EventListener);
    return () => {
      window.removeEventListener(FULLSCREEN_NODE_EVENT, handleFullscreen as EventListener);
    };
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

      const componentId = event.dataTransfer.getData('application/x-playground-component');
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

  // Handle node deletion - also delete iteration file
  const onNodesDelete = useCallback(async (deletedNodes: Node[]) => {
    for (const node of deletedNodes) {
      if (node.type === 'iteration' && node.data.filename) {
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
  }, []);

  // Auto-arrange nodes: components on left, iterations on right
  // Groups component + its iterations together, then stacks groups vertically
  // Also handles skeleton nodes (treats them as iterations)
  const autoArrangeNodes = useCallback((andFitView: boolean = false) => {
    const componentNodes = nodes.filter(n => n.type === 'component');
    // Include both iteration and skeleton nodes as "iteration-like" nodes
    const iterationLikeNodes = nodes.filter(n => n.type === 'iteration' || n.type === 'skeleton');
    
    if (componentNodes.length === 0) return;

    const START_X = 50;
    const START_Y = 50;
    const VERTICAL_GAP = 60; // Gap between nodes within a group
    const GROUP_GAP = 100; // Extra gap between component groups
    const HORIZONTAL_GAP = 80; // Gap between component and iterations

    // Helper to get node dimensions (uses measured if available, else estimates)
    const getNodeSize = (node: Node): { width: number; height: number } => {
      const measured = node.measured;
      if (measured?.width && measured?.height) {
        return { width: measured.width, height: measured.height };
      }
      if (node.type === 'iteration' || node.type === 'skeleton') {
        return { width: 400, height: 300 };
      }
      return { width: 650, height: 450 };
    };

    // Find iterations (and skeletons) for a component
    const findIterationsForComponent = (componentNode: Node): Node[] => {
      const componentId = componentNode.data.componentId as string;
      return iterationLikeNodes.filter(iterNode => {
        const parentNodeId = iterNode.data.parentNodeId as string | undefined;
        if (parentNodeId === componentNode.id) return true;
        
        const iterComponentName = iterNode.data.componentName as string;
        const possibleIds = [
          iterComponentName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, ''),
          iterComponentName.toLowerCase(),
        ];
        return possibleIds.some(id => componentId?.includes(id));
      }).sort((a, b) => {
        const numA = (a.data.iterationNumber as number) || 0;
        const numB = (b.data.iterationNumber as number) || 0;
        return numA - numB;
      });
    };

    // First pass: calculate max component width for consistent iteration column
    let maxComponentWidth = 0;
    componentNodes.forEach((node) => {
      const size = getNodeSize(node);
      maxComponentWidth = Math.max(maxComponentWidth, size.width);
    });
    const iterationX = START_X + maxComponentWidth + HORIZONTAL_GAP;

    // Create position map
    const positionMap = new Map<string, { x: number; y: number }>();
    let currentGroupY = START_Y;

    // Process each component with its iterations as a group
    componentNodes.forEach((componentNode) => {
      const componentSize = getNodeSize(componentNode);
      const relatedIterations = findIterationsForComponent(componentNode);
      
      // Calculate total height needed for iterations
      let totalIterationsHeight = 0;
      relatedIterations.forEach((iterNode, idx) => {
        const size = getNodeSize(iterNode);
        totalIterationsHeight += size.height;
        if (idx < relatedIterations.length - 1) {
          totalIterationsHeight += VERTICAL_GAP;
        }
      });

      // The group height is the max of component height vs total iterations height
      const groupHeight = Math.max(componentSize.height, totalIterationsHeight);

      // Position component - vertically centered within group height
      const componentOffsetY = (groupHeight - componentSize.height) / 2;
      positionMap.set(componentNode.id, {
        x: START_X,
        y: currentGroupY + componentOffsetY,
      });

      // Position iterations - vertically centered within group height
      const iterationsOffsetY = (groupHeight - totalIterationsHeight) / 2;
      let iterY = currentGroupY + iterationsOffsetY;
      
      relatedIterations.forEach((iterNode) => {
        const size = getNodeSize(iterNode);
        positionMap.set(iterNode.id, {
          x: iterationX,
          y: iterY,
        });
        iterY += size.height + VERTICAL_GAP;
      });

      // Move to next group position
      currentGroupY += groupHeight + GROUP_GAP;
    });

    // Position any orphan iteration nodes (including skeletons)
    const positionedIds = new Set(positionMap.keys());
    const orphanIterations = iterationLikeNodes.filter(n => !positionedIds.has(n.id));
    
    if (orphanIterations.length > 0) {
      let orphanY = currentGroupY;
      orphanIterations.forEach((node) => {
        const size = getNodeSize(node);
        positionMap.set(node.id, {
          x: iterationX,
          y: orphanY,
        });
        orphanY += size.height + VERTICAL_GAP;
      });
    }

    // Update all nodes
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const newPosition = positionMap.get(node.id);
        if (newPosition) {
          return { ...node, position: newPosition };
        }
        return node;
      })
    );

    // Fit view to show all nodes if requested
    if (andFitView) {
      setTimeout(() => {
        fitView({
          padding: 0.15,
          duration: 400,
          maxZoom: 1,
        });
      }, 50); // Small delay to let node positions update
    }
  }, [nodes, setNodes, fitView]);

  // Handle auto-arrange event (triggered after skeleton nodes are added)
  useEffect(() => {
    const handleAutoArrange = (e: CustomEvent<{ fitView: boolean }>) => {
      autoArrangeNodes(e.detail.fitView);
    };

    window.addEventListener('PLAYGROUND_AUTO_ARRANGE', handleAutoArrange as EventListener);
    return () => {
      window.removeEventListener('PLAYGROUND_AUTO_ARRANGE', handleAutoArrange as EventListener);
    };
  }, [autoArrangeNodes]);

  // Clear all nodes and edges
  const clearAllNodes = useCallback(() => {
    if (window.confirm('Clear the canvas? This will remove all nodes.')) {
      // Stop polling first to prevent re-adding iterations
      stopPolling();
      
      setNodes([]);
      setEdges([]);
      
      // Also clear knownIterations so they can be re-fetched
      // when user drags the component back and scans
      setKnownIterations([]);
      
      // Also clear localStorage to prevent stale state on refresh
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [setNodes, setEdges, stopPolling]);

  return (
    <TooltipProvider>
      <div ref={reactFlowWrapper} className="w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodesDelete={onNodesDelete}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-50"
          proOptions={{ hideAttribution: true }}
          panOnScroll={!isFullscreen}
          zoomOnScroll={false}
          zoomOnPinch={!isFullscreen}
          panOnDrag={!isFullscreen}
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
                    onClick={autoArrangeNodes}
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
                    onClick={clearAllNodes}
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
                if (node.type === 'skeleton') return '#f59e0b'; // Amber for skeletons
                if (node.type === 'iteration') return '#6b7280'; // Gray for iterations
                return '#3b82f6'; // Blue for components
              }}
              maskColor="rgba(0, 0, 0, 0.08)"
            />
          )}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#d1d5db"
        />
      </ReactFlow>
    </div>
    </TooltipProvider>
  );
}
