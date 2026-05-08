'use client';

import { memo } from 'react';
import { createPortal } from 'react-dom';
import { Zap } from 'lucide-react';

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
  const cornerX = x + w;
  const cornerY = y + h;
  const tooltipSide: 'left' | 'right' =
    typeof window !== 'undefined' && cornerX > window.innerWidth - 220
      ? 'left'
      : 'right';

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
      <div
        style={{
          position: 'absolute',
          left: cornerX,
          top: cornerY,
          width: 32,
          height: 32,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 32,
            height: 32,
            borderRadius: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            background: '#0B99FF',
            boxShadow: '0 12px 30px rgba(11, 153, 255, 0.32)',
          }}
        >
          <Zap size={16} fill="currentColor" strokeWidth={2.5} />
        </div>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            ...(tooltipSide === 'left'
              ? { right: '100%', marginRight: 12 }
              : { left: '100%', marginLeft: 12 }),
            transform: 'translateY(-50%)',
            padding: '8px 12px',
            borderRadius: 9999,
            color: '#0B99FF',
            background: '#fff',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          release to generate
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default memo(DragSelectionOverlay);
