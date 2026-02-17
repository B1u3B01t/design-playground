// ============================================================================
// Playground Constants
// All fixed variables used across the playground feature.
// ============================================================================

// ---------------------------------------------------------------------------
// Custom Event Names
// ---------------------------------------------------------------------------

/** Fired when the iteration prompt is copied to clipboard */
export const ITERATION_PROMPT_COPIED_EVENT = 'iteration-prompt-copied';

/** Fired to request an immediate iteration fetch/scan */
export const ITERATION_FETCH_EVENT = 'iteration-fetch-requested';

/** Fired when a component enters/exits fullscreen */
export const FULLSCREEN_NODE_EVENT = 'playground:fullscreen-node';

/** Fired when a ComponentNode changes its viewport size */
export const COMPONENT_SIZE_CHANGE_EVENT = 'playground:component-size-change';

/** Fired when generation starts (skeleton nodes are created) */
export const GENERATION_START_EVENT = 'playground:generation-start';

/** Fired when generation completes successfully */
export const GENERATION_COMPLETE_EVENT = 'playground:generation-complete';

/** Fired when generation encounters an error */
export const GENERATION_ERROR_EVENT = 'playground:generation-error';

/** Fired to trigger auto-arrange of canvas nodes */
export const PLAYGROUND_AUTO_ARRANGE_EVENT = 'PLAYGROUND_AUTO_ARRANGE';

/** Fired when an iteration node's collapse/expand state is toggled */
export const ITERATION_COLLAPSE_TOGGLE_EVENT = 'playground:iteration-collapse-toggle';

// ---------------------------------------------------------------------------
// localStorage Keys
// ---------------------------------------------------------------------------

/** Key for persisting canvas state (nodes, edges, counter) */
export const STORAGE_KEY = 'playground-canvas-state';

/** Key for persisting the list of available AI models */
export const MODELS_STORAGE_KEY = 'playground-ai-models';

/** Key for persisting the user's last selected AI model */
export const SELECTED_MODEL_STORAGE_KEY = 'playground-selected-model';

// ---------------------------------------------------------------------------
// Timing Constants
// ---------------------------------------------------------------------------

/** Interval between iteration polling scans (ms) */
export const POLL_INTERVAL = 10_000; // 10 seconds

/** Maximum duration to keep polling after a prompt copy (ms) */
export const POLL_DURATION = 120_000; // 120 seconds

/** TTL for the shared async-props cache (ms) */
export const PROPS_CACHE_TTL_MS = 60_000; // 60 seconds

/** TTL for the server-side AI models cache (ms) */
export const MODELS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Canvas Zoom Limits
// ---------------------------------------------------------------------------

/** Maximum zoom level for the playground canvas */
export const CANVAS_MAX_ZOOM = 2;

/** Minimum zoom level for the playground canvas */
export const CANVAS_MIN_ZOOM = 0.05;

// ---------------------------------------------------------------------------
// Canvas Layout Constants
// ---------------------------------------------------------------------------

/** Starting X position for auto-arranged nodes */
export const ARRANGE_START_X = 50;

/** Starting Y position for auto-arranged nodes */
export const ARRANGE_START_Y = 50;

/** Vertical gap between nodes within a component group (px) */
export const ARRANGE_VERTICAL_GAP = 60;

/** Extra vertical gap between component groups (px) */
export const ARRANGE_GROUP_GAP = 100;

/** Horizontal gap between the component column and iteration column (px) */
export const ARRANGE_HORIZONTAL_GAP = 80;

/** Horizontal spacing between iteration nodes when placed below parent */
export const ITERATION_HORIZONTAL_SPACING = 420;

/** Vertical offset below parent for iteration nodes */
export const ITERATION_VERTICAL_OFFSET = 350;

// ---------------------------------------------------------------------------
// Default Node Dimensions (estimated, used when measured size is unavailable)
// ---------------------------------------------------------------------------

/** Default estimated width for iteration / skeleton nodes (px) */
export const DEFAULT_ITERATION_NODE_WIDTH = 400;

/** Default estimated height for iteration / skeleton nodes (px) */
export const DEFAULT_ITERATION_NODE_HEIGHT = 300;

/** Default estimated width for component nodes (px) */
export const DEFAULT_COMPONENT_NODE_WIDTH = 650;

/** Default estimated height for component nodes (px) */
export const DEFAULT_COMPONENT_NODE_HEIGHT = 450;

// ---------------------------------------------------------------------------
// Component Size Configurations
// ---------------------------------------------------------------------------

export type ComponentSize = 'default' | 'laptop' | 'tablet' | 'mobile';

export interface SizeConfigEntry {
  width: number;
  height: number;
  scale: number;
  label: string;
}

/** Viewport presets for previewing components at different device sizes */
export const SIZE_CONFIG: Record<ComponentSize, SizeConfigEntry> = {
  default: { width: 0, height: 0, scale: 1, label: 'Auto' },
  laptop:  { width: 1280, height: 720, scale: 0.6, label: 'Laptop' },
  tablet:  { width: 768, height: 1024, scale: 0.5, label: 'Tablet' },
  mobile:  { width: 375, height: 812, scale: 0.7, label: 'Mobile' },
};

/** Calculate display dimensions (scaled) for a given size preset */
export function getDisplayDimensions(size: ComponentSize) {
  const config = SIZE_CONFIG[size];
  if (size === 'default') return { width: 'auto' as const, height: 'auto' as const };
  return {
    width: Math.round(config.width * config.scale),
    height: Math.round(config.height * config.scale),
  };
}

// ---------------------------------------------------------------------------
// Iteration Dialog Defaults
// ---------------------------------------------------------------------------

/** Available iteration count options */
export const ITERATION_COUNT_OPTIONS = [1, 2, 3, 4] as const;

/** Default number of iterations to generate */
export const DEFAULT_ITERATION_COUNT = 3;

/** Default iteration depth */
export const DEFAULT_DEPTH: 'shell' | '1-level' | 'all' = 'shell';

/** Depth option definitions */
export const DEPTH_OPTIONS: { key: 'shell' | '1-level' | 'all'; label: string }[] = [
  { key: 'shell', label: 'Shell only' },
  { key: '1-level', label: '1 level deep' },
  { key: 'all', label: 'All levels' },
];

// ---------------------------------------------------------------------------
// Fallback AI Models
// ---------------------------------------------------------------------------

export interface ModelOption {
  value: string;
  label: string;
}

/** Fallback models used when the CLI fetch fails and localStorage is empty */
export const FALLBACK_MODELS: ModelOption[] = [
  { value: '', label: 'Auto (Default)' },
  { value: 'opus-4.6-thinking', label: 'Claude 4.6 Opus (Thinking)' },
  { value: 'opus-4.6', label: 'Claude 4.6 Opus' },
  { value: 'sonnet-4.5', label: 'Claude 4.5 Sonnet' },
  { value: 'gpt-5.2', label: 'GPT-5.2' },
  { value: 'gpt-5.2-codex', label: 'GPT-5.2 Codex' },
  { value: 'gemini-3-pro', label: 'Gemini 3 Pro' },
  { value: 'grok', label: 'Grok' },
];

// ---------------------------------------------------------------------------
// FitView Configurations
// ---------------------------------------------------------------------------

/** FitView config when entering fullscreen on a specific node */
export const FITVIEW_FULLSCREEN_ENTER = {
  padding: 0.02,
  duration: 400,
  maxZoom: 2,
  minZoom: 0.1,
} as const;

/** FitView config when exiting fullscreen (show all nodes) */
export const FITVIEW_FULLSCREEN_EXIT = {
  padding: 0.2,
  duration: 300,
} as const;

/** FitView config after auto-arrange */
export const FITVIEW_AFTER_ARRANGE = {
  padding: 0.15,
  duration: 400,
  maxZoom: 1,
} as const;

// ---------------------------------------------------------------------------
// Animation / Transition Delays (ms)
// ---------------------------------------------------------------------------

/** Delay before fitting view after entering fullscreen (waits for sidebar animation) */
export const FULLSCREEN_ENTER_DELAY = 350;

/** Delay before fitting view after exiting fullscreen */
export const FULLSCREEN_EXIT_DELAY = 100;

/** Delay before fitting view after auto-arrange */
export const ARRANGE_FITVIEW_DELAY = 50;

/** Delay after generation completes before scanning for iterations */
export const POST_GENERATION_SCAN_DELAY = 1000;

/** Delay after scan before auto-arrange */
export const POST_GENERATION_ARRANGE_DELAY = 200;

/** Delay before dispatching auto-arrange after skeleton nodes are added */
export const SKELETON_ARRANGE_DELAY = 100;

/** Duration to show "Copied!" feedback (ms) */
export const COPIED_FEEDBACK_DURATION = 2000;

// ---------------------------------------------------------------------------
// Edge Styles
// ---------------------------------------------------------------------------

/** Edge style for normal iteration connections */
export const ITERATION_EDGE_STYLE = {
  stroke: '#9ca3af',
  strokeWidth: 1.5,
} as const;

/** Edge style for skeleton (generating) connections */
export const SKELETON_EDGE_STYLE = {
  stroke: '#f59e0b',
  strokeWidth: 1.5,
  strokeDasharray: '5,5',
} as const;

// ---------------------------------------------------------------------------
// MiniMap Colors
// ---------------------------------------------------------------------------

/** MiniMap node color for skeleton nodes */
export const MINIMAP_SKELETON_COLOR = '#f59e0b';

/** MiniMap node color for iteration nodes */
export const MINIMAP_ITERATION_COLOR = '#6b7280';

/** MiniMap node color for component nodes */
export const MINIMAP_COMPONENT_COLOR = '#3b82f6';

/** MiniMap mask color */
export const MINIMAP_MASK_COLOR = 'rgba(0, 0, 0, 0.08)';

// ---------------------------------------------------------------------------
// ReactFlow Background
// ---------------------------------------------------------------------------

/** Gap between background dots (px) */
export const BACKGROUND_GAP = 20;

/** Size of each background dot (px) */
export const BACKGROUND_DOT_SIZE = 1;

/** Color of background dots */
export const BACKGROUND_COLOR = '#d1d5db';

// ---------------------------------------------------------------------------
// Server-Side API Constants (used in route handlers)
// ---------------------------------------------------------------------------

/** Name of the iterations index file */
export const ITERATIONS_INDEX_FILENAME = 'index.ts';

/** Relative path to the temporary directory for generation artifacts */
export const TEMP_DIR_RELATIVE = '.playground-temp';

/** Filename for the generation lockfile */
export const GENERATION_LOCKFILE_FILENAME = 'generation.lock';

/** Regex pattern to validate iteration filenames (prevents directory traversal) */
export const ITERATION_FILENAME_PATTERN = /^[A-Za-z0-9]+\.iteration-\d+\.tsx$/;

/** Regex pattern to parse iteration filenames into componentName + number */
export const ITERATION_FILENAME_PARSE_PATTERN = /^(.+)\.iteration-(\d+)\.tsx$/;

// ---------------------------------------------------------------------------
// Drag & Drop
// ---------------------------------------------------------------------------

/** MIME-like key used for drag-and-drop data transfer of playground components */
export const DND_DATA_KEY = 'application/x-playground-component';

// ---------------------------------------------------------------------------
// Tree Layout Constants
// ---------------------------------------------------------------------------

/** Filename for the iteration tree manifest */
export const TREE_MANIFEST_FILENAME = 'tree.json';

/** Horizontal spacing between depth columns in tree layout (px) */
export const TREE_COLUMN_WIDTH = 500;

// ---------------------------------------------------------------------------
// Generation Event Payload Types
// ---------------------------------------------------------------------------

/** Payload for GENERATION_START_EVENT */
export interface GenerationStartPayload {
  componentId: string;
  componentName: string;
  parentNodeId: string;
  iterationCount: number;
}

/** Payload for GENERATION_COMPLETE_EVENT */
export interface GenerationCompletePayload {
  componentId: string;
  parentNodeId: string;
  output: string;
}

/** Payload for GENERATION_ERROR_EVENT */
export interface GenerationErrorPayload {
  componentId: string;
  parentNodeId: string;
  error: string;
}
