/**
 * Flow-mode types. A flow is a sequence of stages a user moves through
 * (e.g. signup: account → verify email → choose plan → landed home). Stages
 * are rendered on the canvas as StageNodes and stitched together with edges.
 */

export interface FlowStage {
  /** Stable id within the flow, e.g. 'account' */
  id: string;
  /** Display label shown in StageNode header */
  label: string;
  /** Registry id of the component used to render this stage's preview.
   *  Must exist in the playground registry so iterations can target it. */
  componentId: string;
  /** Key used to look up seed mocks in the descriptor's seedMocks map */
  mockKey: string;
  /**
   * Synthetic stages are not part of the source page's codebase — they exist
   * only to give the simulator a destination/intermediate state to render.
   * Excluded from the Adopt diff generator.
   */
  synthetic?: boolean;
}

export interface FlowStageEdge {
  from: string;
  to: string;
}

export interface FlowDescriptor {
  /** Stable id of the flow, e.g. 'signup' */
  id: string;
  label: string;
  /** Route this flow corresponds to, e.g. '/signup' */
  sourceRoute: string;
  /** Files Adopt should target with the generated diff */
  sourceFiles: string[];
  stages: FlowStage[];
  defaultEdges: FlowStageEdge[];
  /** Seed mock data keyed by FlowStage.mockKey */
  seedMocks: Record<string, Record<string, unknown>>;
}

/**
 * Stage node data persisted on the XyFlow node. The `flowId` lets the
 * MockDataPanel and FlowSimulator find sibling stages on the same canvas.
 */
export interface StageNodeData {
  /** Instance id of the flow this stage belongs to (one canvas can host
   *  multiple flows of the same type). */
  flowId: string;
  /** Descriptor id, e.g. 'signup' */
  descriptorId: string;
  /** Stage id, matches FlowStage.id */
  stageId: string;
  /** Convenience copies for offline access without re-reading the descriptor */
  componentId: string;
  label: string;
  synthetic?: boolean;
  /** Stagger index for the expand-flow reveal animation (set on decompose) */
  revealIndex?: number;
}
