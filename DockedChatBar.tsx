'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  InlineReference,
  InlineReferenceInput,
  InlineReferenceContent,
  type Segment,
  type InlineReferenceHandle,
} from './ui/inline-reference';
import type { PlaygroundSkill } from './skills';
import { ImpeccableSkillPicker } from './ui/impeccable-skill-picker';
import { ImpeccableDemoteMenu } from './ui/impeccable-demote-menu';
import { useImpeccableSkillPicker } from './hooks/useImpeccableSkillPicker';
import { impeccablePromptFromSegment } from './lib/impeccable-skill';
import { useAvailableModels } from './nodes/shared/IterateDialogParts';
import { useModelCycle } from './hooks/useModelCycle';
import { useSkills } from './hooks/useSkills';
import { captureClient } from './lib/telemetry/client';
import { safeModel, safeSkills } from './lib/telemetry/schema';
import { getModelIconConfig } from './lib/model-icons';
import {
  CURSOR_CHAT_ACTIVE_EVENT,
  CURSOR_CHAT_DEFAULT_COUNT,
  type CursorChatActivePayload,
  type CursorChatSubmitPayload,
} from './lib/constants';
import { matchesAction, formatKeyCombo, getCombo } from './lib/keybindings';
import type { SelectedElement } from './lib/element-context';
import type { SelectedNodeContext } from './hooks/useNodeSelection';
import { useModelSettingsStore } from './lib/model-settings-store';
import {
  EditIcon,
  ExploreIcon,
  FrameIcon,
  BracketIcon,
  PillLeadingRemoveSlot,
  IterationCountDragger,
  SendArrowIcon,
} from './ui/chat-bits';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DockedChatBarProps {
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
// Small node-reference glyphs (match CursorChat's reference chips)
// ---------------------------------------------------------------------------

function ImageRefIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
      <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1" />
      <path d="M2 11l3-3 2 2 3-3 4 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NodeRefIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
      <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 6h6M5 8h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// DockedChatBar — always-on, bottom-center composer
// ---------------------------------------------------------------------------
// A new chat surface that COEXISTS with the cursor-following CursorChat. It is
// docked at the bottom-center of the screen, collapsed to a slim pill when idle
// and expanded on focus. It reuses the same submit→generate pipeline
// (CursorChatSubmitPayload → onSubmit) as CursorChat: raw freeform generation
// with nothing selected, or Edit/Explore against the current canvas selection.
// ---------------------------------------------------------------------------

// Cursor-proximity thresholds (px) for the minimise/expand hysteresis.
const NEAR_PX = 44;
const FAR_PX = 120;

export default function DockedChatBar({
  isGenerating,
  onSubmit,
  selectedElements,
  onRemoveElement,
  onClearElements,
  selectedNodes,
  onRemoveNode,
  onClearNodes,
}: DockedChatBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const skills = useSkills();
  const [chatMode, setChatMode] = useState<'edit' | 'explore'>('edit');
  const [iterationCount, setIterationCount] = useState(CURSOR_CHAT_DEFAULT_COUNT);
  // While the cursor-following CursorChat is active, the dock defers entirely.
  const [cursorChatActive, setCursorChatActive] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const inlineRefContainerRef = useRef<HTMLDivElement | null>(null);
  const inlineRefHandle = useRef<InlineReferenceHandle | null>(null);
  // Proximity state-machine refs (read by the global mousemove listener so it
  // never closes over stale state or re-subscribes).
  const expandedRef = useRef(false);
  const dismissedRef = useRef(false); // Esc suppresses re-expand until cursor leaves
  const dwellTimerRef = useRef<number | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const cursorChatActiveRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const { screenToFlowPosition } = useReactFlow();
  const { models, isLoading: isLoadingModels } = useAvailableModels();
  const { model, cycleModel, isSwitching, nextModel } = useModelCycle(models);
  const activeProvider = useModelSettingsStore((s) => s.activeProvider);

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

  const skillsById = useMemo(() => {
    const map = new Map<string, PlaygroundSkill>();
    for (const skill of skills) map.set(skill.id, skill);
    return map;
  }, [skills]);

  const getInputEl = useCallback(() => {
    return (
      inlineRefContainerRef.current?.querySelector<HTMLDivElement>(
        '[data-slot="inline-reference-input"]',
      ) ?? null
    );
  }, []);

  // -------------------------------------------------------------------------
  // Derived selection / mode state
  // -------------------------------------------------------------------------

  const hasContent = useMemo(
    () =>
      segments.some(
        (s) => (s.type === 'text' && s.value.trim().length > 0) || s.type === 'reference',
      ),
    [segments],
  );

  // The edit/explore target is the FIRST selected node that is a valid target
  // (a React/HTML/JSX component or iteration — not an embed/image/text). The
  // rest of the selection becomes reference context.
  const editTarget = useMemo<SelectedNodeContext | null>(() => {
    const candidates = (selectedNodes ?? []).filter(
      (n) => (n.type === 'component' || n.type === 'iteration') && n.renderMode !== 'embed',
    );
    return candidates[0] ?? null;
  }, [selectedNodes]);

  const referenceNodes = useMemo(
    () => (selectedNodes ?? []).filter((n) => n.nodeId !== editTarget?.nodeId),
    [selectedNodes, editTarget],
  );

  const hasSelection =
    !!editTarget || (selectedElements?.length ?? 0) > 0 || (selectedNodes?.length ?? 0) > 0;

  // Visible-expanded state: proximity drives `expanded`; typing or a selection
  // also keeps the bar open. Render uses this so it never minimises mid-use.
  const shouldExpand = expanded || hasContent || hasSelection;

  // Edit/Explore only make sense against an editable target or an element
  // selection; a selection of only embed/image/text nodes runs as raw (with the
  // nodes attached as references), so the toggle is hidden in that case.
  const canEditOrExplore = !!editTarget || (selectedElements?.length ?? 0) > 0;
  const effectiveChatMode: 'edit' | 'explore' | 'raw' = canEditOrExplore ? chatMode : 'raw';
  const showModeToggle = shouldExpand && canEditOrExplore;
  const hasAnyPill =
    !!editTarget || (selectedElements?.length ?? 0) > 0 || referenceNodes.length > 0;
  const showPillsRow = shouldExpand && hasAnyPill;

  // -------------------------------------------------------------------------
  // Minimise (orange bubble) ⇄ expand (composer)
  //
  // Resting state is a small orange bubble. The bar expands when the cursor
  // comes near it, or while it's "held" open (focused / has text / has a canvas
  // selection), and minimises again once the cursor leaves and none of those
  // hold.
  // -------------------------------------------------------------------------

  const clearDwell = useCallback(() => {
    if (dwellTimerRef.current != null) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  }, []);

  const openAndFocus = useCallback(() => {
    dismissedRef.current = false;
    clearDwell();
    setExpanded(true);
    requestAnimationFrame(() => getInputEl()?.focus());
  }, [clearDwell, getInputEl]);

  // Mirror `expanded` into a ref for the closure-captured mousemove listener.
  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  // Defer to the cursor-following chat: hide the dock (display:none, so the
  // draft survives) while CursorChat is up — they do the same thing.
  useEffect(() => {
    const handler = (e: Event) => {
      const active = !!(e as CustomEvent<CursorChatActivePayload>).detail?.active;
      cursorChatActiveRef.current = active;
      setCursorChatActive(active);
      if (active) {
        clearDwell();
        setExpanded(false);
      }
    };
    window.addEventListener(CURSOR_CHAT_ACTIVE_EVENT, handler);
    return () => window.removeEventListener(CURSOR_CHAT_ACTIVE_EVENT, handler);
  }, [clearDwell]);

  // Cache the bar's rect so the hot mousemove path doesn't force a layout read
  // every move. It only changes when the bar resizes (expand/collapse), hides,
  // or the window resizes.
  useEffect(() => {
    const update = () => {
      rectRef.current = rootRef.current?.getBoundingClientRect() ?? null;
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [shouldExpand, cursorChatActive]);

  // Proximity (mouse only — desktop). rAF-coalesced; reads the cached rect.
  // Expanding requires a brief dwell so brushing past the bottom doesn't pop it
  // open; collapsing past FAR is immediate. After an explicit Esc dismiss it
  // stays minimised until the cursor leaves the halo, then re-arms. Text /
  // selection keep it open independently via `shouldExpand`.
  useEffect(() => {
    const process = () => {
      rafRef.current = null;
      const pt = lastPointRef.current;
      const rect = rectRef.current;
      if (!pt || !rect || cursorChatActiveRef.current) {
        clearDwell();
        return;
      }
      const dx = Math.max(rect.left - pt.x, 0, pt.x - rect.right);
      const dy = Math.max(rect.top - pt.y, 0, pt.y - rect.bottom);
      const dist = Math.hypot(dx, dy);

      if (rootRef.current?.contains(document.activeElement)) {
        dismissedRef.current = false;
        clearDwell();
        setExpanded(true);
        return;
      }

      if (expandedRef.current) {
        if (dist > FAR_PX) {
          clearDwell();
          setExpanded(false);
        }
        return;
      }

      // Minimised.
      if (dismissedRef.current) {
        if (dist > FAR_PX) dismissedRef.current = false;
        clearDwell();
        return;
      }
      if (dist <= NEAR_PX) {
        if (dwellTimerRef.current == null) {
          dwellTimerRef.current = window.setTimeout(() => {
            dwellTimerRef.current = null;
            if (!dismissedRef.current && !cursorChatActiveRef.current) setExpanded(true);
          }, 150);
        }
      } else {
        clearDwell();
      }
    };
    const onMove = (e: MouseEvent) => {
      lastPointRef.current = { x: e.clientX, y: e.clientY };
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(process);
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      clearDwell();
    };
  }, [clearDwell]);

  const pickerOpen = useCallback(
    () =>
      !!document.querySelector('[data-slot="inline-reference-content"]') ||
      !!document.querySelector('[data-slot="impeccable-demote-menu"]'),
    [],
  );

  // -------------------------------------------------------------------------
  // Payload
  // -------------------------------------------------------------------------

  const computeCanvasPosition = useCallback(() => {
    try {
      return screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    } catch {
      return { x: 0, y: 0 };
    }
  }, [screenToFlowPosition]);

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
        const impeccablePrompt = impeccablePromptFromSegment(
          segment,
          skillsById.get('impeccable')?.skillPath,
        );
        if (impeccablePrompt) {
          skillPrompts.push(impeccablePrompt);
        } else {
          const skill = skillsById.get(segment.value);
          const p = skill?.skillPath?.trim();
          if (p) skillPrompts.push(p);
        }
      }
    }

    return { text: textParts.join('\n').trim(), skillPrompts, skillIds };
  }, [segments, skillsById]);

  const handleSubmit = useCallback(async () => {
    const { text, skillPrompts, skillIds } = extractPayload();
    if (!text && skillPrompts.length === 0) return;

    const mode: 'edit' | 'explore' | 'raw' = canEditOrExplore ? chatMode : 'raw';

    // Adoption metric (dev-only, content-free) — schema in lib/telemetry/schema.
    captureClient('docked_chat_submit', {
      provider: useModelSettingsStore.getState().activeProvider,
      model: safeModel(model),
      mode,
      has_target: !!editTarget,
      iteration_count: mode === 'explore' ? iterationCount : 1,
      skills: safeSkills(skillIds),
    });

    const payload: CursorChatSubmitPayload = {
      text,
      skillPrompts,
      skillIds,
      model,
      provider: useModelSettingsStore.getState().activeProvider,
      targetNodeId: editTarget?.nodeId ?? null,
      targetComponentId: editTarget?.componentId ?? null,
      targetComponentName: editTarget?.componentName ?? null,
      targetType: editTarget?.type ?? null,
      sourceFilename: editTarget?.sourceFilename,
      iterationCount: mode === 'explore' ? iterationCount : 1,
      canvasPosition: computeCanvasPosition(),
      editMode: mode === 'edit',
      chatMode: mode,
      renderMode: editTarget?.renderMode,
      htmlPageSlug: editTarget?.htmlPageSlug,
      htmlIterationFolder: editTarget?.htmlIterationFolder,
      jsxFile: editTarget?.jsxFile,
      embedUrl: editTarget?.embedUrl,
      elementSelections:
        selectedElements && selectedElements.length > 0
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
      referenceNodes:
        referenceNodes.length > 0
          ? referenceNodes.map((node) => ({
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

    // Clear input + blur; the proximity/held state governs whether the bar
    // minimises back to the bubble.
    setSegments([]);
    const el = getInputEl();
    if (el) {
      el.textContent = '';
      el.blur();
    }
    onClearElements?.();
    onClearNodes?.();
    resetImpeccablePicker();

    await onSubmit(payload);
  }, [
    extractPayload,
    canEditOrExplore,
    chatMode,
    model,
    editTarget,
    referenceNodes,
    selectedElements,
    iterationCount,
    computeCanvasPosition,
    getInputEl,
    onClearElements,
    onClearNodes,
    resetImpeccablePicker,
    onSubmit,
  ]);

  // -------------------------------------------------------------------------
  // Keyboard (scoped to the input subtree — capture phase, defers to the picker)
  // -------------------------------------------------------------------------

  const handleKeyDownCapture = useCallback(
    (e: React.KeyboardEvent) => {
      // Esc: clear + minimise. Suppress proximity re-expand until the cursor
      // leaves the halo so it doesn't immediately re-pop while still hovering.
      if (e.key === 'Escape') {
        if (pickerOpen()) return;
        e.preventDefault();
        e.stopPropagation();
        setSegments([]);
        const el = getInputEl();
        if (el) {
          el.textContent = '';
          el.blur();
        }
        clearDwell();
        dismissedRef.current = true;
        setExpanded(false);
        return;
      }

      // Cycle model (default Shift+Tab). Defer to the picker (Tab accepts an item).
      if (matchesAction(e.nativeEvent, 'cursor-chat.cycle-model')) {
        if (pickerOpen()) return;
        e.preventDefault();
        cycleModel();
        return;
      }

      // Toggle Edit/Explore (default Cmd+E).
      if (matchesAction(e.nativeEvent, 'cursor-chat.toggle-edit-mode')) {
        e.preventDefault();
        setChatMode((prev) => (prev === 'edit' ? 'explore' : 'edit'));
        return;
      }

      // Enter: submit (unless the picker is open — then Enter accepts an item).
      if (e.key === 'Enter' && !e.shiftKey) {
        if (pickerOpen()) return;
        e.preventDefault();
        handleSubmit();
        return;
      }
    },
    [pickerOpen, getInputEl, cycleModel, handleSubmit, clearDwell],
  );

  // -------------------------------------------------------------------------
  // Model labels / icons
  // -------------------------------------------------------------------------

  const shortModelName = useMemo(() => {
    if (isLoadingModels) return 'AI';
    const found = models.find((m) => m.value === model);
    const label = found?.label || model;
    const cleaned = label
      .replace(/^Claude\s+\d+(\.\d+)?\s*/i, '')
      .replace(/^GPT-?\s*/i, '')
      .replace(/^Gemini\s+\d*\s*/i, '')
      .replace(/\(.*?\)/g, '')
      .trim();
    return cleaned || label;
  }, [models, model, isLoadingModels]);

  const currentConfig = getModelIconConfig(model, activeProvider);
  const nextConfig = nextModel ? getModelIconConfig(nextModel, activeProvider) : currentConfig;

  const placeholder =
    effectiveChatMode === 'raw'
      ? 'Ask anything, or / for skills…'
      : effectiveChatMode === 'edit'
        ? 'Describe edits…'
        : editTarget
          ? 'Describe variations…'
          : `Explore, using ${shortModelName}`;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const bubbleFaces = (
    <>
      <span
        className="bubble-face bubble-face--current"
        style={{ backgroundColor: currentConfig.bg, backgroundImage: `url(${currentConfig.src})` }}
      />
      <span
        className="bubble-face bubble-face--next"
        style={{ backgroundColor: nextConfig.bg, backgroundImage: `url(${nextConfig.src})` }}
      />
    </>
  );

  return (
    <div
      ref={rootRef}
      data-docked-chat
      role="region"
      aria-label="AI chat"
      className={`fixed bottom-6 left-1/2 z-[9998] flex -translate-x-1/2 flex-col items-center ${cursorChatActive ? 'hidden' : ''}`}
      style={{ pointerEvents: 'none' }}
    >
      {!shouldExpand ? (
        <button
          type="button"
          aria-label="Open chat"
          onClick={openAndFocus}
          data-generating={isGenerating || undefined}
          className="docked-chat-minimized pointer-events-auto"
        />
      ) : (
      <div
        className="docked-chat-expand-anim relative text-sm duration-150 animate-in fade-in-0 zoom-in-95"
        style={{ width: 'min(520px, calc(100vw - 32px))', pointerEvents: 'auto' }}
      >
        {/* Floating model bubble — top-left */}
        {shouldExpand && (
          <div
            className="absolute left-1.5 flex items-center gap-1.5"
            style={{ bottom: 'calc(100% + 10px)' }}
          >
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={cycleModel}
              className={`cursor-bubble inline-block border-0 bg-transparent p-0 ${isSwitching ? 'is-switching' : ''}`}
              style={{ width: 16, height: 16 }}
            >
              {bubbleFaces}
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={cycleModel}
              aria-label="Switch model"
              title={`Switch model (${formatKeyCombo(getCombo('cursor-chat.cycle-model'))})`}
              className="select-none whitespace-nowrap text-[11px] font-medium text-stone-400 transition-colors hover:text-stone-600"
            >
              {shortModelName}
            </button>
          </div>
        )}

        {/* Floating Edit / Explore cluster — top-right, only with a selection */}
        {showModeToggle && (
          <div
            className="absolute right-1.5 inline-flex items-center gap-0.5 rounded-full border border-stone-200/70 bg-white/95 px-0.5 py-0.5 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.25)] backdrop-blur"
            style={{ bottom: 'calc(100% + 10px)' }}
          >
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setChatMode('edit')}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                effectiveChatMode === 'edit'
                  ? 'bg-stone-100 text-stone-900'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              aria-pressed={effectiveChatMode === 'edit'}
              title={`Edit design (${formatKeyCombo(getCombo('cursor-chat.toggle-edit-mode'))})`}
            >
              <EditIcon className="flex-shrink-0" />
              <span>Edit</span>
            </button>
            <div
              className={`inline-flex items-center gap-1 rounded-full transition-colors ${
                effectiveChatMode === 'explore' ? 'bg-stone-100 pr-1' : ''
              }`}
            >
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setChatMode('explore')}
                className={`inline-flex items-center gap-1 rounded-full pl-2.5 text-[11px] font-medium transition-colors ${
                  effectiveChatMode === 'explore' ? 'py-1 pr-0 text-stone-900' : 'py-1 pr-2.5 text-stone-500 hover:text-stone-800'
                }`}
                aria-pressed={effectiveChatMode === 'explore'}
                title={`Explore (${formatKeyCombo(getCombo('cursor-chat.toggle-edit-mode'))})`}
              >
                <ExploreIcon className="flex-shrink-0" />
                <span>Explore</span>
              </button>
              {effectiveChatMode === 'explore' && (
                <IterationCountDragger count={iterationCount} onChange={setIterationCount} />
              )}
            </div>
          </div>
        )}

        {/* The pill */}
        <div
          className="docked-chat-pill"
          data-generating={isGenerating || undefined}
          style={{ borderRadius: showPillsRow ? 22 : 9999 }}
        >
          {isGenerating && <span className="docked-chat-pill__glow" aria-hidden />}

          <div
            className="docked-chat-pill__surface flex flex-col"
            onMouseDown={(e) => {
              // Clicking empty pill chrome focuses the input; let buttons and the
              // input itself handle their own clicks.
              const target = e.target as HTMLElement;
              if (target.closest('button') || target.closest('[data-slot="inline-reference-input"]')) {
                return;
              }
              e.preventDefault();
              openAndFocus();
            }}
          >
            {/* Selection pills row */}
            {showPillsRow && (
              <div className="flex flex-wrap items-center gap-1 px-3.5 pt-2.5">
                {/* Target chip (only when no element selection) */}
                {editTarget && (!selectedElements || selectedElements.length === 0) && (
                  <div
                    className="group flex select-none items-center gap-1 px-2.5 py-1.5"
                    style={{
                      background: 'rgb(250, 250, 249)',
                      border: '1px solid rgb(147, 197, 253)',
                      borderRadius: '50px',
                      color: 'rgb(59, 130, 246)',
                      fontSize: '10px',
                      fontWeight: 500,
                    }}
                  >
                    <PillLeadingRemoveSlot
                      icon={<FrameIcon />}
                      onRemove={onRemoveNode ? () => onRemoveNode(editTarget.nodeId) : undefined}
                    />
                    <span>{editTarget.componentName}</span>
                  </div>
                )}

                {/* Element chips */}
                {selectedElements &&
                  selectedElements.length > 0 &&
                  selectedElements.map((sel, i) => (
                    <div
                      key={i}
                      className="group flex select-none items-center gap-1 px-2.5 py-1.5"
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
                      <span>
                        &lt;{sel.context.tagName}&gt; {sel.componentName}
                      </span>
                    </div>
                  ))}

                {/* Node reference chips */}
                {referenceNodes.map((node) => (
                  <div
                    key={node.nodeId}
                    className="group flex select-none items-center gap-1 px-2.5 py-1.5"
                    style={
                      node.type === 'image'
                        ? {
                            background: 'rgb(245, 243, 255)',
                            border: '1px solid rgb(167, 139, 250)',
                            borderRadius: '50px',
                            color: 'rgb(109, 40, 217)',
                            fontSize: '9px',
                            fontWeight: 500,
                          }
                        : {
                            background: 'rgb(236, 253, 245)',
                            border: '1px solid rgb(110, 231, 183)',
                            borderRadius: '50px',
                            color: 'rgb(5, 150, 105)',
                            fontSize: '10px',
                            fontWeight: 500,
                          }
                    }
                  >
                    <PillLeadingRemoveSlot
                      slotClassName="h-2.5 w-2.5"
                      icon={node.type === 'image' ? <ImageRefIcon /> : <NodeRefIcon />}
                      onRemove={onRemoveNode ? () => onRemoveNode(node.nodeId) : undefined}
                    />
                    <span>{node.componentName}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Input row */}
            <div
              ref={inlineRefContainerRef}
              className="flex items-center gap-2 px-3.5 py-2.5"
              onKeyDownCapture={handleKeyDownCapture}
            >
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
                  placeholder={placeholder}
                  aria-label="Chat prompt"
                  className="w-full rounded-none border-none px-0 py-1 text-left leading-[1.4] shadow-none outline-none ring-0 focus-visible:border-none focus-visible:ring-0"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    color: 'rgb(41, 37, 36)',
                    caretColor: 'rgb(87, 83, 78)',
                  }}
                />
                <InlineReferenceContent
                  trigger="/"
                  items={skillPickerItems}
                  filterFn={skillPickerFilterFn}
                  placement="top"
                  className="rounded-xl border border-stone-200 shadow-lg"
                >
                  <ImpeccableSkillPicker
                    impeccableSubMenuOpen={impeccableSubMenuOpen}
                    onBackFromSubMenu={() => setImpeccableSubMenuOpen(false)}
                    showAddSkillButton={false}
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

              {/* Send button */}
              <button
                type="button"
                disabled={!hasContent}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSubmit();
                }}
                className="flex flex-shrink-0 items-center justify-center transition-colors hover:bg-stone-700 disabled:cursor-default disabled:hover:bg-[rgb(41,37,36)]"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgb(41, 37, 36)',
                  color: 'white',
                  opacity: hasContent ? 1 : 0.4,
                }}
                aria-label="Send"
              >
                <SendArrowIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
