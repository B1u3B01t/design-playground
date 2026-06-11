"use client";

// Canvas flow-state source. Provides a unified { nodes, edges, setNodes, setEdges,
// onNodesChange, onEdgesChange } shape so the giant PlaygroundCanvas component doesn't care
// whether state is local (single-player) or synced via Liveblocks (multiplayer).
//
// Because hooks can't be called conditionally, the solo and multiplayer sources are two
// separate provider components; CanvasFlowProvider picks one based on the active session.

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import { useLiveblocksFlow } from "@liveblocks/react-flow";
import { useMultiplayer } from "./multiplayer-context";
import { loadCanvasState } from "./canvas-persistence";

export interface CanvasFlowState {
  nodes: Node[];
  edges: Edge[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange<Edge>;
  /** True while a multiplayer room's Storage is still loading; always false in single-player. */
  isLoading: boolean;
}

const CanvasFlowContext = createContext<CanvasFlowState | null>(null);

export function useCanvasFlow(): CanvasFlowState {
  const ctx = useContext(CanvasFlowContext);
  if (!ctx) throw new Error("useCanvasFlow must be used within <CanvasFlowProvider>");
  return ctx;
}

const EMPTY_NODES: Node[] = [];
const EMPTY_EDGES: Edge[] = [];

// Convert an imperative setState (full array) into React Flow change arrays by diffing on id.
function diffNodes(prev: Node[], next: Node[]): NodeChange<Node>[] {
  if (prev === next) return [];
  const prevById = new Map(prev.map((n) => [n.id, n]));
  const nextIds = new Set(next.map((n) => n.id));
  const changes: NodeChange<Node>[] = [];
  for (const n of prev) if (!nextIds.has(n.id)) changes.push({ type: "remove", id: n.id });
  for (const n of next) {
    const before = prevById.get(n.id);
    if (!before) changes.push({ type: "add", item: n });
    else if (before !== n) changes.push({ type: "replace", id: n.id, item: n });
  }
  return changes;
}

function diffEdges(prev: Edge[], next: Edge[]): EdgeChange<Edge>[] {
  if (prev === next) return [];
  const prevById = new Map(prev.map((e) => [e.id, e]));
  const nextIds = new Set(next.map((e) => e.id));
  const changes: EdgeChange<Edge>[] = [];
  for (const e of prev) if (!nextIds.has(e.id)) changes.push({ type: "remove", id: e.id });
  for (const e of next) {
    const before = prevById.get(e.id);
    if (!before) changes.push({ type: "add", item: e });
    else if (before !== e) changes.push({ type: "replace", id: e.id, item: e });
  }
  return changes;
}

/** Single-player: classic local React Flow state seeded from localStorage (unchanged behavior). */
function SoloFlowProvider({ children, storageKey }: { children: ReactNode; storageKey?: string }) {
  const [initial] = useState(() => loadCanvasState(storageKey));
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initial?.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial?.edges ?? []);
  const value: CanvasFlowState = {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    isLoading: false,
  };
  return <CanvasFlowContext.Provider value={value}>{children}</CanvasFlowContext.Provider>;
}

/**
 * Multiplayer: nodes/edges live in Liveblocks Storage (the "flow" key, managed by
 * useLiveblocksFlow). We expose setNodes/setEdges shims that diff against the current state
 * and emit React Flow change arrays through the synced handlers, so the canvas's existing
 * imperative `setNodes(...)` call sites keep working unchanged. Native drag/select interactions
 * wire straight to onNodesChange on <ReactFlow> and never touch the shim.
 */
function MultiplayerFlowProvider({
  children,
  storageKey,
}: {
  children: ReactNode;
  storageKey?: string;
}) {
  // Seed new Liveblocks rooms from local canvas so starting a session doesn't wipe progress.
  // Frozen on first render — useLiveblocksFlow only reads `initial` when storage is first created.
  const flowOptionsRef = useRef<{
    nodes?: { initial: Node[] };
    edges?: { initial: Edge[] };
  } | null>(null);
  if (flowOptionsRef.current === null) {
    const local = loadCanvasState(storageKey);
    flowOptionsRef.current =
      local?.nodes?.length
        ? {
            nodes: { initial: local.nodes },
            ...(local.edges?.length ? { edges: { initial: local.edges } } : {}),
          }
        : {};
  }

  const flow = useLiveblocksFlow<Node, Edge>(flowOptionsRef.current);
  const nodes = flow.nodes ?? EMPTY_NODES;
  const edges = flow.edges ?? EMPTY_EDGES;

  // Mirrors track the authoritative state and also compose synchronously across back-to-back
  // setter calls within one tick (Storage writes are async, so flow.nodes won't update yet).
  const nodesMirror = useRef<Node[]>(nodes);
  nodesMirror.current = nodes;
  const edgesMirror = useRef<Edge[]>(edges);
  edgesMirror.current = edges;

  // Keep the latest synced handlers in refs so the exposed callbacks stay stable across renders.
  const onNodesChangeRef = useRef(flow.onNodesChange);
  onNodesChangeRef.current = flow.onNodesChange;
  const onEdgesChangeRef = useRef(flow.onEdgesChange);
  onEdgesChangeRef.current = flow.onEdgesChange;
  const onDeleteRef = useRef(flow.onDelete);
  onDeleteRef.current = flow.onDelete;

  // IMPORTANT: useLiveblocksFlow's change appliers intentionally IGNORE "remove" changes —
  // node/edge removal only happens through its atomic onDelete. So every change list is split:
  // adds/moves/selects go to onNodesChange/onEdgesChange, and removals are routed to onDelete.
  // Without this, deleting a node (button, Delete key, or clear-all) silently does nothing.
  const onNodesChange = useCallback<OnNodesChange<Node>>((changes) => {
    const removeIds = new Set<string>();
    const rest: NodeChange<Node>[] = [];
    for (const c of changes) {
      if (c.type === "remove") removeIds.add(c.id);
      else rest.push(c);
    }
    if (rest.length) onNodesChangeRef.current(rest);
    if (removeIds.size) {
      onDeleteRef.current({
        nodes: nodesMirror.current.filter((n) => removeIds.has(n.id)),
        edges: []
      });
    }
  }, []);

  const onEdgesChange = useCallback<OnEdgesChange<Edge>>((changes) => {
    const removeIds = new Set<string>();
    const rest: EdgeChange<Edge>[] = [];
    for (const c of changes) {
      if (c.type === "remove") removeIds.add(c.id);
      else rest.push(c);
    }
    if (rest.length) onEdgesChangeRef.current(rest);
    if (removeIds.size) {
      onDeleteRef.current({
        nodes: [],
        edges: edgesMirror.current.filter((e) => removeIds.has(e.id))
      });
    }
  }, []);

  const setNodes = useCallback<Dispatch<SetStateAction<Node[]>>>((arg) => {
    const prev = nodesMirror.current;
    const next = typeof arg === "function" ? (arg as (p: Node[]) => Node[])(prev) : arg;
    nodesMirror.current = next;
    const nextIds = new Set(next.map((n) => n.id));
    const removed = prev.filter((n) => !nextIds.has(n.id));
    const upserts = diffNodes(prev, next).filter((c) => c.type !== "remove");
    if (upserts.length) onNodesChangeRef.current(upserts);
    if (removed.length) onDeleteRef.current({ nodes: removed, edges: [] });
  }, []);

  const setEdges = useCallback<Dispatch<SetStateAction<Edge[]>>>((arg) => {
    const prev = edgesMirror.current;
    const next = typeof arg === "function" ? (arg as (p: Edge[]) => Edge[])(prev) : arg;
    edgesMirror.current = next;
    const nextIds = new Set(next.map((e) => e.id));
    const removed = prev.filter((e) => !nextIds.has(e.id));
    const upserts = diffEdges(prev, next).filter((c) => c.type !== "remove");
    if (upserts.length) onEdgesChangeRef.current(upserts);
    if (removed.length) onDeleteRef.current({ nodes: [], edges: removed });
  }, []);

  const value: CanvasFlowState = {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    isLoading: flow.isLoading
  };
  return <CanvasFlowContext.Provider value={value}>{children}</CanvasFlowContext.Provider>;
}

/** Picks the solo or multiplayer flow source based on the active session. */
export function CanvasFlowProvider({
  children,
  storageKey,
}: {
  children: ReactNode;
  /** Project-scoped localStorage key for single-player persistence. */
  storageKey?: string;
}) {
  const { enabled } = useMultiplayer();
  return enabled ? (
    <MultiplayerFlowProvider storageKey={storageKey}>{children}</MultiplayerFlowProvider>
  ) : (
    <SoloFlowProvider storageKey={storageKey}>{children}</SoloFlowProvider>
  );
}
