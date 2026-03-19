import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  ENABLED_MODELS_STORAGE_KEY,
  MODELS_STORAGE_KEY,
  FALLBACK_MODELS,
  DEFAULT_ENABLED_MODELS,
  type ModelOption,
} from './constants';

interface ModelSettingsState {
  /** Model values that are enabled. Empty array = all models shown (default). */
  enabledModels: string[];
  toggleModel: (value: string) => void;
  setEnabledModels: (values: string[]) => void;
  resetToAll: () => void;

  /** All available models fetched from the API */
  availableModels: ModelOption[];
  /** Whether the initial fetch has completed (prevents re-fetching on every hook mount) */
  hasFetched: boolean;
  /** Whether a fetch is currently in progress */
  isLoadingModels: boolean;
  /** Fetch models from API. Called once on init and on explicit user refresh. */
  fetchModels: () => Promise<void>;
}

export const useModelSettingsStore = create<ModelSettingsState>()(
  persist(
    (set, get) => ({
      enabledModels: DEFAULT_ENABLED_MODELS,
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
      resetToAll: () => set({ enabledModels: DEFAULT_ENABLED_MODELS }),

      availableModels: FALLBACK_MODELS,
      hasFetched: false,
      isLoadingModels: false,
      fetchModels: async () => {
        // Prevent concurrent fetches
        if (get().isLoadingModels) return;
        set({ isLoadingModels: true });
        try {
          const response = await fetch('/playground/api/models');
          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(data?.error || 'Failed to fetch models');
          }
          if (Array.isArray(data.models) && data.models.length > 0) {
            set({ availableModels: data.models, hasFetched: true });
          } else {
            throw new Error('No models returned from API');
          }
        } catch (error) {
          console.error('[Models] Failed to fetch models:', error);
          // Keep existing availableModels (persisted from localStorage or fallback)
          set({ hasFetched: true });
        } finally {
          set({ isLoadingModels: false });
        }
      },
    }),
    {
      name: ENABLED_MODELS_STORAGE_KEY,
      partialize: (state) => ({
        enabledModels: state.enabledModels,
        availableModels: state.availableModels,
      }),
    }
  )
);

/**
 * Filters a list of models to only those enabled in settings.
 * If no models are configured (empty array), returns all models.
 */
export function filterEnabledModels(allModels: ModelOption[]): ModelOption[] {
  const { enabledModels } = useModelSettingsStore.getState();
  if (enabledModels.length === 0) {
    return allModels.filter((m) => DEFAULT_ENABLED_MODELS.includes(m.value));
  }
  return allModels.filter((m) => enabledModels.includes(m.value));
}
