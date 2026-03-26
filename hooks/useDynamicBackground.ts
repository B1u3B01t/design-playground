import { useMemo } from 'react';
import { useStore } from '@xyflow/react';
import {
  BACKGROUND_GAP,
  BACKGROUND_DOT_SIZE,
  BACKGROUND_MIN_GAP,
  BACKGROUND_MAX_GAP,
  BACKGROUND_MIN_DOT_SIZE,
  BACKGROUND_MAX_DOT_SIZE,
  BACKGROUND_ZOOM_STEPS,
  CANVAS_MIN_ZOOM,
  CANVAS_MAX_ZOOM,
} from '../lib/constants';

const zoomSelector = (s: { transform: [number, number, number] }) => s.transform[2];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Precompute log range for quantization
const LOG_MIN = Math.log(CANVAS_MIN_ZOOM);
const LOG_MAX = Math.log(CANVAS_MAX_ZOOM);
const LOG_RANGE = LOG_MAX - LOG_MIN;

function quantizeZoom(zoom: number): number {
  const logZoom = Math.log(clamp(zoom, CANVAS_MIN_ZOOM, CANVAS_MAX_ZOOM));
  const t = (logZoom - LOG_MIN) / LOG_RANGE; // 0..1
  const step = Math.round(t * (BACKGROUND_ZOOM_STEPS - 1));
  const snappedT = step / (BACKGROUND_ZOOM_STEPS - 1);
  return Math.exp(LOG_MIN + snappedT * LOG_RANGE);
}

export function useDynamicBackground() {
  const zoom = useStore(zoomSelector);
  const stepZoom = quantizeZoom(zoom);

  return useMemo(() => {
    return {
      size: clamp(BACKGROUND_DOT_SIZE / stepZoom, BACKGROUND_MIN_DOT_SIZE, BACKGROUND_MAX_DOT_SIZE),
      gap: clamp(BACKGROUND_GAP / stepZoom, BACKGROUND_MIN_GAP, BACKGROUND_MAX_GAP),
    };
  }, [stepZoom]);
}
