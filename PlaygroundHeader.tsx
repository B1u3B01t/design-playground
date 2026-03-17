'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { LayoutGrid, Eraser, RefreshCw, X, Settings } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { getModelIconConfig } from './lib/model-icons';
import {
  PLAYGROUND_AUTO_ARRANGE_EVENT,
  ITERATION_FETCH_EVENT,
  PLAYGROUND_CLEAR_EVENT,
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  PAN_TO_POSITION_EVENT,
  type GenerationStartPayload,
  type GenerationErrorPayload,
} from './lib/constants';
import ModelSettingsModal from './ModelSettingsModal';

// ---------------------------------------------------------------------------
// Presence Bubble Type
// ---------------------------------------------------------------------------

interface PresenceBubble {
  id: string;
  model: string;
  status: 'generating' | 'done';
  flowPosition: { x: number; y: number } | null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlaygroundHeaderProps {
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlaygroundHeader({
  sidebarVisible: _sidebarVisible,
  onToggleSidebar: _onToggleSidebar,
}: PlaygroundHeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [presenceBubbles, setPresenceBubbles] = useState<PresenceBubble[]>([]);
  const removeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Listen to generation lifecycle events
  useEffect(() => {
    const handleStart = (e: Event) => {
      const detail = (e as CustomEvent<GenerationStartPayload>).detail;
      const id = `${detail.componentId}-${Date.now()}`;
      const bubble: PresenceBubble = {
        id,
        model: detail.model || 'auto',
        status: 'generating',
        flowPosition: detail.flowPosition ?? null,
      };
      setPresenceBubbles(prev => [...prev, bubble]);
    };

    const handleComplete = (e: Event) => {
      const detail = (e as CustomEvent<{ componentId: string }>).detail;
      setPresenceBubbles(prev => {
        const updated = prev.map(b =>
          b.status === 'generating' && b.id.startsWith(detail.componentId)
            ? { ...b, status: 'done' as const }
            : b
        );
        // Auto-remove done bubbles after 5s
        for (const b of updated) {
          if (b.status === 'done' && !removeTimersRef.current.has(b.id)) {
            const timer = setTimeout(() => {
              setPresenceBubbles(p => p.filter(x => x.id !== b.id));
              removeTimersRef.current.delete(b.id);
            }, 5000);
            removeTimersRef.current.set(b.id, timer);
          }
        }
        return updated;
      });
    };

    const handleError = (e: Event) => {
      const detail = (e as CustomEvent<{ componentId: string }>).detail;
      setPresenceBubbles(prev =>
        prev.filter(b => !(b.status === 'generating' && b.id.startsWith(detail.componentId)))
      );
    };

    window.addEventListener(GENERATION_START_EVENT, handleStart);
    window.addEventListener(GENERATION_COMPLETE_EVENT, handleComplete);
    window.addEventListener(GENERATION_ERROR_EVENT, handleError);
    return () => {
      window.removeEventListener(GENERATION_START_EVENT, handleStart);
      window.removeEventListener(GENERATION_COMPLETE_EVENT, handleComplete);
      window.removeEventListener(GENERATION_ERROR_EVENT, handleError);
      // Clean up timers
      for (const timer of removeTimersRef.current.values()) clearTimeout(timer);
      removeTimersRef.current.clear();
    };
  }, []);

  const handleBubbleClick = useCallback((bubble: PresenceBubble) => {
    if (bubble.flowPosition) {
      window.dispatchEvent(
        new CustomEvent(PAN_TO_POSITION_EVENT, { detail: bubble.flowPosition })
      );
    }
  }, []);

  const handleRemoveBubble = useCallback((id: string) => {
    setPresenceBubbles(prev => prev.filter(b => b.id !== id));
    const timer = removeTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      removeTimersRef.current.delete(id);
    }
  }, []);

  const handleArrange = () => {
    window.dispatchEvent(new CustomEvent(PLAYGROUND_AUTO_ARRANGE_EVENT, { detail: { fitView: true } }));
  };

  const handleRefresh = () => {
    window.dispatchEvent(new CustomEvent(ITERATION_FETCH_EVENT));
  };

  const handleClear = () => {
    window.dispatchEvent(new CustomEvent(PLAYGROUND_CLEAR_EVENT));
  };

  const handleCancelGeneration = async () => {
    try {
      await fetch('/playground/api/generate', { method: 'DELETE' });
      window.dispatchEvent(new CustomEvent<GenerationErrorPayload>(GENERATION_ERROR_EVENT, {
        detail: { componentId: '', parentNodeId: '', error: 'Cancelled by user' },
      }));
    } catch (error) {
      console.error('Error cancelling generation:', error);
    }
  };

  return (
    <TooltipProvider>
      <header
        className="flex items-center justify-between px-4 h-12 bg-gradient-to-b from-stone-50 to-transparent flex-shrink-0"
      >
        {/* Left: route label */}
        <span className="text-sm font-medium text-stone-800 tracking-tight select-none">
          /playground
        </span>

        {/* Right: action icons + presence bubbles */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors"
                aria-label="Model settings"
              >
                <Settings className="w-[18px] h-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Model settings</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleArrange}
                className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors"
                aria-label="Auto-arrange layout"
              >
                <LayoutGrid className="w-[18px] h-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Auto-arrange layout</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleClear}
                className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors"
                aria-label="Clear all"
              >
                <Eraser className="w-[18px] h-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Clear all</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleRefresh}
                className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors"
                aria-label="Refresh variations"
              >
                <RefreshCw className="w-[18px] h-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Refresh variations</p>
            </TooltipContent>
          </Tooltip>

          {/* Presence bubbles — after action icons */}
          {presenceBubbles.length > 0 && (
            <div className="flex items-center ml-1.5 gap-0.5">
              {presenceBubbles.map((bubble) => {
                const iconConfig = getModelIconConfig(bubble.model);
                return (
                <div
                  key={bubble.id}
                  className="presence-bubble group"
                  onClick={() => handleBubbleClick(bubble)}
                  title={`${bubble.model} — ${bubble.status}`}
                >
                  {bubble.status === 'generating' && (
                    <div className="presence-bubble-spinner" />
                  )}
                  <div
                    className="presence-bubble-face"
                    style={{
                      backgroundColor: iconConfig.bg,
                      backgroundImage: `url(${iconConfig.src})`,
                    }}
                  />
                  {bubble.status === 'done' && (
                    <div className="presence-bubble-dot" />
                  )}
                  {/* Cancel / remove on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (bubble.status === 'generating') {
                        handleCancelGeneration();
                      }
                      handleRemoveBubble(bubble.id);
                    }}
                    className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white border border-stone-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={bubble.status === 'generating' ? 'Cancel generation' : 'Dismiss'}
                  >
                    <X className="w-2 h-2 text-stone-500" />
                  </button>
                </div>
              );
              })}
            </div>
          )}
        </div>
      </header>

      <ModelSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </TooltipProvider>
  );
}
