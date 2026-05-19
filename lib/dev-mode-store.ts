import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEV_MODE_STORAGE_KEY } from './constants';

interface DevModeState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}

export const useDevModeStore = create<DevModeState>()(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (enabled: boolean) => set({ enabled }),
      toggle: () => set((state) => ({ enabled: !state.enabled })),
    }),
    {
      name: DEV_MODE_STORAGE_KEY,
    }
  )
);
