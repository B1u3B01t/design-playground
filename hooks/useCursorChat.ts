'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  CURSOR_CHAT_ACTIVE_EVENT,
  CURSOR_CHAT_NODE_SELECTED_EVENT,
  type CursorChatNodeSelectedPayload,
} from '../lib/constants';

export interface SelectedTarget {
  componentId: string;
  componentName: string;
  nodeId: string;
  sourceFilename?: string;
  elementContext?: string;
}

export type CursorChatMode = 'inactive' | 'peek' | 'placed';

export interface UseCursorChatReturn {
  mode: CursorChatMode;
  mousePos: { x: number; y: number };
  placedPos: { x: number; y: number } | null;
  selectedTarget: SelectedTarget | null;
  activate: () => void;
  place: (x: number, y: number) => void;
  deactivate: () => void;
  resetToFollowing: () => void;
  selectTarget: (target: SelectedTarget) => void;
  clearTarget: () => void;
}

function isEditableElement(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useCursorChat(): UseCursorChatReturn {
  const [mode, setMode] = useState<CursorChatMode>('inactive');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [placedPos, setPlacedPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const activate = useCallback(() => {
    setMode('peek');
    setPlacedPos(null);
    setSelectedTarget(null);
    window.dispatchEvent(
      new CustomEvent(CURSOR_CHAT_ACTIVE_EVENT, { detail: { active: true } }),
    );
  }, []);

  const deactivate = useCallback(() => {
    setMode('inactive');
    setPlacedPos(null);
    setSelectedTarget(null);
    window.dispatchEvent(
      new CustomEvent(CURSOR_CHAT_ACTIVE_EVENT, { detail: { active: false } }),
    );
  }, []);

  const place = useCallback((x: number, y: number) => {
    setMode('placed');
    setPlacedPos({ x, y });
  }, []);

  const resetToFollowing = useCallback(() => {
    setMode('peek');
    setPlacedPos(null);
    setSelectedTarget(null);
  }, []);

  const selectTarget = useCallback((target: SelectedTarget) => {
    setSelectedTarget(target);
  }, []);

  const clearTarget = useCallback(() => {
    setSelectedTarget(null);
  }, []);

  // Track mouse position when in peek mode
  useEffect(() => {
    if (mode !== 'peek') return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mode]);

  // Keyboard shortcuts: C to toggle, Escape to step back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableElement(e.target)) return;

      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        if (modeRef.current === 'inactive') {
          activate();
        } else {
          deactivate();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (modeRef.current === 'placed') {
          e.preventDefault();
          resetToFollowing();
        } else if (modeRef.current === 'peek') {
          e.preventDefault();
          deactivate();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activate, deactivate, resetToFollowing]);

  // Listen for node selection events from PlaygroundCanvas
  useEffect(() => {
    const handleNodeSelected = (e: Event) => {
      const detail = (e as CustomEvent<CursorChatNodeSelectedPayload>).detail;
      setSelectedTarget({
        componentId: detail.componentId,
        componentName: detail.componentName,
        nodeId: detail.nodeId,
        sourceFilename: detail.sourceFilename,
      });
    };

    window.addEventListener(CURSOR_CHAT_NODE_SELECTED_EVENT, handleNodeSelected);
    return () => window.removeEventListener(CURSOR_CHAT_NODE_SELECTED_EVENT, handleNodeSelected);
  }, []);

  return {
    mode,
    mousePos,
    placedPos,
    selectedTarget,
    activate,
    place,
    deactivate,
    resetToFollowing,
    selectTarget,
    clearTarget,
  };
}
