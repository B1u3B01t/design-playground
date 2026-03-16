'use client';

import { useEffect, useState, useCallback } from 'react';
import { useOnViewportChange } from '@xyflow/react';
import type { SelectedElement } from './lib/element-context';

interface ElementHighlightProps {
  isAltHeld: boolean;
  hoveredElement: HTMLElement | null;
  hoveredRect: DOMRect | null;
  hoveredInfo: { tagName: string; displayName: string } | null;
  selectedElements: SelectedElement[];
}

// Re-read bounding rects for selected elements
function useRefreshedRects(elements: SelectedElement[], deps: number) {
  const [rects, setRects] = useState<Map<HTMLElement, DOMRect>>(new Map());

  useEffect(() => {
    const map = new Map<HTMLElement, DOMRect>();
    for (const sel of elements) {
      if (document.contains(sel.element)) {
        map.set(sel.element, sel.element.getBoundingClientRect());
      }
    }
    setRects(map);
  }, [elements, deps]);

  return rects;
}

export default function ElementHighlight({
  isAltHeld,
  hoveredElement,
  hoveredRect,
  hoveredInfo,
  selectedElements,
}: ElementHighlightProps) {
  // Refresh rects on viewport change (zoom/pan)
  const [viewportTick, setViewportTick] = useState(0);

  const onViewportChange = useCallback(() => {
    setViewportTick((t) => t + 1);
  }, []);

  useOnViewportChange({ onEnd: onViewportChange });

  const selectionRects = useRefreshedRects(selectedElements, viewportTick);

  const showHover = isAltHeld && hoveredElement && hoveredRect && hoveredInfo;

  if (!showHover && selectedElements.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      {/* Hover highlight */}
      {showHover && (
        <>
          <div
            style={{
              position: 'fixed',
              top: hoveredRect.top,
              left: hoveredRect.left,
              width: hoveredRect.width,
              height: hoveredRect.height,
              outline: '2px solid rgba(59, 130, 246, 0.5)',
              borderRadius: '2px',
              pointerEvents: 'none',
            }}
          />
          {/* Floating label */}
          <div
            style={{
              position: 'fixed',
              top: hoveredRect.top - 22,
              left: hoveredRect.left,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                background: 'rgba(59, 130, 246, 0.9)',
                color: 'white',
                fontSize: '9px',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'ui-monospace, monospace',
                whiteSpace: 'nowrap',
              }}
            >
              &lt;{hoveredInfo.tagName}&gt;{' '}
              {hoveredInfo.displayName !== hoveredInfo.tagName && hoveredInfo.displayName}
            </span>
          </div>
        </>
      )}

      {/* Selection highlights */}
      {selectedElements.map((sel, i) => {
        const rect = selectionRects.get(sel.element);
        if (!rect) return null;

        return (
          <div key={i}>
            <div
              style={{
                position: 'fixed',
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                outline: '2px solid rgb(59, 130, 246)',
                background: 'rgba(59, 130, 246, 0.05)',
                borderRadius: '2px',
                pointerEvents: 'none',
              }}
            />
            {/* Persistent label */}
            <div
              style={{
                position: 'fixed',
                top: rect.top - 22,
                left: rect.left,
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  background: 'rgb(59, 130, 246)',
                  color: 'white',
                  fontSize: '9px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontFamily: 'ui-monospace, monospace',
                  whiteSpace: 'nowrap',
                }}
              >
                &lt;{sel.context.tagName}&gt; {sel.componentName}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
