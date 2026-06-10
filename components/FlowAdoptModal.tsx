'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, FileCheck2, AlertTriangle } from 'lucide-react';
import { useFlowMocksStore } from '../lib/flow-mocks-store';
import { findFlowDescriptorById } from '../lib/flows/registry';
import { FLOW_ADOPT_EVENT, type FlowAdoptPayload } from '../lib/constants';
import { toast } from 'sonner';

interface StageDiff {
  stageId: string;
  stageLabel: string;
  originalPath: string;
  iterationFilename: string;
  unifiedDiff: string;
}

interface AdoptResponse {
  descriptorId: string;
  perStageDiffs: StageDiff[];
  combinedDiff: string;
  patchPath: string | null;
  errors: string[];
}

export function FlowAdoptModal() {
  const [open, setOpen] = useState(false);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AdoptResponse | null>(null);
  const flows = useFlowMocksStore((s) => s.flows);

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent<FlowAdoptPayload>).detail;
      if (!detail?.flowId) return;
      const flow = useFlowMocksStore.getState().flows[detail.flowId];
      if (!flow) return;

      setOpen(true);
      setActiveFlowId(detail.flowId);
      setResponse(null);
      setLoading(true);

      try {
        const res = await fetch('/playground/api/flow-adopt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            descriptorId: flow.descriptorId,
            canonicalIterationByStage: flow.canonicalIterationByStage,
          }),
        });
        if (!res.ok) throw new Error(`Adopt route returned ${res.status}`);
        const data = (await res.json()) as AdoptResponse;
        setResponse(data);
      } catch (err) {
        toast.error('Adopt failed', {
          description: (err as Error).message,
        });
        setOpen(false);
      } finally {
        setLoading(false);
      }
    };
    window.addEventListener(FLOW_ADOPT_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(FLOW_ADOPT_EVENT, handler as EventListener);
    };
  }, []);

  if (!open) return null;

  const flow = activeFlowId ? flows[activeFlowId] : null;
  const descriptor = flow ? findFlowDescriptorById(flow.descriptorId) : null;
  const close = () => {
    setOpen(false);
    setResponse(null);
    setActiveFlowId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] m-4 bg-white rounded-3xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col">
        <header className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-stone-400">
              Adopt diff · {descriptor?.label}
            </p>
            <h2 className="text-sm font-semibold text-stone-800">
              Generated patch against {descriptor?.sourceRoute}
            </h2>
          </div>
          <button
            onClick={close}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
            aria-label="Close adopt modal"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating diff…
            </div>
          )}

          {!loading && response && response.perStageDiffs.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              No canonical iterations were chosen for any stage — nothing to adopt.
            </div>
          )}

          {!loading && response?.errors && response.errors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
              {response.errors.map((err, i) => (
                <p key={i}>· {err}</p>
              ))}
            </div>
          )}

          {!loading && response?.perStageDiffs.map((stage) => (
            <div key={stage.stageId} className="rounded-2xl border border-stone-200 overflow-hidden">
              <div className="px-4 py-2 bg-stone-50 border-b border-stone-200">
                <p className="text-[10px] uppercase tracking-wider text-stone-400">
                  {stage.stageLabel}
                </p>
                <p className="text-xs font-mono text-stone-700">
                  {stage.originalPath} ← {stage.iterationFilename}
                </p>
              </div>
              <pre className="px-4 py-3 max-h-[280px] overflow-auto text-[11px] font-mono leading-relaxed text-stone-700 whitespace-pre">
                {stage.unifiedDiff || '(no changes)'}
              </pre>
            </div>
          ))}

          {!loading && response?.patchPath && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
              <FileCheck2 className="w-4 h-4 shrink-0" />
              <div>
                Patch saved to <code className="font-mono">{response.patchPath}</code>.
                <br />
                Apply with{' '}
                <code className="font-mono">git apply {response.patchPath}</code> after reviewing.
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-stone-100">
          <button
            onClick={close}
            className="px-3 py-1.5 text-xs rounded-lg text-stone-600 hover:bg-stone-100"
          >
            Close
          </button>
          {response?.patchPath && (
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(response.combinedDiff);
                  toast.success('Diff copied to clipboard');
                } catch {
                  toast.error('Clipboard write failed');
                }
              }}
              className="px-3 py-1.5 text-xs rounded-lg bg-purple-600 text-white hover:bg-purple-700"
            >
              Copy combined diff
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
