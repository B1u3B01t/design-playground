'use client';

import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, useNodeId } from '@xyflow/react';
import { ChevronDown, Check, Copy, Monitor, Tablet, Smartphone, Maximize2, Fullscreen, Play, Loader2, AlertCircle, XCircle, Download } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { flatRegistry, generateIterationPrompt, ComponentSize } from '../registry';
import { ITERATION_PROMPT_COPIED_EVENT } from '../PlaygroundCanvas';
import { usePlaygroundContext } from '../PlaygroundClient';

const PROPS_CACHE_TTL_MS = 60_000;
const propsCache = new Map<string, { ts: number; props: Record<string, unknown> }>();

// Event for size changes - IterationNodes listen for this
export const COMPONENT_SIZE_CHANGE_EVENT = 'playground:component-size-change';

// Events for generation lifecycle
export const GENERATION_START_EVENT = 'playground:generation-start';
export const GENERATION_COMPLETE_EVENT = 'playground:generation-complete';
export const GENERATION_ERROR_EVENT = 'playground:generation-error';

// Payload types for generation events
export interface GenerationStartPayload {
  componentId: string;
  componentName: string;
  parentNodeId: string;
  iterationCount: number;
}

export interface GenerationCompletePayload {
  componentId: string;
  parentNodeId: string;
  output: string;
}

export interface GenerationErrorPayload {
  componentId: string;
  parentNodeId: string;
  error: string;
}

// Size configurations for different component display sizes
export const sizeConfig: Record<ComponentSize, { width: number; height: number; scale: number; label: string }> = {
  default: { width: 0, height: 0, scale: 1, label: 'Auto' },
  laptop: { width: 1280, height: 720, scale: 0.6, label: 'Laptop' },
  tablet: { width: 768, height: 1024, scale: 0.5, label: 'Tablet' },
  mobile: { width: 375, height: 812, scale: 0.7, label: 'Mobile' },
};

// Calculate display dimensions (scaled)
export function getDisplayDimensions(size: ComponentSize) {
  const config = sizeConfig[size];
  if (size === 'default') return { width: 'auto', height: 'auto' };
  return {
    width: Math.round(config.width * config.scale),
    height: Math.round(config.height * config.scale),
  };
}

interface ComponentNodeProps {
  data: {
    componentId: string;
  };
}

function SizeDropdown({ 
  currentSize, 
  onSizeChange 
}: { 
  currentSize: ComponentSize; 
  onSizeChange: (size: ComponentSize) => void;
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

  const sizes: { key: ComponentSize; icon: React.ReactNode; label: string }[] = [
    { key: 'default', icon: <Maximize2 className="w-3 h-3" />, label: 'Auto' },
    { key: 'laptop', icon: <Monitor className="w-3 h-3" />, label: 'Laptop' },
    { key: 'tablet', icon: <Tablet className="w-3 h-3" />, label: 'Tablet' },
    { key: 'mobile', icon: <Smartphone className="w-3 h-3" />, label: 'Mobile' },
  ];

  const currentConfig = sizeConfig[currentSize];
  const currentIcon = sizes.find(s => s.key === currentSize)?.icon;

  return (
    <div ref={dropdownRef} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] text-gray-500 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            {currentIcon}
            <span>{currentConfig.label}</span>
            {currentSize !== 'default' && (
              <span className="text-gray-400">({Math.round(currentConfig.scale * 100)}%)</span>
            )}
            <ChevronDown className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Change viewport size</p>
        </TooltipContent>
      </Tooltip>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden z-50">
          {sizes.map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => {
                onSizeChange(key);
                setOpen(false);
              }}
              className={`w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2 ${currentSize === key ? 'bg-gray-50' : ''}`}
            >
              {icon}
              <span>{label}</span>
              {currentSize === key && <Check className="w-3 h-3 text-green-500 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IterationCountDropdown({ 
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

  const options = [1, 2, 3, 4];

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

function DepthDropdown({ 
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

  const options: { key: 'shell' | '1-level' | 'all'; label: string }[] = [
    { key: 'shell', label: 'Shell only' },
    { key: '1-level', label: '1 level deep' },
    { key: 'all', label: 'All levels' },
  ];

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

function ModelDropdown({ 
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

function CancelGenerationButton() {
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const response = await fetch('/playground/api/generate', {
        method: 'DELETE',
      });
      const data = await response.json();
      
      if (response.ok) {
        console.log('Generation cancelled:', data.message);
        // Dispatch error event to clean up skeleton nodes
        window.dispatchEvent(new CustomEvent(GENERATION_ERROR_EVENT, {
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

// Model storage keys
const MODELS_STORAGE_KEY = 'playground-ai-models';
const SELECTED_MODEL_STORAGE_KEY = 'playground-selected-model';

// Fallback models (used if API fetch fails and localStorage is empty)
const FALLBACK_MODELS: ModelOption[] = [
  { value: '', label: 'Default' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'o3', label: 'o3' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

interface ModelOption {
  value: string;
  label: string;
}

// Load models from localStorage
function loadStoredModels(): ModelOption[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(MODELS_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      if (Array.isArray(data.models) && data.models.length > 0) {
        return data.models;
      }
    }
  } catch (e) {
    console.error('[Models] Error loading from localStorage:', e);
  }
  return null;
}

// Save models to localStorage
function saveModelsToStorage(models: ModelOption[], source: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify({
      models,
      source,
      timestamp: Date.now(),
    }));
  } catch (e) {
    console.error('[Models] Error saving to localStorage:', e);
  }
}

// Load last selected model from localStorage
function loadSelectedModel(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(SELECTED_MODEL_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

// Save selected model to localStorage
function saveSelectedModel(model: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, model);
  } catch (e) {
    console.error('[Models] Error saving selected model:', e);
  }
}

// Hook to manage models with auto-fetch
function useAvailableModels() {
  const [models, setModels] = useState<ModelOption[]>(() => {
    // Try localStorage first, then fallback
    return loadStoredModels() || FALLBACK_MODELS;
  });
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Only fetch once per session
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchModels = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/playground/api/models');
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.models) && data.models.length > 0) {
            setModels(data.models);
            saveModelsToStorage(data.models, data.source);
            console.log(`[Models] Loaded ${data.models.length} models from ${data.source}`);
          }
        }
      } catch (error) {
        console.error('[Models] Failed to fetch models:', error);
        // Keep using localStorage/fallback models
      }
      setIsLoading(false);
    };

    fetchModels();
  }, []);

  return { models, isLoading };
}

function IterateDialog({ componentId, parentNodeId, isGlobalGenerating }: { 
  componentId: string; 
  parentNodeId: string | null;
  isGlobalGenerating: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [iterationCount, setIterationCount] = useState(4);
  const [depth, setDepth] = useState<'shell' | '1-level' | 'all'>('shell');
  const [customInstructions, setCustomInstructions] = useState('');
  const [selectedModel, setSelectedModel] = useState(() => loadSelectedModel());
  
  // Fetch available models
  const { models, isLoading: isLoadingModels } = useAvailableModels();
  
  // Save selected model to localStorage when it changes
  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    saveSelectedModel(model);
  }, []);

  const registryItem = flatRegistry[componentId];
  const componentName = registryItem?.label.replace(/\s*\(.*\)/, '') || componentId;

  // Generate the prompt based on current settings
  const generatedPrompt = generateIterationPrompt(componentId, iterationCount, depth, customInstructions || undefined);

  const handleCopyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.dispatchEvent(new CustomEvent(ITERATION_PROMPT_COPIED_EVENT));
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  };

  const handleDefaultCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const defaultPrompt = generateIterationPrompt(componentId, 4, 'shell', undefined);
    await handleCopyPrompt(defaultPrompt);
  };

  const handleRunWithCursor = async () => {
    if (!parentNodeId) {
      console.error('Cannot generate: node ID not available');
      return;
    }

    // Dispatch GENERATION_START event to create skeleton nodes
    window.dispatchEvent(new CustomEvent<GenerationStartPayload>(GENERATION_START_EVENT, {
      detail: {
        componentId,
        componentName,
        parentNodeId,
        iterationCount,
      }
    }));

    // Close dialog immediately
    setOpen(false);

    // API waits for completion - this runs in background while dialog is closed
    try {
      console.log('[IterateDialog] Starting generation, waiting for completion...');
      
      const response = await fetch('/playground/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: generatedPrompt,
          componentId,
          iterationCount,
          model: selectedModel || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error('[IterateDialog] Generation failed:', data.error);
        // Dispatch error event to remove skeleton nodes
        window.dispatchEvent(new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
          detail: {
            componentId,
            parentNodeId,
            error: data.error || 'Generation failed',
          }
        }));
      } else {
        console.log('[IterateDialog] Generation completed successfully:', data.generationId);
        // Dispatch complete event to remove skeletons and scan for iterations
        window.dispatchEvent(new CustomEvent<GenerationCompletePayload>(GENERATION_COMPLETE_EVENT, {
          detail: {
            componentId,
            parentNodeId,
            output: '',
          }
        }));
      }
    } catch (error) {
      console.error('[IterateDialog] Generation error:', error);
      window.dispatchEvent(new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
        detail: {
          componentId,
          parentNodeId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }));
    }
  };

  const canRunWithCursor = !isGlobalGenerating && parentNodeId;

  return (
    <>
      <button
        onClick={(e) => {
          if (e.shiftKey) {
            handleDefaultCopy(e);
          } else {
            setOpen(true);
          }
        }}
        className="flex items-center gap-1 px-2 py-1 text-xs font-mono text-white bg-black hover:bg-gray-800 rounded transition-colors"
      >
        <span>Iterate</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Generate Iterations</DialogTitle>
            <DialogDescription>
              Describe what kind of iterations you want to explore. Be specific about layout, style, or behavior changes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Custom Instructions */}
            <div>
              <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-2">
                Custom Instructions
              </label>
              <textarea
                id="instructions"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g., 'Try a horizontal card layout with image on the left', 'Experiment with darker color schemes and bolder typography', 'Create a more compact spacing with tighter gaps'..."
                className="w-full min-h-[100px] px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
              />
              <p className="mt-1 text-xs text-gray-500">
                Describe the specific changes you want to explore. Leave empty for general variations.
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 whitespace-nowrap">Iterations:</label>
                <IterationCountDropdown count={iterationCount} onChange={setIterationCount} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 whitespace-nowrap">Depth:</label>
                <DepthDropdown depth={depth} onChange={setDepth} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 whitespace-nowrap">Model:</label>
                <ModelDropdown 
                  model={selectedModel} 
                  onChange={handleModelChange} 
                  models={models}
                  isLoading={isLoadingModels}
                />
              </div>
            </div>

            {/* Info box */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>How it works:</strong> Clicking &quot;Run with Cursor&quot; will start the Cursor Agent in the background.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleCopyPrompt(generatedPrompt)}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Prompt</span>
                </>
              )}
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleRunWithCursor}
                  disabled={!canRunWithCursor}
                  className="px-4 py-2 text-sm text-white bg-black hover:bg-gray-800 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4" />
                  <span>Run with Cursor</span>
                </button>
              </TooltipTrigger>
              {isGlobalGenerating && (
                <TooltipContent>
                  <p>Another generation is in progress</p>
                </TooltipContent>
              )}
            </Tooltip>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ComponentNode({ data }: ComponentNodeProps) {
  const componentId = data.componentId;
  const registryItem = flatRegistry[componentId];
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [resolvedProps, setResolvedProps] = useState<Record<string, unknown> | null>(null);
  const [isLoadingProps, setIsLoadingProps] = useState(false);
  const [propsError, setPropsError] = useState<string | null>(null);
  const [isGlobalGenerating, setIsGlobalGenerating] = useState(false);
  
  // Fullscreen support
  const nodeId = useNodeId();
  const { fullscreenNodeId, enterFullscreen } = usePlaygroundContext();
  const isFullscreen = fullscreenNodeId === nodeId;
  
  // Local size state - initialized from registry
  const [size, setSize] = useState<ComponentSize>(registryItem?.size || 'default');

  // Listen for global generation state changes
  useEffect(() => {
    const handleGenerationStart = () => setIsGlobalGenerating(true);
    const handleGenerationEnd = () => setIsGlobalGenerating(false);

    window.addEventListener(GENERATION_START_EVENT, handleGenerationStart);
    window.addEventListener(GENERATION_COMPLETE_EVENT, handleGenerationEnd);
    window.addEventListener(GENERATION_ERROR_EVENT, handleGenerationEnd);

    return () => {
      window.removeEventListener(GENERATION_START_EVENT, handleGenerationStart);
      window.removeEventListener(GENERATION_COMPLETE_EVENT, handleGenerationEnd);
      window.removeEventListener(GENERATION_ERROR_EVENT, handleGenerationEnd);
    };
  }, []);

  // Emit event when size changes so IterationNodes can update
  const handleSizeChange = (newSize: ComponentSize) => {
    setSize(newSize);
    window.dispatchEvent(new CustomEvent(COMPONENT_SIZE_CHANGE_EVENT, {
      detail: { componentId, size: newSize }
    }));
  };

  // Handle wheel events to allow scrolling inside the component
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = container;
    const isScrollableY = scrollHeight > clientHeight;
    const isScrollableX = scrollWidth > clientWidth;
    
    // Check if we can scroll in the direction the user is scrolling
    const canScrollUp = scrollTop > 0;
    const canScrollDown = scrollTop < scrollHeight - clientHeight;
    const canScrollLeft = scrollLeft > 0;
    const canScrollRight = scrollLeft < scrollWidth - clientWidth;

    const isScrollingDown = e.deltaY > 0;
    const isScrollingUp = e.deltaY < 0;
    const isScrollingRight = e.deltaX > 0;
    const isScrollingLeft = e.deltaX < 0;

    // Stop propagation if we can scroll in the intended direction
    const shouldCapture = 
      (isScrollableY && ((isScrollingDown && canScrollDown) || (isScrollingUp && canScrollUp))) ||
      (isScrollableX && ((isScrollingRight && canScrollRight) || (isScrollingLeft && canScrollLeft)));

    if (shouldCapture) {
      e.stopPropagation();
    }
  };

  // Async props loader (Option D): fetch props via registryItem.getProps (playground-only)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setPropsError(null);

      if (!registryItem?.getProps) {
        setResolvedProps(null);
        setIsLoadingProps(false);
        return;
      }

      const cacheKey = componentId;
      const cached = propsCache.get(cacheKey);
      const now = Date.now();
      if (cached && now - cached.ts < PROPS_CACHE_TTL_MS) {
        setResolvedProps(cached.props);
        setIsLoadingProps(false);
        return;
      }

      setIsLoadingProps(true);
      try {
        const next = await Promise.resolve(registryItem.getProps());
        if (cancelled) return;
        propsCache.set(cacheKey, { ts: Date.now(), props: next });
        setResolvedProps(next);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load props';
        setPropsError(msg);
        setResolvedProps(null);
      } finally {
        if (!cancelled) setIsLoadingProps(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [componentId, registryItem]);

  if (!registryItem) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 min-w-[200px]">
        <p className="text-red-600 text-sm">Unknown component: {componentId}</p>
        <Handle type="source" position={Position.Right} className="!bg-red-500" />
      </div>
    );
  }

  const { Component, props, label } = registryItem;
  const effectiveProps = (resolvedProps ?? props ?? {}) as Record<string, unknown>;
  const config = sizeConfig[size];
  const isLargeComponent = size !== 'default';
  const displayDims = getDisplayDimensions(size);

  return (
    <div 
      className={`bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden ${isLargeComponent ? '' : 'min-w-[200px]'}`}
      style={isLargeComponent ? { width: displayDims.width } : undefined}
    >
      {/* Node header - draggable area, nodrag on interactive elements only */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-700">{label}</span>
          <span className="text-[10px] text-gray-400 font-mono">{componentId}</span>
        </div>
        <div className="flex items-center gap-2 nodrag">
          {isGlobalGenerating ? (
            <CancelGenerationButton />
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => nodeId && enterFullscreen(nodeId)}
                    className={`p-1 rounded transition-colors ${
                      isFullscreen 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                    aria-label="View fullscreen"
                  >
                    <Fullscreen className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View fullscreen</p>
                </TooltipContent>
              </Tooltip>
              <SizeDropdown currentSize={size} onSizeChange={handleSizeChange} />
              <IterateDialog componentId={componentId} parentNodeId={nodeId} isGlobalGenerating={isGlobalGenerating} />
            </>
          )}
        </div>
      </div>

      {/* Rendered component - nodrag/nowheel/nopan classes tell ReactFlow to let component handle events */}
      {isLargeComponent ? (
        <div 
          ref={scrollContainerRef}
          className="bg-gray-100 overflow-auto nodrag nowheel nopan"
          style={{
            width: displayDims.width,
            height: displayDims.height,
          }}
          onWheel={handleWheel}
        >
          {/* Device frame - use CSS zoom for proper scroll behavior */}
          <div 
            className="bg-white"
            style={{
              width: config.width,
              minHeight: config.height,
              zoom: config.scale,
            }}
          >
            {isLoadingProps && !Object.keys(effectiveProps).length ? (
              <div className="p-6 text-xs text-gray-500">Loading live data…</div>
            ) : propsError && !Object.keys(effectiveProps).length ? (
              <div className="p-6 text-xs text-red-600">Failed to load data: {propsError}</div>
            ) : (
              <Component {...effectiveProps} />
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 flex items-center justify-center nodrag nowheel nopan">
          {isLoadingProps && !Object.keys(effectiveProps).length ? (
            <div className="text-xs text-gray-500">Loading live data…</div>
          ) : propsError && !Object.keys(effectiveProps).length ? (
            <div className="text-xs text-red-600">Failed to load data: {propsError}</div>
          ) : (
            <Component {...effectiveProps} />
          )}
        </div>
      )}

      {/* Handles for connections - on the right side */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />
    </div>
  );
}

export default memo(ComponentNode);
