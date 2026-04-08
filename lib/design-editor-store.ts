// ---------------------------------------------------------------------------
// Design Editor Store
// ---------------------------------------------------------------------------
// Session-only Zustand store for the Figma-style sidebar design editor.
// Tracks computed styles, ephemeral overrides, and panel UI state.
// No persistence — all state is cleared on page reload.
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { ComputedStyles } from './computed-styles';
import { applyStyleOverrides, clearStyleOverrides, clearAllStyleOverrides, applyIframeStyleOverrides } from './style-injector';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StyleOverride {
  nodeId: string;
  cssSelector: string;
  property: string;
  value: string;
  originalValue: string;
  /** Whether this node renders in an iframe */
  isIframe: boolean;
}

export interface PropOverride {
  nodeId: string;
  componentId: string;
  propName: string;
  value: unknown;
  originalValue: unknown;
}

export interface ContentOverride {
  nodeId: string;
  cssSelector: string;
  type: 'text' | 'image';
  value: string;
  originalValue: string;
  /** Whether this node renders in an iframe */
  isIframe: boolean;
}

export type DesignEditorTab = 'design' | 'props' | 'content';

// ---------------------------------------------------------------------------
// Store Interface
// ---------------------------------------------------------------------------

interface DesignEditorState {
  // Panel visibility
  isOpen: boolean;
  activeTab: DesignEditorTab;

  // Computed styles cache — keyed by "nodeId:cssSelector"
  computedStyles: Map<string, ComputedStyles>;

  // Ephemeral overrides (the delta)
  styleOverrides: StyleOverride[];
  propOverrides: PropOverride[];
  contentOverrides: ContentOverride[];

  // Per-node design token mode (true = Tailwind tokens, false = arbitrary)
  tokenMode: Map<string, boolean>;

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  toggle: () => void;
  open: () => void;
  close: () => void;
  setActiveTab: (tab: DesignEditorTab) => void;

  // Computed styles
  setComputedStyles: (key: string, styles: ComputedStyles) => void;
  clearComputedStyles: () => void;

  // Style overrides
  addStyleOverride: (override: Omit<StyleOverride, 'originalValue'> & { originalValue?: string }) => void;
  removeStyleOverride: (nodeId: string, cssSelector: string, property: string) => void;
  clearOverridesForNode: (nodeId: string) => void;
  clearAllOverrides: () => void;

  // Prop overrides
  addPropOverride: (override: Omit<PropOverride, 'originalValue'> & { originalValue?: unknown }) => void;
  removePropOverride: (nodeId: string, propName: string) => void;

  // Content overrides
  addContentOverride: (override: Omit<ContentOverride, 'originalValue'> & { originalValue?: string }) => void;
  removeContentOverride: (nodeId: string, cssSelector: string, type: 'text' | 'image') => void;

  // Token mode
  setTokenMode: (nodeId: string, mode: boolean) => void;

  // Delta computation
  getStyleDeltas: () => StyleOverride[];
  getPropDeltas: () => PropOverride[];
  getContentDeltas: () => ContentOverride[];
  formatDeltaDescription: () => string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useDesignEditorStore = create<DesignEditorState>()((set, get) => ({
  // Defaults
  isOpen: false,
  activeTab: 'design',
  computedStyles: new Map(),
  styleOverrides: [],
  propOverrides: [],
  contentOverrides: [],
  tokenMode: new Map(),

  // ---------------------------------------------------------------------------
  // Panel actions
  // ---------------------------------------------------------------------------

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  // ---------------------------------------------------------------------------
  // Computed styles
  // ---------------------------------------------------------------------------

  setComputedStyles: (key, styles) =>
    set((s) => {
      const next = new Map(s.computedStyles);
      next.set(key, styles);
      return { computedStyles: next };
    }),

  clearComputedStyles: () => set({ computedStyles: new Map() }),

  // ---------------------------------------------------------------------------
  // Style overrides
  // ---------------------------------------------------------------------------

  addStyleOverride: (override) =>
    set((s) => {
      const existing = s.styleOverrides.find(
        (o) => o.nodeId === override.nodeId && o.cssSelector === override.cssSelector && o.property === override.property
      );

      // Resolve original value from computed styles if not provided
      const key = `${override.nodeId}:${override.cssSelector}`;
      const computed = s.computedStyles.get(key);
      const computedValue = computed
        ? ((computed as unknown as Record<string, string>)[override.property] ?? '')
        : '';
      const originalValue = override.originalValue ?? computedValue;

      let nextOverrides: StyleOverride[];

      if (existing) {
        nextOverrides = s.styleOverrides.map((o) =>
          o.nodeId === override.nodeId && o.cssSelector === override.cssSelector && o.property === override.property
            ? { ...o, value: override.value }
            : o
        );
      } else {
        nextOverrides = [...s.styleOverrides, { ...override, originalValue }];
      }

      // Apply to DOM
      const nodeOverrides = nextOverrides.filter((o) => o.nodeId === override.nodeId);
      if (override.isIframe) {
        applyIframeStyleOverrides(override.nodeId, nodeOverrides);
      } else {
        applyStyleOverrides(override.nodeId, nodeOverrides);
      }

      return { styleOverrides: nextOverrides };
    }),

  removeStyleOverride: (nodeId, cssSelector, property) =>
    set((s) => {
      const nextOverrides = s.styleOverrides.filter(
        (o) => !(o.nodeId === nodeId && o.cssSelector === cssSelector && o.property === property)
      );

      // Re-apply remaining overrides to DOM
      const nodeOverrides = nextOverrides.filter((o) => o.nodeId === nodeId);
      const removed = s.styleOverrides.find(
        (o) => o.nodeId === nodeId && o.cssSelector === cssSelector && o.property === property
      );
      if (removed?.isIframe) {
        applyIframeStyleOverrides(nodeId, nodeOverrides);
      } else {
        applyStyleOverrides(nodeId, nodeOverrides);
      }

      return { styleOverrides: nextOverrides };
    }),

  clearOverridesForNode: (nodeId) =>
    set((s) => {
      const removed = s.styleOverrides.filter((o) => o.nodeId === nodeId);
      const hasIframe = removed.some((o) => o.isIframe);

      if (hasIframe) {
        applyIframeStyleOverrides(nodeId, []);
      } else {
        clearStyleOverrides(nodeId);
      }

      return {
        styleOverrides: s.styleOverrides.filter((o) => o.nodeId !== nodeId),
        propOverrides: s.propOverrides.filter((o) => o.nodeId !== nodeId),
        contentOverrides: s.contentOverrides.filter((o) => o.nodeId !== nodeId),
      };
    }),

  clearAllOverrides: () => {
    clearAllStyleOverrides();
    set({
      styleOverrides: [],
      propOverrides: [],
      contentOverrides: [],
    });
  },

  // ---------------------------------------------------------------------------
  // Prop overrides
  // ---------------------------------------------------------------------------

  addPropOverride: (override) =>
    set((s) => {
      const existing = s.propOverrides.find(
        (o) => o.nodeId === override.nodeId && o.propName === override.propName
      );

      const originalValue = override.originalValue ?? existing?.originalValue ?? undefined;

      let nextOverrides: PropOverride[];
      if (existing) {
        nextOverrides = s.propOverrides.map((o) =>
          o.nodeId === override.nodeId && o.propName === override.propName
            ? { ...o, value: override.value }
            : o
        );
      } else {
        nextOverrides = [...s.propOverrides, { ...override, originalValue }];
      }

      // Dispatch event for ComponentNode/IterationNode to pick up
      const nodeProps: Record<string, unknown> = {};
      for (const o of nextOverrides.filter((o) => o.nodeId === override.nodeId)) {
        nodeProps[o.propName] = o.value;
      }
      window.dispatchEvent(
        new CustomEvent('playground:prop-override-change', {
          detail: { nodeId: override.nodeId, componentId: override.componentId, props: nodeProps },
        })
      );

      return { propOverrides: nextOverrides };
    }),

  removePropOverride: (nodeId, propName) =>
    set((s) => {
      const nextOverrides = s.propOverrides.filter(
        (o) => !(o.nodeId === nodeId && o.propName === propName)
      );

      // Re-dispatch remaining overrides
      const nodeProps: Record<string, unknown> = {};
      for (const o of nextOverrides.filter((o) => o.nodeId === nodeId)) {
        nodeProps[o.propName] = o.value;
      }
      window.dispatchEvent(
        new CustomEvent('playground:prop-override-change', {
          detail: { nodeId, props: nodeProps },
        })
      );

      return { propOverrides: nextOverrides };
    }),

  // ---------------------------------------------------------------------------
  // Content overrides
  // ---------------------------------------------------------------------------

  addContentOverride: (override) =>
    set((s) => {
      const existing = s.contentOverrides.find(
        (o) => o.nodeId === override.nodeId && o.cssSelector === override.cssSelector && o.type === override.type
      );

      const originalValue = override.originalValue ?? existing?.originalValue ?? '';

      let nextOverrides: ContentOverride[];
      if (existing) {
        nextOverrides = s.contentOverrides.map((o) =>
          o.nodeId === override.nodeId && o.cssSelector === override.cssSelector && o.type === override.type
            ? { ...o, value: override.value }
            : o
        );
      } else {
        nextOverrides = [...s.contentOverrides, { ...override, originalValue }];
      }

      return { contentOverrides: nextOverrides };
    }),

  removeContentOverride: (nodeId, cssSelector, type) =>
    set((s) => ({
      contentOverrides: s.contentOverrides.filter(
        (o) => !(o.nodeId === nodeId && o.cssSelector === cssSelector && o.type === type)
      ),
    })),

  // ---------------------------------------------------------------------------
  // Token mode
  // ---------------------------------------------------------------------------

  setTokenMode: (nodeId, mode) =>
    set((s) => {
      const next = new Map(s.tokenMode);
      next.set(nodeId, mode);
      return { tokenMode: next };
    }),

  // ---------------------------------------------------------------------------
  // Delta computation
  // ---------------------------------------------------------------------------

  getStyleDeltas: () => {
    return get().styleOverrides.filter((o) => o.value !== o.originalValue);
  },

  getPropDeltas: () => {
    return get().propOverrides.filter((o) => o.value !== o.originalValue);
  },

  getContentDeltas: () => {
    return get().contentOverrides.filter((o) => o.value !== o.originalValue);
  },

  formatDeltaDescription: () => {
    const state = get();
    const lines: string[] = [];

    for (const o of state.getStyleDeltas()) {
      lines.push(`- Changed ${camelToKebab(o.property)} from ${o.originalValue || 'unset'} to ${o.value} on ${o.cssSelector}`);
    }

    for (const o of state.getPropDeltas()) {
      lines.push(`- Changed prop "${o.propName}" from ${JSON.stringify(o.originalValue)} to ${JSON.stringify(o.value)}`);
    }

    for (const o of state.getContentDeltas()) {
      const label = o.type === 'text' ? 'text content' : 'image src';
      const from = o.originalValue.length > 50 ? o.originalValue.slice(0, 50) + '…' : o.originalValue;
      const to = o.value.length > 50 ? o.value.slice(0, 50) + '…' : o.value;
      lines.push(`- Changed ${label} of ${o.cssSelector} from "${from}" to "${to}"`);
    }

    if (lines.length === 0) return '';

    return `Apply these visual changes to the component:\n${lines.join('\n')}`;
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}
