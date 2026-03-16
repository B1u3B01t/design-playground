import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ENABLED_MODELS_STORAGE_KEY, type ModelOption } from './constants';

interface ModelSettingsState {
  /** Model values that are enabled. Empty array = all models shown (default). */
  enabledModels: string[];
  toggleModel: (value: string) => void;
  setEnabledModels: (values: string[]) => void;
  resetToAll: () => void;
}

export const useModelSettingsStore = create<ModelSettingsState>()(
  persist(
    (set) => ({
      enabledModels: [],
      toggleModel: (value: string) =>
        set((state) => {
          const current = state.enabledModels;
          if (current.includes(value)) {
            // Don't allow removing the last model
            if (current.length <= 1) return state;
            return { enabledModels: current.filter((v) => v !== value) };
          }
          return { enabledModels: [...current, value] };
        }),
      setEnabledModels: (values: string[]) => set({ enabledModels: values }),
      resetToAll: () => set({ enabledModels: [] }),
    }),
    {
      name: ENABLED_MODELS_STORAGE_KEY,
    }
  )
);

/**
 * Filters a list of models to only those enabled in settings.
 * If no models are configured (empty array), returns all models.
 */
export function filterEnabledModels(allModels: ModelOption[]): ModelOption[] {
  const { enabledModels } = useModelSettingsStore.getState();
  if (enabledModels.length === 0) return allModels;
  return allModels.filter((m) => enabledModels.includes(m.value));
}
