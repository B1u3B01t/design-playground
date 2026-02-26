'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Check, Copy, Play, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../ui/dialog';
import { Kbd } from '../../ui/kbd';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../ui/accordion';
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
import { cn } from '../../lib/utils';
import type { PlaygroundSkill } from '../../skills';
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
  const [instructionsOpen, setInstructionsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = window.localStorage.getItem('playground.iterate.instructionsOpen');
      if (stored === null) return true;
      return stored === 'true';
    } catch {
      return true;
    }
  });

  // Iteration-from-iteration: fetch max number for startNumber
  const [startNumber, setStartNumber] = useState<number | null>(null);
  const [isFetchingMax, setIsFetchingMax] = useState(false);

  // Skills loaded dynamically from filesystem-backed API
  const [skills, setSkills] = useState<PlaygroundSkill[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  // Allow attaching multiple skills at once
  const [activeSkills, setActiveSkills] = useState<PlaygroundSkill[]>([]);
  const [isSkillMenuOpen, setIsSkillMenuOpen] = useState(false);
  const [skillQuery, setSkillQuery] = useState('');
  const [skillHighlightIndex, setSkillHighlightIndex] = useState(0);

  const isFromIteration = !!sourceFilename;

  // Fetch available models
  const { models, isLoading: isLoadingModels } = useAvailableModels();

  // Load skills list once when the dialog component mounts
  useEffect(() => {
    let cancelled = false;

    const loadSkills = async () => {
      setIsLoadingSkills(true);
      setSkillsError(null);
      try {
        const res = await fetch('/playground/api/skills');
        if (!res.ok) {
          throw new Error(`Failed to load skills (${res.status})`);
        }
        const data = (await res.json()) as { skills: PlaygroundSkill[] };
        if (!cancelled) {
          setSkills(data.skills || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[IterateDialog] Failed to load skills:', error);
          setSkillsError('Failed to load skills');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSkills(false);
        }
      }
    };

    loadSkills();

    return () => {
      cancelled = true;
    };
  }, []);

  // Save selected model to localStorage when it changes
  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    saveSelectedModel(model);
  }, []);

  const filteredSkills = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((skill) => {
      const haystack = `${skill.id} ${skill.label} ${skill.description}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [skillQuery, skills]);

  const handleInstructionsKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === '/' && !isSkillMenuOpen && !customInstructions.trim()) {
      setIsSkillMenuOpen(true);
      setSkillQuery('');
      setSkillHighlightIndex(0);
      return;
    }

    if (!isSkillMenuOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSkillHighlightIndex((prev) => {
        if (!filteredSkills.length) return 0;
        return (prev + 1) % filteredSkills.length;
      });
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSkillHighlightIndex((prev) => {
        if (!filteredSkills.length) return 0;
        return (prev - 1 + filteredSkills.length) % filteredSkills.length;
      });
      return;
    }

    if (e.key === 'Enter') {
      if (!filteredSkills.length) {
        setIsSkillMenuOpen(false);
        return;
      }
      e.preventDefault();
      const chosen = filteredSkills[Math.min(skillHighlightIndex, filteredSkills.length - 1)];
      // Add chosen skill if not already active
      setActiveSkills((prev) =>
        prev.some((s) => s.id === chosen.id) ? prev : [...prev, chosen],
      );
      // Clear the slash query (e.g. "/front") from the textarea once a skill is selected
      setCustomInstructions('');
      setIsSkillMenuOpen(false);
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsSkillMenuOpen(false);
      return;
    }

    if (e.key === 'Backspace') {
      setSkillQuery((prev) => prev.slice(0, -1));
      return;
    }

    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      setSkillQuery((prev) => prev + e.key.toLowerCase());
    }
  };

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

  // Build combined skill prompt when multiple skills are active
  const combinedSkillPrompt = useMemo(() => {
    if (!activeSkills.length) return undefined;
    if (activeSkills.length === 1) return activeSkills[0].systemPrompt;
    return activeSkills
      .map(
        (skill) =>
          `SKILL: ${skill.label} (${skill.id})\n────────────────────\n${skill.systemPrompt.trim()}`,
      )
      .join('\n\n\n');
  }, [activeSkills]);

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
        combinedSkillPrompt,
      );
    }
    return generateIterationPrompt(
      componentId,
      iterationCount,
      depth,
      customInstructions || undefined,
      combinedSkillPrompt,
    );
  }, [
    componentId,
    sourceFilename,
    iterationCount,
    startNumber,
    depth,
    customInstructions,
    isFromIteration,
    combinedSkillPrompt,
  ]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('playground.iterate.instructionsOpen', String(instructionsOpen));
      }
    } catch {
      // ignore localStorage errors
    }
  }, [instructionsOpen]);

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
    const defaultPrompt = generateIterationPrompt(
      componentId,
      4,
      'shell',
      undefined,
      combinedSkillPrompt,
    );
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
          className="flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-mono tracking-tight text-neutral-900 shadow-sm/0 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-300"
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
      className="flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-mono tracking-tight text-neutral-900 shadow-sm/0 transition hover:border-neutral-400 hover:bg-neutral-50"
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
        <DialogContent className="max-w-xl rounded-2xl border border-neutral-200/80 bg-white/95 p-0 shadow-xl backdrop-blur-sm">
          <DialogHeader className="space-y-1 border-b border-neutral-200 px-5 pt-4 pb-3">
            <DialogTitle className="text-sm font-medium tracking-tight text-neutral-900">
              {dialogTitle}
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500">
              {dialogDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-5 py-4">
            {/* Source info (iteration-from-iteration only) */}
            {isFromIteration && (
              <div className="rounded-md border border-neutral-200 bg-neutral-50/60 px-3 py-2">
                <p className="text-[10px] font-mono text-neutral-700">
                  Base: {sourceFilename}
                </p>
                {startNumber !== null && (
                  <p className="mt-0.5 text-[10px] text-neutral-500">
                    New iterations: #{startNumber}–{startNumber + iterationCount - 1}
                  </p>
                )}
                {isFetchingMax && (
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-neutral-500">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    Determining next iteration number...
                  </p>
                )}
              </div>
            )}

            {/* Custom Instructions as accordion */}
            <Accordion
              type="single"
              collapsible
              value={instructionsOpen ? 'instructions' : undefined}
              onValueChange={(val) => setInstructionsOpen(val === 'instructions')}
              className="border-neutral-200/80 bg-neutral-50/60"
            >
              <AccordionItem value="instructions">
                <AccordionTrigger>
                  <span className="text-[11px] font-medium tracking-tight">
                    Custom instructions
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {activeSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {activeSkills.map((skill) => (
                          <div
                            key={skill.id}
                            className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-0.5 text-[10px] font-medium text-white"
                          >
                            <span>Skill: {skill.label}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveSkills((prev) =>
                                  prev.filter((s) => s.id !== skill.id),
                                )
                              }
                              className="ml-1 rounded-full px-1 text-[10px] text-neutral-200 hover:bg-neutral-800"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <textarea
                      id="iterate-instructions"
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      onKeyDown={handleInstructionsKeyDown}
                      placeholder={
                        isFromIteration
                          ? "e.g., 'Try bolder typography', 'Add more whitespace', 'Make it more compact'..."
                          : "e.g., 'Try a horizontal card layout with image on the left', 'Experiment with darker color schemes and bolder typography'..."
                      }
                      className="w-full min-h-[96px] resize-y rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm leading-relaxed text-neutral-900 outline-none ring-0 transition focus:border-neutral-400 focus:ring-1 focus:ring-neutral-900/10"
                    />
                    <p className="text-[11px] text-neutral-500">
                      {isFromIteration
                        ? 'Describe how you want the new iterations to differ from this one.'
                        : 'Describe the specific changes you want to explore. Leave empty for general variations.'}
                    </p>
                    <p className="text-[10px] text-neutral-400">
                      Type <span className="font-mono text-[10px]">/</span> to open skills and prepend a skill
                      prompt to the iteration.
                    </p>
                    {isSkillMenuOpen && (
                      <div className="mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-lg">
                        {filteredSkills.length === 0 ? (
                          <div className="px-3 py-2 text-[11px] text-neutral-500">
                            No skills match &quot;{skillQuery}&quot;
                          </div>
                        ) : (
                          filteredSkills.map((skill, index) => (
                            <button
                              key={skill.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                // Clear the slash query (e.g. "/front") from the textarea once a skill is selected
                                setCustomInstructions('');
                                setActiveSkills((prev) =>
                                  prev.some((s) => s.id === skill.id)
                                    ? prev
                                    : [...prev, skill],
                                );
                                setIsSkillMenuOpen(false);
                              }}
                              className={cn(
                                'flex w-full items-start gap-2 px-3 py-1.5 text-left text-[11px]',
                                index === skillHighlightIndex
                                  ? 'bg-neutral-900 text-white'
                                  : 'text-neutral-700 hover:bg-neutral-50',
                              )}
                            >
                              <span className="font-medium">{skill.label}</span>
                              <span
                                className={cn(
                                  'text-[10px]',
                                  index === skillHighlightIndex ? 'text-neutral-200' : 'text-neutral-500',
                                )}
                              >
                                {skill.description}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="whitespace-nowrap text-[11px] text-neutral-500">
                  Iterations
                </label>
                <IterationCountDropdown count={iterationCount} onChange={setIterationCount} />
              </div>
              <div className="flex items-center gap-2">
                <label className="whitespace-nowrap text-[11px] text-neutral-500">
                  Depth
                </label>
                <DepthDropdown depth={depth} onChange={setDepth} />
              </div>
              <div className="flex items-center gap-2">
                <label className="whitespace-nowrap text-[11px] text-neutral-500">
                  Model
                </label>
                <ModelDropdown
                  model={selectedModel}
                  onChange={handleModelChange}
                  models={models}
                  isLoading={isLoadingModels}
                />
              </div>
            </div>

            {/* Info box */}
            <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50/60 px-3 py-2">
              <p className="text-[11px] leading-relaxed text-neutral-600">
                <span className="font-medium text-neutral-800">How it works.</span>{' '}
                Clicking &quot;Run&quot; will start the Cursor Agent in the background
                {isFromIteration ? ' using this iteration as the base.' : '.'}
              </p>
            </div>
          </div>

          <DialogFooter className="flex-row items-center justify-end gap-2 border-t border-neutral-200 px-5 py-3">
            <button
              onClick={() => setOpen(false)}
              className="rounded-full px-3 py-1 text-xs text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              Cancel
            </button>
            <button
              onClick={() => handleCopyPrompt(generatedPrompt)}
              disabled={!generatedPrompt}
              className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-300"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
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
                  className="flex items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 py-1 text-xs text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:bg-neutral-300"
                >
                  <Play className="h-3 w-3" />
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
