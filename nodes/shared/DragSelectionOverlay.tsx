'use client';

import { memo } from 'react';
import { createPortal } from 'react-dom';

interface DragSelectionOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Screen-pixel X of the drag start (top-left of bounding box) */
  originX: number;
  /** Screen-pixel Y of the drag start (top-left of bounding box) */
  originY: number;
  /** Current cursor screen X */
  cursorX: number;
  /** Current cursor screen Y */
  cursorY: number;
}

/**
 * Free-flowing dotted selection rectangle from the top-left origin to the
 * current cursor position — similar to ReactFlow's selection box.
 * Rendered via portal on document.body so it sits above everything.
 */
function DragSelectionOverlay({
  visible,
  originX,
  originY,
  cursorX,
  cursorY,
}: DragSelectionOverlayProps) {
  if (!visible || typeof document === 'undefined') return null;

  // Compute rect — handle negative drag (left / up) gracefully
  const x = Math.min(originX, cursorX);
  const y = Math.min(originY, cursorY);
  const w = Math.abs(cursorX - originX);
  const h = Math.abs(cursorY - originY);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: w,
          height: h,
          border: '1.5px dashed #0B99FF',
          borderRadius: 8,
          background: 'rgba(11, 153, 255, 0.06)',
          transition: 'none',
        }}
      />
    </div>,
    document.body,
  );
}

export default memo(DragSelectionOverlay);
