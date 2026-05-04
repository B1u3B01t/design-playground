import { create } from 'zustand';

interface InteractiveNodeState {
  interactiveNodeId: string | null;
  setInteractiveNodeId: (id: string | null) => void;
}

export const useInteractiveNodeStore = create<InteractiveNodeState>((set) => ({
  interactiveNodeId: null,
  setInteractiveNodeId: (id) => set({ interactiveNodeId: id }),
}));

export function useIsInteractiveNode(nodeId: string | null | undefined): boolean {
  return useInteractiveNodeStore((s) => !!nodeId && s.interactiveNodeId === nodeId);
}
