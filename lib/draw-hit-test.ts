import type { DrawPoint, DrawStroke } from './draw-types';

function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function toPixelPoints(
  points: DrawPoint[],
  width: number,
  height: number,
  normalized: boolean,
): DrawPoint[] {
  if (!normalized) return points;
  return points.map((p) => ({ x: p.x * width, y: p.y * height }));
}

/** Returns the id of the topmost stroke under (x, y), or null. */
export function hitTestStrokes(
  strokes: DrawStroke[],
  x: number,
  y: number,
  width: number,
  height: number,
  normalized: boolean,
  minHitPx = 10,
): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;

  for (let s = strokes.length - 1; s >= 0; s--) {
    const stroke = strokes[s];
    const pts = toPixelPoints(stroke.points, width, height, normalized);
    const threshold = Math.max(minHitPx, stroke.width / 2 + 6);

    if (pts.length === 1) {
      const d = Math.hypot(x - pts[0].x, y - pts[0].y);
      if (d <= threshold && d < bestDist) {
        bestDist = d;
        bestId = stroke.id;
      }
      continue;
    }

    for (let i = 0; i < pts.length - 1; i++) {
      const d = pointToSegmentDistance(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      if (d <= threshold && d < bestDist) {
        bestDist = d;
        bestId = stroke.id;
      }
    }
  }

  return bestId;
}
