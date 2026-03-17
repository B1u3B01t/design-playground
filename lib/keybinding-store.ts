import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { KEYBINDINGS_STORAGE_KEY } from './constants';
import type { KeyCombo, PlaygroundAction } from './keybindings';

interface KeybindingState {
  /** Only stores user overrides. Empty = all defaults. */
  overrides: Record<string, KeyCombo>;
  setKeybinding: (action: PlaygroundAction, combo: KeyCombo) => void;
  resetKeybinding: (action: PlaygroundAction) => void;
  resetAll: () => void;
}

export const useKeybindingStore = create<KeybindingState>()(
  persist(
    (set) => ({
      overrides: {},
      setKeybinding: (action: PlaygroundAction, combo: KeyCombo) =>
        set((state) => ({
          overrides: { ...state.overrides, [action]: combo },
        })),
      resetKeybinding: (action: PlaygroundAction) =>
        set((state) => {
          const { [action]: _, ...rest } = state.overrides;
          return { overrides: rest };
        }),
      resetAll: () => set({ overrides: {} }),
    }),
    {
      name: KEYBINDINGS_STORAGE_KEY,
    }
  )
);
