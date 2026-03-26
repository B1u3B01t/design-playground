'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Check, Copy, Loader2, Zap } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import { generateIterationPrompt, generateIterationFromIterationPrompt } from '../../registry';
import { generateHtmlIterationPrompt, generateHtmlIterationFromIterationPrompt } from '../../lib/html-prompts';
import { captureAndSaveScreenshot, getScreenshotFilename } from '../../lib/captureAndSaveScreenshot';
import {
  InlineReference,
  InlineReferenceInput,
  InlineReferenceContent,
  InlineReferenceList,
  InlineReferenceItem,
  InlineReferenceEmpty,
  InlineReferenceGroup,
  type Segment,
} from '../../ui/inline-reference';
import type { PlaygroundSkill } from '../../skills';
import { matchesAction } from '../../lib/keybindings';
import { getProviderFields } from '../../lib/generation-body';
import {
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  ITERATION_PROMPT_COPIED_EVENT,
  COPIED_FEEDBACK_DURATION,
  ITERATION_COUNT_OPTIONS,
  DRAG_ITERATE_EVENT,
  DRAG_GHOST_GAP,
  DRAG_OVERLAY_PADDING_X,
  DRAG_OVERLAY_PADDING_Y,
  DEFAULT_COMPONENT_NODE_WIDTH,
  DEFAULT_COMPONENT_NODE_HEIGHT,
  DEFAULT_ITERATION_NODE_WIDTH,
  DEFAULT_ITERATION_NODE_HEIGHT,
  DEFAULT_EMPTY_ITERATION_INSTRUCTIONS,
  type GenerationStartPayload,
  type GenerationCompletePayload,
  type GenerationErrorPayload,
  type DragIteratePayload,
} from '../../lib/constants';
import {
  ModelDropdown,
  useAvailableModels,
  loadSelectedModel,
  saveSelectedModel,
} from './IterateDialogParts';
import { useDragToIterate, clampGrid, type DragDelta, type CursorScreenPos } from '../../hooks/useDragToIterate';
import DragSelectionOverlay from './DragSelectionOverlay';

// Ghost node ID prefix to identify and clean up drag-ghost nodes
const GHOST_NODE_PREFIX = 'drag-ghost-';

// ---------------------------------------------------------------------------
// IterateDialog — inline popover panel
// ---------------------------------------------------------------------------

export interface IterateDialogProps {
  componentId: string;
  componentName: string;
  parentNodeId: string;
  sourceFilename?: string;
  isGlobalGenerating: boolean;
  renderMode?: 'react' | 'html';
  htmlFolder?: string;
  htmlIterationFolder?: string;
}

export default function IterateDialog({
  componentId,
  componentName,
  parentNodeId,
  sourceFilename,
  isGlobalGenerating,
  renderMode,
  htmlFolder,
  htmlIterationFolder,
}: IterateDialogProps) {
  const isHtmlMode = renderMode === 'html';
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [iterationCount, setIterationCount] = useState(4);
  const [depth] = useState<'shell' | '1-level' | 'all'>('shell');
  const [selectedModel, setSelectedModel] = useState(() => loadSelectedModel());
  const [segments, setSegments] = useState<Segment[]>([]);
  const [skills, setSkills] = useState<PlaygroundSkill[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);

  const [startNumber, setStartNumber] = useState<number | null>(null);
  const [isFetchingMax, setIsFetchingMax] = useState(false);

  const isFromIteration = !!sourceFilename;
  const panelRef = useRef<HTMLDivElement>(null);

  const { models, isLoading: isLoadingModels } = useAvailableModels();
  const { getNode, setNodes, flowToScreenPosition, screenToFlowPosition } = useReactFlow();

  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    saveSelectedModel(model);
  }, []);

  // When the provider changes, auto-select the first enabled model if the
  // current selection isn't valid for the new provider.
  useEffect(() => {
    if (models.length > 0 && !models.some(m => m.value === selectedModel)) {
      handleModelChange(models[0].value);
    }
  }, [models, selectedModel, handleModelChange]);

  // Load available skills when the dialog opens (once)
  useEffect(() => {
    if (!open || skills.length > 0) return;

    let cancelled = false;
    const fetchSkills = async () => {
      setIsLoadingSkills(true);
      try {
        const response = await fetch('/playground/api/skills');
        if (!response.ok) return;
        const data = (await response.json()) as { skills?: PlaygroundSkill[] };
        if (!cancelled && Array.isArray(data.skills)) {
          setSkills(data.skills);
        }
      } catch {
        // ignore – inline reference will just have no skill items
      } finally {
        if (!cancelled) {
          setIsLoadingSkills(false);
        }
      }
    };

    fetchSkills();
    return () => {
      cancelled = true;
    };
  }, [open, skills.length]);

  const skillsById = useMemo(() => {
    const map = new Map<string, PlaygroundSkill>();
    for (const skill of skills) {
      map.set(skill.id, skill);
    }
    return map;
  }, [skills]);

  const getDefaultSkillPrompt = useCallback(
    (skillMap: Map<string, PlaygroundSkill>): string | undefined => {
      if (skillMap.size === 0) return undefined;
      const DEFAULT_SKILL_IDS = ['design-variations', 'frontend-design'] as const;
      const parts: string[] = [];
      for (const id of DEFAULT_SKILL_IDS) {
        const skill = skillMap.get(id);
        const body = skill?.systemPrompt?.trim();
        if (body) parts.push(body);
      }
      if (!parts.length) return undefined;
      return parts.join('\n\n');
    },
    [],
  );

  // Derive freeform instructions + skill prompt from inline reference segments
  const { customInstructionsText, skillPrompt } = useMemo(() => {
    const hasSegments = !!segments && segments.length > 0;

    const textParts: string[] = [];
    const skillSections: string[] = [];

    if (hasSegments) {
      for (const segment of segments) {
        if (segment.type === 'text') {
          const trimmed = segment.value.trim();
          if (trimmed) {
            textParts.push(trimmed);
          }
        } else if (segment.type === 'reference') {
          const skill = skillsById.get(segment.value);
          if (skill?.systemPrompt) {
            skillSections.push(skill.systemPrompt);
          }
        }
      }
    }

    let customInstructionsText =
      textParts.join('\n').trim() || undefined;

    let skillPromptText =
      skillSections.join('\n\n').trim() || undefined;

    // When the inline reference area is empty (no text, no explicit skills),
    // automatically apply the default design skills.
    if (!hasSegments && !skillPromptText) {
      skillPromptText = getDefaultSkillPrompt(skillsById);
    }

    // When the inline reference is completely empty, also add a default
    // instruction line at the end of the prompt.
    if (!hasSegments && !customInstructionsText) {
      customInstructionsText = DEFAULT_EMPTY_ITERATION_INSTRUCTIONS;
    }

    return { customInstructionsText, skillPrompt: skillPromptText };
  }, [segments, skillsById, getDefaultSkillPrompt]);

  // Fetch max iteration number when panel opens
  useEffect(() => {
    if (!open) {
      setStartNumber(null);
      return;
    }
    const fetchMaxIteration = async () => {
      setIsFetchingMax(true);
      try {
        if (isHtmlMode && htmlFolder) {
          // HTML mode: fetch from html-pages API
          const response = await fetch('/playground/api/html-pages');
          if (!response.ok) { setStartNumber(1); return; }
          const { pages } = (await response.json()) as { pages: { folder: string; iterations: { number: number }[] }[] };
          const page = pages.find((p: { folder: string }) => p.folder === htmlFolder);
          const maxNumber = page?.iterations.reduce((max: number, i: { number: number }) => Math.max(max, i.number), 0) ?? 0;
          setStartNumber(maxNumber + 1);
        } else {
          const response = await fetch('/playground/api/iterations');
          if (!response.ok) { setStartNumber(1); return; }
          const { iterations } = (await response.json()) as {
            iterations: { filename: string; componentName: string; iterationNumber: number }[];
          };
          const cleanName = componentName.replace(/\s+/g, '');
          const componentIterations = iterations.filter(i => i.componentName === cleanName);
          const maxNumber = componentIterations.reduce((max, i) => Math.max(max, i.iterationNumber), 0);
          setStartNumber(maxNumber + 1);
        }
      } catch {
        setStartNumber(1);
      } finally {
        setIsFetchingMax(false);
      }
    };
    fetchMaxIteration();
  }, [open, componentName, isHtmlMode, htmlFolder]);

  const generatedPrompt = useMemo(() => {
    if (startNumber === null) return '';
    if (isHtmlMode && htmlFolder) {
      if (isFromIteration && htmlIterationFolder) {
        return generateHtmlIterationFromIterationPrompt(
          htmlFolder,
          htmlIterationFolder,
          iterationCount,
          startNumber,
          customInstructionsText,
          skillPrompt,
        );
      }
      return generateHtmlIterationPrompt(
        htmlFolder,
        iterationCount,
        startNumber,
        customInstructionsText,
        skillPrompt,
      );
    }
    if (isFromIteration) {
      return generateIterationFromIterationPrompt(
        componentId,
        sourceFilename!,
        iterationCount,
        startNumber,
        depth,
        customInstructionsText,
        skillPrompt,
      );
    }
    return generateIterationPrompt(
      componentId,
      iterationCount,
      startNumber,
      depth,
      customInstructionsText,
      skillPrompt,
    );
  }, [
    componentId,
    sourceFilename,
    iterationCount,
    startNumber,
    depth,
    isFromIteration,
    customInstructionsText,
    skillPrompt,
    isHtmlMode,
    htmlFolder,
    htmlIterationFolder,
  ]);

  const handleCopyPrompt = useCallback(async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.dispatchEvent(new CustomEvent(ITERATION_PROMPT_COPIED_EVENT));
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_DURATION);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  }, []);

  const handleDefaultCopy = useCallback(async () => {
    await handleCopyPrompt(generateIterationPrompt(componentId, 4, startNumber ?? 1, 'shell', undefined));
  }, [componentId, startNumber, handleCopyPrompt]);

  const handleRunWithCursor = async () => {
    if (!parentNodeId) return;
    if (isFromIteration && startNumber === null) return;

    if (!generatedPrompt) {
      window.dispatchEvent(new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
        detail: {
          componentId,
          parentNodeId,
          error: `Component "${componentId}" is not registered. Add it to the registry before iterating.`,
        },
      }));
      return;
    }

    // Capture screenshot and rebuild prompt with the image path
    const screenshotFilename = getScreenshotFilename(componentName, sourceFilename);
    const screenshotPath = await captureAndSaveScreenshot(parentNodeId, screenshotFilename);

    // Build a fresh prompt that includes the screenshot path
    let promptWithScreenshot: string;
    if (isHtmlMode && htmlFolder) {
      if (isFromIteration && htmlIterationFolder && startNumber !== null) {
        promptWithScreenshot = generateHtmlIterationFromIterationPrompt(
          htmlFolder,
          htmlIterationFolder,
          iterationCount,
          startNumber,
          customInstructionsText,
          skillPrompt,
          screenshotPath ?? undefined,
        );
      } else {
        promptWithScreenshot = generateHtmlIterationPrompt(
          htmlFolder,
          iterationCount,
          startNumber ?? 1,
          customInstructionsText,
          skillPrompt,
          screenshotPath ?? undefined,
        );
      }
    } else if (isFromIteration && startNumber !== null) {
      promptWithScreenshot = generateIterationFromIterationPrompt(
        componentId,
        sourceFilename!,
        iterationCount,
        startNumber,
        depth,
        customInstructionsText,
        skillPrompt,
        undefined,
        screenshotPath ?? undefined,
      );
    } else {
      promptWithScreenshot = generateIterationPrompt(
        componentId,
        iterationCount,
        startNumber ?? 1,
        depth,
        customInstructionsText,
        skillPrompt,
        undefined,
        screenshotPath ?? undefined,
      );
    }

    const providerFields = getProviderFields();
    window.dispatchEvent(
      new CustomEvent<GenerationStartPayload>(GENERATION_START_EVENT, {
        detail: {
          componentId,
          componentName,
          parentNodeId,
          iterationCount,
          model: selectedModel || undefined,
          provider: providerFields.provider as GenerationStartPayload['provider'],
          ...(isHtmlMode ? { renderMode: 'html' as const, htmlFolder } : {}),
        },
      }),
    );

    setOpen(false);

    try {
      const response = await fetch('/playground/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptWithScreenshot || generatedPrompt,
          componentId,
          iterationCount,
          model: selectedModel || undefined,
          ...providerFields,
          ...(isHtmlMode ? { htmlFolder } : {}),
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

        // Delegate all error handling to PlaygroundCanvas via the generation error event
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
    }
  };

  const canRun = !isGlobalGenerating && parentNodeId && (!isFromIteration || (startNumber !== null && !isFetchingMax));

  // ---------------------------------------------------------------------------
  // Drag-to-iterate: ghost node management
  // ---------------------------------------------------------------------------

  // Track the last ghost grid to avoid re-rendering when only cursor moves
  const lastGhostGridRef = useRef<{ rows: number; cols: number } | null>(null);

  const removeGhostNodes = useCallback(() => {
    lastGhostGridRef.current = null;
    setNodes(nds => nds.filter(n => !n.id.startsWith(GHOST_NODE_PREFIX)));
  }, [setNodes]);

  // Get the parent node's cell dimensions in flow-space
  const getParentCellSize = useCallback(() => {
    const parentNode = getNode(parentNodeId);
    if (!parentNode) return null;
    const cellW =
      parentNode.measured?.width ??
      (parentNode.type === 'component'
        ? DEFAULT_COMPONENT_NODE_WIDTH
        : DEFAULT_ITERATION_NODE_WIDTH);
    const cellH =
      parentNode.measured?.height ??
      (parentNode.type === 'component'
        ? DEFAULT_COMPONENT_NODE_HEIGHT
        : DEFAULT_ITERATION_NODE_HEIGHT);
    return { cellW, cellH, parentNode };
  }, [getNode, parentNodeId]);

  // Compute grid dimensions based on the overlay extent: from the parent
  // node's top-left corner to the current cursor position, both converted
  // to flow-space. This ensures rows and columns appear at the same
  // threshold — only when the cursor crosses a full cell boundary.
  const computeGridFromScreenDelta = useCallback(
    (delta: DragDelta, dragStart: { x: number; y: number } | null) => {
      const info = getParentCellSize();
      if (!info || !dragStart) return null;
      const { cellW, cellH, parentNode } = info;

      // The cursor's absolute screen position
      const cursorScreenX = dragStart.x + delta.dx;
      const cursorScreenY = dragStart.y + delta.dy;

      // Parent node's top-left in screen space
      const parentScreen = flowToScreenPosition({
        x: parentNode.position.x,
        y: parentNode.position.y,
      });

      // The overlay extent in screen pixels (from parent top-left to cursor)
      const overlayW = cursorScreenX - parentScreen.x;
      const overlayH = cursorScreenY - parentScreen.y;

      // Convert the overlay extent to flow-space (zoom-aware)
      const flowOrigin = screenToFlowPosition({ x: 0, y: 0 });
      const flowExtent = screenToFlowPosition({ x: overlayW, y: overlayH });
      const flowW = flowExtent.x - flowOrigin.x;
      const flowH = flowExtent.y - flowOrigin.y;

      // How many cells fit? The first cell is the original. A new ghost cell
      // appears once the cursor crosses 50% of that cell's extent (+ gap).
      const step = cellW + DRAG_GHOST_GAP;
      const stepH = cellH + DRAG_GHOST_GAP;
      const rawCols = 1 + Math.max(0, Math.floor((flowW - cellW + step * 0.5) / step));
      const rawRows = 1 + Math.max(0, Math.floor((flowH - cellH + stepH * 0.5) / stepH));

      return { grid: clampGrid(rawCols, rawRows), cellW, cellH };
    },
    [getParentCellSize, screenToFlowPosition, flowToScreenPosition],
  );

  const handleDragUpdate = useCallback(
    (delta: DragDelta | null, dragStart: CursorScreenPos | null) => {
      if (!delta || !dragStart) {
        removeGhostNodes();
        return;
      }

      const result = computeGridFromScreenDelta(delta, dragStart);
      if (!result || result.grid.count === 0) {
        // Grid went to zero — remove ghosts only if they were showing
        if (lastGhostGridRef.current) {
          removeGhostNodes();
        }
        return;
      }

      const { grid, cellW, cellH } = result;

      // Skip setNodes if the grid dimensions haven't changed
      const prev = lastGhostGridRef.current;
      if (prev && prev.rows === grid.rows && prev.cols === grid.cols) {
        return;
      }
      lastGhostGridRef.current = { rows: grid.rows, cols: grid.cols };

      const info = getParentCellSize();
      if (!info) return;

      // Convert screen-pixel padding to flow-space so the ghost border
      // aligns with the selection overlay's padded origin.
      const flowZero = screenToFlowPosition({ x: 0, y: 0 });
      const flowPad = screenToFlowPosition({ x: DRAG_OVERLAY_PADDING_X, y: DRAG_OVERLAY_PADDING_Y });
      const padX = flowPad.x - flowZero.x;
      const padY = flowPad.y - flowZero.y;

      // Single bounding-box ghost node — shifted by padding so its border
      // starts at the same point as the selection overlay.
      const ghostNode = {
        id: `${GHOST_NODE_PREFIX}bounding`,
        type: 'drag-ghost' as const,
        position: {
          x: info.parentNode.position.x - padX,
          y: info.parentNode.position.y - padY,
        },
        data: {
          cols: grid.cols,
          rows: grid.rows,
          cellWidth: cellW,
          cellHeight: cellH,
          padX,
          padY,
        },
        draggable: false,
        selectable: false,
        connectable: false,
      };

      setNodes(nds => [
        ...nds.filter(n => !n.id.startsWith(GHOST_NODE_PREFIX)),
        ghostNode,
      ]);
    },
    [computeGridFromScreenDelta, getParentCellSize, setNodes, removeGhostNodes, screenToFlowPosition],
  );

  const handleDragEnd = useCallback(
    (delta: DragDelta, dragStart: CursorScreenPos) => {
      removeGhostNodes();

      const result = computeGridFromScreenDelta(delta, dragStart);
      if (!result || result.grid.count === 0) return;

      const { grid } = result;
      const model = loadSelectedModel();
      window.dispatchEvent(
        new CustomEvent<DragIteratePayload>(DRAG_ITERATE_EVENT, {
          detail: {
            componentId,
            componentName,
            parentNodeId,
            iterationCount: grid.count,
            rows: grid.rows,
            cols: grid.cols,
            model: model || undefined,
            sourceFilename: sourceFilename || undefined,
            ...(isHtmlMode ? { renderMode: 'html' as const, htmlFolder } : {}),
          },
        }),
      );
    },
    [componentId, componentName, parentNodeId, sourceFilename, removeGhostNodes, computeGridFromScreenDelta],
  );

  const handleZapClick = useCallback(
    (shiftKey: boolean) => {
      if (isGlobalGenerating) return;
      if (!isFromIteration && shiftKey) {
        handleDefaultCopy();
      } else {
        setOpen(o => !o);
      }
    },
    [isGlobalGenerating, isFromIteration, handleDefaultCopy],
  );

  const { isDragging, cursorScreen, dragStartScreen, handlers } = useDragToIterate({
    onDragEnd: handleDragEnd,
    onClick: handleZapClick,
    disabled: isGlobalGenerating,
    onDragUpdate: handleDragUpdate,
  });

  // Compute parent node's screen-space top-left for the selection overlay origin.
  // Offset by a small padding so the overlay visually encompasses the original node.
  const overlayOrigin = useMemo(() => {
    if (!isDragging || !dragStartScreen) return null;
    const parentNode = getNode(parentNodeId);
    if (!parentNode) return dragStartScreen;
    const screenPos = flowToScreenPosition({
      x: parentNode.position.x,
      y: parentNode.position.y,
    });
    return {
      x: screenPos.x - DRAG_OVERLAY_PADDING_X,
      y: screenPos.y - DRAG_OVERLAY_PADDING_Y,
    };
  }, [isDragging, dragStartScreen, getNode, parentNodeId, flowToScreenPosition]);

  // Clean up ghost nodes if component unmounts during drag
  useEffect(() => {
    return () => {
      removeGhostNodes();
    };
  }, [removeGhostNodes]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (matchesAction(e, 'iterate.copy-prompt')) {
        e.preventDefault();
        handleCopyPrompt(generatedPrompt);
      }
      if (matchesAction(e, 'iterate.run') && canRun) {
        e.preventDefault();
        handleRunWithCursor();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, generatedPrompt, canRun]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;

      // Keep dialog open when interacting with inline reference dropdown
      if (target?.closest('[data-slot="inline-reference-content"]')) {
        return;
      }

      if (panelRef.current && !panelRef.current.contains(target as Node)) {
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
  const triggerButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onPointerDown={handlers.onPointerDown}
          disabled={isGlobalGenerating}
          className={`w-8 h-8 flex items-center justify-center text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${open ? 'rounded-l-full rounded-r-[8px]' : 'rounded-full'}`}
          style={{ background: '#0B99FF', touchAction: 'none' }}
          aria-label="Iterate"
        >
          <Zap className="w-4 h-4 fill-white" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>
          {isGlobalGenerating
            ? 'Another generation is in progress'
            : isDragging
              ? 'Release to generate'
              : 'Click to configure, drag to iterate'}
        </p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <>
      {/* Free-flowing selection rectangle during drag */}
      <DragSelectionOverlay
        visible={isDragging && !!cursorScreen}
        originX={overlayOrigin?.x ?? dragStartScreen?.x ?? 0}
        originY={overlayOrigin?.y ?? dragStartScreen?.y ?? 0}
        cursorX={cursorScreen?.x ?? 0}
        cursorY={cursorScreen?.y ?? 0}
      />

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
              className="w-80 rounded-2xl p-5 flex flex-col gap-4 bg-white"
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

              {/* Inline reference input for instructions + skills */}
              <InlineReference
                value={segments}
                onValueChange={setSegments}
                className="w-full"
              >
                <InlineReferenceInput
                  autoFocus
                  placeholder={
                    isFromIteration
                      ? 'Describe how you want to iterate, then type / to add a skill…'
                      : 'Describe what to explore, then type / to add a skill…'
                  }
                  className="min-h-[96px] text-sm bg-white rounded-xl border border-stone-200 outline-none text-stone-800 placeholder:text-stone-400"
                />

                <InlineReferenceContent
                  trigger="/"
                  items={skills.map((skill) => ({
                    id: skill.id,
                    label: skill.label,
                    description: skill.description,
                    systemPrompt: skill.systemPrompt,
                  }))}
                >
                  <InlineReferenceGroup heading="Skills">
                    <InlineReferenceList>
                      {(item) => (
                        <InlineReferenceItem key={item.id} value={item}>
                          <span className="text-xs font-medium">
                            {item.label}
                          </span>
                        </InlineReferenceItem>
                      )}
                    </InlineReferenceList>
                    <InlineReferenceEmpty>
                      {isLoadingSkills
                        ? 'Loading skills…'
                        : 'No skills available.'}
                    </InlineReferenceEmpty>
                  </InlineReferenceGroup>
                </InlineReferenceContent>
              </InlineReference>

              {/* Controls */}
              <div className="flex flex-col gap-2.5">
                {/* Model + count row */}
                <div className="flex items-center justify-between">
                  <ModelDropdown
                    model={selectedModel}
                    onChange={handleModelChange}
                    models={models}
                    isLoading={isLoadingModels}
                  />

                  {/* Count pills: 1 2 3 4 */}
                  <div className="flex items-center gap-1 bg-stone-50 rounded-full px-2 py-1 border border-stone-100">
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
              </div>

              {/* Footer buttons */}
              <div className="flex items-center gap-2.5 pt-1">
                {/* Copy */}
                <button
                  onClick={() => handleCopyPrompt(generatedPrompt)}
                  disabled={!generatedPrompt}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors disabled:opacity-50"
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
                  className="flex-[2] py-2.5 rounded-xl text-sm font-semibold text-white bg-stone-900 hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGlobalGenerating ? 'Generating…' : 'Create variations'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </>
  );
}
