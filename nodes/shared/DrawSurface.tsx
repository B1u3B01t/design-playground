'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createNewStroke, type DrawStroke } from '../../lib/draw-types';
import { usePlaygroundDrawStore } from '../../lib/playground-draw-store';
import { DrawStrokePaths } from './DrawStrokePaths';

interface DrawSurfaceProps {
  strokes: DrawStroke[];
  onStrokesChange: (strokes: DrawStroke[]) => void;
  enabled: boolean;
  width: number;
  height: number;
  /** When true, point x/y are 0–1 relative to width/height */
  normalized?: boolean;
  className?: string;
  selectionEnabled?: boolean;
  selectedStrokeId?: string | null;
  onSelectStroke?: (strokeId: string) => void;
  onClearSelection?: () => void;
}

export function DrawSurface({
  strokes,
  onStrokesChange,
  enabled,
  width,
  height,
  normalized = false,
  className = '',
  selectionEnabled = false,
  selectedStrokeId = null,
  onSelectStroke,
  onClearSelection,
}: DrawSurfaceProps) {
  const drawPenKind = usePlaygroundDrawStore((s) => s.drawPenKind);
  const [activeStroke, setActiveStroke] = useState<DrawStroke | null>(null);
  const strokesRef = useRef(strokes);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  const getPoint = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (normalized && rect.width > 0 && rect.height > 0) {
        return { x: x / rect.width, y: y / rect.height };
      }
      return { x, y };
    },
    [normalized],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!enabled) return;
      e.stopPropagation();
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setActiveStroke(createNewStroke(drawPenKind, getPoint(e)));
    },
    [enabled, getPoint, drawPenKind],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!activeStroke) return;
      e.stopPropagation();
      const pt = getPoint(e);
      setActiveStroke((prev) => {
        if (!prev) return prev;
        const last = prev.points.at(-1);
        if (last) {
          const dx = pt.x - last.x;
          const dy = pt.y - last.y;
          const threshold = normalized ? 0.002 : 2;
          if (dx * dx + dy * dy < threshold * threshold) return prev;
        }
        return { ...prev, points: [...prev.points, pt] };
      });
    },
    [activeStroke, getPoint, normalized],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      e.stopPropagation();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      setActiveStroke((prev) => {
        if (prev && prev.points.length > 1) {
          onStrokesChange([...strokesRef.current, prev]);
        }
        return null;
      });
    },
    [onStrokesChange],
  );

  const handleBackgroundPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!selectionEnabled || e.target !== e.currentTarget) return;
      onClearSelection?.();
    },
    [selectionEnabled, onClearSelection],
  );

  const allStrokes = activeStroke ? [...strokes, activeStroke] : strokes;

  if (width <= 0 || height <= 0) return null;

  return (
    <svg
      data-pdf-draw-layer={normalized ? '' : undefined}
      className={`${className} ${
        enabled ? 'nodrag nowheel nopan cursor-crosshair' : 'pointer-events-none'
      }`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        pointerEvents: enabled ? 'auto' : 'none',
        touchAction: enabled ? 'none' : undefined,
      }}
      onPointerDown={(e) => {
        handleBackgroundPointerDown(e);
        handlePointerDown(e);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <DrawStrokePaths
        strokes={allStrokes}
        width={width}
        height={height}
        normalized={normalized}
        selectedStrokeId={selectedStrokeId}
        selectionEnabled={selectionEnabled}
        onSelectStroke={onSelectStroke}
      />
    </svg>
  );
}
