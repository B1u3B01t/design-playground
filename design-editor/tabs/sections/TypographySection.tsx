'use client';

import type { ComputedStyles } from '../../../lib/computed-styles';
import { useDesignEditorStore } from '../../../lib/design-editor-store';
import SectionCollapsible from '../../shared/SectionCollapsible';
import PropertyRow from '../../shared/PropertyRow';
import UnitInput from '../../shared/UnitInput';
import { useCallback } from 'react';

interface SectionProps {
  computedStyles: ComputedStyles;
  nodeId: string;
  cssSelector: string;
  isIframe: boolean;
  isTokenMode: boolean;
}

const FONT_WEIGHT_OPTIONS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
const TEXT_ALIGN_OPTIONS = ['left', 'center', 'right', 'justify'];
const TEXT_DECORATION_OPTIONS = ['none', 'underline', 'overline', 'line-through'];
const TEXT_TRANSFORM_OPTIONS = ['none', 'uppercase', 'lowercase', 'capitalize'];

export default function TypographySection({ computedStyles, nodeId, cssSelector, isIframe }: SectionProps) {
  const addStyleOverride = useDesignEditorStore((s) => s.addStyleOverride);

  const override = useCallback((property: string, value: string) => {
    addStyleOverride({ nodeId, cssSelector, property, value, isIframe });
  }, [nodeId, cssSelector, isIframe, addStyleOverride]);

  return (
    <SectionCollapsible title="Typography">
      <div className="flex flex-col gap-0.5">
        <PropertyRow label="Font">
          <input
            type="text"
            value={computedStyles.fontFamily}
            onChange={(e) => override('fontFamily', e.target.value)}
            className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none truncate"
          />
        </PropertyRow>

        <PropertyRow label="Size">
          <UnitInput value={computedStyles.fontSize} onChange={(v) => override('fontSize', v)} units={['px', 'rem', 'em']} />
        </PropertyRow>

        <PropertyRow label="Weight">
          <select
            value={computedStyles.fontWeight}
            onChange={(e) => override('fontWeight', e.target.value)}
            className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
          >
            {FONT_WEIGHT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </PropertyRow>

        <PropertyRow label="Line H">
          <UnitInput value={computedStyles.lineHeight} onChange={(v) => override('lineHeight', v)} units={['px', 'rem', 'em']} />
        </PropertyRow>

        <PropertyRow label="Spacing">
          <UnitInput value={computedStyles.letterSpacing} onChange={(v) => override('letterSpacing', v)} units={['px', 'rem', 'em']} />
        </PropertyRow>

        <PropertyRow label="Align">
          <div className="flex items-center gap-0.5">
            {TEXT_ALIGN_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => override('textAlign', opt)}
                className={`px-1.5 py-1 text-[10px] rounded-md transition-colors ${
                  computedStyles.textAlign === opt
                    ? 'bg-stone-800 text-white'
                    : 'text-stone-500 hover:bg-stone-100'
                }`}
              >
                {opt[0].toUpperCase()}
              </button>
            ))}
          </div>
        </PropertyRow>

        <PropertyRow label="Decor">
          <select
            value={computedStyles.textDecoration.split(' ')[0] || 'none'}
            onChange={(e) => override('textDecoration', e.target.value)}
            className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
          >
            {TEXT_DECORATION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </PropertyRow>

        <PropertyRow label="Transform">
          <select
            value={computedStyles.textTransform}
            onChange={(e) => override('textTransform', e.target.value)}
            className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
          >
            {TEXT_TRANSFORM_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </PropertyRow>

        <PropertyRow label="Color">
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-md border border-stone-200 shrink-0"
              style={{ backgroundColor: computedStyles.color }}
            />
            <input
              type="text"
              value={computedStyles.color}
              onChange={(e) => override('color', e.target.value)}
              className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
            />
          </div>
        </PropertyRow>
      </div>
    </SectionCollapsible>
  );
}
