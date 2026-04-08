'use client';

import type { ComputedStyles } from '../../../lib/computed-styles';
import { useDesignEditorStore } from '../../../lib/design-editor-store';
import SectionCollapsible from '../../shared/SectionCollapsible';
import PropertyRow from '../../shared/PropertyRow';
import UnitInput from '../../shared/UnitInput';
import { rgbToHex } from '../../shared/unit-utils';
import { useCallback } from 'react';

interface SectionProps {
  computedStyles: ComputedStyles;
  nodeId: string;
  cssSelector: string;
  isIframe: boolean;
  isTokenMode: boolean;
}

const BORDER_STYLE_OPTIONS = ['none', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge'];

export default function BordersSection({ computedStyles, nodeId, cssSelector, isIframe }: SectionProps) {
  const addStyleOverride = useDesignEditorStore((s) => s.addStyleOverride);

  const override = useCallback((property: string, value: string) => {
    addStyleOverride({ nodeId, cssSelector, property, value, isIframe });
  }, [nodeId, cssSelector, isIframe, addStyleOverride]);

  // Show simplified border controls (all sides at once)
  return (
    <SectionCollapsible title="Borders" defaultOpen={false}>
      <div className="flex flex-col gap-0.5">
        <PropertyRow label="Width">
          <UnitInput value={computedStyles.borderTopWidth} onChange={(v) => {
            override('borderTopWidth', v);
            override('borderRightWidth', v);
            override('borderBottomWidth', v);
            override('borderLeftWidth', v);
          }} units={['px', 'rem']} />
        </PropertyRow>

        <PropertyRow label="Style">
          <select
            value={computedStyles.borderTopStyle}
            onChange={(e) => {
              const v = e.target.value;
              override('borderTopStyle', v);
              override('borderRightStyle', v);
              override('borderBottomStyle', v);
              override('borderLeftStyle', v);
            }}
            className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
          >
            {BORDER_STYLE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </PropertyRow>

        <PropertyRow label="Color">
          <div className="flex items-center gap-1.5 flex-1">
            <input
              type="color"
              value={rgbToHex(computedStyles.borderTopColor)}
              onChange={(e) => {
                const v = e.target.value;
                override('borderTopColor', v);
                override('borderRightColor', v);
                override('borderBottomColor', v);
                override('borderLeftColor', v);
              }}
              className="w-5 h-5 rounded-md border border-stone-200 shrink-0 cursor-pointer p-0 bg-transparent"
            />
            <input
              type="text"
              value={computedStyles.borderTopColor}
              onChange={(e) => {
                const v = e.target.value;
                override('borderTopColor', v);
                override('borderRightColor', v);
                override('borderBottomColor', v);
                override('borderLeftColor', v);
              }}
              className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
            />
          </div>
        </PropertyRow>

        <PropertyRow label="Radius">
          <UnitInput value={computedStyles.borderTopLeftRadius} onChange={(v) => {
            override('borderTopLeftRadius', v);
            override('borderTopRightRadius', v);
            override('borderBottomRightRadius', v);
            override('borderBottomLeftRadius', v);
          }} units={['px', 'rem', '%']} />
        </PropertyRow>
      </div>
    </SectionCollapsible>
  );
}
