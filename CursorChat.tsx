'use client';

import { useState, useEffect, useCallback, useRef, useMemo, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  InlineReference,
  InlineReferenceInput,
  InlineReferenceContent,
  InlineReferenceList,
  InlineReferenceItem,
  InlineReferenceEmpty,
  InlineReferenceGroup,
  type Segment,
} from './ui/inline-reference';
import type { PlaygroundSkill } from './skills';
import { useAvailableModels } from './nodes/shared/IterateDialogParts';
import { useCursorChat } from './hooks/useCursorChat';
import { getModelIconConfig } from './lib/model-icons';
import { getSkillBubbleStyle } from './lib/skill-icons';
import { ITERATION_COUNT_OPTIONS, CURSOR_CHAT_DEFAULT_COUNT, CURSOR_CHAT_OPEN_EVENT, type CursorChatSubmitPayload, type CursorChatOpenPayload } from './lib/constants';
import { matchesAction, formatKeyCombo, getCombo } from './lib/keybindings';
import type { SelectedElement } from './lib/element-context';
import { useModelSettingsStore } from './lib/model-settings-store';
import type { SelectedNodeContext } from './hooks/useNodeSelection';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CursorChatProps {
  isGenerating: boolean;
  onSubmit: (payload: CursorChatSubmitPayload) => Promise<void>;
  selectedElements?: SelectedElement[];
  onRemoveElement?: (index: number) => void;
  onClearElements?: () => void;
  selectedNodes?: SelectedNodeContext[];
  onRemoveNode?: (nodeId: string) => void;
  onClearNodes?: () => void;
}

// ---------------------------------------------------------------------------
// Bracket SVG for element chip
// ---------------------------------------------------------------------------

function BracketIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
      <path d="M3.5 2L1.5 6L3.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 2L10.5 6L8.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FrameIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
  );
}

// Edit / Explore icons — sourced from src/app/playground/assets/{edit,explore}-icon.svg.
// Inlined so they pick up `currentColor` from the active toggle segment.
function EditIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 10 10" fill="none" className={className} aria-hidden>
      <path
        d="M7.21853 0.821105C7.42413 0.615505 7.70299 0.5 7.99375 0.5C8.28451 0.5 8.56337 0.615505 8.76897 0.821105C8.97457 1.0267 9.09007 1.30556 9.09007 1.59632C9.09007 1.88708 8.97457 2.16594 8.76897 2.37154L2.56724 8.57326L0.5 9.09007L1.01681 7.02283L7.21853 0.821105Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExploreIcon({ className }: { className?: string }) {
  return (
    <svg width="13" height="14" viewBox="0 0 11 13" fill="currentColor" className={className} aria-hidden>
      <circle cx="1.04653" cy="8.34829" r="1.04653" />
      <circle cx="1.04653" cy="3.93227" r="1.04653" />
      <circle cx="5.30825" cy="1.04653" r="1.04653" />
      <circle cx="9.70083" cy="3.93227" r="1.04653" />
      <circle cx="5.3102" cy="6.02553" r="1.04653" />
      <circle cx="9.70083" cy="8.34829" r="1.04653" />
      <circle cx="5.3102" cy="11.0045" r="1.04653" />
    </svg>
  );
}

/** Leading pill icon that swaps to a remove control on row hover (`group` on parent). */
function PillLeadingRemoveSlot({
  icon,
  onRemove,
  slotClassName = 'h-3 w-3',
}: {
  icon: ReactNode;
  onRemove?: () => void;
  slotClassName?: string;
}) {
  if (!onRemove) {
    return (
      <span className={`inline-flex flex-shrink-0 items-center justify-center ${slotClassName}`}>
        {icon}
      </span>
    );
  }
  return (
    <span className={`relative inline-flex flex-shrink-0 items-center justify-center ${slotClassName}`}>
      <span className="flex items-center justify-center group-hover:invisible">{icon}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRemove();
        }}
        className="absolute inset-0 hidden items-center justify-center rounded-full text-current hover:bg-black/10 group-hover:flex"
        aria-label="Remove reference"
      >
        <span className="text-[14px] leading-none font-light">×</span>
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Iteration Count Dragger
// ---------------------------------------------------------------------------

const DRAG_STEP_PX = 24; // pixels of vertical drag per ±1 count
const MIN_COUNT = ITERATION_COUNT_OPTIONS[0];
const MAX_COUNT = ITERATION_COUNT_OPTIONS[ITERATION_COUNT_OPTIONS.length - 1];

function IterationCountDragger({ count, onChange }: { count: number; onChange: (n: number) => void }) {
  const dragStartY = useRef(0);
  const dragStartCount = useRef(count);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
    dragStartCount.current = count;
  }, [count]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!(e.target as HTMLElement).hasPointerCapture(e.pointerId)) return;
    const delta = dragStartY.current - e.clientY; // up = positive
    const steps = Math.round(delta / DRAG_STEP_PX);
    const next = Math.min(MAX_COUNT, Math.max(MIN_COUNT, dragStartCount.current + steps));
    onChange(next);
  }, [onChange]);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="inline-flex items-center justify-center py-1 pl-1.5 pr-2 gap-1 rounded-full text-[9px] font-medium transition-transform duration-150 ease-out select-none bg-stone-50 text-stone-500 border border-stone-100 hover:text-stone-700 hover:scale-[1.05] active:scale-[0.95]"
      style={{ cursor: 'ns-resize', touchAction: 'none' }}
    >
      <span className="cursor-ns-resize flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 20 20">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M15.6 3.396H4.25c-.314 0-.568.283-.568.633v12.665c0 .35.254.633.568.633H15.6c.314 0 .568-.284.568-.633V4.029c0-.35-.254-.633-.567-.633ZM6.8 10.361h6.25M9.925 7.236v6.25" />
          <path stroke="currentColor" strokeLinecap="round" d="M17.747 5.02v10.682M19.312 6.019v8.685" />
        </svg>
      </span>
      <span className="text-nowrap">{count}x</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// CursorChat Component
// ---------------------------------------------------------------------------

export default function CursorChat({ isGenerating, onSubmit, selectedElements, onRemoveElement, onClearElements, selectedNodes, onRemoveNode, onClearNodes }: CursorChatProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [skills, setSkills] = useState<PlaygroundSkill[]>([]);
  const [iterationCount, setIterationCount] = useState(CURSOR_CHAT_DEFAULT_COUNT);
  // User-preferred mode between Edit and Explore. The effective mode (including
  // 'raw') is derived from this + selection context at render/submit time.
  const [chatMode, setChatMode] = useState<'explore' | 'edit'>('explore');
  const inlineRefContainerRef = useRef<HTMLDivElement | null>(null);

  const { models, isLoading: isLoadingModels } = useAvailableModels();

  const {
    mode,
    model,
    targetNode,
    flowPosition,
    containerRef,
    modeRef,
    activate,
    deactivate,
    place,
    unplace,
    cycleModel,
    hitTestNode,
    isSwitching,
    nextModel,
    getMousePos,
  } = useCursorChat(models);

  // Fetch skills once
  useEffect(() => {
    let cancelled = false;
    const fetchSkills = async () => {
      try {
        const response = await fetch('/playground/api/skills');
        if (!response.ok) return;
        const data = (await response.json()) as { skills?: PlaygroundSkill[] };
        if (!cancelled && Array.isArray(data.skills)) {
          setSkills(data.skills);
        }
      } catch {
        // ignore
      }
    };
    fetchSkills();
    return () => { cancelled = true; };
  }, []);

  // Build skill items for InlineReference
  const skillItems = useMemo(
    () =>
      skills.map((skill) => ({
        id: skill.id,
        label: skill.label,
        description: skill.description,
      })),
    [skills],
  );

  const skillsById = useMemo(() => {
    const map = new Map<string, PlaygroundSkill>();
    for (const skill of skills) map.set(skill.id, skill);
    return map;
  }, [skills]);

  // Helper to get the contentEditable input element
  const getInputEl = useCallback(() => {
    return inlineRefContainerRef.current?.querySelector<HTMLDivElement>(
      '[data-slot="inline-reference-input"]'
    ) ?? null;
  }, []);

  // Focus input when mode becomes active
  useEffect(() => {
    if (mode === 'peek' || mode === 'placed') {
      requestAnimationFrame(() => {
        const el = getInputEl();
        if (el) el.focus();
      });
    }
  }, [mode, getInputEl]);

  // Auto-transition peek → placed when the user starts typing. We watch the
  // segment list; the moment any text content appears we pin the box where
  // the bubble currently is (last known mouse position) so the user can keep
  // typing without an explicit click. Hit-tests for a node under the cursor
  // so the placed mode also picks up a target if applicable.
  useEffect(() => {
    if (modeRef.current !== 'peek') return;
    const hasText = segments.some(
      (s) => (s.type === 'text' && s.value.trim().length > 0) || s.type === 'reference',
    );
    if (!hasText) return;
    const { x, y } = getMousePos();
    const hitNode = hitTestNode(x, y);
    place(x, y, hitNode);
  }, [segments, modeRef, getMousePos, hitTestNode, place]);

  // Auto-open cursor chat when elements are selected while chat is inactive
  const prevElementCountRef = useRef(0);
  useEffect(() => {
    const prevCount = prevElementCountRef.current;
    const curCount = selectedElements?.length ?? 0;
    prevElementCountRef.current = curCount;

    // Only trigger when going from 0 to >0 elements
    if (prevCount === 0 && curCount > 0 && modeRef.current === 'inactive') {
      // Place the chat near the first selected element
      const firstEl = selectedElements![0].element;
      const rect = firstEl.getBoundingClientRect();
      const clickX = rect.right + 8;
      const clickY = rect.top;

      // Resolve the hit node from the element
      const hitNode = hitTestNode(rect.left + rect.width / 2, rect.top + rect.height / 2);

      // Activate then immediately place
      activate();
      // Use rAF to ensure activate's state update has flushed
      requestAnimationFrame(() => {
        place(clickX, clickY, hitNode);
      });
    }
  }, [selectedElements, modeRef, activate, place, hitTestNode]);

  // Programmatic open via custom event (e.g. after HTML page creation)
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const { targetNode: target, screenX, screenY, editMode: shouldEdit } =
        (e as CustomEvent<CursorChatOpenPayload>).detail;

      activate();
      requestAnimationFrame(() => {
        place(screenX + 16, screenY, target);
        if (shouldEdit) setChatMode('edit');
      });
    };

    window.addEventListener(CURSOR_CHAT_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(CURSOR_CHAT_OPEN_EVENT, handleOpen);
  }, [activate, place]);

  // Extract text and skill prompts from segments
  const extractPayload = useCallback(() => {
    const textParts: string[] = [];
    const skillPrompts: string[] = [];
    const skillIds: string[] = [];

    for (const segment of segments) {
      if (segment.type === 'text') {
        const trimmed = segment.value.trim();
        if (trimmed) textParts.push(trimmed);
      } else if (segment.type === 'reference') {
        skillIds.push(segment.value);
        const skill = skillsById.get(segment.value);
        const p = skill?.skillPath?.trim();
        if (p) skillPrompts.push(p);
      }
    }

    return { text: textParts.join('\n').trim(), skillPrompts, skillIds };
  }, [segments, skillsById]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    const { text, skillPrompts, skillIds } = extractPayload();
    if (!text && skillPrompts.length === 0) return;

    // Keep canvas selection as references; only an explicitly placed node is treated as target.
    const effectiveTarget = targetNode;
    const referenceOnly = selectedNodes;

    // Auto-collapse to 'raw' when there's nothing to edit/explore against.
    const hasSelection = !!effectiveTarget
      || (selectedElements?.length ?? 0) > 0
      || (selectedNodes?.length ?? 0) > 0;
    const effectiveChatMode: 'edit' | 'explore' | 'raw' =
      hasSelection ? chatMode : 'raw';

    const payload: CursorChatSubmitPayload = {
      text,
      skillPrompts,
      skillIds,
      model,
      provider: useModelSettingsStore.getState().activeProvider,
      targetNodeId: effectiveTarget?.nodeId ?? null,
      targetComponentId: effectiveTarget?.componentId ?? null,
      targetComponentName: effectiveTarget?.componentName ?? null,
      targetType: effectiveTarget?.type ?? null,
      sourceFilename: effectiveTarget?.sourceFilename,
      iterationCount: effectiveChatMode === 'explore' ? iterationCount : 1,
      canvasPosition: flowPosition ?? { x: 0, y: 0 },
      editMode: effectiveChatMode === 'edit',
      chatMode: effectiveChatMode,
      renderMode: effectiveTarget?.renderMode,
      htmlPageSlug: effectiveTarget?.htmlPageSlug,
      htmlIterationFolder: effectiveTarget?.htmlIterationFolder,
      jsxFile: effectiveTarget?.jsxFile,
      embedUrl: effectiveTarget?.embedUrl,
      elementSelections: selectedElements && selectedElements.length > 0
        ? selectedElements.map((sel) => ({
            tagName: sel.context.tagName,
            displayName: sel.context.displayName,
            textContent: sel.context.textContent,
            cssSelector: sel.context.cssSelector,
            htmlSource: sel.context.htmlSource,
            ancestorComponents: sel.context.ancestorComponents,
            nodeId: sel.nodeId,
            componentName: sel.componentName,
          }))
        : undefined,
      referenceNodes: referenceOnly && referenceOnly.length > 0
        ? referenceOnly.map((node) => ({
            nodeId: node.nodeId,
            componentId: node.componentId,
            componentName: node.componentName,
            type: node.type,
            sourceFilename: node.sourceFilename,
            ...(node.renderMode === 'embed' && node.embedUrl ? { embedUrl: node.embedUrl } : {}),
            ...(node.type === 'image'
              ? { imagePath: node.imagePath, imageUrl: node.imageUrl }
              : {}),
          }))
        : undefined,
    };

    // Clear and deactivate
    setSegments([]);
    const el = getInputEl();
    if (el) el.textContent = '';
    onClearElements?.();
    onClearNodes?.();
    deactivate();

    await onSubmit(payload);
  }, [extractPayload, model, iterationCount, targetNode, flowPosition, chatMode, deactivate, onSubmit, getInputEl, selectedElements, onClearElements, selectedNodes, onClearNodes]);

  // Keyboard handling
  useEffect(() => {
    if (mode === 'inactive') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: progressive dismissal
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        const pickerOpen = document.querySelector('[data-slot="inline-reference-content"]');
        if (pickerOpen) return;

        if (modeRef.current === 'placed') {
          unplace();
        } else {
          setSegments([]);
          const el = getInputEl();
          if (el) el.textContent = '';
          onClearElements?.();
          deactivate();
        }
        return;
      }

      // Cycle model (default: Shift+Tab)
      if (matchesAction(e, 'cursor-chat.cycle-model')) {
        e.preventDefault();
        cycleModel();
        return;
      }

      // Toggle edit/iterate mode (default: Cmd+E) — toggles Edit ↔ Explore.
      // 'raw' is auto-applied at render/submit time when there's no selection.
      if (matchesAction(e, 'cursor-chat.toggle-edit-mode')) {
        e.preventDefault();
        setChatMode((prev) => (prev === 'edit' ? 'explore' : 'edit'));
        return;
      }

      // Enter: submit
      if (e.key === 'Enter' && !e.shiftKey) {
        const pickerOpen = document.querySelector('[data-slot="inline-reference-content"]');
        if (pickerOpen) return;
        e.preventDefault();
        handleSubmit();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [mode, modeRef, deactivate, unplace, cycleModel, handleSubmit, getInputEl, onClearElements]);

  // Click handler for placement
  useEffect(() => {
    if (mode !== 'peek') return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-cursor-chat]')) return;

      e.stopPropagation();
      e.preventDefault();

      const hitNode = hitTestNode(e.clientX, e.clientY);
      place(e.clientX, e.clientY, hitNode);
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    return () => window.removeEventListener('mousedown', handleMouseDown, true);
  }, [mode, hitTestNode, place]);

  // Model label
  const modelLabel = useMemo(() => {
    if (isLoadingModels) return 'Loading...';
    const found = models.find(m => m.value === model);
    return found?.label || model;
  }, [models, model, isLoadingModels]);

  // Short model name (strip provider prefix like "Claude 4.6 Opus" → "Opus")
  const shortModelName = useMemo(() => {
    if (isLoadingModels) return 'AI';
    const found = models.find(m => m.value === model);
    const label = found?.label || model;
    // Strip common prefixes
    const cleaned = label
      .replace(/^Claude\s+\d+(\.\d+)?\s*/i, '')
      .replace(/^GPT-?\s*/i, '')
      .replace(/^Gemini\s+\d*\s*/i, '')
      .replace(/\(.*?\)/g, '')
      .trim();
    return cleaned || label;
  }, [models, model, isLoadingModels]);

  if (mode === 'inactive') return null;

  const isPeek = mode === 'peek';
  const isPlaced = mode === 'placed';
  const chatActiveProvider = useModelSettingsStore.getState().activeProvider;
  const currentConfig = getModelIconConfig(model, chatActiveProvider);
  const nextConfig = nextModel ? getModelIconConfig(nextModel, chatActiveProvider) : currentConfig;

  // Effective chat mode: auto-collapses to 'raw' when there's nothing selected
  // (peek, or placed with no target/elements/nodes). The toggle UI is only
  // rendered for the non-raw cases below.
  const hasSelection = !!targetNode
    || (selectedElements?.length ?? 0) > 0
    || (selectedNodes?.length ?? 0) > 0;
  const effectiveChatMode: 'edit' | 'explore' | 'raw' =
    isPlaced && hasSelection ? chatMode : 'raw';
  const showModeToggle = isPlaced && hasSelection;

  return (
    <div
      ref={containerRef}
      data-cursor-chat
      className="fixed top-0 left-0 z-[9999] pointer-events-none"
      style={{ willChange: 'transform' }}
    >
      {/* Teardrop Bubble + Model Label */}
      <div className="flex items-center gap-2.5">
        <div className={`cursor-bubble ${isSwitching ? 'is-switching' : ''}`}>
          <div
            className="bubble-face bubble-face--current"
            style={{
              backgroundColor: currentConfig.bg,
              backgroundImage: `url(${currentConfig.src})`,
            }}
          />
          <div
            className="bubble-face bubble-face--next"
            style={{
              backgroundColor: nextConfig.bg,
              backgroundImage: `url(${nextConfig.src})`,
            }}
          />
        </div>
        {isPeek && (
          <span className="text-[12px] opacity-50 font-base text-stone-500 select-none whitespace-nowrap pointer-events-none">
            {modelLabel}
          </span>
        )}
        {isPlaced && (
          <button
            type="button"
            onClick={cycleModel}
            className="pointer-events-auto text-[12px] font-base text-stone-500 hover:text-stone-700 select-none whitespace-nowrap transition-colors"
            title={`Switch model (${formatKeyCombo(getCombo('cursor-chat.cycle-model'))})`}
          >
            {modelLabel}
          </button>
        )}
      </div>

      {/* Chat Box — centered directly below the bubble */}
      <div
        className="pointer-events-auto flex flex-col transition-opacity duration-150 text-sm"
        style={{
          position: 'absolute',
          top: '36px',
          left: '28px',
          transform: 'translateX(-9%)',
          width: '320px',
          minWidth: isPlaced ? '260px' : undefined,
          opacity: isPeek ? 0.85 : 1,
        }}
      >
        <div
          style={{
            background: isPlaced ? '#fbfbfb' : 'rgba(239, 239, 239)',
            // backdropFilter: 'blur(20px)',
            // WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '4px 18px 18px 18px',
            border: isPeek ? '1px dashed rgb(178, 175, 172)' : '1px solid rgb(232, 229, 228)',
            padding: '14px',
            boxShadow: isPlaced
              ? '0 0 50px -18px rgba(0,0,0,0.15)'
              : 'none',
          }}
        >
        {/* Selection pills — all in one wrapping row */}
        {(
          (isPlaced && targetNode && (!selectedElements || selectedElements.length === 0)) ||
          (selectedElements && selectedElements.length > 0) ||
          (selectedNodes && selectedNodes.length > 0)
        ) && (
          <div className="flex flex-wrap items-center gap-1 mb-4">
            {/* Target component chip */}
            {isPlaced && targetNode && (!selectedElements || selectedElements.length === 0) && (
              <div
                className="flex items-center gap-1 px-2.5 py-1.5 select-none"
                style={{
                  background: 'rgb(250, 250, 249)',
                  border: '1px solid rgb(147, 197, 253)',
                  borderRadius: '50px',
                  color: 'rgb(59, 130, 246)',
                  fontSize: '10px',
                  fontWeight: 500,
                }}
              >
                <FrameIcon/>
                <span>{targetNode.componentName}</span>
              </div>
            )}

            {/* Selected element chips */}
            {selectedElements && selectedElements.length > 0 && selectedElements.map((sel, i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-2.5 py-1.5 select-none group"
                style={{
                  background: 'rgb(239, 246, 255)',
                  border: '1px solid rgb(147, 197, 253)',
                  borderRadius: '50px',
                  color: 'rgb(59, 130, 246)',
                  fontSize: '10px',
                  fontWeight: 500,
                }}
              >
                <PillLeadingRemoveSlot
                  icon={<BracketIcon />}
                  onRemove={onRemoveElement ? () => onRemoveElement(i) : undefined}
                />
                <span>&lt;{sel.context.tagName}&gt; {sel.componentName}</span>
              </div>
            ))}

            {/* Node reference chips */}
            {selectedNodes && selectedNodes.length > 0 && selectedNodes.map((node) => (
              <div
                key={node.nodeId}
                className="flex items-center gap-1 px-2.5 py-1.5 select-none group"
                style={node.type === 'image' ? {
                  background: 'rgb(245, 243, 255)',
                  border: '1px solid rgb(167, 139, 250)',
                  borderRadius: '50px',
                  color: 'rgb(109, 40, 217)',
                  fontSize: '9px',
                  fontWeight: 500,
                } : {
                  background: 'rgb(236, 253, 245)',
                  border: '1px solid rgb(110, 231, 183)',
                  borderRadius: '50px',
                  color: 'rgb(5, 150, 105)',
                  fontSize: '10px',
                  fontWeight: 500,
                }}
              >
                <PillLeadingRemoveSlot
                  slotClassName="h-2.5 w-2.5"
                  icon={
                    node.type === 'image' ? (
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                        <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1" />
                        <path d="M2 11l3-3 2 2 3-3 4 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M5 6h6M5 8h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                      </svg>
                    )
                  }
                  onRemove={onRemoveNode ? () => onRemoveNode(node.nodeId) : undefined}
                />
                <span>{node.componentName}</span>
              </div>
            ))}
          </div>
        )}

        {/* Select to edit / explore chip — shown whenever the chat has no
            selection (peek, or placed without a target/elements/nodes). */}
        {effectiveChatMode === 'raw' && (
          <div className="mb-4">
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-2 select-none"
              style={{
                background: 'rgb(248, 248, 248)',
                // border: '1px solid rgb(231, 229, 228)',
                borderRadius: '25px',
                color: 'rgb(72, 67, 64)',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-scan-icon lucide-scan"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
              <span>Select to edit / explore</span>
            </div>
          </div>
        )}

        {/* Input row. In raw mode (peek, or placed with no selection) the send
            button sits inline at the end of this row so the layout collapses
            to: [input  send] with no separate footer. */}
        <div
          ref={inlineRefContainerRef}
          className={`flex gap-2 ${effectiveChatMode === 'raw' ? 'items-end' : 'items-start'}`}
        >
          <InlineReference
            value={segments}
            onValueChange={setSegments}
            className="w-full cursor-chat-inline-input"
          >
            <InlineReferenceInput
              placeholder={
                effectiveChatMode === 'raw'
                  ? 'How can I help?'
                  : effectiveChatMode === 'edit'
                    ? 'Describe edits...'
                    : (targetNode ? 'Describe variations...' : `Explore, using ${shortModelName}`)
              }
              className="outline-none w-full border-none shadow-none ring-0 focus-visible:ring-0 focus-visible:border-none rounded-none px-0 py-0 text-left leading-[1.4]"
              style={{
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                color: 'rgb(41, 37, 36)',
                caretColor: 'rgb(87, 83, 78)',
                // minHeight: '52px',
              }}
            />
            <InlineReferenceContent
              trigger="/"
              items={skillItems}
              className="rounded-xl border border-stone-200 shadow-lg"
            >
              <InlineReferenceGroup heading="Skills">
                <InlineReferenceList className="max-h-[256px]">
                  {(item) => (
                    <InlineReferenceItem
                      key={item.id}
                      value={item}
                      className="gap-2.5 rounded-lg px-2 py-1.5 data-[selected=true]:bg-stone-100 data-[selected=true]:text-stone-900"
                    >
                      <span style={getSkillBubbleStyle(item.id, 24)} />
                      <span className="text-[13px] font-medium text-stone-800 truncate">
                        {item.label}
                      </span>
                    </InlineReferenceItem>
                  )}
                </InlineReferenceList>
                <InlineReferenceEmpty>No skills found</InlineReferenceEmpty>
              </InlineReferenceGroup>
            </InlineReferenceContent>
          </InlineReference>

          {/* Inline send button — shown whenever there's no selection (peek
              or placed-raw). Replaces the separate footer send in those cases.
              In placed mode we render the active dark style (same as the
              footer send) so it's clearly clickable; in peek the lighter
              "follows-cursor" style is preserved. */}
          {effectiveChatMode === 'raw' && (
            <button
              type="button"
              // Prevent the input's contentEditable from blurring & swallowing
              // the click: we still take the click event, just keep focus.
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
              }}
              className={`flex-shrink-0 flex items-center justify-center transition-colors ${
                isPlaced ? 'hover:bg-stone-700' : 'hover:bg-stone-100'
              }`}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: isPlaced ? 'rgb(41, 37, 36)' : '#D9d9d9',
              }}
              aria-label="Send"
            >
              <svg width={isPlaced ? 14 : 12} height={isPlaced ? 14 : 12} viewBox={isPlaced ? '0 0 14 14' : '0 0 16 16'} fill="none">
                {isPlaced ? (
                  <path d="M7 11V3M7 3L3 7M7 3L11 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M8 13V3M8 3L3.5 7.5M8 3L12.5 7.5" stroke="rgb(168, 162, 158)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </button>
          )}
        </div>

        {/* Generating indicator */}
        {isGenerating && (
          <span className="text-[10px] text-amber-600 animate-pulse select-none mt-1">
            Generating...
          </span>
        )}

        {/* Footer — placed mode with a selection only. In raw mode the send
            button is rendered inline next to the input above, so the footer
            is omitted entirely. */}
        {isPlaced && showModeToggle && (
          <div className="flex items-center justify-between mt-4 pt-2 gap-2 whitespace-nowrap">
            <div className="inline-flex items-center gap-1 select-none">
                <button
                  type="button"
                  onClick={() => setChatMode('edit')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                    effectiveChatMode === 'edit'
                      ? 'bg-white text-stone-900 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                  aria-pressed={effectiveChatMode === 'edit'}
                  title={`Edit (${formatKeyCombo(getCombo('cursor-chat.toggle-edit-mode'))})`}
                >
                  <EditIcon className="flex-shrink-0" />
                  <span>Edit</span>
                </button>
                {/* Explore segment: text label + (when active) the iteration
                    count dragger sit side-by-side. The whole row is the active
                    "pill". We use sibling buttons (rather than nesting) so the
                    dragger keeps its own click/drag affordance. */}
                <div
                  className={`inline-flex items-center gap-1 rounded-full transition-colors ${
                    effectiveChatMode === 'explore'
                      ? 'bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)] pr-1'
                      : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setChatMode('explore')}
                    className={`inline-flex items-center gap-1.5 pl-3 ${effectiveChatMode === 'explore' ? 'pr-0 py-1' : 'pr-3 py-1.5'} rounded-full text-[12px] font-medium transition-colors ${
                      effectiveChatMode === 'explore'
                        ? 'text-stone-900'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                    aria-pressed={effectiveChatMode === 'explore'}
                    title={`Explore (${formatKeyCombo(getCombo('cursor-chat.toggle-edit-mode'))})`}
                  >
                    <ExploreIcon className="flex-shrink-0" />
                    <span>Explore</span>
                  </button>
                  {effectiveChatMode === 'explore' && (
                    <IterationCountDragger
                      count={iterationCount}
                      onChange={setIterationCount}
                    />
                  )}
                </div>
            </div>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
              }}
              className="flex items-center justify-center flex-shrink-0 transition-colors hover:bg-stone-700"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'rgb(41, 37, 36)',
              }}
              aria-label="Send"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 11V3M7 3L3 7M7 3L11 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
        </div>

        {/* Keyboard shortcuts — peek mode only */}
        {isPeek && (
          <div className="flex items-center opacity-50 justify-center gap-5 mt-2.5 pointer-events-none select-none">
            <span className="text-[10px] text-stone-400 flex items-center gap-1.5">
              <span className="font-medium text-stone-500">{formatKeyCombo(getCombo('cursor-chat.cycle-model'))}</span>
              switch models
            </span>
            <span className="text-[10px] text-stone-400 flex items-center gap-1.5">
              <span className="font-medium text-stone-500">{'\u2318\u21B5'}</span>
              send
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
