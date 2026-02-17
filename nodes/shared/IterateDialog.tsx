'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Check, Copy, Play, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../ui/dialog';
import { Kbd } from '../../ui/kbd';
import { flatRegistry, generateIterationPrompt, generateIterationFromIterationPrompt } from '../../registry';
import {
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  ITERATION_PROMPT_COPIED_EVENT,
  COPIED_FEEDBACK_DURATION,
  type GenerationStartPayload,
  type GenerationCompletePayload,
  type GenerationErrorPayload,
} from '../../lib/constants';
import {
  IterationCountDropdown,
  DepthDropdown,
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
// IterateDialog -- unified dialog for both ComponentNode and IterationNode
// ---------------------------------------------------------------------------

export interface IterateDialogProps {
  componentId: string;
  componentName: string;
  /** ReactFlow node ID of the parent (component OR iteration) */
  parentNodeId: string;
  /** When iterating from an iteration, this is the source iteration filename */
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
  const [depth, setDepth] = useState<'shell' | '1-level' | 'all'>('shell');
  const [customInstructions, setCustomInstructions] = useState('');
  const [selectedModel, setSelectedModel] = useState(() => loadSelectedModel());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Iteration-from-iteration: fetch max number for startNumber
  const [startNumber, setStartNumber] = useState<number | null>(null);
  const [isFetchingMax, setIsFetchingMax] = useState(false);

  const isFromIteration = !!sourceFilename;

  // Fetch available models
  const { models, isLoading: isLoadingModels } = useAvailableModels();

  // Save selected model to localStorage when it changes
  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    saveSelectedModel(model);
  }, []);

  // When iterating from an iteration, fetch max iteration number when dialog opens
  useEffect(() => {
    if (!open || !isFromIteration) {
      setStartNumber(null);
      return;
    }

    const fetchMaxIteration = async () => {
      setIsFetchingMax(true);
      try {
        const response = await fetch('/playground/api/iterations');
        if (!response.ok) {
          console.error('[IterateDialog] Failed to fetch iterations');
          setStartNumber(1);
          return;
        }
        const { iterations } = (await response.json()) as {
          iterations: { filename: string; componentName: string; iterationNumber: number }[];
        };

        // Find max iteration number for this component
        const componentIterations = iterations.filter(
          (iter) => iter.componentName === componentName,
        );
        const maxNumber = componentIterations.reduce(
          (max, iter) => Math.max(max, iter.iterationNumber),
          0,
        );
        setStartNumber(maxNumber + 1);
      } catch (error) {
        console.error('[IterateDialog] Error fetching iterations:', error);
        setStartNumber(1);
      } finally {
        setIsFetchingMax(false);
      }
    };

    fetchMaxIteration();
  }, [open, isFromIteration, componentName]);

  // Generate the prompt based on current settings and mode
  const generatedPrompt = useMemo(() => {
    if (isFromIteration) {
      if (startNumber === null) return '';
      return generateIterationFromIterationPrompt(
        componentId,
        sourceFilename!,
        iterationCount,
        startNumber,
        depth,
        customInstructions || undefined,
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
    const defaultPrompt = generateIterationPrompt(componentId, 4, 'shell', undefined);
    await handleCopyPrompt(defaultPrompt);
  };

  const handleRunWithCursor = async () => {
    if (!parentNodeId) {
      console.error('[IterateDialog] Cannot generate: node ID not available');
      return;
    }
    if (isFromIteration && startNumber === null) {
      console.error('[IterateDialog] Cannot generate: startNumber not available');
      return;
    }

    // Dispatch GENERATION_START event to create skeleton nodes
    window.dispatchEvent(
      new CustomEvent<GenerationStartPayload>(GENERATION_START_EVENT, {
        detail: {
          componentId,
          componentName,
          parentNodeId,
          iterationCount,
        },
      }),
    );

    // Close dialog immediately
    setOpen(false);

    // API waits for completion - runs in background while dialog is closed
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
        const errorMessage = `Failed to parse response: ${jsonError instanceof Error ? jsonError.message : 'Unknown JSON error'}`;
        console.error('[IterateDialog] JSON parse error:', errorMessage);
        window.dispatchEvent(
          new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
            detail: { componentId, parentNodeId, error: errorMessage },
          }),
        );
        return;
      }

      if (!response.ok || !data.success) {
        const rawError = data?.error || data?.message || data || 'Generation failed';
        const normalizedError =
          typeof rawError === 'string' ? rawError.trim() : JSON.stringify(rawError);

        console.error('[IterateDialog] Generation failed:', normalizedError);

        const friendly =
          normalizedError.includes('usage limit') || normalizedError.includes('Spend Limit')
            ? 'Generation failed because the selected model has hit its usage limit.\n\n' +
              'Please switch to a different model in the dialog and try again.'
            : `Generation failed: ${normalizedError}`;

        setErrorMessage(friendly);

        window.dispatchEvent(
          new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
            detail: { componentId, parentNodeId, error: normalizedError },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent<GenerationCompletePayload>(GENERATION_COMPLETE_EVENT, {
            detail: { componentId, parentNodeId, output: '' },
          }),
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error) || 'Unknown error';
      console.error('[IterateDialog] Generation error:', errorMessage, error);
      window.dispatchEvent(
        new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
          detail: { componentId, parentNodeId, error: errorMessage },
        }),
      );
      setErrorMessage(`Generation error: ${errorMessage}`);
    }
  };

  const canRunWithCursor =
    !isGlobalGenerating &&
    parentNodeId &&
    (!isFromIteration || (startNumber !== null && !isFetchingMax));

  // Keyboard shortcuts when dialog is open
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c') {
        e.preventDefault();
        handleCopyPrompt(generatedPrompt);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canRunWithCursor) {
        e.preventDefault();
        handleRunWithCursor();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, generatedPrompt, canRunWithCursor]);

  // -------------------------------------------------------------------------
  // Trigger button
  // -------------------------------------------------------------------------
  // ComponentNode uses shift-click for quick default copy;
  // IterationNode just opens the dialog.

  const triggerButton = isFromIteration ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => setOpen(true)}
          disabled={isGlobalGenerating}
          className="flex items-center gap-1 px-2 py-1 text-xs font-mono text-white bg-black hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Iterate
        </button>
      </TooltipTrigger>
      {isGlobalGenerating && (
        <TooltipContent>
          <p>Another generation is in progress</p>
        </TooltipContent>
      )}
    </Tooltip>
  ) : (
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
  );

  // -------------------------------------------------------------------------
  // Dialog title / description
  // -------------------------------------------------------------------------
  const dialogTitle = isFromIteration
    ? `Iterate from Iteration #${sourceFilename!.match(/iteration-(\d+)/)?.[1]}`
    : 'Generate Iterations';

  const dialogDescription = isFromIteration
    ? `Generate new variations using this iteration as the base. New iterations will be numbered starting from #${startNumber ?? '...'}.`
    : 'Describe what kind of iterations you want to explore. Be specific about layout, style, or behavior changes.';

  return (
    <>
      {triggerButton}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Source info (iteration-from-iteration only) */}
            {isFromIteration && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-[10px] text-amber-700 font-mono">Base: {sourceFilename}</p>
                {startNumber !== null && (
                  <p className="text-[10px] text-amber-600 mt-0.5">
                    New iterations: #{startNumber}–{startNumber + iterationCount - 1}
                  </p>
                )}
                {isFetchingMax && (
                  <p className="text-[10px] text-amber-500 mt-0.5 flex items-center gap-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    Determining next iteration number...
                  </p>
                )}
              </div>
            )}

            {/* Custom Instructions */}
            <div>
              <label htmlFor="iterate-instructions" className="block text-sm font-medium text-gray-700 mb-2">
                Custom Instructions
              </label>
              <textarea
                id="iterate-instructions"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder={
                  isFromIteration
                    ? "e.g., 'Try bolder typography', 'Add more whitespace', 'Make it more compact'..."
                    : "e.g., 'Try a horizontal card layout with image on the left', 'Experiment with darker color schemes and bolder typography'..."
                }
                className="w-full min-h-[100px] px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
              />
              <p className="mt-1 text-xs text-gray-500">
                {isFromIteration
                  ? 'Describe how you want the new iterations to differ from this one.'
                  : 'Describe the specific changes you want to explore. Leave empty for general variations.'}
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
                <strong>How it works:</strong> Clicking &quot;Run with Cursor&quot; will start the Cursor Agent in the background
                {isFromIteration ? ' using this iteration as the base.' : '.'}
              </p>
            </div>
          </div>

          <DialogFooter className="flex-row gap-1.5">
            <button
              onClick={() => setOpen(false)}
              className="px-2.5 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleCopyPrompt(generatedPrompt)}
              disabled={!generatedPrompt}
              className="px-2.5 py-1 text-xs text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                  <Kbd>⌘⇧C</Kbd>
                </>
              )}
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleRunWithCursor}
                  disabled={!canRunWithCursor}
                  className="px-2.5 py-1 text-xs text-white bg-black hover:bg-gray-800 rounded transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-3 h-3" />
                  <span>Run</span>
                  <Kbd>⌘↵</Kbd>
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

      {/* Error dialog for generation failures (usage limits, etc.) */}
      <AlertDialog open={!!errorMessage} onOpenChange={(open) => !open && setErrorMessage(null)}>
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
