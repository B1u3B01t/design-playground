'use client';

import { useMemo } from 'react';
import { useNodes } from '@xyflow/react';
import { useFlowMocksStore } from '../lib/flow-mocks-store';
import { findFlowDescriptorById } from '../lib/flows/registry';
import type { StageNodeData } from '../lib/flows/types';
import { X } from 'lucide-react';

/**
 * Side panel surfaced when a StageNode is selected on the canvas. Lets the
 * user edit the mock data merged into that stage's preview. Supported field
 * types are auto-detected from the current value (string, boolean, number,
 * union via the seed value's type).
 */
export function MockDataPanel() {
  const nodes = useNodes();
  const flows = useFlowMocksStore((s) => s.flows);
  const setStageMock = useFlowMocksStore((s) => s.setStageMock);

  const selectedStageNode = useMemo(
    () => nodes.find((n) => n.type === 'stage' && n.selected) ?? null,
    [nodes],
  );

  if (!selectedStageNode) return null;

  const data = selectedStageNode.data as unknown as StageNodeData;
  const flow = flows[data.flowId];
  if (!flow) return null;
  const descriptor = findFlowDescriptorById(flow.descriptorId);
  if (!descriptor) return null;
  const stage = descriptor.stages.find((s) => s.id === data.stageId);
  const mock = flow.stageMocks[data.stageId] ?? {};

  const handleChange = (key: string, value: unknown) => {
    setStageMock(data.flowId, data.stageId, { [key]: value });
  };

  return (
    <div className="absolute right-4 top-20 z-30 w-72 bg-white rounded-2xl border border-stone-200 shadow-[0_12px_24px_rgba(28,25,23,0.10)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-stone-400">
            Stage mock data
          </p>
          <h3 className="text-sm font-semibold text-stone-800">
            {stage?.label ?? data.stageId}
          </h3>
        </div>
        <X className="w-4 h-4 text-stone-300" />
      </div>
      <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
        {Object.keys(mock).length === 0 && (
          <p className="text-xs text-stone-400">
            No editable mock fields for this stage.
          </p>
        )}
        {Object.entries(mock).map(([key, value]) => (
          <MockField
            key={key}
            fieldKey={key}
            value={value}
            onChange={(v) => handleChange(key, v)}
          />
        ))}
      </div>
    </div>
  );
}

interface MockFieldProps {
  fieldKey: string;
  value: unknown;
  onChange: (next: unknown) => void;
}

function MockField({ fieldKey, value, onChange }: MockFieldProps) {
  const baseInput =
    'mt-1 w-full h-9 rounded-md border border-stone-200 bg-white px-3 text-xs text-stone-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-colors';

  if (typeof value === 'boolean') {
    return (
      <label className="flex items-center justify-between gap-3 text-xs text-stone-600">
        <span className="font-medium text-stone-700">{fieldKey}</span>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
        />
      </label>
    );
  }

  if (typeof value === 'number') {
    return (
      <label className="block text-xs text-stone-600">
        <span className="font-medium text-stone-700">{fieldKey}</span>
        <input
          type="number"
          className={baseInput}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
    );
  }

  // Special-case plan/billing selects so users can flip between known enums.
  if (fieldKey === 'selectedPlan' && typeof value === 'string') {
    return (
      <label className="block text-xs text-stone-600">
        <span className="font-medium text-stone-700">{fieldKey}</span>
        <select
          className={baseInput}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="free">free</option>
          <option value="pro">pro</option>
          <option value="team">team</option>
        </select>
      </label>
    );
  }
  if (fieldKey === 'billingCycle' && typeof value === 'string') {
    return (
      <label className="block text-xs text-stone-600">
        <span className="font-medium text-stone-700">{fieldKey}</span>
        <select
          className={baseInput}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="annual">annual</option>
          <option value="quarterly">quarterly</option>
        </select>
      </label>
    );
  }

  return (
    <label className="block text-xs text-stone-600">
      <span className="font-medium text-stone-700">{fieldKey}</span>
      <input
        type="text"
        className={baseInput}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
