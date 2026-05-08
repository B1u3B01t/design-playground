'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { LayoutGrid, Eraser, RefreshCw, X, Settings, Keyboard, ChevronDown, Copy, Palette } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { getModelIconConfig } from './lib/model-icons';
import { CANVAS_BACKGROUND_COLOR } from './lib/constants';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import cursorIcon from './assets/cursor-icon.svg';
import finderIcon from './assets/finder-icon.png';
import githubDesktopIcon from './assets/github-desktop-icon.png';
import antigravityIcon from './assets/antigravity-icon.png';
import {
  PLAYGROUND_AUTO_ARRANGE_EVENT,
  ITERATION_FETCH_EVENT,
  PLAYGROUND_CLEAR_EVENT,
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  GENERATION_QUEUED_EVENT,
  GENERATION_AGENT_PREVIEW_EVENT,
  PAN_TO_POSITION_EVENT,
  FIT_COMPONENT_NODES_EVENT,
  PRESENCE_BUBBLES_STORAGE_KEY,
  type GenerationStartPayload,
  type GenerationErrorPayload,
  type GenerationQueuedPayload,
  type GenerationAgentPreviewPayload,
} from './lib/constants';
import { cn } from './lib/utils';
import ModelSettingsModal from './ModelSettingsModal';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import DesignSystemModal from './DesignSystemModal';

// ---------------------------------------------------------------------------
// Presence Bubble Type
// ---------------------------------------------------------------------------

interface PresenceBubble {
  id: string;
  componentId: string;
  model: string;
  provider?: string;
  status: 'queued' | 'generating' | 'done';
  flowPosition: { x: number; y: number } | null;
  /** Distinguishes adopt operations from normal generation */
  type?: 'iterate' | 'edit' | 'adopt';
  /** Live assistant text from Claude Code stream-json (not persisted) */
  agentPreviewText?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlaygroundHeaderProps {
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
}

type OpenInTarget = 'finder' | 'cursor' | 'antigravity' | 'github-desktop';

interface ProjectContext {
  projectName: string;
  projectPath: string;
}

const ICON_SRC = (icon: unknown) =>
  (icon as { src?: string }).src ?? (icon as string);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlaygroundHeader({
  sidebarVisible: _sidebarVisible,
  onToggleSidebar: _onToggleSidebar,
}: PlaygroundHeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [presenceBubbles, setPresenceBubbles] = useState<PresenceBubble[]>([]);
  const [projectContext, setProjectContext] = useState<ProjectContext>({
    projectName: 'project',
    projectPath: '',
  });
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [pathCopied, setPathCopied] = useState(false);
  const removeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/playground/api/open-in');
        if (!response.ok) return;
        const data = await response.json();
        if (typeof data?.projectName === 'string' && typeof data?.projectPath === 'string') {
          setProjectContext({
            projectName: data.projectName,
            projectPath: data.projectPath,
          });
        }
      } catch {
        // Ignore failures — project menu is best effort in dev.
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current) {
        clearTimeout(copyFeedbackTimerRef.current);
      }
    };
  }, []);

  // Hydrate presence bubbles from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PRESENCE_BUBBLES_STORAGE_KEY);
      if (stored) {
        const bubbles = JSON.parse(stored) as PresenceBubble[];
        // On reload, drop queued bubbles (queue state is lost), keep generating and done
        setPresenceBubbles(bubbles.filter(b => b.status !== 'queued'));
      }
    } catch { /* ignore */ }
  }, []);

  // Persist presence bubbles to localStorage (omit large live preview text)
  useEffect(() => {
    try {
      const storable = presenceBubbles.map(({ agentPreviewText: _omit, ...rest }) => rest);
      localStorage.setItem(PRESENCE_BUBBLES_STORAGE_KEY, JSON.stringify(storable));
    } catch { /* ignore */ }
  }, [presenceBubbles]);

  // Listen to generation lifecycle events
  useEffect(() => {
    const handleQueued = (e: Event) => {
      const detail = (e as CustomEvent<GenerationQueuedPayload>).detail;
      const id = `${detail.componentId}-queued-${Date.now()}`;
      const bubble: PresenceBubble = {
        id,
        componentId: detail.componentId,
        model: detail.model || 'auto',
        provider: detail.provider,
        status: 'queued',
        flowPosition: detail.flowPosition ?? null,
      };
      setPresenceBubbles(prev => [...prev, bubble]);
    };

    const handleStart = (e: Event) => {
      const detail = (e as CustomEvent<GenerationStartPayload>).detail;
      const bubbleType = detail.adoptionMode ? 'adopt' as const : detail.editMode ? 'edit' as const : 'iterate' as const;

      setPresenceBubbles(prev => {
        // Try to transition a queued bubble for this component
        const queuedIdx = prev.findIndex(
          b => b.status === 'queued' && b.id.startsWith(detail.componentId)
        );

        if (queuedIdx !== -1) {
          return prev.map((b, i) =>
            i === queuedIdx
              ? {
                  ...b,
                  status: 'generating' as const,
                  model: detail.model || b.model,
                  provider: detail.provider ?? b.provider,
                  flowPosition: detail.flowPosition ?? b.flowPosition,
                  type: bubbleType,
                  agentPreviewText: undefined,
                }
              : b
          );
        }

        // No queued bubble — create a new one
        const id = `${detail.componentId}-${Date.now()}`;
        const bubble: PresenceBubble = {
          id,
          componentId: detail.componentId,
          model: detail.model || 'auto',
          provider: detail.provider,
          status: 'generating',
          flowPosition: detail.flowPosition ?? null,
          type: bubbleType,
          agentPreviewText: undefined,
        };
        return [...prev, bubble];
      });
    };

    const handleComplete = (e: Event) => {
      const detail = (e as CustomEvent<{ componentId: string }>).detail;
      setPresenceBubbles(prev => {
        const updated = prev.map(b =>
          b.status === 'generating' && b.id.startsWith(detail.componentId)
            ? { ...b, status: 'done' as const }
            : b
        );
        return updated;
      });
    };

    const handleError = (e: Event) => {
      const detail = (e as CustomEvent<{ componentId: string }>).detail;
      setPresenceBubbles(prev =>
        prev.filter(b => !(
          (b.status === 'generating' || b.status === 'queued') &&
          b.id.startsWith(detail.componentId)
        ))
      );
    };

    const handleAgentPreview = (e: Event) => {
      const d = (e as CustomEvent<GenerationAgentPreviewPayload>).detail;
      setPresenceBubbles((prev) =>
        prev.map((b) =>
          b.componentId === d.componentId &&
          (b.status === 'generating' || b.status === 'done')
            ? { ...b, agentPreviewText: d.text }
            : b,
        ),
      );
    };

    window.addEventListener(GENERATION_QUEUED_EVENT, handleQueued);
    window.addEventListener(GENERATION_START_EVENT, handleStart);
    window.addEventListener(GENERATION_COMPLETE_EVENT, handleComplete);
    window.addEventListener(GENERATION_ERROR_EVENT, handleError);
    window.addEventListener(GENERATION_AGENT_PREVIEW_EVENT, handleAgentPreview);
    return () => {
      window.removeEventListener(GENERATION_QUEUED_EVENT, handleQueued);
      window.removeEventListener(GENERATION_START_EVENT, handleStart);
      window.removeEventListener(GENERATION_COMPLETE_EVENT, handleComplete);
      window.removeEventListener(GENERATION_ERROR_EVENT, handleError);
      window.removeEventListener(GENERATION_AGENT_PREVIEW_EVENT, handleAgentPreview);
      // Clean up timers
      for (const timer of removeTimersRef.current.values()) clearTimeout(timer);
      removeTimersRef.current.clear();
    };
  }, []);

  const handleBubbleClick = useCallback((bubble: PresenceBubble) => {
    window.dispatchEvent(
      new CustomEvent(FIT_COMPONENT_NODES_EVENT, { detail: { componentId: bubble.componentId } })
    );
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

  const handleOpenTarget = useCallback(async (target: OpenInTarget) => {
    try {
      await fetch('/playground/api/open-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
    } catch {
      // Ignore for now — this action is best effort.
    } finally {
      setProjectMenuOpen(false);
    }
  }, []);

  const handleCopyPath = useCallback(async () => {
    if (!projectContext.projectPath) return;
    try {
      await navigator.clipboard.writeText(projectContext.projectPath);
      setPathCopied(true);
      if (copyFeedbackTimerRef.current) clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = setTimeout(() => setPathCopied(false), 1200);
    } catch {
      // Ignore copy failures to avoid interrupting flow.
    } finally {
      setProjectMenuOpen(false);
    }
  }, [projectContext.projectPath]);

  return (
    <TooltipProvider>
      <header
        className="flex items-center justify-between px-4 h-12 bg-gradient-to-b from-[CANVAS_BACKGROUND_COLOR] to-transparent flex-shrink-0"
        style={{
          backgroundColor: CANVAS_BACKGROUND_COLOR,
        }}
      >
        {/* Left: route label + open-in menu */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-stone-500 tracking-tight select-none">
            /playground
          </span>
          <DropdownMenu open={projectMenuOpen} onOpenChange={setProjectMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-mono text-stone-800 hover:bg-stone-200/60 transition-colors"
                aria-label="Open project in external app"
              >
                <span className="truncate max-w-[220px]">{projectContext.projectName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="bottom"
              sideOffset={6}
              className="w-48 rounded-lg border border-stone-200 bg-white/95 p-1 shadow-[0_12px_24px_rgba(28,25,23,0.12)] backdrop-blur-sm"
            >
              <DropdownMenuItem
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-mono text-stone-700 cursor-pointer"
                onSelect={() => handleOpenTarget('finder')}
              >
                <Image src={ICON_SRC(finderIcon)} alt="" width={16} height={16} className="rounded-sm" />
                <span>Finder</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-mono text-stone-700 cursor-pointer"
                onSelect={() => handleOpenTarget('cursor')}
              >
                <Image src={ICON_SRC(cursorIcon)} alt="" width={16} height={16} className="rounded-sm" />
                <span>Cursor</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-mono text-stone-700 cursor-pointer"
                onSelect={() => handleOpenTarget('antigravity')}
              >
                <Image src={ICON_SRC(antigravityIcon)} alt="" width={16} height={16} className="rounded-sm" />
                <span>Antigravity</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-mono text-stone-700 cursor-pointer"
                onSelect={() => handleOpenTarget('github-desktop')}
              >
                <Image src={ICON_SRC(githubDesktopIcon)} alt="" width={16} height={16} className="rounded-sm" />
                <span>GitHub Desktop</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-mono text-stone-700 cursor-pointer"
                onSelect={handleCopyPath}
              >
                <Copy className="h-4 w-4 text-stone-500" />
                <span>{pathCopied ? 'Copied!' : 'Copy path'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right: action icons + presence bubbles */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShortcutsOpen(true)}
                className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors"
                aria-label="Keyboard shortcuts"
              >
                <Keyboard className="w-[18px] h-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Keyboard shortcuts</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setDesignOpen(true)}
                className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors"
                aria-label="Design system"
              >
                <Palette className="w-[18px] h-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Design system</p>
            </TooltipContent>
          </Tooltip>

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

          {/* Presence bubbles — stacked, active leftmost on top */}
          {presenceBubbles.length > 0 && (
         <div className="flex items-center ml-1.5 gap-0.5">
            {presenceBubbles.map((bubble) => {
              // Resolve icon: if model is generic ('auto') but provider is claude-code, show Claude icon
              const iconKey = (bubble.model === 'auto' && bubble.provider === 'claude-code') ? 'claude' : bubble.model;
              const iconConfig = getModelIconConfig(iconKey);
              const displayName = bubble.provider === 'claude-code' ? `Claude Code (${bubble.model})` : bubble.model;
              const tooltipText = bubble.status === 'queued'
                ? 'Queued — will run after current generation'
                : bubble.type === 'adopt'
                  ? `Adopting — ${displayName}`
                  : `${displayName} — ${bubble.status}`;

              const showClaudeStreamTooltip =
                bubble.provider === 'claude-code' &&
                (bubble.status === 'generating' ||
                  (bubble.status === 'done' && Boolean(bubble.agentPreviewText?.trim())));

              return (
                <Tooltip key={bubble.id} delayDuration={showClaudeStreamTooltip ? 280 : undefined}>
                  <TooltipTrigger asChild>
                <div
                  className="presence-bubble group"
                  onClick={() => handleBubbleClick(bubble)}
                >
                  {bubble.status === 'generating' && (
                    <div className={bubble.type === 'adopt' ? 'presence-bubble-spinner--adopt' : 'presence-bubble-spinner'} />
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
                    aria-label={bubble.status === 'generating' ? 'Cancel generation' : bubble.status === 'queued' ? 'Remove from queue' : 'Dismiss'}
                  >
                    <X className="w-2 h-2 text-stone-500" />
                  </button>
                </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    sideOffset={6}
                    className={cn(
                      showClaudeStreamTooltip
                        ? 'max-w-[min(20rem,calc(100vw-2rem))] p-0 border border-stone-200/90 bg-white text-stone-800 shadow-lg pointer-events-auto overflow-hidden rounded-lg'
                        : 'text-xs',
                    )}
                  >
                    {showClaudeStreamTooltip ? (
                      <>
                        <div className="border-b border-stone-100/90 px-3 py-2 text-[11px] font-medium text-stone-600 bg-gradient-to-b from-stone-50 to-stone-50/80">
                          {bubble.status === 'done'
                            ? `${displayName} · done`
                            : bubble.type === 'adopt'
                              ? `Adopting — ${displayName}`
                              : displayName}
                        </div>
                        <div
                          className="max-h-44 min-h-[2.75rem] overflow-y-auto overscroll-y-contain px-3 py-2 text-[11px] leading-relaxed font-mono text-stone-700 whitespace-pre-wrap break-words bg-white"
                          onWheel={(e) => e.stopPropagation()}
                        >
                          {bubble.agentPreviewText?.trim()
                            ? bubble.agentPreviewText
                            : 'Waiting for assistant text…'}
                        </div>
                      </>
                    ) : (
                      <p>{tooltipText}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
              })}
            </div>
          )}
        </div>
      </header>

      <ModelSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <KeyboardShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <DesignSystemModal open={designOpen} onOpenChange={setDesignOpen} />
    </TooltipProvider>
  );
}
