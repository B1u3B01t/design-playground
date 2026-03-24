'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Loader2, XCircle, Download } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import {
  GENERATION_ERROR_EVENT,
  SELECTED_MODEL_STORAGE_KEY,
  ITERATION_COUNT_OPTIONS,
  DEPTH_OPTIONS,
  type ModelOption,
  type GenerationErrorPayload,
} from '../../lib/constants';
import { useModelSettingsStore } from '../../lib/model-settings-store';
import { getProvider } from '../../lib/providers/registry';

// Re-export ModelOption for consumers
export type { ModelOption } from '../../lib/constants';

// Load last selected model from localStorage
export function loadSelectedModel(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(SELECTED_MODEL_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

// Save selected model to localStorage
export function saveSelectedModel(model: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, model);
  } catch (e) {
    console.error('[Models] Error saving selected model:', e);
  }
}

// ---------------------------------------------------------------------------
// useAvailableModels hook
// ---------------------------------------------------------------------------

export function useAvailableModels() {
  const activeProvider = useModelSettingsStore((s) => s.activeProvider);
  const providerState = useModelSettingsStore((s) => s.providerState[s.activeProvider]);
  const isLoading = useModelSettingsStore((s) => s.isLoadingModels);
  const fetchModels = useModelSettingsStore((s) => s.fetchModels);

  const availableModels = providerState?.availableModels ?? [];
  const enabledModels = providerState?.enabledModels ?? [];
  const hasFetched = providerState?.hasFetched ?? false;

  useEffect(() => {
    if (!hasFetched) fetchModels();
  }, [hasFetched, fetchModels]);

  // Filter by enabled models — fall back to provider defaults if empty
  const config = getProvider(activeProvider);
  const models = enabledModels.length === 0
    ? availableModels.filter((m) => config.defaultEnabledModels.includes(m.value))
    : availableModels.filter((m) => enabledModels.includes(m.value));

  return { models, allModels: availableModels, isLoading };
}

// ---------------------------------------------------------------------------
// IterationCountDropdown
// ---------------------------------------------------------------------------

export function IterationCountDropdown({ 
  count, 
  onChange 
}: { 
  count: number; 
  onChange: (count: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = ITERATION_COUNT_OPTIONS;

  return (
    <div ref={dropdownRef} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-0.5 px-1 py-0.5 text-[10px] text-gray-500 hover:text-gray-700 transition-colors"
          >
            <span>{count}x</span>
            <ChevronDown className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Number of iterations</p>
        </TooltipContent>
      </Tooltip>

      {open && (
        <div className="absolute top-full right-0 mt-0.5 w-12 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden z-50">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`w-full px-2 py-1 text-[10px] text-left text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-between ${
                count === option ? 'bg-gray-50' : ''
              }`}
            >
              <span>{option}x</span>
              {count === option && <Check className="w-2.5 h-2.5 text-green-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DepthDropdown
// ---------------------------------------------------------------------------

export function DepthDropdown({ 
  depth, 
  onChange 
}: { 
  depth: 'shell' | '1-level' | 'all'; 
  onChange: (depth: 'shell' | '1-level' | 'all') => void;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = DEPTH_OPTIONS;

  const currentLabel = options.find(o => o.key === depth)?.label || 'Shell only';

  return (
    <div ref={dropdownRef} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-0.5 px-2 py-1 text-[10px] text-gray-600 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
          >
            <span className="max-w-[80px] truncate">{currentLabel}</span>
            <ChevronDown className={`w-2.5 h-2.5 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Iteration depth</p>
        </TooltipContent>
      </Tooltip>

      {open && (
        <div className="absolute top-full left-0 mt-0.5 w-32 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden z-50">
          {options.map((option) => (
            <button
              key={option.key}
              onClick={() => {
                onChange(option.key);
                setOpen(false);
              }}
              className={`w-full px-2 py-1.5 text-[10px] text-left text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-between ${
                depth === option.key ? 'bg-gray-50' : ''
              }`}
            >
              <span>{option.label}</span>
              {depth === option.key && <Check className="w-2.5 h-2.5 text-green-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModelDropdown
// ---------------------------------------------------------------------------

export function ModelDropdown({ 
  model, 
  onChange,
  models,
  isLoading,
}: { 
  model: string; 
  onChange: (model: string) => void;
  models: ModelOption[];
  isLoading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLabel = models.find(m => m.value === model)?.label || 'Default';

  return (
    <div ref={dropdownRef} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-0.5 px-2 py-1 text-[10px] text-gray-600 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
          >
            {isLoading ? (
              <span className="max-w-[100px] truncate text-gray-400">Loading...</span>
            ) : (
              <span className="max-w-[100px] truncate">{currentLabel}</span>
            )}
            <ChevronDown className={`w-2.5 h-2.5 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>AI Model</p>
        </TooltipContent>
      </Tooltip>

      {open && (
        <div className="absolute top-full left-0 mt-0.5 w-44 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden z-50 max-h-64 overflow-y-auto">
          {models.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`w-full px-2 py-1.5 text-[10px] text-left text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-between ${
                model === option.value ? 'bg-gray-50' : ''
              }`}
            >
              <span>{option.label}</span>
              {model === option.value && <Check className="w-2.5 h-2.5 text-green-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CancelGenerationButton
// ---------------------------------------------------------------------------

export function CancelGenerationButton() {
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const response = await fetch('/playground/api/generate', {
        method: 'DELETE',
      });
      const data = await response.json();
      
      if (response.ok) {
        // Dispatch error event to clean up skeleton nodes
        window.dispatchEvent(new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
          detail: { componentId: '', parentNodeId: '', error: 'Cancelled by user' }
        }));
      } else {
        console.error('Failed to cancel:', data.error);
      }
    } catch (error) {
      console.error('Error cancelling generation:', error);
    }
    setIsCancelling(false);
  };

  const handleViewChat = () => {
    // Open chat log in new tab
    window.open('/playground/api/generate?action=download-chat', '_blank');
  };

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleViewChat}
            className="flex items-center gap-1 px-1.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            <Download className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Download chat log</p>
        </TooltipContent>
      </Tooltip>
      <button
        onClick={handleCancel}
        disabled={isCancelling}
        className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors disabled:opacity-50"
      >
        {isCancelling ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Stopping...</span>
          </>
        ) : (
          <>
            <XCircle className="w-3 h-3" />
            <span>Cancel</span>
          </>
        )}
      </button>
    </div>
  );
}
