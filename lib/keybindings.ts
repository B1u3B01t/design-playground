// ============================================================================
// Centralized Keybinding System
// Types, defaults, matchers, and utilities for user-customizable shortcuts.
// ============================================================================

import { useKeybindingStore } from './keybinding-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KeyCombo {
  key: string;
  meta?: boolean;   // Cmd on Mac, Ctrl on Windows/Linux
  shift?: boolean;
  alt?: boolean;
  /** When true, this is a hold-modifier shortcut (key pressed = activate, key released = deactivate) */
  hold?: boolean;
}

export type PlaygroundAction =
  | 'cursor-chat.activate'
  | 'cursor-chat.cycle-model'
  | 'iterate.copy-prompt'
  | 'iterate.run'
  | 'element-select.hold';

export interface KeybindingDefinition {
  action: PlaygroundAction;
  label: string;
  description: string;
  category: 'Cursor Chat' | 'Iterate Dialog' | 'Canvas';
  defaultCombo: KeyCombo;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_KEYBINDINGS: KeybindingDefinition[] = [
  {
    action: 'cursor-chat.activate',
    label: 'Activate Cursor Chat',
    description: 'Open the cursor chat overlay',
    category: 'Cursor Chat',
    defaultCombo: { key: 'c' },
  },
  {
    action: 'cursor-chat.cycle-model',
    label: 'Cycle AI Model',
    description: 'Switch to the next AI model',
    category: 'Cursor Chat',
    defaultCombo: { key: 'Tab', shift: true },
  },
  {
    action: 'iterate.copy-prompt',
    label: 'Copy Iteration Prompt',
    description: 'Copy the generated prompt to clipboard',
    category: 'Iterate Dialog',
    defaultCombo: { key: 'c', meta: true, shift: true },
  },
  {
    action: 'iterate.run',
    label: 'Run Iteration',
    description: 'Run the iteration with selected model',
    category: 'Iterate Dialog',
    defaultCombo: { key: 'Enter', meta: true },
  },
  {
    action: 'element-select.hold',
    label: 'Element Selection',
    description: 'Hold to select elements inside components',
    category: 'Canvas',
    defaultCombo: { key: 'Meta', hold: true },
  },
];

// ---------------------------------------------------------------------------
// Combo Resolution
// ---------------------------------------------------------------------------

export function getCombo(action: PlaygroundAction): KeyCombo {
  const overrides = useKeybindingStore.getState().overrides;
  if (overrides[action]) return overrides[action];
  const def = DEFAULT_KEYBINDINGS.find((d) => d.action === action);
  return def?.defaultCombo ?? { key: '' };
}

// ---------------------------------------------------------------------------
// Key Matching
// ---------------------------------------------------------------------------

export function matchesCombo(event: KeyboardEvent, combo: KeyCombo): boolean {
  // Normalize key comparison (case-insensitive for single chars)
  const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const comboKey = combo.key.length === 1 ? combo.key.toLowerCase() : combo.key;
  if (eventKey !== comboKey) return false;

  // meta means Cmd (Mac) or Ctrl (Win/Linux) — matches existing cross-platform pattern
  const wantsMeta = !!combo.meta;
  const hasMeta = event.metaKey || event.ctrlKey;
  if (wantsMeta !== hasMeta) return false;

  if (!!combo.shift !== event.shiftKey) return false;
  if (!!combo.alt !== event.altKey) return false;

  return true;
}

export function matchesAction(event: KeyboardEvent, action: PlaygroundAction): boolean {
  return matchesCombo(event, getCombo(action));
}

/**
 * For hold-modifier shortcuts: returns the key string to match against e.key
 * in keydown/keyup listeners. E.g. 'Alt', 'Shift', 'Control', 'Meta'.
 */
export function getHoldKey(action: PlaygroundAction): string {
  const combo = getCombo(action);
  return combo.key;
}

// ---------------------------------------------------------------------------
// Display Formatting
// ---------------------------------------------------------------------------

function isMac(): boolean {
  if (typeof navigator === 'undefined') return true; // SSR default
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

/** Map modifier key names to display symbols/labels */
function formatModifierKey(key: string, mac: boolean): string {
  switch (key) {
    case 'Alt': return mac ? '\u2325 Option' : 'Alt';
    case 'Meta': return mac ? '\u2318 Cmd' : 'Win';
    case 'Control': return mac ? '\u2303 Ctrl' : 'Ctrl';
    case 'Shift': return mac ? '\u21E7 Shift' : 'Shift';
    default: return key;
  }
}

function formatKey(key: string, mac: boolean): string {
  // Hold-type modifier keys
  if (['Alt', 'Meta', 'Control', 'Shift'].includes(key)) {
    return formatModifierKey(key, mac);
  }
  if (key === ' ') return 'Space';
  if (key.length === 1) return key.toUpperCase();
  return key;
}

export function formatKeyCombo(combo: KeyCombo): string {
  const parts: string[] = [];
  const mac = isMac();

  if (!combo.hold) {
    if (combo.meta) parts.push(mac ? '\u2318' : 'Ctrl');
    if (combo.shift) parts.push(mac ? '\u21E7' : 'Shift');
    if (combo.alt) parts.push(mac ? '\u2325' : 'Alt');
  }

  parts.push(formatKey(combo.key, mac));
  return mac ? parts.join('') : parts.join(' + ');
}

export function formatKeyComboSegments(combo: KeyCombo): string[] {
  const parts: string[] = [];
  const mac = isMac();

  if (!combo.hold) {
    if (combo.meta) parts.push(mac ? '\u2318' : 'Ctrl');
    if (combo.shift) parts.push(mac ? '\u21E7' : 'Shift');
    if (combo.alt) parts.push(mac ? '\u2325' : 'Alt');
  }

  parts.push(formatKey(combo.key, mac));
  return parts;
}

// ---------------------------------------------------------------------------
// Conflict Detection
// ---------------------------------------------------------------------------

function combosEqual(a: KeyCombo, b: KeyCombo): boolean {
  // Hold-type and regular combos never conflict
  if (!!a.hold !== !!b.hold) return false;
  const normalize = (k: string) => (k.length === 1 ? k.toLowerCase() : k);
  return (
    normalize(a.key) === normalize(b.key) &&
    !!a.meta === !!b.meta &&
    !!a.shift === !!b.shift &&
    !!a.alt === !!b.alt
  );
}

export function findConflicts(action: PlaygroundAction, combo: KeyCombo): PlaygroundAction[] {
  const conflicts: PlaygroundAction[] = [];
  for (const def of DEFAULT_KEYBINDINGS) {
    if (def.action === action) continue;
    const current = getCombo(def.action);
    if (combosEqual(current, combo)) {
      conflicts.push(def.action);
    }
  }
  return conflicts;
}
