'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Check, Loader2, Zap } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import { generateIterationPrompt, generateIterationFromIterationPrompt } from '../../registry';
import { generateHtmlIterationPrompt, generateHtmlIterationFromIterationPrompt } from '../../lib/html-prompts';
import { generateJsxIterationPrompt, generateJsxIterationFromIterationPrompt } from '../../lib/jsx-prompts';
import { captureAndSaveScreenshot, getScreenshotFilename } from '../../lib/captureAndSaveScreenshot';
import {
  InlineReference,
  InlineReferenceInput,
  InlineReferenceContent,
  type Segment,
  type InlineReferenceHandle,
} from '../../ui/inline-reference';
import type { PlaygroundSkill } from '../../skills';
import { ImpeccableSkillPicker } from '../../ui/impeccable-skill-picker';
import { ImpeccableDemoteMenu } from '../../ui/impeccable-demote-menu';
import { useImpeccableSkillPicker } from '../../hooks/useImpeccableSkillPicker';
import { impeccablePromptFromSegment } from '../../lib/impeccable-skill';
import { matchesAction } from '../../lib/keybindings';
import { getProviderFields } from '../../lib/generation-body';
import {
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  ITERATION_PROMPT_COPIED_EVENT,
  COPIED_FEEDBACK_DURATION,
  ITERATION_COUNT_OPTIONS,
  OPEN_SKILLS_CATALOG_EVENT,
  SKILLS_CHANGED_EVENT,
  HTML_ID_PREFIX,
  JSX_ID_PREFIX,
  DRAG_GHOST_GAP,
  DRAG_OVERLAY_PADDING_X,
  DRAG_OVERLAY_PADDING_Y,
  DEFAULT_COMPONENT_NODE_WIDTH,
  DEFAULT_COMPONENT_NODE_HEIGHT,
  DEFAULT_ITERATION_NODE_WIDTH,
  DEFAULT_ITERATION_NODE_HEIGHT,
  DEFAULT_EMPTY_ITERATION_INSTRUCTIONS,
  type ModelOption,
  type GenerationStartPayload,
  type GenerationCompletePayload,
  type GenerationErrorPayload,
} from '../../lib/constants';
import {
  useAvailableModels,
  loadSelectedModel,
  saveSelectedModel,
} from './IterateDialogParts';
import { useDragToIterate, clampGrid, type DragDelta, type CursorScreenPos, type DragIterateGrid } from '../../hooks/useDragToIterate';
import DragSelectionOverlay from './DragSelectionOverlay';
import { getModelIconConfig } from '../../lib/model-icons';
import { useModelSettingsStore } from '../../lib/model-settings-store';

// Ghost node ID prefix to identify and clean up drag-ghost nodes
const GHOST_NODE_PREFIX = 'drag-ghost-';

type PendingDragGrid = {
  count: number;
  rows: number;
  cols: number;
};

function VariationStackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 20 20" aria-hidden>
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M15.6 3.396H4.25c-.314 0-.568.283-.568.633v12.665c0 .35.254.633.568.633H15.6c.314 0 .568-.284.568-.633V4.029c0-.35-.254-.633-.567-.633ZM6.8 10.361h6.25M9.925 7.236v6.25" />
      <path stroke="currentColor" strokeLinecap="round" d="M17.747 5.02v10.682M19.312 6.019v8.685" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M9 14V4M9 4L4 9M9 4L14 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ModelPillDropdown({
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

  const activeProvider = useModelSettingsStore((s) => s.activeProvider);
  const currentLabel = models.find(m => m.value === model)?.label || model || 'Default';
  const currentConfig = getModelIconConfig(model, activeProvider);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex h-9 max-w-[220px] items-center gap-2 rounded-full bg-stone-100/80 pl-2 pr-3 text-[15px] font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-800"
        aria-label="Select model"
      >
        <span
          className="size-6 flex-shrink-0 rounded-full bg-center bg-no-repeat"
          style={{
            backgroundColor: currentConfig.bg,
            backgroundImage: `url(${currentConfig.src})`,
            backgroundSize: '72%',
          }}
        />
        <span className="truncate">
          {isLoading ? 'Loading...' : currentLabel}
        </span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 max-h-64 w-64 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-1.5 shadow-[0_18px_50px_-22px_rgba(0,0,0,0.35)]">
          {models.map((option) => {
            const config = getModelIconConfig(option.value, activeProvider);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-stone-700 transition-colors hover:bg-stone-100 ${
                  model === option.value ? 'bg-stone-50' : ''
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-6 flex-shrink-0 rounded-full bg-center bg-no-repeat"
                    style={{
                      backgroundColor: config.bg,
                      backgroundImage: `url(${config.src})`,
                      backgroundSize: '72%',
                    }}
                  />
                  <span className="truncate">{option.label}</span>
                </span>
                {model === option.value && <Check className="size-3.5 flex-shrink-0 text-stone-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VariationCountDropdown({
  count,
  onChange,
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

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-stone-200/70 bg-stone-50/90 px-2.5 text-[14px] font-semibold text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
        aria-label="Select variation count"
      >
        <VariationStackIcon />
        <span>{count}x</span>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-50 mb-2 w-24 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-[0_18px_50px_-22px_rgba(0,0,0,0.35)]">
          {(ITERATION_COUNT_OPTIONS as readonly number[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-[13px] font-medium text-stone-700 transition-colors hover:bg-stone-100 ${
                count === option ? 'bg-stone-50' : ''
              }`}
            >
              <span>{option}x</span>
              {count === option && <Check className="size-3.5 text-stone-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// IterateDialog — inline popover panel
// ---------------------------------------------------------------------------

export interface IterateDialogProps {
  componentId: string;
  componentName: string;
  parentNodeId: string;
  sourceFilename?: string;
  isGlobalGenerating: boolean;
  renderMode?: 'react' | 'html' | 'jsx';
  htmlFolder?: string;
  htmlIterationFolder?: string;
  jsxFile?: string;
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
  jsxFile,
}: IterateDialogProps) {
  const resolvedHtmlFolder =
    htmlFolder ?? (componentId.startsWith(HTML_ID_PREFIX) ? componentId.slice(HTML_ID_PREFIX.length) : undefined);
  const resolvedJsxFile =
    jsxFile ?? (componentId.startsWith(JSX_ID_PREFIX) ? `${componentId.slice(JSX_ID_PREFIX.length)}.tsx` : undefined);
  const isHtmlMode = renderMode === 'html' || (!renderMode && componentId.startsWith(HTML_ID_PREFIX));
  const isJsxMode = renderMode === 'jsx' || (!renderMode && componentId.startsWith(JSX_ID_PREFIX));
  const [open, setOpen] = useState(false);
  const [, setCopied] = useState(false);
  const [iterationCount, setIterationCount] = useState(4);
  const [pendingDragGrid, setPendingDragGrid] = useState<PendingDragGrid | null>(null);
  const [depth] = useState<'shell' | '1-level' | 'all'>('shell');
  const [selectedModel, setSelectedModel] = useState(() => loadSelectedModel());
  const [segments, setSegments] = useState<Segment[]>([]);
  const [skills, setSkills] = useState<PlaygroundSkill[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);

  const [startNumber, setStartNumber] = useState<number | null>(null);
  const [isFetchingMax, setIsFetchingMax] = useState(false);

  const isFromIteration = !!sourceFilename;
  const panelRef = useRef<HTMLDivElement>(null);
  const inlineRefContainerRef = useRef<HTMLDivElement>(null);
  const inlineRefHandle = useRef<InlineReferenceHandle | null>(null);
  const previousIterationCountBeforeDragRef = useRef(iterationCount);

  const {
    impeccableSubMenuOpen,
    setImpeccableSubMenuOpen,
    demoteState,
    skillPickerItems,
    skillPickerFilterFn,
    handleSelectItem,
    handleImpeccableCommandCleared,
    closeDemoteMenu,
    resetImpeccablePicker,
  } = useImpeccableSkillPicker(skills);

  const { models, isLoading: isLoadingModels } = useAvailableModels();
  const { getNode, setNodes, flowToScreenPosition, screenToFlowPosition } = useReactFlow();

  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    saveSelectedModel(model);
  }, []);

  // Track the last ghost grid to avoid re-rendering when only cursor moves (drag preview)
  const lastGhostGridRef = useRef<{ rows: number; cols: number } | null>(null);

  const removeGhostNodes = useCallback(() => {
    lastGhostGridRef.current = null;
    setNodes(nds => nds.filter(n => !n.id.startsWith(GHOST_NODE_PREFIX)));
  }, [setNodes]);

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

  const placeGhostForGrid = useCallback(
    (grid: Pick<DragIterateGrid, 'rows' | 'cols'>, cellW: number, cellH: number) => {
      const info = getParentCellSize();
      if (!info) return;
      const flowZero = screenToFlowPosition({ x: 0, y: 0 });
      const flowPad = screenToFlowPosition({ x: DRAG_OVERLAY_PADDING_X, y: DRAG_OVERLAY_PADDING_Y });
      const padX = flowPad.x - flowZero.x;
      const padY = flowPad.y - flowZero.y;
      lastGhostGridRef.current = { rows: grid.rows, cols: grid.cols };
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
    [getParentCellSize, screenToFlowPosition, setNodes],
  );

  const closePanel = useCallback(() => {
    removeGhostNodes();
    if (pendingDragGrid) {
      setIterationCount(previousIterationCountBeforeDragRef.current);
    }
    setOpen(false);
    setPendingDragGrid(null);
    resetImpeccablePicker();
  }, [pendingDragGrid, removeGhostNodes, resetImpeccablePicker]);

  // When the provider changes, auto-select the first enabled model if the
  // current selection isn't valid for the new provider.
  useEffect(() => {
    if (models.length > 0 && !models.some(m => m.value === selectedModel)) {
      handleModelChange(models[0].value);
    }
  }, [models, selectedModel, handleModelChange]);

  // Load available skills when the dialog opens (once) and whenever skills change
  const refetchSkills = useCallback(async () => {
    setIsLoadingSkills(true);
    try {
      const response = await fetch('/playground/api/skills');
      if (!response.ok) return;
      const data = (await response.json()) as { skills?: PlaygroundSkill[] };
      if (Array.isArray(data.skills)) {
        setSkills(data.skills);
      }
    } catch {
      // ignore – inline reference will just have no skill items
    } finally {
      setIsLoadingSkills(false);
    }
  }, []);

  useEffect(() => {
    if (!open || skills.length > 0) return;
    refetchSkills();
  }, [open, skills.length, refetchSkills]);

  useEffect(() => {
    const handler = () => {
      refetchSkills();
    };
    window.addEventListener(SKILLS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SKILLS_CHANGED_EVENT, handler);
  }, [refetchSkills]);

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
        const sp = skill?.skillPath?.trim();
        if (sp) parts.push(sp);
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
          const impeccablePrompt = impeccablePromptFromSegment(
            segment,
            skillsById.get('impeccable')?.skillPath,
          );
          if (impeccablePrompt) {
            skillSections.push(impeccablePrompt);
          } else {
            const skill = skillsById.get(segment.value);
            const p = skill?.skillPath?.trim();
            if (p) skillSections.push(p);
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
        if (isJsxMode && resolvedJsxFile) {
          // JSX mode: fetch from oncanvas-components API
          const response = await fetch('/playground/api/oncanvas-components');
          if (!response.ok) { setStartNumber(1); return; }
          const { components } = (await response.json()) as { components: { filename: string; iterations: { iterationNumber: number }[] }[] };
          const baseName = resolvedJsxFile.replace(/\.iteration-\d+\.tsx$/, '.tsx');
          const comp = components.find((c: { filename: string }) => c.filename === baseName);
          const maxNumber = comp?.iterations.reduce((max: number, i: { iterationNumber: number }) => Math.max(max, i.iterationNumber), 0) ?? 0;
          setStartNumber(maxNumber + 1);
        } else if (isHtmlMode && resolvedHtmlFolder) {
          // HTML mode: fetch from html-pages API
          const response = await fetch('/playground/api/html-pages');
          if (!response.ok) { setStartNumber(1); return; }
          const { pages } = (await response.json()) as { pages: { folder: string; iterations: { number: number }[] }[] };
          const page = pages.find((p: { folder: string }) => p.folder === resolvedHtmlFolder);
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
  }, [open, componentName, isHtmlMode, resolvedHtmlFolder, isJsxMode, resolvedJsxFile]);

  const generatedPrompt = useMemo(() => {
    if (startNumber === null) return '';
    if (isJsxMode && resolvedJsxFile) {
      const baseFile = resolvedJsxFile.replace(/\.iteration-\d+\.tsx$/, '.tsx');
      if (isFromIteration) {
        return generateJsxIterationFromIterationPrompt(
          baseFile,
          resolvedJsxFile,
          iterationCount,
          startNumber,
          customInstructionsText,
          skillPrompt,
        );
      }
      return generateJsxIterationPrompt(
        baseFile,
        iterationCount,
        startNumber,
        customInstructionsText,
        skillPrompt,
      );
    }
    if (isHtmlMode && resolvedHtmlFolder) {
      if (isFromIteration && htmlIterationFolder) {
        return generateHtmlIterationFromIterationPrompt(
          resolvedHtmlFolder,
          htmlIterationFolder,
          iterationCount,
          startNumber,
          customInstructionsText,
          skillPrompt,
        );
      }
      return generateHtmlIterationPrompt(
        resolvedHtmlFolder,
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
    resolvedHtmlFolder,
    htmlIterationFolder,
    isJsxMode,
    resolvedJsxFile,
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
    if (isJsxMode && resolvedJsxFile) {
      const baseFile = resolvedJsxFile.replace(/\.iteration-\d+\.tsx$/, '.tsx');
      if (isFromIteration && startNumber !== null) {
        promptWithScreenshot = generateJsxIterationFromIterationPrompt(
          baseFile,
          resolvedJsxFile,
          iterationCount,
          startNumber,
          customInstructionsText,
          skillPrompt,
          screenshotPath ?? undefined,
        );
      } else {
        promptWithScreenshot = generateJsxIterationPrompt(
          baseFile,
          iterationCount,
          startNumber ?? 1,
          customInstructionsText,
          skillPrompt,
          screenshotPath ?? undefined,
        );
      }
    } else if (isHtmlMode && resolvedHtmlFolder) {
      if (isFromIteration && htmlIterationFolder && startNumber !== null) {
        promptWithScreenshot = generateHtmlIterationFromIterationPrompt(
          resolvedHtmlFolder,
          htmlIterationFolder,
          iterationCount,
          startNumber,
          customInstructionsText,
          skillPrompt,
          screenshotPath ?? undefined,
        );
      } else {
        promptWithScreenshot = generateHtmlIterationPrompt(
          resolvedHtmlFolder,
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
          startNumber: startNumber ?? 1,
          model: selectedModel || undefined,
          provider: providerFields.provider as GenerationStartPayload['provider'],
          ...(pendingDragGrid ? { gridLayout: { rows: pendingDragGrid.rows, cols: pendingDragGrid.cols } } : {}),
          ...(isJsxMode
            ? { renderMode: 'jsx' as const, jsxFile: resolvedJsxFile }
            : isHtmlMode
              ? { renderMode: 'html' as const, htmlFolder: resolvedHtmlFolder }
              : {}),
        },
      }),
    );

    closePanel();

    try {
      const response = await fetch('/playground/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptWithScreenshot || generatedPrompt,
          componentId,
          iterationCount,
          model: selectedModel || undefined,
          source: 'dialog',
          ...providerFields,
          ...(isJsxMode ? { jsxFile: resolvedJsxFile } : isHtmlMode ? { htmlFolder: resolvedHtmlFolder } : {}),
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
  // Drag-to-iterate: ghost node management (continued)
  // ---------------------------------------------------------------------------

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

      placeGhostForGrid(grid, cellW, cellH);
    },
    [computeGridFromScreenDelta, placeGhostForGrid, removeGhostNodes],
  );

  const handleDragEnd = useCallback(
    (delta: DragDelta, dragStart: CursorScreenPos) => {
      const result = computeGridFromScreenDelta(delta, dragStart);
      if (!result || result.grid.count === 0) return;

      const { grid, cellW, cellH } = result;
      previousIterationCountBeforeDragRef.current = iterationCount;
      setIterationCount(grid.count);
      setPendingDragGrid({ count: grid.count, rows: grid.rows, cols: grid.cols });
      placeGhostForGrid(grid, cellW, cellH);
      setOpen(true);
    },
    [
      computeGridFromScreenDelta,
      placeGhostForGrid,
      iterationCount,
    ],
  );

  const handleZapClick = useCallback(
    (shiftKey: boolean) => {
      if (isGlobalGenerating) return;
      if (!isFromIteration && shiftKey) {
        handleDefaultCopy();
      } else if (open) {
        closePanel();
      } else {
        removeGhostNodes();
        setPendingDragGrid(null);
        setOpen(true);
      }
    },
    [isGlobalGenerating, isFromIteration, handleDefaultCopy, open, closePanel, removeGhostNodes],
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
      if (e.key === 'Escape') closePanel();
      if (matchesAction(e, 'iterate.copy-prompt')) {
        e.preventDefault();
        handleCopyPrompt(generatedPrompt);
      }
      if (matchesAction(e, 'iterate.run') && canRun) {
        e.preventDefault();
        handleRunWithCursor();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, generatedPrompt, canRun, closePanel]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;

      // Keep dialog open when interacting with inline reference dropdown or demote menu
      if (target?.closest('[data-slot="inline-reference-content"]')
        || target?.closest('[data-slot="impeccable-demote-menu"]')) {
        return;
      }

      if (panelRef.current && !panelRef.current.contains(target as Node)) {
        closePanel();
      }
    };
    // Small delay so the trigger click doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, closePanel]);

  // ── Trigger button ──
  const triggerButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onPointerDown={handlers.onPointerDown}
          disabled={isGlobalGenerating}
          className={`w-8 h-8 flex items-center justify-center text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isDragging ? 'opacity-0' : ''} ${open ? 'rounded-l-full rounded-r-[8px]' : 'rounded-full'}`}
          style={{ background: '#0B99FF', touchAction: 'none' }}
          aria-label="Iterate"
        >
          <Zap className="w-4 h-4 fill-white" strokeWidth={0} />
        </button>
      </TooltipTrigger>
      {!isDragging && (
        <TooltipContent side="right">
          <p>
            {isGlobalGenerating
              ? 'Another generation is in progress'
              : 'Click to configure, drag to iterate'}
          </p>
        </TooltipContent>
      )}
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
            style={{ fontFamily: 'var(--pg-font-sans)' }}
          >
            <div
              className="w-[410px] rounded-[30px] border border-stone-200/80 bg-[#fbfbfb] p-5 shadow-[0_24px_70px_-35px_rgba(0,0,0,0.4)]"
            >
              {/* Source info — iteration-from-iteration */}
              {isFromIteration && isFetchingMax && (
                <div className="mb-3 flex items-center gap-1 text-[11px] font-medium text-stone-400">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  <span>Finding next variation number...</span>
                </div>
              )}

              {/* Inline reference input for instructions + skills */}
              <div ref={inlineRefContainerRef}>
                <InlineReference
                  ref={inlineRefHandle}
                  value={segments}
                  onValueChange={setSegments}
                  onSelectItem={handleSelectItem}
                  onImpeccableCommandCleared={(pillEl) => {
                    handleImpeccableCommandCleared(pillEl, inlineRefContainerRef.current);
                  }}
                  onSkillPillPendingDelete={() => closeDemoteMenu()}
                  className="w-full cursor-chat-inline-input"
                >
                  <InlineReferenceInput
                    autoFocus
                    placeholder={pendingDragGrid ? 'Add context for these variations' : 'Explore variations'}
                    className="min-h-[54px] rounded-none border-none bg-transparent px-2 py-2 text-[16px] font-normal leading-[1.18] text-stone-800 shadow-none outline-none ring-0 focus-visible:border-none focus-visible:ring-0"
                    style={{
                      caretColor: 'rgb(87, 83, 78)',
                    }}
                  />

                  <InlineReferenceContent
                    trigger="/"
                    items={skillPickerItems}
                    filterFn={skillPickerFilterFn}
                    className="rounded-xl border border-stone-200 shadow-lg"
                  >
                    <ImpeccableSkillPicker
                      impeccableSubMenuOpen={impeccableSubMenuOpen}
                      onBackFromSubMenu={() => setImpeccableSubMenuOpen(false)}
                      isLoadingSkills={isLoadingSkills}
                    />
                  </InlineReferenceContent>

                  {demoteState && (
                    <ImpeccableDemoteMenu
                      demoteState={demoteState}
                      onSelect={(command) => {
                        inlineRefHandle.current?.updateImpeccablePill(demoteState.pillEl, command);
                        closeDemoteMenu();
                      }}
                      onClose={closeDemoteMenu}
                    />
                  )}
                </InlineReference>
              </div>

              {/* Controls + circular CTA */}
              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <ModelPillDropdown
                    model={selectedModel}
                    onChange={handleModelChange}
                    models={models}
                    isLoading={isLoadingModels}
                  />
                  {!pendingDragGrid && (
                    <VariationCountDropdown
                      count={iterationCount}
                      onChange={(count) => {
                        previousIterationCountBeforeDragRef.current = count;
                        setIterationCount(count);
                      }}
                    />
                  )}
                </div>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleRunWithCursor}
                  disabled={!canRun}
                  className={`flex size-14 flex-shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed ${
                    canRun
                      ? 'bg-stone-800 text-white hover:bg-stone-700'
                      : 'bg-stone-200 text-stone-400'
                  }`}
                  aria-label="Create variations"
                >
                  {isGlobalGenerating ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <ArrowUpIcon />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </>
  );
}
