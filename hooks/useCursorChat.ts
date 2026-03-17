'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReactFlow, useOnViewportChange } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { loadSelectedModel, saveSelectedModel } from '../nodes/shared/IterateDialogParts';
import type { ModelOption } from '../nodes/shared/IterateDialogParts';
import { flatRegistry } from '../registry';
import { matchesAction } from '../lib/keybindings';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CursorChatMode = 'inactive' | 'peek' | 'placed';

export interface CursorChatTargetNode {
  nodeId: string;
  componentId: string;
  componentName: string;
  type: 'component' | 'iteration';
  sourceFilename?: string;
}

export interface CursorChatState {
  mode: CursorChatMode;
  screenPosition: { x: number; y: number };
  flowPosition: { x: number; y: number } | null;
  model: string;
  targetNode: CursorChatTargetNode | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCursorChat(models: ModelOption[]) {
  const [mode, setMode] = useState<CursorChatMode>('inactive');
  const [model, setModel] = useState(() => loadSelectedModel() || 'auto');
  const [targetNode, setTargetNode] = useState<CursorChatTargetNode | null>(null);
  const [flowPosition, setFlowPosition] = useState<{ x: number; y: number } | null>(null);

  // Screen position stored in ref for RAF updates (avoids re-renders on every mouse move)
  const screenPosRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const modeRef = useRef<CursorChatMode>('inactive');

  const { screenToFlowPosition, flowToScreenPosition, getNodes } = useReactFlow();

  // Keep mode ref in sync
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // RAF-based cursor tracking for peek mode
  const startTracking = useCallback(() => {
    const tick = () => {
      if (modeRef.current !== 'peek') return;
      const el = containerRef.current;
      if (el) {
        const x = mousePosRef.current.x + 16;
        const y = mousePosRef.current.y + 16;
        // Clamp to viewport
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const clampedX = Math.min(x, vw - 420);
        const clampedY = Math.min(y, vh - 200);
        el.style.transform = `translate3d(${Math.max(0, clampedX)}px, ${Math.max(0, clampedY)}px, 0)`;
      }
      screenPosRef.current = { ...mousePosRef.current };
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopTracking = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Mouse move listener (always on, just stores position)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Activate (Cmd+/ or Ctrl+/)
  const activate = useCallback(() => {
    // Guard: don't activate if focus is in input/textarea/contenteditable
    const active = document.activeElement;
    if (active) {
      const tag = active.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if ((active as HTMLElement).isContentEditable) return;
      // Also skip if a dialog/popover is open
      if (active.closest('[role="dialog"]') || active.closest('[data-radix-popper-content-wrapper]')) return;
    }

    setMode('peek');
    document.body.style.cursor = 'crosshair';
    startTracking();
  }, [startTracking]);

  // Deactivate fully
  const deactivate = useCallback(() => {
    setMode('inactive');
    setTargetNode(null);
    setFlowPosition(null);
    document.body.style.cursor = '';
    stopTracking();
  }, [stopTracking]);

  // Place at current position (peek -> placed)
  const place = useCallback((clickX: number, clickY: number, hitNode: CursorChatTargetNode | null) => {
    const fp = screenToFlowPosition({ x: clickX, y: clickY });
    setFlowPosition(fp);
    setTargetNode(hitNode);
    setMode('placed');
    document.body.style.cursor = '';
    stopTracking();

    // Set the container to the click position
    if (containerRef.current) {
      containerRef.current.style.transform = `translate3d(${clickX + 16}px, ${clickY + 16}px, 0)`;
    }
  }, [screenToFlowPosition, stopTracking]);

  // Unplace (placed -> peek)
  const unplace = useCallback(() => {
    setMode('peek');
    setTargetNode(null);
    setFlowPosition(null);
    document.body.style.cursor = 'crosshair';
    startTracking();
  }, [startTracking]);

  // Flip animation state
  const [isSwitching, setIsSwitching] = useState(false);
  const [nextModel, setNextModel] = useState<string | null>(null);
  const switchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cycle model with Shift+Tab (with flip animation)
  const cycleModel = useCallback(() => {
    if (models.length === 0 || isSwitching) return;
    const currentIdx = models.findIndex(m => m.value === model);
    const nextIdx = (currentIdx + 1) % models.length;
    const next = models[nextIdx].value;

    setNextModel(next);
    setIsSwitching(true);

    switchTimeoutRef.current = setTimeout(() => {
      setModel(next);
      saveSelectedModel(next);
      setIsSwitching(false);
      setNextModel(null);
    }, 350);
  }, [models, model, isSwitching]);

  // Node hit testing for click placement
  const hitTestNode = useCallback((screenX: number, screenY: number): CursorChatTargetNode | null => {
    const nodes = getNodes();
    // Iterate in reverse z-order (last rendered = on top)
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.type !== 'component' && node.type !== 'iteration') continue;

      const flowPos = screenToFlowPosition({ x: screenX, y: screenY });
      const nodeX = node.position.x;
      const nodeY = node.position.y;
      const nodeW = node.measured?.width ?? 400;
      const nodeH = node.measured?.height ?? 300;

      if (
        flowPos.x >= nodeX &&
        flowPos.x <= nodeX + nodeW &&
        flowPos.y >= nodeY &&
        flowPos.y <= nodeY + nodeH
      ) {
        if (node.type === 'component') {
          return {
            nodeId: node.id,
            componentId: (node.data.componentId as string) || '',
            componentName: flatRegistry[(node.data.componentId as string)]?.label || (node.data.componentId as string) || '',
            type: 'component',
          };
        } else {
          return {
            nodeId: node.id,
            componentId: (node.data.componentName as string)?.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '') || '',
            componentName: (node.data.componentName as string) || '',
            type: 'iteration',
            sourceFilename: (node.data.filename as string) || undefined,
          };
        }
      }
    }
    return null;
  }, [getNodes, screenToFlowPosition]);

  // Viewport change: update screen position in placed mode
  useOnViewportChange({
    onChange: useCallback(() => {
      if (modeRef.current === 'placed' && flowPosition && containerRef.current) {
        const sp = flowToScreenPosition(flowPosition);
        containerRef.current.style.transform = `translate3d(${sp.x + 16}px, ${sp.y + 16}px, 0)`;
      }
    }, [flowPosition, flowToScreenPosition]),
  });

  // Global keyboard listener for Cmd+/
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesAction(e, 'cursor-chat.activate')) {
        // Guard: don't intercept if focus is in input/textarea/contenteditable
        const active = document.activeElement;
        if (active) {
          const tag = active.tagName.toLowerCase();
          if (tag === 'input' || tag === 'textarea') return;
          if ((active as HTMLElement).isContentEditable) return;
          if (active.closest('[role="dialog"]') || active.closest('[data-radix-popper-content-wrapper]')) return;
        }
        e.preventDefault();
        if (modeRef.current === 'inactive') {
          activate();
        }
        // If already active, no-op (idempotent)
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activate]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      stopTracking();
      if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current);
    };
  }, [stopTracking]);

  return {
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
    setModel,
    isSwitching,
    nextModel,
  };
}
