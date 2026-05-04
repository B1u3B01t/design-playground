import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DesignSystemState {
  hasHydrated: boolean;
  /** When true, DESIGN.md tokens are prepended to generation prompts. */
  injectIntoGeneration: boolean;
  setInjectIntoGeneration: (value: boolean) => void;
}

const STORE_KEY = 'playground-design-system-v1';

export const useDesignSystemStore = create<DesignSystemState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      injectIntoGeneration: false,
      setInjectIntoGeneration: (value) => set({ injectIntoGeneration: value }),
    }),
    {
      name: STORE_KEY,
      version: 1,
      onRehydrateStorage: () => () => {
        useDesignSystemStore.setState({ hasHydrated: true });
      },
      partialize: (state) => ({
        injectIntoGeneration: state.injectIntoGeneration,
      }),
    },
  ),
);
