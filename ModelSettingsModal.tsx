'use client';

import { useEffect, useState } from 'react';
import { Check, RefreshCw, ChevronDown } from 'lucide-react';
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
import { type ModelOption } from './lib/constants';
import type { ProviderId, ClaudeCodeOptions, CodexOptions } from './lib/providers/types';
import { getAllProviders, getProvider } from './lib/providers/registry';
import { getDisplayName, setDisplayName } from './liveblocks.config';

// ---------------------------------------------------------------------------
// Effort level options for Claude Code
// ---------------------------------------------------------------------------

const EFFORT_OPTIONS: { value: ClaudeCodeOptions['effort']; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
  { value: 'max', label: 'Max' },
];

const CODEX_EFFORT_OPTIONS: { value: CodexOptions['reasoningEffort']; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'XHigh' },
];

const CODEX_SANDBOX_OPTIONS: {
  value: CodexOptions['sandbox'];
  label: string;
  description: string;
}[] = [
  {
    value: 'workspace-write',
    label: 'Workspace write',
    description: 'Read anywhere; write only inside the repo (recommended).',
  },
  {
    value: 'danger-full-access',
    label: 'Full access',
    description: 'No sandbox — extremely dangerous. Use only in trusted environments.',
  },
];


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ModelSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ModelSettingsModal({ open, onOpenChange }: ModelSettingsModalProps) {
  const { allModels: models, isLoading } = useAvailableModels();
  const {
    activeProvider,
    setActiveProvider,
    setEnabledModels,
    fetchModels,
    claudeCodeOptions,
    setClaudeCodeOptions,
    codexOptions,
    setCodexOptions,
  } = useModelSettingsStore();

  // Read enabledModels from the store's provider state directly
  const enabledModels = useModelSettingsStore(
    (s) => s.providerState[s.activeProvider]?.enabledModels ?? [],
  );

  // Local state mirrors store while modal is open
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [localClaudeOpts, setLocalClaudeOpts] = useState<ClaudeCodeOptions>(claudeCodeOptions);
  const [localCodexOpts, setLocalCodexOpts] = useState<CodexOptions>(codexOptions);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [displayName, setDisplayNameState] = useState('');

  // Load the saved display name when the modal opens.
  useEffect(() => {
    if (open) setDisplayNameState(getDisplayName());
  }, [open]);

  // Sync from store when modal opens or provider changes
  useEffect(() => {
    if (open) {
      const config = getProvider(activeProvider);
      if (enabledModels.length === 0) {
        setSelected(new Set(config.defaultEnabledModels));
      } else {
        setSelected(new Set(enabledModels));
      }
      setLocalClaudeOpts(claudeCodeOptions);
      setLocalCodexOpts(codexOptions);
    }
  }, [open, enabledModels, models, activeProvider, claudeCodeOptions, codexOptions]);

  const providers = getAllProviders();
  const allSelected = selected.size === models.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set(models.length > 0 ? [models[0].value] : []));
    } else {
      setSelected(new Set(models.map((m) => m.value)));
    }
  };

  const toggleModel = (value: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        if (next.size <= 1) return prev;
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const handleTabChange = (id: ProviderId) => {
    setActiveProvider(id);
    setAdvancedOpen(false);
  };

  const handleSave = () => {
    if (selected.size === models.length) {
      setEnabledModels([]);
    } else {
      setEnabledModels(Array.from(selected));
    }
    // Persist provider-specific options
    setClaudeCodeOptions(localClaudeOpts);
    setCodexOptions(localCodexOpts);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Model Settings</DialogTitle>
          <DialogDescription className="flex items-center justify-between">
            <span>Choose provider and models.</span>
            <button
              onClick={() => fetchModels()}
              disabled={isLoading}
              className="p-1 text-stone-400 hover:text-stone-600 rounded transition-colors disabled:opacity-50"
              title="Refresh models"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </DialogDescription>
        </DialogHeader>

        {/* Display name — your identity in shared (multiplayer) sessions */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-stone-700">Your name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayNameState(e.target.value);
              setDisplayName(e.target.value);
            }}
            placeholder="Set a name for shared sessions"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-[13px] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/40"
          />
          <p className="text-[11px] text-stone-400">
            Shown to others in shared sessions. Applies the next time you join a session.
          </p>
        </div>

        {/* Provider segment control */}
        <div className="flex gap-0.5 p-0.5 bg-stone-100 rounded-lg">
          {providers.map((p) => {
            const isActive = activeProvider === p.id;
            const iconConfig = getModelIconConfig('', p.id);
            return (
              <button
                key={p.id}
                onClick={() => handleTabChange(p.id)}
                className={`flex items-center justify-center gap-1.5 flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  isActive
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <span
                  className="inline-block w-4 h-4 rounded bg-center bg-no-repeat bg-[length:70%] flex-shrink-0"
                  style={{
                    backgroundColor: iconConfig.bg,
                    backgroundImage: `url(${iconConfig.src})`,
                  }}
                />
                {p.displayName}
              </button>
            );
          })}
        </div>

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
          <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
            {isLoading ? (
              <span className="text-xs text-stone-400 px-2 py-2">Loading models...</span>
            ) : (
              models.map((m: ModelOption) => {
                const checked = selected.has(m.value);
                const iconConfig = getModelIconConfig(m.value, activeProvider);
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

        {/* Codex Advanced Options */}
        {activeProvider === 'codex' && (
          <div className="mt-1">
            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-stone-500 hover:text-stone-700 transition-colors w-full"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? '' : '-rotate-90'}`}
              />
              <span className="font-medium">Advanced Options</span>
            </button>

            {advancedOpen && (
              <div className="flex flex-col gap-3 px-2 py-2 bg-stone-50 rounded-lg mt-1">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-stone-600 font-medium">Sandbox</label>
                  <div className="flex flex-col gap-1">
                    {CODEX_SANDBOX_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() =>
                          setLocalCodexOpts({ ...localCodexOpts, sandbox: opt.value })
                        }
                        className={`flex flex-col items-start px-2 py-1.5 text-left rounded-md transition-all ${
                          localCodexOpts.sandbox === opt.value
                            ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200'
                            : 'text-stone-500 hover:text-stone-700'
                        }`}
                      >
                        <span className="text-xs font-medium">{opt.label}</span>
                        <span className="text-[11px] text-stone-500 mt-0.5">{opt.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-stone-600 font-medium">Reasoning Effort</label>
                  <div className="flex gap-0.5 p-0.5 bg-stone-200 rounded-md">
                    {CODEX_EFFORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() =>
                          setLocalCodexOpts({
                            ...localCodexOpts,
                            reasoningEffort: opt.value,
                          })
                        }
                        className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-all ${
                          localCodexOpts.reasoningEffort === opt.value
                            ? 'bg-white text-stone-900 shadow-sm'
                            : 'text-stone-500 hover:text-stone-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localCodexOpts.detailedStdout}
                    onChange={(e) =>
                      setLocalCodexOpts({
                        ...localCodexOpts,
                        detailedStdout: e.target.checked,
                      })
                    }
                    className="mt-0.5 rounded border-stone-300"
                  />
                  <span className="text-xs text-stone-600">
                    <span className="font-medium text-stone-700">Detailed Codex log (JSON)</span>
                    <span className="block text-stone-500 mt-0.5">
                      Streams assistant text to the header bubble tooltip during runs. Chat file download stays small (raw JSONL is not written there).
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Claude Code Advanced Options */}
        {activeProvider === 'claude-code' && (
          <div className="mt-1">
            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-stone-500 hover:text-stone-700 transition-colors w-full"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? '' : '-rotate-90'}`}
              />
              <span className="font-medium">Advanced Options</span>
            </button>

            {advancedOpen && (
              <div className="flex flex-col gap-3 px-2 py-2 bg-stone-50 rounded-lg mt-1">
                {/* Effort level */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-stone-600 font-medium">Effort Level</label>
                  <div className="flex gap-0.5 p-0.5 bg-stone-200 rounded-md">
                    {EFFORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setLocalClaudeOpts({ ...localClaudeOpts, effort: opt.value })}
                        className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-all ${
                          localClaudeOpts.effort === opt.value
                            ? 'bg-white text-stone-900 shadow-sm'
                            : 'text-stone-500 hover:text-stone-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Budget limit */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-stone-600 font-medium">Budget Limit (USD)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="No limit"
                    value={localClaudeOpts.maxBudgetUsd ?? ''}
                    onChange={(e) =>
                      setLocalClaudeOpts({
                        ...localClaudeOpts,
                        maxBudgetUsd: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs bg-white border border-stone-200 rounded-md text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>

                {/* Max turns */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-stone-600 font-medium">Max Turns</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="No limit"
                    value={localClaudeOpts.maxTurns ?? ''}
                    onChange={(e) =>
                      setLocalClaudeOpts({
                        ...localClaudeOpts,
                        maxTurns: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs bg-white border border-stone-200 rounded-md text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localClaudeOpts.detailedStdout}
                    onChange={(e) =>
                      setLocalClaudeOpts({
                        ...localClaudeOpts,
                        detailedStdout: e.target.checked,
                      })
                    }
                    className="mt-0.5 rounded border-stone-300"
                  />
                  <span className="text-xs text-stone-600">
                    <span className="font-medium text-stone-700">Detailed Claude log (stream-json)</span>
                    <span className="block text-stone-500 mt-0.5">
                      Streams assistant text to the header bubble tooltip during runs. Chat file download stays small (raw stream-json is not written there).
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

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
