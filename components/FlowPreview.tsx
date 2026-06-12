'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Minus,
  X,
} from 'lucide-react';
import { useFlowMocksStore } from '../lib/flow-mocks-store';
import { findFlowDescriptorById } from '../lib/flows/registry';
import { getIterationComponent } from '../iterations';
import { stageRenderers } from './stage-renderers';

interface FlowPreviewProps {
  flowId: string;
  useCanonical?: boolean;
}

export function FlowPreview({ flowId, useCanonical = false }: FlowPreviewProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [barPinned, setBarPinned] = useState(true);
  const [barHovered, setBarHovered] = useState(false);
  const flows = useFlowMocksStore((s) => s.flows);

  const flow = flows[flowId] ?? null;
  const descriptor = flow ? findFlowDescriptorById(flow.descriptorId) : null;
  const stages = descriptor?.stages ?? [];
  const currentStage = stages[currentStageIndex];

  const mergedMock = useMemo(() => {
    if (!flow || !currentStage) return {};
    return stages
      .slice(0, currentStageIndex + 1)
      .reduce<Record<string, unknown>>((acc, s) => {
        return { ...acc, ...(flow.stageMocks[s.id] ?? {}) };
      }, {});
  }, [flow, currentStage, stages, currentStageIndex]);

  const close = useCallback(() => {
    window.close();
  }, []);

  const next = useCallback(() => {
    if (currentStageIndex >= stages.length - 1) {
      close();
      return;
    }
    setCurrentStageIndex((i) => i + 1);
  }, [currentStageIndex, stages.length, close]);

  const back = useCallback(() => {
    setCurrentStageIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const restart = useCallback(() => {
    setCurrentStageIndex(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, next, back]);

  if (!flow || !descriptor || !currentStage) {
    return (
      <div className="playground-iteration-view fixed inset-0 flex items-center justify-center bg-background app-theme p-8 text-sm text-stone-500">
        Flow not found. Expand a flow on the playground canvas first, then try again.
      </div>
    );
  }

  const isLast = currentStageIndex === stages.length - 1;
  const isFirst = currentStageIndex === 0;
  const showBar = barPinned || barHovered;

  const Renderer = stageRenderers[currentStage.componentId];
  const canonicalFilename =
    useCanonical && flow.canonicalIterationByStage[currentStage.id];
  const ComponentOverride = canonicalFilename
    ? getIterationComponent(canonicalFilename)
    : undefined;

  return (
    <div className="playground-iteration-view fixed inset-0 z-50 bg-background app-theme">
      <div className="h-full w-full overflow-y-auto">
        {Renderer ? (
          <Renderer
            key={currentStage.id}
            mock={mergedMock}
            onContinue={next}
            Component={ComponentOverride}
          />
        ) : (
          <div className="p-8 text-sm text-red-500">
            No renderer registered for component <code>{currentStage.componentId}</code>.
          </div>
        )}
      </div>

      {!barPinned && (
        <div
          className="fixed bottom-0 inset-x-0 h-20 z-[60]"
          onMouseEnter={() => setBarHovered(true)}
          onMouseLeave={() => setBarHovered(false)}
          aria-hidden
        />
      )}

      <div
        className={`fixed bottom-6 left-1/2 z-[61] -translate-x-1/2 transition-all duration-300 ease-out ${
          showBar ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'
        }`}
        onMouseEnter={() => setBarHovered(true)}
        onMouseLeave={() => setBarHovered(false)}
      >
        <div className="flex items-center gap-1 rounded-full bg-black px-3 py-2 text-white shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
          <button
            onClick={back}
            disabled={isFirst}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous screen"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={next}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={isLast ? 'Finish flow' : 'Next screen'}
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="mx-2 flex min-w-0 items-center gap-1.5 text-sm">
            <span className="truncate text-white/45">
              {useCanonical ? `${descriptor.label} · Combine` : descriptor.label}
            </span>
            <span className="text-white/30">/</span>
            <span className="truncate font-medium text-white">{currentStage.label}</span>
          </div>

          <span className="mx-1 shrink-0 text-xs tabular-nums text-white/50">
            {currentStageIndex + 1}/{stages.length}
          </span>

          <button
            onClick={restart}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Restart flow"
            title="Restart"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <div className="mx-1 h-5 w-px bg-white/15" />

          <button
            onClick={() => setBarPinned(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Hide controls"
            title="Hide controls"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
