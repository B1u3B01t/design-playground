'use client';

import { useCallback, useState } from 'react';
import { useOnViewportChange, useReactFlow } from '@xyflow/react';
import { type DrawStroke } from './lib/draw-types';
import { DrawStrokePaths } from './nodes/shared/DrawStrokePaths';
import { usePlaygroundDrawStore } from './lib/playground-draw-store';

interface PlaygroundCanvasDrawLayerProps {
  strokes: DrawStroke[];
}

const CANVAS_DRAW_EXTENT = 8000;

/** Renders canvas-space ink; supports stroke selection in select mode. */
export default function PlaygroundCanvasDrawLayer({ strokes }: PlaygroundCanvasDrawLayerProps) {
  const { getViewport } = useReactFlow();
  const [viewport, setViewport] = useState(getViewport);
  const strokeSelectEnabled = usePlaygroundDrawStore((s) => s.strokeSelectEnabled);
  const strokeSelection = usePlaygroundDrawStore((s) => s.strokeSelection);
  const setStrokeSelection = usePlaygroundDrawStore((s) => s.setStrokeSelection);

  useOnViewportChange({
    onChange: (vp) => setViewport(vp),
  });

  const selectedCanvasStrokeId =
    strokeSelection?.scope === 'canvas' ? strokeSelection.strokeId : null;

  const handleSelectStroke = useCallback(
    (strokeId: string) => {
      setStrokeSelection({ scope: 'canvas', strokeId });
    },
    [setStrokeSelection],
  );

  if (strokes.length === 0) return null;

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
          selectionEnabled={strokeSelectEnabled}
          onSelectStroke={handleSelectStroke}
          canvasStrokePick
        />
      </svg>
    </div>
  );
}
