'use client';

import { useState, useEffect, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Kbd } from './ui/kbd';
import { useKeybindingStore } from './lib/keybinding-store';
import {
  DEFAULT_KEYBINDINGS,
  formatKeyComboSegments,
  findConflicts,
  getCombo,
  type KeyCombo,
  type PlaygroundAction,
} from './lib/keybindings';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = ['Cursor Chat', 'Iterate Dialog', 'Canvas'] as const;

/** Modifier keys that can be used as hold keys */
const MODIFIER_KEYS = ['Meta', 'Shift', 'Alt', 'Control'] as const;

export default function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  const { overrides, setKeybinding, resetKeybinding, resetAll } = useKeybindingStore();
  const [recordingAction, setRecordingAction] = useState<PlaygroundAction | null>(null);
  const [conflict, setConflict] = useState<{ action: PlaygroundAction; combo: KeyCombo; conflictsWith: PlaygroundAction[] } | null>(null);

  // Check if the recording action is a hold-type shortcut
  const recordingDef = recordingAction
    ? DEFAULT_KEYBINDINGS.find((d) => d.action === recordingAction)
    : null;
  const isHoldRecording = recordingDef?.defaultCombo.hold ?? false;

  // Recording handler
  useEffect(() => {
    if (!recordingAction) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (isHoldRecording) {
        // For hold-type shortcuts, accept a single modifier key press
        if (!(MODIFIER_KEYS as readonly string[]).includes(e.key)) return;
        const combo: KeyCombo = { key: e.key, hold: true };
        setKeybinding(recordingAction, combo);
        setRecordingAction(null);
        return;
      }

      // For regular combos, ignore lone modifier presses
      if ((MODIFIER_KEYS as readonly string[]).includes(e.key)) return;

      const combo: KeyCombo = {
        key: e.key,
        ...(e.metaKey || e.ctrlKey ? { meta: true } : {}),
        ...(e.shiftKey ? { shift: true } : {}),
        ...(e.altKey ? { alt: true } : {}),
      };

      const conflicts = findConflicts(recordingAction, combo);
      if (conflicts.length > 0) {
        setConflict({ action: recordingAction, combo, conflictsWith: conflicts });
      } else {
        setKeybinding(recordingAction, combo);
        setRecordingAction(null);
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [recordingAction, isHoldRecording, setKeybinding]);

  // Reset recording state when modal closes
  useEffect(() => {
    if (!open) {
      setRecordingAction(null);
      setConflict(null);
    }
  }, [open]);

  const handleConfirmConflict = useCallback(() => {
    if (!conflict) return;
    // Remove the conflicting binding(s) and set the new one
    for (const c of conflict.conflictsWith) {
      resetKeybinding(c);
    }
    setKeybinding(conflict.action, conflict.combo);
    setConflict(null);
    setRecordingAction(null);
  }, [conflict, setKeybinding, resetKeybinding]);

  const handleCancelConflict = useCallback(() => {
    setConflict(null);
    setRecordingAction(null);
  }, []);

  const getLabel = (action: PlaygroundAction): string => {
    return DEFAULT_KEYBINDINGS.find((d) => d.action === action)?.label ?? action;
  };

  const isOverridden = (action: PlaygroundAction): boolean => {
    return action in overrides;
  };

  const hasAnyOverrides = Object.keys(overrides).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Click a shortcut to record a new key combination.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-1">
          {CATEGORIES.map((category) => {
            const bindings = DEFAULT_KEYBINDINGS.filter((d) => d.category === category);
            if (bindings.length === 0) return null;

            return (
              <div key={category}>
                <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider px-1">
                  {category}
                </span>
                <div className="flex flex-col gap-0.5 mt-1">
                  {bindings.map((def) => {
                    const isRecording = recordingAction === def.action;
                    const combo = getCombo(def.action);
                    const segments = formatKeyComboSegments(combo);

                    return (
                      <div
                        key={def.action}
                        className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-stone-50 transition-colors group"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-stone-700">{def.label}</span>
                          <span className="text-[10px] text-stone-400">{def.description}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isRecording ? (
                            <span className="text-[10px] text-amber-600 font-medium animate-pulse">
                              {def.defaultCombo.hold ? 'Press a modifier key...' : 'Press keys...'}
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setConflict(null);
                                setRecordingAction(def.action);
                              }}
                              className="flex items-center gap-0.5 cursor-pointer"
                              title="Click to change shortcut"
                            >
                              {segments.map((seg, i) => (
                                <Kbd key={i}>{seg}</Kbd>
                              ))}
                            </button>
                          )}

                          {isOverridden(def.action) && !isRecording && (
                            <button
                              onClick={() => resetKeybinding(def.action)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-stone-400 hover:text-stone-600"
                              title="Reset to default"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Conflict warning */}
        {conflict && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-1">
            <p className="text-xs text-amber-800">
              This shortcut conflicts with <strong>{getLabel(conflict.conflictsWith[0])}</strong>.
              Override it?
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleCancelConflict}
                className="px-2.5 py-1 text-[10px] text-stone-600 hover:bg-stone-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmConflict}
                className="px-2.5 py-1 text-[10px] text-white bg-amber-600 hover:bg-amber-700 rounded transition-colors"
              >
                Override
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center mt-2">
          {hasAnyOverrides ? (
            <button
              onClick={resetAll}
              className="px-3 py-1.5 text-xs text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
            >
              Reset All Defaults
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 text-xs text-white bg-stone-800 hover:bg-stone-900 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
