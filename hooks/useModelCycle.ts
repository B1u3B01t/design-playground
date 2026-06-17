'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSelectedModel, saveSelectedModel } from '../nodes/shared/IterateDialogParts';
import { resolveAgentModel } from '../lib/resolve-agent-model';
import { useModelSettingsStore } from '../lib/model-settings-store';
import type { ProviderId } from '../lib/providers/types';
import type { ModelOption } from '../nodes/shared/IterateDialogParts';

// ---------------------------------------------------------------------------
// useModelCycle
// ---------------------------------------------------------------------------
// The model-selection slice extracted from useCursorChat: it owns the selected
// model, persists it, and cycles to the next available model with a 350ms flip
// animation (mirrors the .cursor-bubble.is-switching CSS). Kept free of the
// cursor-tracking / placement machinery so the bottom-docked composer can reuse
// just the model bubble without a second Cmd+/ global handler or RAF loop.
// ---------------------------------------------------------------------------

export interface UseModelCycleReturn {
  model: string;
  setModel: (value: string) => void;
  cycleModel: () => void;
  isSwitching: boolean;
  nextModel: string | null;
}

export function useModelCycle(models: ModelOption[]): UseModelCycleReturn {
  const [model, setModel] = useState(() => {
    const provider = useModelSettingsStore.getState().activeProvider as ProviderId;
    return resolveAgentModel(provider, loadSelectedModel()) ?? 'auto';
  });

  const [isSwitching, setIsSwitching] = useState(false);
  const [nextModel, setNextModel] = useState<string | null>(null);
  const switchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cycleModel = useCallback(() => {
    if (models.length === 0 || isSwitching) return;
    const currentIdx = models.findIndex((m) => m.value === model);
    const nextIdx = (currentIdx + 1) % models.length;
    const next = models[nextIdx].value;

    setNextModel(next);
    setIsSwitching(true);

    switchTimeoutRef.current = setTimeout(() => {
      setModel(next);
      saveSelectedModel(next);
      setIsSwitching(false);
      setNextModel(null);
    }, 350);
  }, [models, model, isSwitching]);

  // Clean up the in-flight flip timeout on unmount.
  useEffect(() => {
    return () => {
      if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current);
    };
  }, []);

  return { model, setModel, cycleModel, isSwitching, nextModel };
}
