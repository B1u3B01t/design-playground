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

const DISPLAY_OPTIONS = ['block', 'flex', 'grid', 'inline', 'inline-flex', 'inline-block', 'none'];
const POSITION_OPTIONS = ['static', 'relative', 'absolute', 'fixed', 'sticky'];
const FLEX_DIRECTION_OPTIONS = ['row', 'row-reverse', 'column', 'column-reverse'];
const FLEX_WRAP_OPTIONS = ['nowrap', 'wrap', 'wrap-reverse'];
const ALIGN_OPTIONS = ['flex-start', 'center', 'flex-end', 'stretch', 'baseline'];
const JUSTIFY_OPTIONS = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'];

export default function LayoutSection({ computedStyles, nodeId, cssSelector, isIframe }: SectionProps) {
  const addStyleOverride = useDesignEditorStore((s) => s.addStyleOverride);

  const override = useCallback((property: string, value: string) => {
    addStyleOverride({ nodeId, cssSelector, property, value, isIframe });
  }, [nodeId, cssSelector, isIframe, addStyleOverride]);

  const isFlex = computedStyles.display === 'flex' || computedStyles.display === 'inline-flex';
  const isGrid = computedStyles.display === 'grid' || computedStyles.display === 'inline-grid';

  return (
    <SectionCollapsible title="Layout">
      <div className="flex flex-col gap-0.5">
        <PropertyRow label="Display">
          <select
            value={computedStyles.display}
            onChange={(e) => override('display', e.target.value)}
            className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
          >
            {DISPLAY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </PropertyRow>

        {isFlex && (
          <>
            <PropertyRow label="Direction">
              <select
                value={computedStyles.flexDirection}
                onChange={(e) => override('flexDirection', e.target.value)}
                className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
              >
                {FLEX_DIRECTION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </PropertyRow>

            <PropertyRow label="Wrap">
              <select
                value={computedStyles.flexWrap}
                onChange={(e) => override('flexWrap', e.target.value)}
                className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
              >
                {FLEX_WRAP_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </PropertyRow>

            <PropertyRow label="Align">
              <select
                value={computedStyles.alignItems}
                onChange={(e) => override('alignItems', e.target.value)}
                className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
              >
                {ALIGN_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </PropertyRow>

            <PropertyRow label="Justify">
              <select
                value={computedStyles.justifyContent}
                onChange={(e) => override('justifyContent', e.target.value)}
                className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
              >
                {JUSTIFY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </PropertyRow>

            <PropertyRow label="Gap">
              <input
                type="text"
                value={computedStyles.gap}
                onChange={(e) => override('gap', e.target.value)}
                className="w-[80px] px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none text-right"
              />
            </PropertyRow>
          </>
        )}

        {isGrid && (
          <>
            <PropertyRow label="Columns">
              <input
                type="text"
                value={computedStyles.gridTemplateColumns}
                onChange={(e) => override('gridTemplateColumns', e.target.value)}
                className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
                placeholder="e.g. 1fr 1fr"
              />
            </PropertyRow>

            <PropertyRow label="Rows">
              <input
                type="text"
                value={computedStyles.gridTemplateRows}
                onChange={(e) => override('gridTemplateRows', e.target.value)}
                className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
                placeholder="e.g. auto 1fr"
              />
            </PropertyRow>
          </>
        )}

        <PropertyRow label="Position">
          <select
            value={computedStyles.position}
            onChange={(e) => override('position', e.target.value)}
            className="w-full px-1.5 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:border-stone-400 focus:ring-1 focus:ring-stone-400/15 outline-none"
          >
            {POSITION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </PropertyRow>
      </div>
    </SectionCollapsible>
  );
}
