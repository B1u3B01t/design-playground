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

const OVERFLOW_OPTIONS = ['visible', 'hidden', 'scroll', 'auto'];

export default function EffectsSection({ computedStyles, nodeId, cssSelector, isIframe }: SectionProps) {
  const addStyleOverride = useDesignEditorStore((s) => s.addStyleOverride);

  const override = useCallback((property: string, value: string) => {
    addStyleOverride({ nodeId, cssSelector, property, value, isIframe });
  }, [nodeId, cssSelector, isIframe, addStyleOverride]);

  const opacityPercent = Math.round(parseFloat(computedStyles.opacity || '1') * 100);

  return (
    <SectionCollapsible title="Effects" defaultOpen={false}>
      <div className="flex flex-col gap-0.5">
        <PropertyRow label="Opacity">
          <div className="flex items-center gap-1.5 flex-1">
            <input
              type="range"
              min="0"
              max="100"
              value={opacityPercent}
              onChange={(e) => override('opacity', String(parseInt(e.target.value) / 100))}
              className="flex-1 h-1 accent-stone-800"
            />
            <span className="text-[10px] text-stone-500 w-[28px] text-right tabular-nums">{opacityPercent}%</span>
          </div>
        </PropertyRow>

        <PropertyRow label="Shadow">
          <input
            type="text"
            value={computedStyles.boxShadow === 'none' ? '' : computedStyles.boxShadow}
            onChange={(e) => override('boxShadow', e.target.value || 'none')}
            placeholder="none"
            className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
          />
        </PropertyRow>

        <PropertyRow label="Overflow">
          <select
            value={computedStyles.overflow}
            onChange={(e) => override('overflow', e.target.value)}
            className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
          >
            {OVERFLOW_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </PropertyRow>

        <PropertyRow label="Z-Index">
          <input
            type="text"
            value={computedStyles.zIndex === 'auto' ? '' : computedStyles.zIndex}
            onChange={(e) => override('zIndex', e.target.value || 'auto')}
            placeholder="auto"
            className="w-[60px] px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none text-right tabular-nums"
          />
        </PropertyRow>

        <PropertyRow label="Transform">
          <input
            type="text"
            value={computedStyles.transform === 'none' ? '' : computedStyles.transform}
            onChange={(e) => override('transform', e.target.value || 'none')}
            placeholder="none"
            className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
          />
        </PropertyRow>
      </div>
    </SectionCollapsible>
  );
}
