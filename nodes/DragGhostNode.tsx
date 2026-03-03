'use client';

import { memo } from 'react';
import { DRAG_GHOST_GAP } from '../lib/constants';

interface DragGhostNodeProps {
  data: {
    /** Total grid columns (including the original at 0,0) */
    cols: number;
    /** Total grid rows (including the original at 0,0) */
    rows: number;
    /** Width of a single cell (matches parent node width) */
    cellWidth: number;
    /** Height of a single cell (matches parent node height) */
    cellHeight: number;
    /** Flow-space padding so the border encompasses the original node */
    padX: number;
    padY: number;
  };
}

function DragGhostNode({ data }: DragGhostNodeProps) {
  const { cols, rows, cellWidth, cellHeight, padX, padY } = data;
  const gap = DRAG_GHOST_GAP;

  // Total bounding box size covering all cells in the grid + padding on each side
  const totalWidth = cols * cellWidth + (cols - 1) * gap + padX * 2;
  const totalHeight = rows * cellHeight + (rows - 1) * gap + padY * 2;

  // Build the grid cells — skip (0,0) since that's the original component
  const cells: { row: number; col: number; variantNumber: number }[] = [];
  let variantNumber = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 && c === 0) continue;
      cells.push({ row: r, col: c, variantNumber });
      variantNumber++;
    }
  }

  return (
    <div
      className="rounded-2xl pointer-events-none"
      style={{
        width: totalWidth,
        height: totalHeight,
        borderColor: '#0B99FF',
        background: 'rgba(11, 153, 255, 0.04)',
        position: 'relative',
      }}
    >
      {/* Inner grid lines and labels — offset by padding */}
      {cells.map((cell) => {
        const x = padX + cell.col * (cellWidth + gap);
        const y = padY + cell.row * (cellHeight + gap);

        return (
          <div
            key={`${cell.row}-${cell.col}`}
            className="absolute flex items-center justify-center rounded-xl border border-dashed"
            style={{
              left: x,
              top: y,
              width: cellWidth,
              height: cellHeight,
              borderColor: 'rgba(11, 153, 255, 0.7)',
              background: 'rgba(11, 153, 255, 0.02)',
            }}
          >
            <span
              className="text-2xl font-medium select-none"
              style={{ color: 'rgba(11, 153, 255, 0.45)' }}
            >
              Create variant {cell.variantNumber}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default memo(DragGhostNode);
