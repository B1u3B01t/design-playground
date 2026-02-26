'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Check, Copy, Loader2, Zap, ChevronDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import { flatRegistry, generateIterationPrompt, generateIterationFromIterationPrompt } from '../../registry';
import {
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  ITERATION_PROMPT_COPIED_EVENT,
  COPIED_FEEDBACK_DURATION,
  ITERATION_COUNT_OPTIONS,
  type GenerationStartPayload,
  type GenerationCompletePayload,
  type GenerationErrorPayload,
} from '../../lib/constants';
import {
  ModelDropdown,
  useAvailableModels,
  loadSelectedModel,
  saveSelectedModel,
} from './IterateDialogParts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';

// ---------------------------------------------------------------------------
// IterateDialog — inline popover panel
// ---------------------------------------------------------------------------

export interface IterateDialogProps {
  componentId: string;
  componentName: string;
  parentNodeId: string;
  sourceFilename?: string;
  isGlobalGenerating: boolean;
}

export default function IterateDialog({
  componentId,
  componentName,
  parentNodeId,
  sourceFilename,
  isGlobalGenerating,
}: IterateDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [iterationCount, setIterationCount] = useState(4);
  const [depth] = useState<'shell' | '1-level' | 'all'>('shell');
  const [customInstructions, setCustomInstructions] = useState('');
  const [selectedModel, setSelectedModel] = useState(() => loadSelectedModel());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [startNumber, setStartNumber] = useState<number | null>(null);
  const [isFetchingMax, setIsFetchingMax] = useState(false);

  const isFromIteration = !!sourceFilename;
  const panelRef = useRef<HTMLDivElement>(null);

  const { models, isLoading: isLoadingModels } = useAvailableModels();

  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    saveSelectedModel(model);
  }, []);

  // Fetch max iteration number when panel opens (iteration-from-iteration)
  useEffect(() => {
    if (!open || !isFromIteration) {
      setStartNumber(null);
      return;
    }
    const fetchMaxIteration = async () => {
      setIsFetchingMax(true);
      try {
        const response = await fetch('/playground/api/iterations');
        if (!response.ok) { setStartNumber(1); return; }
        const { iterations } = (await response.json()) as {
          iterations: { filename: string; componentName: string; iterationNumber: number }[];
        };
        const componentIterations = iterations.filter(i => i.componentName === componentName);
        const maxNumber = componentIterations.reduce((max, i) => Math.max(max, i.iterationNumber), 0);
        setStartNumber(maxNumber + 1);
      } catch {
        setStartNumber(1);
      } finally {
        setIsFetchingMax(false);
      }
    };
    fetchMaxIteration();
  }, [open, isFromIteration, componentName]);

  const generatedPrompt = useMemo(() => {
    if (isFromIteration) {
      if (startNumber === null) return '';
      return generateIterationFromIterationPrompt(
        componentId, sourceFilename!, iterationCount, startNumber, depth, customInstructions || undefined,
      );
    }
    return generateIterationPrompt(componentId, iterationCount, depth, customInstructions || undefined);
  }, [componentId, sourceFilename, iterationCount, startNumber, depth, customInstructions, isFromIteration]);

  const handleCopyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.dispatchEvent(new CustomEvent(ITERATION_PROMPT_COPIED_EVENT));
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_DURATION);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  };

  const handleDefaultCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await handleCopyPrompt(generateIterationPrompt(componentId, 4, 'shell', undefined));
  };

  const handleRunWithCursor = async () => {
    if (!parentNodeId) return;
    if (isFromIteration && startNumber === null) return;

    window.dispatchEvent(
      new CustomEvent<GenerationStartPayload>(GENERATION_START_EVENT, {
        detail: { componentId, componentName, parentNodeId, iterationCount },
      }),
    );

    setOpen(false);

    try {
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

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        const msg = `Failed to parse response: ${jsonError instanceof Error ? jsonError.message : 'Unknown JSON error'}`;
        window.dispatchEvent(new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
          detail: { componentId, parentNodeId, error: msg },
        }));
        return;
      }

      if (!response.ok || !data.success) {
        const rawError = data?.error || data?.message || data || 'Generation failed';
        const normalizedError = typeof rawError === 'string' ? rawError.trim() : JSON.stringify(rawError);
        const friendly = normalizedError.includes('usage limit') || normalizedError.includes('Spend Limit')
          ? 'Generation failed because the selected model has hit its usage limit.\n\nPlease switch to a different model in the dialog and try again.'
          : `Generation failed: ${normalizedError}`;
        setErrorMessage(friendly);
        window.dispatchEvent(new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
          detail: { componentId, parentNodeId, error: normalizedError },
        }));
      } else {
        window.dispatchEvent(new CustomEvent<GenerationCompletePayload>(GENERATION_COMPLETE_EVENT, {
          detail: { componentId, parentNodeId, output: '' },
        }));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error) || 'Unknown error';
      window.dispatchEvent(new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
        detail: { componentId, parentNodeId, error: msg },
      }));
      setErrorMessage(`Generation error: ${msg}`);
    }
  };

  const canRun = !isGlobalGenerating && parentNodeId && (!isFromIteration || (startNumber !== null && !isFetchingMax));

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c') {
        e.preventDefault();
        handleCopyPrompt(generatedPrompt);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canRun) {
        e.preventDefault();
        handleRunWithCursor();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, generatedPrompt, canRun]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Small delay so the trigger click doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // ── Trigger button ──
  const triggerButton = isFromIteration ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => setOpen(o => !o)}
          disabled={isGlobalGenerating}
          className={`w-8 h-8 flex items-center justify-center text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${open ? 'rounded-l-full rounded-r-[8px]' : 'rounded-full'}`}
          style={{ background: '#0B99FF' }}
          aria-label="Iterate"
        >
          <Zap className="w-4 h-4 fill-white" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{isGlobalGenerating ? 'Another generation is in progress' : 'Iterate'}</p>
      </TooltipContent>
    </Tooltip>
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={(e) => {
            if (e.shiftKey) {
              handleDefaultCopy(e);
            } else {
              setOpen(o => !o);
            }
          }}
          className={`w-8 h-8 flex items-center justify-center text-white transition-all ${open ? 'rounded-l-full rounded-r-[8px]' : 'rounded-full'}`}
          style={{ background: '#0B99FF' }}
          aria-label="Iterate"
        >
          <Zap className="w-4 h-4 fill-white" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right"><p>Iterate</p></TooltipContent>
    </Tooltip>
  );

  return (
    <>
      {/* Wrapper keeps trigger + panel in the same stacking context */}
      <div className="relative" ref={panelRef}>
        {triggerButton}

        {/* ── Inline popover panel ── */}
        {open && (
          <div
            className="absolute left-full top-0 ml-2 z-50 nodrag nowheel nopan"
            style={{ fontFamily: 'var(--font-geist-sans), Geist, system-ui, sans-serif' }}
          >
            <div
              className="w-72 rounded-2xl p-4 flex flex-col gap-3 bg-white"
            >
              {/* Title */}
              <p className="text-sm font-medium text-stone-600">
                {isFromIteration
                  ? `Iterate from #${sourceFilename!.match(/iteration-(\d+)/)?.[1]}`
                  : 'Describe variations'}
              </p>

              {/* Source info — iteration-from-iteration */}
              {isFromIteration && isFetchingMax && (
                <div className="flex items-center gap-1 text-[10px] text-stone-400">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  <span>Finding next number…</span>
                </div>
              )}

              {/* Textarea */}
              <textarea
                autoFocus
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder={isFromIteration
                  ? 'Eg: "Try bolder typography"'
                  : 'Eg: "Try different color styles"'}
                rows={4}
                className="w-full px-3 py-2.5 text-sm bg-white rounded-xl border border-stone-200 outline-none resize-none text-stone-800 placeholder:text-stone-400"
              />

              {/* Controls row: model dropdown + count pills */}
              <div className="flex items-center justify-between gap-2">
                {/* Model dropdown — reuse existing component */}
                <ModelDropdown
                  model={selectedModel}
                  onChange={handleModelChange}
                  models={models}
                  isLoading={isLoadingModels}
                />

                {/* Count pills: 1 2 3 4 */}
                <div className="flex items-center gap-1 bg-white rounded-full px-2 py-1">
                  {(ITERATION_COUNT_OPTIONS as readonly number[]).map((n) => (
                    <button
                      key={n}
                      onClick={() => setIterationCount(n)}
                      className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium transition-colors ${iterationCount === n
                        ? 'bg-stone-800 text-white'
                        : 'text-stone-500 hover:text-stone-800'
                        }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer buttons */}
              <div className="flex items-center gap-2">
                {/* Copy */}
                <button
                  onClick={() => handleCopyPrompt(generatedPrompt)}
                  disabled={!generatedPrompt}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium text-stone-500 bg-stone-200 hover:bg-stone-300 transition-colors disabled:opacity-50"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                {/* Create variations */}
                <button
                  onClick={handleRunWithCursor}
                  disabled={!canRun}
                  className="flex-[2] py-2 rounded-xl text-sm font-semibold text-white bg-stone-900 hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGlobalGenerating ? 'Generating…' : 'Create variations'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error alert — kept as-is since it's a separate concern */}
      <AlertDialog open={!!errorMessage} onOpenChange={(o) => !o && setErrorMessage(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Iteration generation failed</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {errorMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction onClick={() => setErrorMessage(null)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
