'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { useAvailableModels } from './nodes/shared/IterateDialogParts';
import { useModelSettingsStore } from './lib/model-settings-store';
import { getModelIconConfig } from './lib/model-icons';
import type { ModelOption } from './lib/constants';

interface ModelSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ModelSettingsModal({ open, onOpenChange }: ModelSettingsModalProps) {
  const { allModels: models, isLoading } = useAvailableModels();
  const { enabledModels, setEnabledModels } = useModelSettingsStore();

  // Local state mirrors store while modal is open
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Sync from store when modal opens
  useEffect(() => {
    if (open) {
      if (enabledModels.length === 0) {
        // All models enabled by default
        setSelected(new Set(models.map((m) => m.value)));
      } else {
        setSelected(new Set(enabledModels));
      }
    }
  }, [open, enabledModels, models]);

  const allSelected = selected.size === models.length;

  const toggleAll = () => {
    if (allSelected) {
      // Deselect all except first
      setSelected(new Set(models.length > 0 ? [models[0].value] : []));
    } else {
      setSelected(new Set(models.map((m) => m.value)));
    }
  };

  const toggleModel = (value: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        if (next.size <= 1) return prev; // keep at least 1
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const handleSave = () => {
    if (selected.size === models.length) {
      // All selected = store empty array (show all)
      setEnabledModels([]);
    } else {
      setEnabledModels(Array.from(selected));
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Model Settings</DialogTitle>
          <DialogDescription>
            Choose which models appear in model selectors.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1 mt-1">
          {/* Select all toggle */}
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-stone-600 hover:bg-stone-50 rounded-lg transition-colors"
          >
            <span
              className={`flex items-center justify-center w-4 h-4 rounded border transition-colors ${
                allSelected
                  ? 'bg-stone-800 border-stone-800'
                  : 'border-stone-300'
              }`}
            >
              {allSelected && <Check className="w-3 h-3 text-white" />}
            </span>
            <span className="font-medium">{allSelected ? 'Deselect All' : 'Select All'}</span>
          </button>

          <div className="h-px bg-stone-100 my-0.5" />

          {/* Model list */}
          <div className="max-h-64 overflow-y-auto flex flex-col gap-0.5">
            {isLoading ? (
              <span className="text-xs text-stone-400 px-2 py-2">Loading models...</span>
            ) : (
              models.map((m: ModelOption) => {
                const checked = selected.has(m.value);
                const iconConfig = getModelIconConfig(m.value);
                return (
                  <button
                    key={m.value}
                    onClick={() => toggleModel(m.value)}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-stone-50 transition-colors w-full"
                  >
                    <span
                      className={`flex items-center justify-center w-4 h-4 rounded border transition-colors flex-shrink-0 ${
                        checked
                          ? 'bg-stone-800 border-stone-800'
                          : 'border-stone-300'
                      }`}
                    >
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span className="text-xs text-stone-700 truncate flex-1 text-left">{m.label}</span>
                    <span
                      className="flex items-center justify-center w-5 h-5 rounded flex-shrink-0 bg-center bg-no-repeat bg-[length:70%] ml-auto"
                      style={{
                        backgroundColor: iconConfig.bg,
                        backgroundImage: `url(${iconConfig.src})`,
                      }}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-xs text-white bg-stone-800 hover:bg-stone-900 rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
