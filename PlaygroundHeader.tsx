'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Eraser, RefreshCw, X, SlidersVertical, Keyboard, ChevronDown, Copy, Wrench } from 'lucide-react';
import { useDevModeStore } from './lib/dev-mode-store';
import { useFlowMocksStore } from './lib/flow-mocks-store';
import {
  FLOW_PLAY_EVENT,
  FLOW_COMBINE_EVENT,
  FLOW_ADOPT_EVENT,
  type FlowPlayPayload,
  type FlowAdoptPayload,
} from './lib/constants';
import { Play, Combine, Upload } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { getModelIconConfig } from './lib/model-icons';
import { getProvider } from './lib/providers/registry';
import type { ProviderId } from './lib/providers/types';

function resolveBubbleDisplayName(model: string, provider: ProviderId): string {
  if (provider === 'cursor') return model;
  const config = getProvider(provider);
  const modelLabel = model && model !== 'auto' ? model : 'default';
  return `${config.displayName} (${modelLabel})`;
}
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
import codexIcon from './assets/codex-icon.png';
import {
  OPEN_SKILLS_CATALOG_EVENT,
  ITERATION_FETCH_EVENT,
  PLAYGROUND_CLEAR_EVENT,
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  GENERATION_QUEUED_EVENT,
  GENERATION_AGENT_PREVIEW_EVENT,
  PAN_TO_POSITION_EVENT,
  FIT_COMPONENT_NODES_EVENT,
  PRESENCE_BUBBLE_DISMISS_EVENT,
  PRESENCE_BUBBLES_STORAGE_KEY,
  type GenerationStartPayload,
  type GenerationErrorPayload,
  type GenerationQueuedPayload,
  type GenerationAgentPreviewPayload,
  type PresenceBubbleDismissPayload,
} from './lib/constants';
import { cn } from './lib/utils';
import { useMultiplayer } from './lib/multiplayer-context';
import { PresenceAvatars } from './lib/presence';
import ModelSettingsModal from './ModelSettingsModal';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';

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
  targetNodeId?: string | null;
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

type OpenInTarget = 'finder' | 'cursor' | 'antigravity' | 'codex' | 'github-desktop';

interface ProjectContext {
  projectName: string;
  projectPath: string;
}

const ICON_SRC = (icon: unknown) =>
  (icon as { src?: string }).src ?? (icon as string);

const OPEN_IN_DEFAULT_KEY = 'playground-open-in-default';

const TARGET_LABELS: Record<OpenInTarget, string> = {
  cursor: 'Cursor',
  finder: 'Finder',
  antigravity: 'Antigravity',
  codex: 'Codex',
  'github-desktop': 'GitHub Desktop',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlaygroundHeader({
  sidebarVisible: _sidebarVisible,
  onToggleSidebar: _onToggleSidebar,
}: PlaygroundHeaderProps) {
  const multiplayer = useMultiplayer();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [devModeMenu, setDevModeMenu] = useState<{ x: number; y: number } | null>(null);
  const devMode = useDevModeStore((s) => s.enabled);
  const toggleDevMode = useDevModeStore((s) => s.toggle);
  const flows = useFlowMocksStore((s) => s.flows);
  const flowIds = Object.keys(flows);
  const activeFlowId = flowIds[flowIds.length - 1] ?? null;
  const hasCanonicalChoices =
    !!activeFlowId &&
    Object.keys(flows[activeFlowId]?.canonicalIterationByStage ?? {}).length > 0;

  const fireFlowEvent = useCallback(
    (name: string, payload: FlowPlayPayload | FlowAdoptPayload) => {
      window.dispatchEvent(new CustomEvent(name, { detail: payload }));
    },
    [],
  );
  const [presenceBubbles, setPresenceBubbles] = useState<PresenceBubble[]>([]);
  const [projectContext, setProjectContext] = useState<ProjectContext>({
    projectName: 'project',
    projectPath: '',
  });
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [pathCopied, setPathCopied] = useState(false);
  const [defaultTarget, setDefaultTarget] = useState<OpenInTarget>(() => {
    if (typeof window === 'undefined') return 'cursor';
    const stored = localStorage.getItem(OPEN_IN_DEFAULT_KEY) as OpenInTarget | null;
    return stored ?? 'cursor';
  });
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

  useEffect(() => {
    if (!devModeMenu) return;
    const handleClick = () => setDevModeMenu(null);
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDevModeMenu(null); };
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [devModeMenu]);

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
        targetNodeId: detail.targetNodeId ?? null,
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
                  targetNodeId: detail.targetNodeId ?? detail.parentNodeId ?? b.targetNodeId ?? null,
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
          targetNodeId: detail.targetNodeId ?? detail.parentNodeId ?? null,
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

  const dismissBubbleEverywhere = useCallback((bubble: PresenceBubble) => {
    window.dispatchEvent(
      new CustomEvent<PresenceBubbleDismissPayload>(PRESENCE_BUBBLE_DISMISS_EVENT, {
        detail: {
          componentId: bubble.componentId,
          flowPosition: bubble.flowPosition,
          targetNodeId: bubble.targetNodeId ?? null,
        },
      }),
    );
  }, []);

  const handleBubbleClick = useCallback((bubble: PresenceBubble) => {
    if (bubble.flowPosition || bubble.targetNodeId) {
      window.dispatchEvent(
        new CustomEvent(PAN_TO_POSITION_EVENT, {
          detail: {
            x: bubble.flowPosition?.x,
            y: bubble.flowPosition?.y,
            componentId: bubble.componentId,
            targetNodeId: bubble.targetNodeId ?? null,
          },
        }),
      );
    } else {
      window.dispatchEvent(
        new CustomEvent(FIT_COMPONENT_NODES_EVENT, { detail: { componentId: bubble.componentId } }),
      );
    }
    // Don't dismiss while the generation is still running or queued — only navigate to it.
    if (bubble.status === 'generating' || bubble.status === 'queued') return;
    setPresenceBubbles((prev) => prev.filter((b) => b.id !== bubble.id));
    dismissBubbleEverywhere(bubble);
  }, [dismissBubbleEverywhere]);

  const handleRemoveBubble = useCallback((id: string) => {
    setPresenceBubbles(prev => prev.filter(b => b.id !== id));
    const timer = removeTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      removeTimersRef.current.delete(id);
    }
  }, []);

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

  const handleOpenTarget = useCallback(async (target: OpenInTarget, makeDefault = false) => {
    if (makeDefault) {
      setDefaultTarget(target);
      try { localStorage.setItem(OPEN_IN_DEFAULT_KEY, target); } catch { /* ignore */ }
    }
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
        {/* Left: project name label */}
        <div className="flex items-center">
          <span className="text-sm font-medium text-stone-500 tracking-tight select-none">
            /{projectContext.projectName}
          </span>
        </div>

        {/* Right: action icons + presence bubbles */}
        <div className="flex items-center gap-0.5">
          {multiplayer.enabled && <PresenceAvatars />}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent(OPEN_SKILLS_CATALOG_EVENT))}
                className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors"
                aria-label="Skills"
              >
                <Wrench className="w-[18px] h-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Skills</p>
            </TooltipContent>
          </Tooltip>

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
                onClick={() => setSettingsOpen(true)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const MENU_WIDTH = 180;
                  const MENU_HEIGHT = 44;
                  const PADDING = 8;
                  const x = Math.min(e.clientX, window.innerWidth - MENU_WIDTH - PADDING);
                  const y = Math.min(e.clientY, window.innerHeight - MENU_HEIGHT - PADDING);
                  setDevModeMenu({ x, y });
                }}
                className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors"
                aria-label="Model settings"
              >
                <SlidersVertical className="w-[18px] h-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Model settings</p>
            </TooltipContent>
          </Tooltip>

          {activeFlowId && (
            <>
              <div className="w-px h-5 bg-stone-200 mx-1" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() =>
                      fireFlowEvent(FLOW_PLAY_EVENT, { flowId: activeFlowId })
                    }
                    className="p-2 text-purple-600 hover:text-purple-700 hover:bg-purple-100/60 transition-colors"
                    aria-label="Play flow"
                  >
                    <Play className="w-[18px] h-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Play flow with mock data</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() =>
                      fireFlowEvent(FLOW_COMBINE_EVENT, {
                        flowId: activeFlowId,
                        useCanonical: true,
                      })
                    }
                    disabled={!hasCanonicalChoices}
                    className="p-2 text-purple-600 hover:text-purple-700 hover:bg-purple-100/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Combine canonical variants"
                  >
                    <Combine className="w-[18px] h-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>
                    {hasCanonicalChoices
                      ? 'Combine canonical variants into a stitched preview'
                      : 'Pick a canonical variant per stage first'}
                  </p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() =>
                      fireFlowEvent(FLOW_ADOPT_EVENT, { flowId: activeFlowId })
                    }
                    disabled={!hasCanonicalChoices}
                    className="p-2 text-purple-600 hover:text-purple-700 hover:bg-purple-100/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Adopt to /signup"
                  >
                    <Upload className="w-[18px] h-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>
                    {hasCanonicalChoices
                      ? 'Generate a diff against the original source'
                      : 'Pick a canonical variant per stage first'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </>
          )}

          {devMode && (
            <>
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
            </>
          )}

          {/* Split open-in button — far right */}
          <div className="flex items-center ml-1.5">
            <div className="flex items-center rounded-2xl border border-stone-200 bg-white overflow-hidden">
              {/* Default app: click to open immediately */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleOpenTarget(defaultTarget)}
                    className="flex items-center justify-center w-9 h-9 hover:bg-stone-50 transition-colors"
                    aria-label={`Open in ${TARGET_LABELS[defaultTarget]}`}
                  >
                    <Image
                      src={
                        defaultTarget === 'cursor' ? ICON_SRC(cursorIcon)
                        : defaultTarget === 'finder' ? ICON_SRC(finderIcon)
                        : defaultTarget === 'antigravity' ? ICON_SRC(antigravityIcon)
                        : defaultTarget === 'codex' ? ICON_SRC(codexIcon)
                        : ICON_SRC(githubDesktopIcon)
                      }
                      alt={TARGET_LABELS[defaultTarget]}
                      width={18}
                      height={18}
                      className="rounded-sm"
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  <p>Open in {TARGET_LABELS[defaultTarget]}</p>
                </TooltipContent>
              </Tooltip>

              {/* Divider */}
              <div className="w-px h-4 bg-stone-200 shrink-0" />

              {/* Chevron: opens picker dropdown */}
              <DropdownMenu open={projectMenuOpen} onOpenChange={setProjectMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center justify-center w-7 h-9 hover:bg-stone-50 transition-colors"
                    aria-label="Choose app to open in"
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="bottom"
                  sideOffset={6}
                  className="w-48 rounded-2xl border border-stone-200 bg-white/95 p-1.5 shadow-[0_12px_24px_rgba(28,25,23,0.12)] backdrop-blur-sm"
                >
                  {(
                    [
                      { target: 'cursor' as const, icon: ICON_SRC(cursorIcon), label: 'Cursor' },
                      { target: 'finder' as const, icon: ICON_SRC(finderIcon), label: 'Finder' },
                      { target: 'antigravity' as const, icon: ICON_SRC(antigravityIcon), label: 'Antigravity' },
                      { target: 'codex' as const, icon: ICON_SRC(codexIcon), label: 'Codex' },
                      { target: 'github-desktop' as const, icon: ICON_SRC(githubDesktopIcon), label: 'GitHub Desktop' },
                    ] satisfies { target: OpenInTarget; icon: string; label: string }[]
                  ).map(({ target, icon, label }) => (
                    <DropdownMenuItem
                      key={target}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-mono text-stone-700 cursor-pointer"
                      onSelect={() => handleOpenTarget(target, true)}
                    >
                      <Image src={icon} alt="" width={16} height={16} className="rounded-sm" />
                      <span className="flex-1">{label}</span>
                      {defaultTarget === target && (
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                  <div className="my-1 h-px bg-stone-100" />
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-mono text-stone-700 cursor-pointer"
                    onSelect={handleCopyPath}
                  >
                    <Copy className="h-4 w-4 text-stone-400" />
                    <span>{pathCopied ? 'Copied!' : 'Copy path'}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Presence bubbles — stacked, active leftmost on top */}
          {presenceBubbles.length > 0 && (
         <div className="flex items-center ml-1.5 gap-0.5">
            {presenceBubbles.map((bubble) => {
              const bubbleProvider = (bubble.provider ?? 'cursor') as ProviderId;
              const iconConfig = getModelIconConfig(bubble.model, bubbleProvider);
              const displayName = resolveBubbleDisplayName(bubble.model, bubbleProvider);
              const tooltipText = bubble.status === 'queued'
                ? 'Queued — will run after current generation'
                : bubble.type === 'adopt'
                  ? `Adopting — ${displayName}`
                  : `${displayName} — ${bubble.status}`;

              const showAgentStreamTooltip =
                (bubbleProvider === 'claude-code' || bubbleProvider === 'codex') &&
                (bubble.status === 'generating' ||
                  (bubble.status === 'done' && Boolean(bubble.agentPreviewText?.trim())));

              return (
                <Tooltip key={bubble.id} delayDuration={showAgentStreamTooltip ? 280 : undefined}>
                  <TooltipTrigger asChild>
                <div
                  className="presence-bubble group"
                  data-status={bubble.status}
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
                      dismissBubbleEverywhere(bubble);
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
                    sideOffset={12}
                    className={cn(
                      showAgentStreamTooltip
                        ? 'w-[min(22rem,calc(100vw-2rem))] p-0 border border-stone-200/80 bg-[#fbfbfb] text-stone-800 shadow-[0_20px_48px_-22px_rgba(28,25,23,0.38)] pointer-events-auto overflow-hidden rounded-2xl'
                        : 'text-xs',
                    )}
                  >
                    {showAgentStreamTooltip ? (
                      <>
                        <div className="border-b border-stone-200/70 px-3.5 py-2.5 text-[11px] font-semibold tracking-[-0.01em] text-stone-600 bg-gradient-to-b from-white to-stone-50/80">
                          {bubble.status === 'done'
                            ? `${displayName} · done`
                            : bubble.type === 'adopt'
                              ? `Adopting — ${displayName}`
                              : displayName}
                        </div>
                        <div
                          className="max-h-48 min-h-[3.25rem] overflow-y-auto overscroll-y-contain px-3.5 py-3 text-[12px] leading-5 font-mono text-stone-700 whitespace-pre-wrap break-words bg-[#fbfbfb]"
                          onWheel={(e) => e.stopPropagation()}
                        >
                          {bubble.agentPreviewText?.trim()
                            ? bubble.agentPreviewText
                            : 'Waiting for assistant text...'}
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

      {devModeMenu && createPortal(
        <div
          className="fixed z-50 min-w-[180px] bg-white border border-stone-200 rounded-2xl shadow-lg p-1 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: devModeMenu.y, left: devModeMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              toggleDevMode();
              setDevModeMenu(null);
            }}
            className="flex items-center justify-between gap-3 w-full px-3 py-1.5 text-[13px] text-stone-700 hover:bg-stone-100 transition-colors text-left rounded-xl"
          >
            <span>Dev mode</span>
            <span
              className={cn(
                'relative inline-flex h-[16px] w-[28px] items-center rounded-full transition-colors',
                devMode ? 'bg-stone-800' : 'bg-stone-300',
              )}
            >
              <span
                className={cn(
                  'inline-block h-[12px] w-[12px] rounded-full bg-white shadow transition-transform',
                  devMode ? 'translate-x-[14px]' : 'translate-x-[2px]',
                )}
              />
            </span>
          </button>
        </div>,
        document.body,
      )}
    </TooltipProvider>
  );
}
