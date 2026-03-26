'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { ITERATION_COUNT_OPTIONS, CURSOR_CHAT_DEFAULT_COUNT, type CursorChatSubmitPayload } from './lib/constants';
import { matchesAction } from './lib/keybindings';
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

// ---------------------------------------------------------------------------
// CursorChat Component
// ---------------------------------------------------------------------------

export default function CursorChat({ isGenerating, onSubmit, selectedElements, onRemoveElement, onClearElements, selectedNodes, onRemoveNode, onClearNodes }: CursorChatProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [skills, setSkills] = useState<PlaygroundSkill[]>([]);
  const [iterationCount, setIterationCount] = useState(CURSOR_CHAT_DEFAULT_COUNT);
  const [editMode, setEditMode] = useState(false);
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
  const skillItems = useMemo(() =>
    skills.map((skill) => ({
      id: skill.id,
      label: skill.label,
      description: skill.description,
      systemPrompt: skill.systemPrompt,
    })),
    [skills]
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
        if (skill?.systemPrompt) skillPrompts.push(skill.systemPrompt);
      }
    }

    return { text: textParts.join('\n').trim(), skillPrompts, skillIds };
  }, [segments, skillsById]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    const { text, skillPrompts, skillIds } = extractPayload();
    if (!text && skillPrompts.length === 0) return;

    // If no target node but exactly one selected node, promote it to target.
    // With 2+ selected nodes and no click target → freeform with all as references.
    const effectiveTarget = targetNode
      ?? (selectedNodes?.length === 1 ? selectedNodes[0] : null);
    const referenceOnly = effectiveTarget && !targetNode
      ? undefined  // single selected node promoted to target, no references left
      : selectedNodes;  // all selected nodes are references (freeform or click-target case)

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
      iterationCount: editMode ? 1 : iterationCount,
      canvasPosition: flowPosition ?? { x: 0, y: 0 },
      editMode,
      renderMode: effectiveTarget?.renderMode,
      htmlPageSlug: effectiveTarget?.htmlPageSlug,
      htmlIterationFolder: effectiveTarget?.htmlIterationFolder,
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
  }, [extractPayload, model, iterationCount, targetNode, flowPosition, deactivate, onSubmit, getInputEl, selectedElements, onClearElements, selectedNodes, onClearNodes]);

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
  const currentConfig = getModelIconConfig(model);
  const nextConfig = nextModel ? getModelIconConfig(nextModel) : currentConfig;

  return (
    <div
      ref={containerRef}
      data-cursor-chat
      className="fixed top-0 left-0 z-[9999] pointer-events-none"
      style={{ willChange: 'transform' }}
    >
      {/* Teardrop Bubble */}
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

      {/* Chat Box — centered directly below the bubble */}
      <div
        className="pointer-events-auto flex flex-col transition-opacity duration-150 text-sm"
        style={{
          position: 'absolute',
          top: '36px',
          left: '100%',
          transform: 'translateX(-9%)',
          width: isPeek ? '320px' : '320px',
          minWidth: isPeek ? undefined : '260px',
          opacity: isPeek ? 0.85 : 1,
          background: 'rgba(255, 255, 255, 0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: isPeek ? '18px' : '18px',
          border: isPeek ? '1.5px dashed rgb(215, 212, 209)' : '',
          padding: isPeek ? '14px' : '14px',
          boxShadow: isPlaced
            ? '0 0 50px -18px rgba(0,0,0,0.15), 0 2px 12px rgba(0,0,0,0.06)'
            : 'none',
        }}
      >
        {/* Element chip — placed mode + target only */}
        {isPlaced && targetNode && (!selectedElements || selectedElements.length === 0) && (
          <div
            className="flex items-center gap-1 px-1.5 py-px mb-1 self-start select-none"
            style={{
              background: 'rgb(250, 250, 249)',
              border: '1px solid rgb(147, 197, 253)',
              borderRadius: '12px',
              color: 'rgb(59, 130, 246)',
              fontSize: '10px',
              fontWeight: 500,
              marginBottom: '8px',
            }}
          >
            <FrameIcon/>
            <span>{targetNode.componentName}</span>
          </div>
        )}

        {/* Selected element chips */}
        {selectedElements && selectedElements.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mb-1">
            {selectedElements.map((sel, i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-1.5 py-px select-none group"
                style={{
                  background: 'rgb(239, 246, 255)',
                  border: '1px solid rgb(147, 197, 253)',
                  borderRadius: '12px',
                  color: 'rgb(59, 130, 246)',
                  fontSize: '10px',
                  fontWeight: 500,
                  marginBottom: '4px',
                }}
              >
                <BracketIcon />
                <span>&lt;{sel.context.tagName}&gt; {sel.componentName}</span>
                {onRemoveElement && (
                  <button
                    onClick={() => onRemoveElement(i)}
                    className="ml-0.5 hover:text-red-500 transition-colors pointer-events-auto"
                    style={{ lineHeight: 1 }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {selectedElements.length >= 2 && onClearElements && (
              <button
                onClick={onClearElements}
                className="px-1.5 py-px text-[10px] text-stone-400 hover:text-stone-600 transition-colors pointer-events-auto select-none"
              >
                × clear
              </button>
            )}
          </div>
        )}

        {/* Node reference chips */}
        {selectedNodes && selectedNodes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mb-1">
            {selectedNodes.map((node) => (
              <div
                key={node.nodeId}
                className="flex items-center gap-1 px-1.5 py-px select-none group"
                style={{
                  background: 'rgb(236, 253, 245)',
                  border: '1px solid rgb(110, 231, 183)',
                  borderRadius: '12px',
                  color: 'rgb(5, 150, 105)',
                  fontSize: '9px',
                  fontWeight: 500,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                  <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 6h6M5 8h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                </svg>
                <span>{node.componentName}</span>
                {onRemoveNode && (
                  <button
                    onClick={() => onRemoveNode(node.nodeId)}
                    className="ml-0.5 hover:text-red-500 transition-colors pointer-events-auto"
                    style={{ lineHeight: 1 }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {selectedNodes.length >= 2 && onClearNodes && (
              <button
                onClick={onClearNodes}
                className="px-1.5 py-px text-[9px] text-stone-400 hover:text-stone-600 transition-colors pointer-events-auto select-none"
              >
                × clear
              </button>
            )}
          </div>
        )}

        {/* Input row */}
        <div ref={inlineRefContainerRef} className="flex items-start gap-2">
          <InlineReference
            value={segments}
            onValueChange={setSegments}
            className="w-full cursor-chat-inline-input"
          >
            <InlineReferenceInput
              placeholder={targetNode ? 'Describe variations...' : `Iterate, / for skills, using ${shortModelName}`}
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
              className="rounded-lg border border-stone-100"
            >
              <InlineReferenceGroup heading="Skills">
                <InlineReferenceList>
                  {(item) => (
                    <InlineReferenceItem key={item.id} value={item} className="rounded-lg">
                      <span className="text-md px-1">{item.label}</span>
                    </InlineReferenceItem>
                  )}
                </InlineReferenceList>
                <InlineReferenceEmpty>No skills found</InlineReferenceEmpty>
              </InlineReferenceGroup>
            </InlineReferenceContent>
          </InlineReference>

          {/* Inline send button — peek mode */}
          {isPeek && (
            <button
              onClick={handleSubmit}
              className="flex-shrink-0 flex items-center justify-center transition-colors hover:bg-stone-300"
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'rgb(231, 229, 228)',
              }}
              aria-label="Send"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 13V3M8 3L3.5 7.5M8 3L12.5 7.5" stroke="rgb(87, 83, 78)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

        {/* Footer — placed mode only */}
        {isPlaced && (
          <div className="flex items-center justify-between mt-4 pt-2 gap-2 whitespace-nowrap">
            <button
              onClick={cycleModel}
              className="inline-flex items-center gap-1 px-1.5 py-px text-[9px] font-medium select-none transition-colors hover:bg-stone-100 whitespace-nowrap"
              style={{
                background: 'transparent',
                borderRadius: '6px',
                color: 'rgb(87, 83, 78)',
              }}
            >
              {modelLabel}
              <span style={{ opacity: 0.5 }}>Shift+Tab</span>
            </button>

            {/* Edit/Iterate toggle */}
            <button
              onClick={() => setEditMode(m => !m)}
              className={`px-2 py-1 rounded-full text-[9px] font-medium transition-colors select-none ${
                editMode
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-stone-50 text-stone-500 border border-stone-100 hover:text-stone-700'
              }`}
            >
              {editMode ? 'Edit' : 'Iterate'}
            </button>

            {/* Iteration count pills — hidden in edit mode */}
            {!editMode && (
              <div className="flex items-center gap-0.5 bg-stone-50 rounded-full px-1 py-1 border border-stone-100">
                {(ITERATION_COUNT_OPTIONS as readonly number[]).map((n) => (
                  <button
                    key={n}
                    onClick={() => setIterationCount(n)}
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium transition-colors ${
                      iterationCount === n
                        ? 'bg-stone-800 text-white'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={handleSubmit}
              className="flex items-center justify-center transition-colors hover:bg-stone-200"
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
    </div>
  );
}
