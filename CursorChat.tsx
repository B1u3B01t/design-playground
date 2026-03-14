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
import { getModelIcon } from './lib/model-icons';
import type { CursorChatSubmitPayload } from './lib/constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CursorChatProps {
  isGenerating: boolean;
  onSubmit: (payload: CursorChatSubmitPayload) => Promise<void>;
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

// ---------------------------------------------------------------------------
// CursorChat Component
// ---------------------------------------------------------------------------

export default function CursorChat({ isGenerating, onSubmit }: CursorChatProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [skills, setSkills] = useState<PlaygroundSkill[]>([]);
  const inlineRefContainerRef = useRef<HTMLDivElement | null>(null);

  const { models, isLoading: isLoadingModels } = useAvailableModels();

  const {
    mode,
    model,
    targetNode,
    flowPosition,
    containerRef,
    modeRef,
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

  // Extract text and skill prompts from segments
  const extractPayload = useCallback(() => {
    const textParts: string[] = [];
    const skillPrompts: string[] = [];

    for (const segment of segments) {
      if (segment.type === 'text') {
        const trimmed = segment.value.trim();
        if (trimmed) textParts.push(trimmed);
      } else if (segment.type === 'reference') {
        const skill = skillsById.get(segment.value);
        if (skill?.systemPrompt) skillPrompts.push(skill.systemPrompt);
      }
    }

    return { text: textParts.join('\n').trim(), skillPrompts };
  }, [segments, skillsById]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    const { text, skillPrompts } = extractPayload();
    if (!text && skillPrompts.length === 0) return;

    const payload: CursorChatSubmitPayload = {
      text,
      skillPrompts,
      model,
      targetNodeId: targetNode?.nodeId ?? null,
      targetComponentId: targetNode?.componentId ?? null,
      targetComponentName: targetNode?.componentName ?? null,
      targetType: targetNode?.type ?? null,
      sourceFilename: targetNode?.sourceFilename,
      canvasPosition: flowPosition ?? { x: 0, y: 0 },
    };

    // Clear and deactivate
    setSegments([]);
    const el = getInputEl();
    if (el) el.textContent = '';
    deactivate();

    await onSubmit(payload);
  }, [extractPayload, model, targetNode, flowPosition, deactivate, onSubmit, getInputEl]);

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
          deactivate();
        }
        return;
      }

      // Shift+Tab: cycle model
      if (e.key === 'Tab' && e.shiftKey) {
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
  }, [mode, modeRef, deactivate, unplace, cycleModel, handleSubmit, getInputEl]);

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
  const currentIcon = getModelIcon(model);
  const nextIcon = nextModel ? getModelIcon(nextModel) : currentIcon;

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
          style={{ backgroundImage: `url(${currentIcon})` }}
        />
        <div
          className="bubble-face bubble-face--next"
          style={{ backgroundImage: `url(${nextIcon})` }}
        />
      </div>

      {/* Chat Box */}
      <div
        className="pointer-events-auto flex flex-col transition-opacity duration-150 text-sm"
        style={{
          position: 'absolute',
          top: '20px',
          left: '22px',
          width: isPeek ? '260px' : '240px',
          opacity: isPeek ? 0.85 : 1,
          background: 'rgba(255, 255, 255, 0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: isPeek ? '18px' : '14px',
          border: isPeek ? '1.5px dashed rgb(200, 197, 193)' : '1.5px solid rgb(214, 211, 209)',
          padding: isPeek ? '10px 5px 10px 12px' : '8px 10px 6px',
          boxShadow: isPlaced
            ? '0 0 50px -18px rgba(0,0,0,0.15), 0 2px 12px rgba(0,0,0,0.06)'
            : 'none',
        }}
      >
        {/* Element chip — placed mode + target only */}
        {isPlaced && targetNode && (
          <div
            className="flex items-center gap-1 px-1.5 py-px mb-1 self-start select-none"
            style={{
              background: 'rgb(250, 250, 249)',
              border: '1px solid rgb(214, 211, 209)',
              borderRadius: '12px',
              color: 'rgb(59, 130, 246)',
              fontSize: '9px',
              fontWeight: 500,
            }}
          >
            <BracketIcon />
            <span>{targetNode.componentName}</span>
          </div>
        )}

        {/* Input row */}
        <div ref={inlineRefContainerRef} className="flex items-start gap-1.5">
          <InlineReference
            value={segments}
            onValueChange={setSegments}
            className="w-full"
          >
            <InlineReferenceInput
              placeholder={targetNode ? 'Describe variations...' : `using ${shortModelName} to iterate`}
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
            >
              <InlineReferenceGroup heading="Skills">
                <InlineReferenceList>
                  {(item) => (
                    <InlineReferenceItem key={item.id} value={item}>
                      <span className="text-xs font-medium">{item.label}</span>
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
          <div className="flex items-center justify-between mt-1 pt-1">
            <button
              onClick={cycleModel}
              className="inline-flex items-center gap-1 px-1.5 py-px text-[9px] font-medium select-none transition-colors hover:bg-stone-100"
              style={{
                background: 'transparent',
                borderRadius: '6px',
                color: 'rgb(87, 83, 78)',
              }}
            >
              @{modelLabel}
              <span style={{ opacity: 0.5 }}>Shift+Tab</span>
            </button>
            <button
              onClick={handleSubmit}
              className="flex items-center justify-center transition-colors hover:bg-stone-300"
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: 'rgb(41, 37, 36)',
              }}
              aria-label="Send"
            >
              <svg width="9" height="9" viewBox="0 0 14 14" fill="none">
                <path d="M7 11V3M7 3L3 7M7 3L11 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
