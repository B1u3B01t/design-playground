'use client';

import { useState, useEffect, useCallback } from 'react';
import { LayoutGrid, Eraser, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import {
  PLAYGROUND_AUTO_ARRANGE_EVENT,
  ITERATION_FETCH_EVENT,
  PLAYGROUND_CLEAR_EVENT,
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  type GenerationStartPayload,
  type GenerationCompletePayload,
  type GenerationErrorPayload,
} from './lib/constants';

// ---------------------------------------------------------------------------
// Generation task tracked for the presence bubble
// ---------------------------------------------------------------------------

interface GenerationTask {
  id: string;
  componentName: string;
  status: 'loading' | 'done';
}

let taskIdCounter = 0;

// ---------------------------------------------------------------------------
// PresenceBubble — spinning bubble during generation
// ---------------------------------------------------------------------------

function PresenceBubble({ task, onRemove }: { task: GenerationTask; onRemove: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={task.status === 'done' ? onRemove : undefined}
          className="relative w-8 h-8 rounded-[50%_50%_50%_4px] border-2 border-white bg-stone-800 cursor-pointer transition-transform hover:-translate-y-0.5 -ml-1.5 first:ml-0"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
          aria-label={task.status === 'loading' ? `Generating: ${task.componentName}` : `Done: ${task.componentName}`}
        >
          {task.status === 'loading' ? (
            <span
              className="absolute inset-1 rounded-full border-2 border-white/30 border-t-white animate-spin"
              style={{ animationDuration: '0.8s' }}
            />
          ) : (
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-stone-800" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{task.status === 'loading' ? `Generating: ${task.componentName}` : `Done: ${task.componentName}`}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// PlaygroundHeader
// ---------------------------------------------------------------------------

interface PlaygroundHeaderProps {
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
}

export default function PlaygroundHeader({ sidebarVisible: _sidebarVisible, onToggleSidebar: _onToggleSidebar }: PlaygroundHeaderProps) {
  const [tasks, setTasks] = useState<GenerationTask[]>([]);

  const handleArrange = () => {
    window.dispatchEvent(new CustomEvent(PLAYGROUND_AUTO_ARRANGE_EVENT, { detail: { fitView: true } }));
  };

  const handleRefresh = () => {
    window.dispatchEvent(new CustomEvent(ITERATION_FETCH_EVENT));
  };

  const handleClear = () => {
    window.dispatchEvent(new CustomEvent(PLAYGROUND_CLEAR_EVENT));
  };

  // Listen for generation lifecycle events
  useEffect(() => {
    const onStart = (e: Event) => {
      const detail = (e as CustomEvent<GenerationStartPayload>).detail;
      const id = `gen-${++taskIdCounter}`;
      setTasks(prev => [...prev, { id, componentName: detail.componentName, status: 'loading' }]);
    };

    const onComplete = (e: Event) => {
      const detail = (e as CustomEvent<GenerationCompletePayload>).detail;
      setTasks(prev =>
        prev.map(t =>
          t.status === 'loading' && t.componentName === detail.componentId
            ? { ...t, status: 'done' as const }
            : t
        )
      );
      // Also try matching by componentId in the task — the event uses componentId
      // Mark the first loading task as done if componentName didn't match
      setTasks(prev => {
        const hasLoading = prev.some(t => t.status === 'loading');
        if (!hasLoading) return prev;
        // Mark the first loading task done
        let found = false;
        return prev.map(t => {
          if (!found && t.status === 'loading') {
            found = true;
            return { ...t, status: 'done' as const };
          }
          return t;
        });
      });
    };

    const onError = (e: Event) => {
      const detail = (e as CustomEvent<GenerationErrorPayload>).detail;
      // Remove the task on error
      setTasks(prev => {
        const idx = prev.findIndex(t => t.status === 'loading');
        if (idx === -1) return prev;
        return prev.filter((_, i) => i !== idx);
      });
    };

    window.addEventListener(GENERATION_START_EVENT, onStart);
    window.addEventListener(GENERATION_COMPLETE_EVENT, onComplete);
    window.addEventListener(GENERATION_ERROR_EVENT, onError);
    return () => {
      window.removeEventListener(GENERATION_START_EVENT, onStart);
      window.removeEventListener(GENERATION_COMPLETE_EVENT, onComplete);
      window.removeEventListener(GENERATION_ERROR_EVENT, onError);
    };
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <TooltipProvider>
      <header
        className="flex items-center justify-between px-4 h-10 bg-[#f5f5f4] border-b border-stone-200 flex-shrink-0"
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
                onClick={handleArrange}
                className="p-1.5 rounded-md text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors"
                aria-label="Auto-arrange layout"
              >
                <LayoutGrid className="w-4 h-4" />
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
                className="p-1.5 rounded-md text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors"
                aria-label="Clear all"
              >
                <Eraser className="w-4 h-4" />
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
                className="p-1.5 rounded-md text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors"
                aria-label="Refresh variations"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Refresh variations</p>
            </TooltipContent>
          </Tooltip>

          {/* Generation presence bubbles */}
          {tasks.length > 0 && (
            <div className="flex items-center ml-3 h-full">
              {tasks.map(task => (
                <PresenceBubble
                  key={task.id}
                  task={task}
                  onRemove={() => removeTask(task.id)}
                />
              ))}
            </div>
          )}
        </div>
      </header>
    </TooltipProvider>
  );
}
