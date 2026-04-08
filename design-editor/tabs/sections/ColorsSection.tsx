'use client';

import type { ComputedStyles } from '../../../lib/computed-styles';
import { useDesignEditorStore } from '../../../lib/design-editor-store';
import SectionCollapsible from '../../shared/SectionCollapsible';
import PropertyRow from '../../shared/PropertyRow';
import { useCallback } from 'react';

interface SectionProps {
  computedStyles: ComputedStyles;
  nodeId: string;
  cssSelector: string;
  isIframe: boolean;
  isTokenMode: boolean;
}

function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <PropertyRow label={label}>
      <div className="flex items-center gap-1.5 flex-1">
        <input
          type="color"
          value={rgbToHex(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-5 h-5 rounded-md border border-stone-200 shrink-0 cursor-pointer p-0 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
        />
      </div>
    </PropertyRow>
  );
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgb.startsWith('#') ? rgb : '#000000';
  const r = parseInt(match[1]).toString(16).padStart(2, '0');
  const g = parseInt(match[2]).toString(16).padStart(2, '0');
  const b = parseInt(match[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

export default function ColorsSection({ computedStyles, nodeId, cssSelector, isIframe }: SectionProps) {
  const addStyleOverride = useDesignEditorStore((s) => s.addStyleOverride);

  const override = useCallback((property: string, value: string) => {
    addStyleOverride({ nodeId, cssSelector, property, value, isIframe });
  }, [nodeId, cssSelector, isIframe, addStyleOverride]);

  return (
    <SectionCollapsible title="Colors">
      <div className="flex flex-col gap-0.5">
        <ColorInput label="Fill" value={computedStyles.backgroundColor} onChange={(v) => override('backgroundColor', v)} />
        <ColorInput label="Text" value={computedStyles.color} onChange={(v) => override('color', v)} />
      </div>
    </SectionCollapsible>
  );
}
