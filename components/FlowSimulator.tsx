'use client';

import { useEffect, useState, useMemo } from 'react';
import { X, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { useFlowMocksStore } from '../lib/flow-mocks-store';
import { findFlowDescriptorById } from '../lib/flows/registry';
import { getIterationComponent } from '../iterations';
import {
  FLOW_PLAY_EVENT,
  FLOW_COMBINE_EVENT,
  type FlowPlayPayload,
} from '../lib/constants';
import { stageRenderers } from './stage-renderers';

interface FlowSimulatorState {
  flowId: string;
  useCanonical: boolean;
  currentStageIndex: number;
}

export function FlowSimulator() {
  const [state, setState] = useState<FlowSimulatorState | null>(null);
  const flows = useFlowMocksStore((s) => s.flows);

  useEffect(() => {
    const handlePlay = (e: Event) => {
      const detail = (e as CustomEvent<FlowPlayPayload>).detail;
      if (!detail?.flowId) return;
      setState({
        flowId: detail.flowId,
        useCanonical: !!detail.useCanonical,
        currentStageIndex: 0,
      });
    };
    const handleCombine = (e: Event) => {
      const detail = (e as CustomEvent<FlowPlayPayload>).detail;
      if (!detail?.flowId) return;
      setState({
        flowId: detail.flowId,
        useCanonical: true,
        currentStageIndex: 0,
      });
    };
    window.addEventListener(FLOW_PLAY_EVENT, handlePlay as EventListener);
    window.addEventListener(FLOW_COMBINE_EVENT, handleCombine as EventListener);
    return () => {
      window.removeEventListener(FLOW_PLAY_EVENT, handlePlay as EventListener);
      window.removeEventListener(FLOW_COMBINE_EVENT, handleCombine as EventListener);
    };
  }, []);

  const flow = state ? flows[state.flowId] : null;
  const descriptor = flow ? findFlowDescriptorById(flow.descriptorId) : null;

  const stages = descriptor?.stages ?? [];
  const currentStage = state && stages[state.currentStageIndex];

  const mergedMock = useMemo(() => {
    if (!flow || !currentStage) return {};
    // Carry forward "submitted" data from previous stages onto the current
    // one. We don't actually track per-step submissions here — the seed
    // mocks for downstream stages already include the values they need
    // (e.g. plan stage's firstName), so we just merge stage mocks 0..n.
    return stages
      .slice(0, (state?.currentStageIndex ?? 0) + 1)
      .reduce<Record<string, unknown>>((acc, s) => {
        return { ...acc, ...(flow.stageMocks[s.id] ?? {}) };
      }, {});
  }, [flow, currentStage, stages, state?.currentStageIndex]);

  if (!state || !descriptor || !flow || !currentStage) return null;

  const isLast = state.currentStageIndex === stages.length - 1;
  const isFirst = state.currentStageIndex === 0;

  const close = () => setState(null);
  const next = () => {
    if (isLast) {
      close();
      return;
    }
    setState((s) => (s ? { ...s, currentStageIndex: s.currentStageIndex + 1 } : null));
  };
  const back = () =>
    setState((s) =>
      s && s.currentStageIndex > 0
        ? { ...s, currentStageIndex: s.currentStageIndex - 1 }
        : s,
    );
  const restart = () => setState((s) => (s ? { ...s, currentStageIndex: 0 } : null));

  const Renderer = stageRenderers[currentStage.componentId];
  const canonicalFilename =
    state.useCanonical && flow.canonicalIterationByStage[currentStage.id];
  const ComponentOverride = canonicalFilename
    ? getIterationComponent(canonicalFilename)
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl max-h-[92vh] m-4 bg-white rounded-3xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col">
        <header className="flex items-center justify-between px-5 py-3 border-b border-stone-100 bg-white/80">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-stone-400">
              {state.useCanonical ? 'Combine preview' : 'Flow simulator'} · {descriptor.label}
            </p>
            <h2 className="text-sm font-semibold text-stone-800">
              Stage {state.currentStageIndex + 1} / {stages.length} · {currentStage.label}
              {canonicalFilename && (
                <span className="ml-2 text-[10px] font-medium text-amber-600">
                  ({canonicalFilename})
                </span>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={restart}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              aria-label="Restart flow"
              title="Restart"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={close}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              aria-label="Close simulator"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex items-center gap-1 px-5 py-2 border-b border-stone-100 bg-stone-50/60">
          {stages.map((s, i) => (
            <div
              key={s.id}
              className={`flex-1 h-1 rounded-full transition-colors ${
                i <= state.currentStageIndex ? 'bg-purple-500' : 'bg-stone-200'
              }`}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto bg-background app-theme">
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

        <footer className="flex items-center justify-between px-5 py-3 border-t border-stone-100 bg-white/80">
          <button
            onClick={back}
            disabled={isFirst}
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <p className="text-[11px] text-stone-400">
            Click the stage&rsquo;s submit button to advance, or use the arrows.
          </p>
          <button
            onClick={next}
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800"
          >
            {isLast ? 'Finish' : 'Next'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </footer>
      </div>
    </div>
  );
}
