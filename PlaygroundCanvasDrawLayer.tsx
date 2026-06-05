'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOnViewportChange, useReactFlow } from '@xyflow/react';
import { type DrawStroke } from './lib/draw-types';
import { DrawStrokePaths } from './nodes/shared/DrawStrokePaths';
import { usePlaygroundDrawStore } from './lib/playground-draw-store';

interface PlaygroundCanvasDrawLayerProps {
  strokes: DrawStroke[];
  /** Ref to the wrapper div that contains the ReactFlow canvas */
  wrapperRef: React.RefObject<HTMLDivElement | null>;
}

const CANVAS_DRAW_EXTENT = 8000;

function strokeBounds(stroke: DrawStroke): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function rectsOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/** Renders canvas-space ink; supports stroke selection + marquee drag-select. */
export default function PlaygroundCanvasDrawLayer({ strokes, wrapperRef }: PlaygroundCanvasDrawLayerProps) {
  const { getViewport, screenToFlowPosition } = useReactFlow();
  const [viewport, setViewport] = useState(getViewport);
  const strokeSelectEnabled = usePlaygroundDrawStore((s) => s.strokeSelectEnabled);
  const strokeSelection = usePlaygroundDrawStore((s) => s.strokeSelection);
  const setStrokeSelection = usePlaygroundDrawStore((s) => s.setStrokeSelection);
  const multiStrokeSelection = usePlaygroundDrawStore((s) => s.multiStrokeSelection);
  const setMultiStrokeSelection = usePlaygroundDrawStore((s) => s.setMultiStrokeSelection);

  // Marquee state — screen coords for the visual overlay
  const [marquee, setMarquee] = useState<{ sx: number; sy: number; ex: number; ey: number } | null>(null);
  /** true once pointerdown passed all pane-background checks */
  const startedRef = useRef(false);
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  useOnViewportChange({ onChange: (vp) => setViewport(vp) });

  const selectedCanvasStrokeId =
    strokeSelection?.scope === 'canvas' ? strokeSelection.strokeId : null;

  const handleSelectStroke = useCallback(
    (strokeId: string) => {
      setStrokeSelection({ scope: 'canvas', strokeId });
    },
    [setStrokeSelection],
  );

  // Marquee drag-select: listen on the wrapper div so we don't block ReactFlow
  useEffect(() => {
    if (!strokeSelectEnabled) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const onDown = (e: PointerEvent) => {
      startedRef.current = false;
      draggingRef.current = false;
      if (e.button !== 0 || strokesRef.current.length === 0) return;
      if (e.target instanceof Element && e.target.closest('[data-canvas-draw-stroke]')) return;
      if (e.target instanceof Element && e.target.closest('[data-pdf-draw-layer]')) return;
      if (e.target instanceof Element && e.target.closest('.react-flow__node')) return;
      if (e.target instanceof Element && e.target.closest('.react-flow__nodesselection')) return;
      const pane = wrapper.querySelector('.react-flow__pane');
      if (!pane?.contains(e.target as globalThis.Node)) return;

      startRef.current = { x: e.clientX, y: e.clientY };
      startedRef.current = true;
    };

    const onMove = (e: PointerEvent) => {
      if (!startedRef.current || !(e.buttons & 1)) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (!draggingRef.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        draggingRef.current = true;
      }
      if (draggingRef.current) {
        setMarquee({ sx: startRef.current.x, sy: startRef.current.y, ex: e.clientX, ey: e.clientY });
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!startedRef.current || !draggingRef.current) {
        startedRef.current = false;
        draggingRef.current = false;
        return;
      }
      startedRef.current = false;
      draggingRef.current = false;

      const a = screenToFlowPosition({ x: startRef.current.x, y: startRef.current.y });
      const b = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const rect = {
        minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y),
        maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y),
      };
      const hits = new Set<string>();
      for (const stroke of strokesRef.current) {
        if (rectsOverlap(rect, strokeBounds(stroke))) hits.add(stroke.id);
      }
      if (hits.size > 0) setMultiStrokeSelection(hits);
      setMarquee(null);
    };

    wrapper.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      wrapper.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [strokeSelectEnabled, wrapperRef, screenToFlowPosition, setMultiStrokeSelection]);

  if (strokes.length === 0) return null;

  const marqueeStyle = marquee ? {
    left: Math.min(marquee.sx, marquee.ex),
    top: Math.min(marquee.sy, marquee.ey),
    width: Math.abs(marquee.ex - marquee.sx),
    height: Math.abs(marquee.ey - marquee.sy),
  } : null;

  return (
    <div className="absolute inset-0 z-[2] pointer-events-none overflow-hidden" aria-hidden>
      <svg
        className="overflow-visible"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
          width: CANVAS_DRAW_EXTENT,
          height: CANVAS_DRAW_EXTENT,
          pointerEvents: 'none',
        }}
      >
        <DrawStrokePaths
          strokes={strokes}
          width={CANVAS_DRAW_EXTENT}
          height={CANVAS_DRAW_EXTENT}
          normalized={false}
          selectedStrokeId={selectedCanvasStrokeId}
          selectedStrokeIds={multiStrokeSelection.size > 0 ? multiStrokeSelection : undefined}
          selectionEnabled={strokeSelectEnabled}
          onSelectStroke={handleSelectStroke}
          canvasStrokePick
        />
      </svg>
      {marqueeStyle && (
        <div
          className="fixed border border-blue-500 bg-blue-500/10 rounded-sm pointer-events-none"
          style={marqueeStyle}
        />
      )}
    </div>
  );
}
