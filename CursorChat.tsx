'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Send, X, Sparkles } from 'lucide-react';
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
import {
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  ITERATION_COUNT_OPTIONS,
  DEFAULT_CURSOR_CHAT_ITERATION_COUNT,
  type GenerationStartPayload,
  type GenerationCompletePayload,
  type GenerationErrorPayload,
} from './lib/constants';
import {
  ModelDropdown,
  useAvailableModels,
  loadSelectedModel,
  saveSelectedModel,
} from './nodes/shared/IterateDialogParts';
import { generateIterationPrompt, generateIterationFromIterationPrompt } from './registry';
import { derivePromptParts, formatElementContext } from './lib/prompt-utils';
import { useCursorChat, type CursorChatMode } from './hooks/useCursorChat';

export default function CursorChat() {
  const {
    mode,
    mousePos,
    placedPos,
    selectedTarget,
    place,
    deactivate,
    clearTarget,
  } = useCursorChat();

  const [segments, setSegments] = useState<Segment[]>([]);
  const [iterationCount, setIterationCount] = useState(DEFAULT_CURSOR_CHAT_ITERATION_COUNT);
  const [selectedModel, setSelectedModel] = useState(() => loadSelectedModel());
  const [skills, setSkills] = useState<PlaygroundSkill[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [askResponse, setAskResponse] = useState<string | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);
  const { models, isLoading: isLoadingModels } = useAvailableModels();

  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    saveSelectedModel(model);
  }, []);

  // Load skills when chat becomes active
  useEffect(() => {
    if (mode === 'inactive' || skills.length > 0) return;

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
        // ignore
      } finally {
        if (!cancelled) setIsLoadingSkills(false);
      }
    };

    fetchSkills();
    return () => { cancelled = true; };
  }, [mode, skills.length]);

  const skillsById = useMemo(() => {
    const map = new Map<string, PlaygroundSkill>();
    for (const skill of skills) map.set(skill.id, skill);
    return map;
  }, [skills]);

  const { customInstructionsText, skillPrompt } = useMemo(
    () => derivePromptParts(segments, skillsById),
    [segments, skillsById],
  );

  // Handle canvas click to place the chat
  useEffect(() => {
    if (mode !== 'peek') return;

    const handleClick = (e: MouseEvent) => {
      // Don't place if clicking inside the chat itself
      if (chatRef.current?.contains(e.target as Node)) return;
      place(e.clientX, e.clientY);
    };

    // Small delay to avoid the activation click from immediately placing
    const t = setTimeout(() => {
      window.addEventListener('click', handleClick);
    }, 50);

    return () => {
      clearTimeout(t);
      window.removeEventListener('click', handleClick);
    };
  }, [mode, place]);

  // Reset state when deactivating
  useEffect(() => {
    if (mode === 'inactive') {
      setSegments([]);
      setAskResponse(null);
    }
  }, [mode]);

  const handleSend = useCallback(async () => {
    if (isGenerating) return;

    const componentId = selectedTarget?.componentId;
    const parentNodeId = selectedTarget?.nodeId;

    // Build custom instructions with element context
    let finalCustomInstructions = customInstructionsText;
    if (selectedTarget?.elementContext) {
      const elementPart = formatElementContext(selectedTarget.elementContext);
      finalCustomInstructions = (finalCustomInstructions || '') + elementPart;
    }

    if (componentId && parentNodeId) {
      // Iteration mode
      const prompt = selectedTarget?.sourceFilename
        ? generateIterationFromIterationPrompt(
            componentId,
            selectedTarget.sourceFilename,
            iterationCount,
            1, // startNumber — will be overridden by the backend
            'shell',
            finalCustomInstructions,
            skillPrompt,
          )
        : generateIterationPrompt(
            componentId,
            iterationCount,
            'shell',
            finalCustomInstructions,
            skillPrompt,
          );

      if (!prompt) return;

      setIsGenerating(true);

      window.dispatchEvent(
        new CustomEvent<GenerationStartPayload>(GENERATION_START_EVENT, {
          detail: {
            componentId,
            componentName: selectedTarget!.componentName,
            parentNodeId,
            iterationCount,
          },
        }),
      );

      deactivate();

      try {
        const response = await fetch('/playground/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            componentId,
            iterationCount,
            model: selectedModel || undefined,
          }),
        });

        let data;
        try {
          data = await response.json();
        } catch {
          window.dispatchEvent(
            new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
              detail: { componentId, parentNodeId, error: 'Failed to parse response' },
            }),
          );
          return;
        }

        if (!response.ok || !data.success) {
          const rawError = data?.error || data?.message || 'Generation failed';
          const normalizedError = typeof rawError === 'string' ? rawError.trim() : JSON.stringify(rawError);
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
        const msg = error instanceof Error ? error.message : String(error);
        window.dispatchEvent(
          new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
            detail: { componentId, parentNodeId, error: msg },
          }),
        );
      } finally {
        setIsGenerating(false);
      }
    } else {
      // Ask mode — no component selected
      const textParts: string[] = [];
      for (const seg of segments) {
        if (seg.type === 'text') {
          const trimmed = seg.value.trim();
          if (trimmed) textParts.push(trimmed);
        }
      }
      const userPrompt = textParts.join('\n').trim();
      if (!userPrompt) return;

      setIsGenerating(true);

      try {
        const response = await fetch('/playground/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userPrompt,
            componentId: 'ask',
            mode: 'ask',
            model: selectedModel || undefined,
          }),
        });

        const data = await response.json();
        if (data.success) {
          setAskResponse(data.output || 'Done.');
        } else {
          setAskResponse(`Error: ${data.error || 'Unknown error'}`);
        }
      } catch (error) {
        setAskResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsGenerating(false);
      }
    }
  }, [
    isGenerating, selectedTarget, customInstructionsText, skillPrompt,
    iterationCount, selectedModel, segments, deactivate,
  ]);

  if (mode === 'inactive') return null;

  const pos = mode === 'placed' && placedPos ? placedPos : mousePos;
  const isPlaced = mode === 'placed';

  return (
    <div
      ref={chatRef}
      className="fixed z-[100] pointer-events-none"
      style={{
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%, -100%) translateY(-16px)',
      }}
    >
      <div
        className={`pointer-events-auto transition-all duration-150 ${
          isPlaced
            ? 'opacity-100 scale-100'
            : 'opacity-75 scale-95 border-dashed'
        }`}
        style={{ fontFamily: 'var(--font-geist-sans), Geist, system-ui, sans-serif' }}
      >
        <div className={`rounded-2xl bg-white shadow-xl border border-stone-200 ${isPlaced ? 'w-80' : 'w-72'}`}>
          {/* Element chip */}
          {selectedTarget && isPlaced && (
            <div className="flex items-center gap-1.5 px-3 pt-3">
              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                <Sparkles className="w-3 h-3" />
                <span>{selectedTarget.componentName}</span>
                <button
                  onClick={clearTarget}
                  className="ml-0.5 hover:text-blue-900 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="p-3">
            <InlineReference
              value={segments}
              onValueChange={setSegments}
              className="w-full"
            >
              <InlineReferenceInput
                autoFocus={isPlaced}
                placeholder={
                  selectedTarget
                    ? 'Describe variations for this component…'
                    : 'Ask anything about your project…'
                }
                onSubmit={isPlaced ? handleSend : undefined}
                className={`text-sm bg-white rounded-xl border border-stone-200 outline-none text-stone-800 placeholder:text-stone-400 ${
                  isPlaced ? 'min-h-[72px]' : 'min-h-[40px]'
                }`}
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
                        <span className="text-xs font-medium">{item.label}</span>
                      </InlineReferenceItem>
                    )}
                  </InlineReferenceList>
                  <InlineReferenceEmpty>
                    {isLoadingSkills ? 'Loading skills…' : 'No skills available.'}
                  </InlineReferenceEmpty>
                </InlineReferenceGroup>
              </InlineReferenceContent>
            </InlineReference>
          </div>

          {/* Footer — only in placed mode */}
          {isPlaced && (
            <div className="flex items-center justify-between gap-2 px-3 pb-3">
              <div className="flex items-center gap-2">
                {/* Model dropdown */}
                <ModelDropdown
                  model={selectedModel}
                  onChange={handleModelChange}
                  models={models}
                  isLoading={isLoadingModels}
                />

                {/* Iteration count pills — only when a component is selected */}
                {selectedTarget && (
                  <div className="flex items-center gap-0.5 bg-stone-100 rounded-full px-1.5 py-0.5">
                    {(ITERATION_COUNT_OPTIONS as readonly number[]).map((n) => (
                      <button
                        key={n}
                        onClick={() => setIterationCount(n)}
                        className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-medium transition-colors ${
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
              </div>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={isGenerating}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-stone-900 text-white hover:bg-stone-700 transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Ask mode response */}
          {askResponse && isPlaced && (
            <div className="px-3 pb-3">
              <div className="text-xs text-stone-600 bg-stone-50 rounded-xl p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {askResponse}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
