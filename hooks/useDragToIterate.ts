'use client';

import { useCallback, useRef, useState } from 'react';
import {
  DRAG_ITERATE_THRESHOLD_PX,
  DRAG_ITERATE_MAX_TOTAL,
  DRAG_ITERATE_MAX_COLS,
  DRAG_ITERATE_MAX_ROWS,
} from '../lib/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DragIterateGrid {
  rows: number;
  cols: number;
  count: number; // total new iterations = rows * cols - 1
}

/** Raw screen-pixel delta from the drag start point */
export interface DragDelta {
  dx: number;
  dy: number;
}

/** Absolute screen-space cursor position */
export interface CursorScreenPos {
  x: number;
  y: number;
}

interface DragToIterateConfig {
  /** Called when a drag gesture completes — consumer decides the grid from raw delta */
  onDragEnd: (delta: DragDelta, dragStart: CursorScreenPos) => void;
  /** Called when the interaction is a click (not a drag) */
  onClick: (shiftKey: boolean) => void;
  /** When true, all interactions are disabled */
  disabled?: boolean;
  /** Called continuously during drag with the raw screen-space delta */
  onDragUpdate?: (delta: DragDelta | null, dragStart: CursorScreenPos | null) => void;
}

interface DragToIterateResult {
  isDragging: boolean;
  /** Raw screen-pixel delta — only set while dragging */
  dragDelta: DragDelta | null;
  /** Absolute screen-space cursor position — tracks cursor 1:1 while dragging */
  cursorScreen: CursorScreenPos | null;
  /** Screen position where the drag started (the Zap button) */
  dragStartScreen: CursorScreenPos | null;
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
  };
}

// ---------------------------------------------------------------------------
// Helper: clamp a grid so total iterations stay within bounds
// ---------------------------------------------------------------------------

export function clampGrid(rawCols: number, rawRows: number): DragIterateGrid {
  let cols = Math.max(1, Math.min(rawCols, DRAG_ITERATE_MAX_COLS));
  let rows = Math.max(1, Math.min(rawRows, DRAG_ITERATE_MAX_ROWS));

  // Ensure total new iterations (rows * cols - 1) doesn't exceed max
  while (rows * cols - 1 > DRAG_ITERATE_MAX_TOTAL && (rows > 1 || cols > 1)) {
    if (cols >= rows) cols--;
    else rows--;
  }

  const count = Math.max(0, rows * cols - 1);
  return { rows, cols, count };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDragToIterate({
  onDragEnd,
  onClick,
  disabled = false,
  onDragUpdate,
}: DragToIterateConfig): DragToIterateResult {
  const [isDragging, setIsDragging] = useState(false);
  const [dragDelta, setDragDelta] = useState<DragDelta | null>(null);
  const [cursorScreen, setCursorScreen] = useState<CursorScreenPos | null>(null);
  const [dragStartScreen, setDragStartScreen] = useState<CursorScreenPos | null>(null);

  const stateRef = useRef({
    startX: 0,
    startY: 0,
    hasDragged: false,
    shiftKey: false,
  });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      // Only respond to primary button (left click)
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);

      stateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        hasDragged: false,
        shiftKey: e.shiftKey,
      };

      const handlePointerMove = (ev: PointerEvent) => {
        const { startX, startY } = stateRef.current;
        const deltaX = ev.clientX - startX;
        const deltaY = ev.clientY - startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (!stateRef.current.hasDragged && distance > DRAG_ITERATE_THRESHOLD_PX) {
          stateRef.current.hasDragged = true;
          setIsDragging(true);
          setDragStartScreen({ x: startX, y: startY });
          document.body.style.cursor = 'crosshair';
        }

        if (stateRef.current.hasDragged) {
          const delta: DragDelta = { dx: deltaX, dy: deltaY };
          const start: CursorScreenPos = { x: startX, y: startY };
          setDragDelta(delta);
          setCursorScreen({ x: ev.clientX, y: ev.clientY });
          onDragUpdate?.(delta, start);
        }
      };

      const handlePointerUp = (ev: PointerEvent) => {
        el.releasePointerCapture(ev.pointerId);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);

        document.body.style.cursor = '';

        if (stateRef.current.hasDragged) {
          const { startX, startY } = stateRef.current;
          const deltaX = ev.clientX - startX;
          const deltaY = ev.clientY - startY;

          setIsDragging(false);
          setDragDelta(null);
          setCursorScreen(null);
          setDragStartScreen(null);
          onDragUpdate?.(null, null);

          onDragEnd(
            { dx: deltaX, dy: deltaY },
            { x: startX, y: startY },
          );
        } else {
          // It's a click (pointer didn't move past threshold)
          setIsDragging(false);
          setDragDelta(null);
          setCursorScreen(null);
          setDragStartScreen(null);
          onDragUpdate?.(null, null);
          onClick(stateRef.current.shiftKey);
        }
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [disabled, onDragEnd, onClick, onDragUpdate],
  );

  return {
    isDragging,
    dragDelta,
    cursorScreen,
    dragStartScreen,
    handlers: { onPointerDown },
  };
}
