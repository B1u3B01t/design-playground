export interface DrawPoint {
  x: number;
  y: number;
}

export type DrawPenKind = 'pen' | 'highlight';

export interface DrawStroke {
  id: string;
  points: DrawPoint[];
  color: string;
  width: number;
  /** 0–1; omitted on legacy strokes defaults to 1 (or highlight preset). */
  opacity?: number;
  kind?: DrawPenKind;
}

export const DEFAULT_DRAW_COLOR = '#1e1e1e';
export const DEFAULT_DRAW_WIDTH = 2.5;

export const DRAW_PEN_PRESETS: Record<
  DrawPenKind,
  { color: string; width: number; opacity: number }
> = {
  pen: { color: DEFAULT_DRAW_COLOR, width: DEFAULT_DRAW_WIDTH, opacity: 1 },
  highlight: { color: '#facc15', width: 20, opacity: 0.42 },
};

export function createNewStroke(kind: DrawPenKind, firstPoint: DrawPoint): DrawStroke {
  const preset = DRAW_PEN_PRESETS[kind];
  return {
    id: createStrokeId(),
    points: [firstPoint],
    color: preset.color,
    width: preset.width,
    opacity: preset.opacity,
    kind,
  };
}

export function getStrokeOpacity(stroke: DrawStroke): number {
  if (stroke.opacity != null) return stroke.opacity;
  if (stroke.kind === 'highlight') return DRAW_PEN_PRESETS.highlight.opacity;
  return 1;
}

export type PdfDrawingsMap = Record<string, DrawStroke[]>;

export function createStrokeId(): string {
  return `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function pointsToSvgPath(
  points: DrawPoint[],
  width: number,
  height: number,
  normalized: boolean,
): string {
  if (points.length === 0) return '';
  const scale = (x: number, y: number) =>
    normalized ? { x: x * width, y: y * height } : { x, y };

  const first = scale(points[0].x, points[0].y);
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i++) {
    const p = scale(points[i].x, points[i].y);
    d += ` L ${p.x} ${p.y}`;
  }
  return d;
}
