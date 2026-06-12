'use client';

import { getStrokeOpacity, pointsToSvgPath, type DrawStroke } from '../../lib/draw-types';

const SELECTED_STROKE_COLOR = '#2563eb';

interface DrawStrokePathsProps {
  strokes: DrawStroke[];
  width: number;
  height: number;
  normalized?: boolean;
  selectedStrokeId?: string | null;
  selectedStrokeIds?: Set<string>;
  selectionEnabled?: boolean;
  onSelectStroke?: (strokeId: string) => void;
  /** Marks hit targets for canvas ink (used by pane click handling) */
  canvasStrokePick?: boolean;
}

export function DrawStrokePaths({
  strokes,
  width,
  height,
  normalized = false,
  selectedStrokeId = null,
  selectedStrokeIds,
  selectionEnabled = false,
  onSelectStroke,
  canvasStrokePick = false,
}: DrawStrokePathsProps) {
  return (
    <>
      {strokes.map((stroke) => {
        const d = pointsToSvgPath(stroke.points, width, height, !!normalized);
        const isSelected = stroke.id === selectedStrokeId || (selectedStrokeIds?.has(stroke.id) ?? false);
        const hitWidth = Math.max(stroke.width + 14, 16);
        const strokeOpacity = isSelected ? 1 : getStrokeOpacity(stroke);

        return (
          <g key={stroke.id}>
            {selectionEnabled && (
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={hitWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="cursor-pointer nodrag nowheel nopan"
                {...(canvasStrokePick ? { 'data-canvas-draw-stroke': '' } : {})}
                style={{ pointerEvents: 'stroke' }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (e.button !== 0) return;
                  onSelectStroke?.(stroke.id);
                }}
              />
            )}
            <path
              d={d}
              fill="none"
              stroke={isSelected ? SELECTED_STROKE_COLOR : stroke.color}
              strokeWidth={isSelected ? stroke.width + 1.5 : stroke.width}
              strokeOpacity={strokeOpacity}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pointerEvents: 'none' }}
            />
          </g>
        );
      })}
    </>
  );
}
