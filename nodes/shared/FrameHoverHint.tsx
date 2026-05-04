'use client';

import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface FrameHoverHintProps {
  enabled: boolean;
}

export function useFrameHoverHint(enabled: boolean) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      setPos({ x: e.clientX, y: e.clientY });
    },
    [enabled],
  );

  const onMouseLeave = useCallback(() => setPos(null), []);

  const tooltip =
    enabled && pos && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="pointer-events-none fixed px-2 py-1 rounded bg-stone-900 text-white text-[10px] font-medium whitespace-nowrap shadow-md flex items-center gap-1.5"
            style={{ left: pos.x + 14, top: pos.y + 14, zIndex: 9999 }}
          >
            <span>hold</span>
            <kbd className="px-1 py-px rounded bg-stone-700 text-white text-[9px] font-sans leading-none">⌘</kbd>
            <span>to select an element</span>
            <span className="text-stone-400">·</span>
            <span>double click to interact</span>
          </div>,
          document.body,
        )
      : null;

  return { onMouseMove, onMouseLeave, tooltip };
}
