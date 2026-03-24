import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProviderId, ClaudeCodeOptions } from './providers/types';
import { DEFAULT_CLAUDE_CODE_OPTIONS } from './providers/types';
import { getProvider, DEFAULT_PROVIDER_ID, getAllProviderIds } from './providers/registry';
import type { ModelOption } from './constants';

// ---------------------------------------------------------------------------
// Per-Provider State
// ---------------------------------------------------------------------------

interface PerProviderState {
  enabledModels: string[];
  availableModels: ModelOption[];
  hasFetched: boolean;
}

function makeDefaultProviderState(providerId: ProviderId): PerProviderState {
  const config = getProvider(providerId);
  return {
    enabledModels: config.defaultEnabledModels,
    availableModels: config.fallbackModels,
    hasFetched: false,
  };
}

function makeDefaultProviderStates(): Record<ProviderId, PerProviderState> {
  const states = {} as Record<ProviderId, PerProviderState>;
  for (const id of getAllProviderIds()) {
    states[id] = makeDefaultProviderState(id);
  }
  return states;
}

// ---------------------------------------------------------------------------
// Store Interface
// ---------------------------------------------------------------------------

interface ModelSettingsState {
  // Provider selection
  activeProvider: ProviderId;
  setActiveProvider: (id: ProviderId) => void;

  // Per-provider model state
  providerState: Record<ProviderId, PerProviderState>;

  // Convenience getters scoped to activeProvider
  readonly enabledModels: string[];
  readonly availableModels: ModelOption[];

  // Loading state (shared — only one fetch at a time)
  isLoadingModels: boolean;

  // Actions (operate on activeProvider)
  toggleModel: (value: string) => void;
  setEnabledModels: (values: string[]) => void;
  resetToAll: () => void;
  fetchModels: () => Promise<void>;

  // Claude Code-specific options
  claudeCodeOptions: ClaudeCodeOptions;
  setClaudeCodeOptions: (opts: Partial<ClaudeCodeOptions>) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const STORE_KEY = 'playground-model-settings-v2';

export const useModelSettingsStore = create<ModelSettingsState>()(
  persist(
    (set, get) => ({
      activeProvider: DEFAULT_PROVIDER_ID,

      setActiveProvider: (id: ProviderId) => {
        set({ activeProvider: id });
        // Auto-fetch models for the new provider if not yet fetched
        const providerState = get().providerState[id];
        if (!providerState?.hasFetched) {
          get().fetchModels();
        }
      },

      providerState: makeDefaultProviderStates(),

      // Convenience getters
      get enabledModels() {
        const state = get();
        return state.providerState[state.activeProvider]?.enabledModels ?? [];
      },
      get availableModels() {
        const state = get();
        return state.providerState[state.activeProvider]?.availableModels ?? [];
      },

      isLoadingModels: false,

      toggleModel: (value: string) =>
        set((state) => {
          const ps = state.providerState[state.activeProvider];
          const current = ps.enabledModels;
          let next: string[];
          if (current.includes(value)) {
            if (current.length <= 1) return state; // keep at least 1
            next = current.filter((v) => v !== value);
          } else {
            next = [...current, value];
          }
          return {
            providerState: {
              ...state.providerState,
              [state.activeProvider]: { ...ps, enabledModels: next },
            },
          };
        }),

      setEnabledModels: (values: string[]) =>
        set((state) => ({
          providerState: {
            ...state.providerState,
            [state.activeProvider]: {
              ...state.providerState[state.activeProvider],
              enabledModels: values,
            },
          },
        })),

      resetToAll: () =>
        set((state) => {
          const config = getProvider(state.activeProvider);
          return {
            providerState: {
              ...state.providerState,
              [state.activeProvider]: {
                ...state.providerState[state.activeProvider],
                enabledModels: config.defaultEnabledModels,
              },
            },
          };
        }),

      fetchModels: async () => {
        if (get().isLoadingModels) return;
        set({ isLoadingModels: true });
        const { activeProvider } = get();
        try {
          const response = await fetch(`/playground/api/models?provider=${activeProvider}`);
          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(data?.error || 'Failed to fetch models');
          }
          if (Array.isArray(data.models) && data.models.length > 0) {
            set((state) => ({
              providerState: {
                ...state.providerState,
                [activeProvider]: {
                  ...state.providerState[activeProvider],
                  availableModels: data.models,
                  hasFetched: true,
                },
              },
            }));
          } else {
            throw new Error('No models returned from API');
          }
        } catch (error) {
          console.error('[Models] Failed to fetch models:', error);
          // Keep existing availableModels — mark as fetched to avoid retries
          set((state) => ({
            providerState: {
              ...state.providerState,
              [activeProvider]: {
                ...state.providerState[activeProvider],
                hasFetched: true,
              },
            },
          }));
        } finally {
          set({ isLoadingModels: false });
        }
      },

      // Claude Code options
      claudeCodeOptions: DEFAULT_CLAUDE_CODE_OPTIONS,
      setClaudeCodeOptions: (opts: Partial<ClaudeCodeOptions>) =>
        set((state) => ({
          claudeCodeOptions: { ...state.claudeCodeOptions, ...opts },
        })),
    }),
    {
      name: STORE_KEY,
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        // v0 → v1: migrate from flat shape to provider-scoped
        if (version === 0 && persisted && typeof persisted === 'object') {
          const old = persisted as {
            enabledModels?: string[];
            availableModels?: ModelOption[];
          };
          const defaultStates = makeDefaultProviderStates();
          return {
            activeProvider: DEFAULT_PROVIDER_ID,
            providerState: {
              ...defaultStates,
              cursor: {
                enabledModels: old.enabledModels ?? defaultStates.cursor.enabledModels,
                availableModels: old.availableModels ?? defaultStates.cursor.availableModels,
                hasFetched: false,
              },
            },
            claudeCodeOptions: DEFAULT_CLAUDE_CODE_OPTIONS,
          };
        }
        return persisted as ModelSettingsState;
      },
      partialize: (state) => ({
        activeProvider: state.activeProvider,
        providerState: state.providerState,
        claudeCodeOptions: state.claudeCodeOptions,
      }),
    },
  ),
);

/**
 * Filters a list of models to only those enabled in settings.
 * Uses the active provider's enabled models.
 */
export function filterEnabledModels(allModels: ModelOption[]): ModelOption[] {
  const state = useModelSettingsStore.getState();
  const ps = state.providerState[state.activeProvider];
  const enabledModels = ps?.enabledModels ?? [];
  if (enabledModels.length === 0) {
    const config = getProvider(state.activeProvider);
    return allModels.filter((m) => config.defaultEnabledModels.includes(m.value));
  }
  return allModels.filter((m) => enabledModels.includes(m.value));
}
