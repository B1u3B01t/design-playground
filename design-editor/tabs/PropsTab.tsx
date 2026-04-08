'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDesignEditorStore } from '../../lib/design-editor-store';
import type { SelectedNodeContext } from '../../hooks/useNodeSelection';
import { parsePropsInterface, type ParsedProp } from '../props-parser';
import { flatRegistry } from '../../registry';
import PropertyRow from '../shared/PropertyRow';

interface PropsTabProps {
  selectedNodes: SelectedNodeContext[];
}

function getRegistryItem(componentId: string) {
  return flatRegistry[componentId] ?? null;
}

export default function PropsTab({ selectedNodes }: PropsTabProps) {
  const [parsedProps, setParsedProps] = useState<ParsedProp[]>([]);
  const [currentProps, setCurrentProps] = useState<Record<string, unknown>>({});
  const { addPropOverride, propOverrides } = useDesignEditorStore();

  const selectedNode = selectedNodes.find((n) => n.type === 'component' || n.type === 'iteration') ?? null;

  // Parse props interface when selection changes
  useEffect(() => {
    if (!selectedNode) {
      setParsedProps([]);
      setCurrentProps({});
      return;
    }

    const item = getRegistryItem(selectedNode.componentId);
    if (item) {
      setParsedProps(parsePropsInterface(item.propsInterface));
      setCurrentProps(item.props ?? {});
    } else {
      setParsedProps([]);
      setCurrentProps({});
    }
  }, [selectedNode]);

  const handlePropChange = useCallback((propName: string, value: unknown) => {
    if (!selectedNode) return;
    addPropOverride({
      nodeId: selectedNode.nodeId,
      componentId: selectedNode.componentId,
      propName,
      value,
      originalValue: currentProps[propName],
    });
  }, [selectedNode, currentProps, addPropOverride]);

  if (!selectedNode || selectedNode.renderMode === 'html') {
    return (
      <div className="flex items-center justify-center h-32 text-[11px] text-stone-400">
        {selectedNode?.renderMode === 'html' ? 'HTML nodes don\'t have props' : 'Select a component to edit props'}
      </div>
    );
  }

  if (parsedProps.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[11px] text-stone-400">
        No parseable props found
      </div>
    );
  }

  // Get current overrides for this node
  const nodeOverrides = propOverrides.filter((o) => o.nodeId === selectedNode.nodeId);
  const overrideMap = new Map(nodeOverrides.map((o) => [o.propName, o.value]));

  return (
    <div className="px-2 py-2 flex flex-col gap-0.5">
      {parsedProps.map((prop) => {
        const currentValue = overrideMap.get(prop.name) ?? currentProps[prop.name] ?? '';

        switch (prop.type) {
          case 'string':
            return (
              <PropertyRow key={prop.name} label={prop.name}>
                <input
                  type="text"
                  value={String(currentValue)}
                  onChange={(e) => handlePropChange(prop.name, e.target.value)}
                  className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
                />
              </PropertyRow>
            );

          case 'number':
            return (
              <PropertyRow key={prop.name} label={prop.name}>
                <input
                  type="number"
                  value={String(currentValue ?? '')}
                  onChange={(e) => handlePropChange(prop.name, parseFloat(e.target.value))}
                  className="w-[80px] px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none text-right tabular-nums"
                />
              </PropertyRow>
            );

          case 'boolean':
            return (
              <PropertyRow key={prop.name} label={prop.name}>
                <button
                  type="button"
                  onClick={() => handlePropChange(prop.name, !currentValue)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                    currentValue ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {currentValue ? 'true' : 'false'}
                </button>
              </PropertyRow>
            );

          case 'string-union':
            return (
              <PropertyRow key={prop.name} label={prop.name}>
                <select
                  value={String(currentValue)}
                  onChange={(e) => handlePropChange(prop.name, e.target.value)}
                  className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
                >
                  {prop.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </PropertyRow>
            );

          case 'complex':
            return (
              <PropertyRow key={prop.name} label={prop.name}>
                <input
                  type="text"
                  value={typeof currentValue === 'object' ? JSON.stringify(currentValue) : String(currentValue)}
                  onChange={(e) => {
                    try {
                      handlePropChange(prop.name, JSON.parse(e.target.value));
                    } catch {
                      handlePropChange(prop.name, e.target.value);
                    }
                  }}
                  placeholder={prop.rawType}
                  className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
                />
              </PropertyRow>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
