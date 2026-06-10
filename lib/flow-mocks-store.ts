import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Per-flow state on the canvas:
 *  - Which descriptor it was spawned from
 *  - Per-stage mock props (the editable seed values shown in MockDataPanel)
 *  - Per-stage canonical iteration filename (chosen variant for Combine / Adopt)
 *
 * Keyed by a flow instance id — one canvas can host multiple flows of the
 * same descriptor, so the id is independent of the descriptor id.
 */

export interface FlowInstance {
  descriptorId: string;
  /** Mock props per stage, keyed by stage id. Merged on top of seedMocks. */
  stageMocks: Record<string, Record<string, unknown>>;
  /** Iteration filename per stage (e.g. 'SignupForm.iteration-3.tsx') */
  canonicalIterationByStage: Record<string, string>;
  /** Stage node ids on the canvas, keyed by stage id — used by simulator */
  stageNodeIds: Record<string, string>;
}

interface FlowMocksState {
  flows: Record<string, FlowInstance>;
  addFlow: (
    flowId: string,
    descriptorId: string,
    stageNodeIds: Record<string, string>,
    seedMocks: Record<string, Record<string, unknown>>,
  ) => void;
  removeFlow: (flowId: string) => void;
  setStageMock: (
    flowId: string,
    stageId: string,
    patch: Record<string, unknown>,
  ) => void;
  setCanonical: (
    flowId: string,
    stageId: string,
    iterationFilename: string | null,
  ) => void;
  setStageNodeIds: (
    flowId: string,
    stageNodeIds: Record<string, string>,
  ) => void;
}

export const useFlowMocksStore = create<FlowMocksState>()(
  persist(
    (set) => ({
      flows: {},
      addFlow: (flowId, descriptorId, stageNodeIds, seedMocks) =>
        set((state) => {
          if (state.flows[flowId]) return state;
          return {
            flows: {
              ...state.flows,
              [flowId]: {
                descriptorId,
                stageMocks: Object.fromEntries(
                  Object.entries(seedMocks).map(([k, v]) => [k, { ...v }]),
                ),
                canonicalIterationByStage: {},
                stageNodeIds,
              },
            },
          };
        }),
      removeFlow: (flowId) =>
        set((state) => {
          const next = { ...state.flows };
          delete next[flowId];
          return { flows: next };
        }),
      setStageMock: (flowId, stageId, patch) =>
        set((state) => {
          const flow = state.flows[flowId];
          if (!flow) return state;
          return {
            flows: {
              ...state.flows,
              [flowId]: {
                ...flow,
                stageMocks: {
                  ...flow.stageMocks,
                  [stageId]: { ...flow.stageMocks[stageId], ...patch },
                },
              },
            },
          };
        }),
      setCanonical: (flowId, stageId, iterationFilename) =>
        set((state) => {
          const flow = state.flows[flowId];
          if (!flow) return state;
          const next = { ...flow.canonicalIterationByStage };
          if (iterationFilename) next[stageId] = iterationFilename;
          else delete next[stageId];
          return {
            flows: {
              ...state.flows,
              [flowId]: { ...flow, canonicalIterationByStage: next },
            },
          };
        }),
      setStageNodeIds: (flowId, stageNodeIds) =>
        set((state) => {
          const flow = state.flows[flowId];
          if (!flow) return state;
          return {
            flows: {
              ...state.flows,
              [flowId]: { ...flow, stageNodeIds },
            },
          };
        }),
    }),
    { name: 'playground-flow-mocks' },
  ),
);
