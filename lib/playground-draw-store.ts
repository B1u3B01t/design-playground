import { create } from 'zustand';
import type { DrawPenKind } from './draw-types';

export type DrawStrokeSelection =
  | { scope: 'canvas'; strokeId: string }
  | { scope: 'pdf'; nodeId: string; pageKey: string; strokeId: string };

interface PlaygroundDrawStore {
  /** True when the left-toolbar draw tool is active */
  drawToolActive: boolean;
  setDrawToolActive: (active: boolean) => void;
  /** True when the select tool is active (stroke picking enabled) */
  strokeSelectEnabled: boolean;
  setStrokeSelectEnabled: (enabled: boolean) => void;
  strokeSelection: DrawStrokeSelection | null;
  setStrokeSelection: (selection: DrawStrokeSelection | null) => void;
  drawPenKind: DrawPenKind;
  setDrawPenKind: (kind: DrawPenKind) => void;
}

export const usePlaygroundDrawStore = create<PlaygroundDrawStore>((set) => ({
  drawToolActive: false,
  setDrawToolActive: (active) => set({ drawToolActive: active }),
  strokeSelectEnabled: true,
  setStrokeSelectEnabled: (enabled) => set({ strokeSelectEnabled: enabled }),
  strokeSelection: null,
  setStrokeSelection: (selection) => set({ strokeSelection: selection }),
  drawPenKind: 'pen',
  setDrawPenKind: (kind) => set({ drawPenKind: kind }),
}));
