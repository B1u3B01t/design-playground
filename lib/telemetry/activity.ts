'use client';

// ============================================================================
// Activity tracker — powers the time_summary event (active / passive /
// generation time split + nodes-added counts).
//
// Privacy: only aggregate per-window second counts and node-type counts ever
// leave this module. No input contents, positions, timings of individual
// interactions, or anything else is recorded.
//
// Semantics:
// - "active":     tab visible AND user input within the last 60s
// - "passive":    tab visible, no recent input (active/passive are disjoint)
// - "generation": ≥1 generation in flight — accrues even with the tab hidden
//                 (the agent working in the background is product value, not
//                 user surveillance), so it may overlap active/passive
// ============================================================================

import {
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
} from '../constants';
import { captureClient } from './client';

const WINDOW_MS = 10 * 60 * 1000; // flush every 10 minutes
const IDLE_THRESHOLD_MS = 60 * 1000; // input within 60s counts as active
const TICK_MS = 1_000;

export type CountableNodeType =
  | 'component'
  | 'iteration'
  | 'image'
  | 'pdf'
  | 'text'
  | 'stage';

interface ActivityState {
  started: boolean;
  lastInputAt: number;
  generationsInFlight: number;
  lastGenerationEventAt: number;
  activeSeconds: number;
  passiveSeconds: number;
  generationSeconds: number;
  windowSeconds: number;
  nodesAdded: Record<CountableNodeType, number>;
}

const zeroNodes = (): Record<CountableNodeType, number> => ({
  component: 0,
  iteration: 0,
  image: 0,
  pdf: 0,
  text: 0,
  stage: 0,
});

const activity: ActivityState = {
  started: false,
  lastInputAt: 0,
  generationsInFlight: 0,
  lastGenerationEventAt: 0,
  activeSeconds: 0,
  passiveSeconds: 0,
  generationSeconds: 0,
  windowSeconds: 0,
  nodesAdded: zeroNodes(),
};

/** Count a node added to the canvas (called from canvas-flow add paths). */
export function countNodeAdded(type: CountableNodeType, count: number = 1): void {
  if (!activity.started) return;
  activity.nodesAdded[type] += count;
}

function flushWindow(): void {
  const {
    activeSeconds,
    passiveSeconds,
    generationSeconds,
    windowSeconds,
    nodesAdded,
  } = activity;
  activity.activeSeconds = 0;
  activity.passiveSeconds = 0;
  activity.generationSeconds = 0;
  activity.windowSeconds = 0;
  activity.nodesAdded = zeroNodes();

  const nodesTotal = Object.values(nodesAdded).reduce((a, b) => a + b, 0);
  if (windowSeconds === 0 && generationSeconds === 0 && nodesTotal === 0) return;

  captureClient('time_summary', {
    active_seconds: activeSeconds,
    passive_seconds: passiveSeconds,
    generation_seconds: generationSeconds,
    window_seconds: windowSeconds,
    nodes_added_component: nodesAdded.component,
    nodes_added_iteration: nodesAdded.iteration,
    nodes_added_image: nodesAdded.image,
    nodes_added_pdf: nodesAdded.pdf,
    nodes_added_text: nodesAdded.text,
    nodes_added_stage: nodesAdded.stage,
  });
}

/**
 * Start tracking (idempotent; survives nothing — call once per page load
 * from PlaygroundClient's mount effect, host/single-player sessions only).
 */
export function startActivityTracking(): () => void {
  if (activity.started || typeof window === 'undefined') return () => {};
  if (process.env.NODE_ENV !== 'development') return () => {};
  activity.started = true;

  const onInput = () => {
    activity.lastInputAt = Date.now();
  };
  // Throttle pointermove by piggybacking on lastInputAt freshness.
  let lastMoveStamp = 0;
  const onMove = () => {
    const now = Date.now();
    if (now - lastMoveStamp > 1_000) {
      lastMoveStamp = now;
      activity.lastInputAt = now;
    }
  };
  const onGenerationStart = () => {
    activity.generationsInFlight += 1;
    activity.lastGenerationEventAt = Date.now();
  };
  const onGenerationEnd = () => {
    activity.generationsInFlight = Math.max(0, activity.generationsInFlight - 1);
    activity.lastGenerationEventAt = Date.now();
  };
  const onHide = () => {
    if (document.visibilityState === 'hidden') flushWindow();
  };

  window.addEventListener('pointerdown', onInput, { passive: true });
  window.addEventListener('keydown', onInput, { passive: true });
  window.addEventListener('wheel', onInput, { passive: true });
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener(GENERATION_START_EVENT, onGenerationStart);
  window.addEventListener(GENERATION_COMPLETE_EVENT, onGenerationEnd);
  window.addEventListener(GENERATION_ERROR_EVENT, onGenerationEnd);
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flushWindow);

  const tick = window.setInterval(() => {
    const visible = document.visibilityState === 'visible';
    if (visible) {
      activity.windowSeconds += 1;
      if (Date.now() - activity.lastInputAt <= IDLE_THRESHOLD_MS) {
        activity.activeSeconds += 1;
      } else {
        activity.passiveSeconds += 1;
      }
    }
    // Generation time accrues regardless of visibility (disjoint bucket).
    if (activity.generationsInFlight > 0) {
      // Failsafe: the server watchdog kills generations at 10 min — if no
      // start/end event arrived for 11 min the counter is stuck; reset it.
      if (Date.now() - activity.lastGenerationEventAt > 11 * 60 * 1000) {
        activity.generationsInFlight = 0;
      } else {
        activity.generationSeconds += 1;
      }
    }
  }, TICK_MS);

  const flusher = window.setInterval(flushWindow, WINDOW_MS);

  return () => {
    activity.started = false;
    window.clearInterval(tick);
    window.clearInterval(flusher);
    window.removeEventListener('pointerdown', onInput);
    window.removeEventListener('keydown', onInput);
    window.removeEventListener('wheel', onInput);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener(GENERATION_START_EVENT, onGenerationStart);
    window.removeEventListener(GENERATION_COMPLETE_EVENT, onGenerationEnd);
    window.removeEventListener(GENERATION_ERROR_EVENT, onGenerationEnd);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', flushWindow);
  };
}
