'use client';

import type { ComputedStyles } from '../../../lib/computed-styles';
import { useDesignEditorStore } from '../../../lib/design-editor-store';
import SectionCollapsible from '../../shared/SectionCollapsible';
import { useCallback, useState, useEffect } from 'react';
import { parseValue } from '../../shared/unit-utils';

interface SectionProps {
  computedStyles: ComputedStyles;
  nodeId: string;
  cssSelector: string;
  isIframe: boolean;
  isTokenMode: boolean;
}

const POSITION_CLASSES = {
  top: 'top-0.5 left-1/2 -translate-x-1/2',
  right: 'right-0.5 top-1/2 -translate-y-1/2',
  bottom: 'bottom-0.5 left-1/2 -translate-x-1/2',
  left: 'left-0.5 top-1/2 -translate-y-1/2',
} as const;

function SpacingInput({
  value,
  onChange,
  position,
}: {
  value: string;
  onChange: (v: string) => void;
  position: 'top' | 'right' | 'bottom' | 'left';
}) {
  const parsed = parseValue(value);
  const displayFromProp = parsed.number !== null ? String(Math.round(parsed.number)) : '—';

  // Local state — commit on blur/enter, not on every keystroke
  const [localValue, setLocalValue] = useState(displayFromProp);

  // Sync from prop when it changes externally
  useEffect(() => {
    setLocalValue(displayFromProp);
  }, [displayFromProp]);

  const commit = useCallback(() => {
    const num = parseFloat(localValue);
    if (!isNaN(num)) {
      onChange(`${num}px`);
    } else {
      // Reset to prop value on invalid input
      setLocalValue(displayFromProp);
    }
  }, [localValue, onChange, displayFromProp]);

  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={`absolute ${POSITION_CLASSES[position]} w-[28px] text-center text-[10px] text-stone-500 bg-transparent border-none outline-none focus:text-stone-900 focus:bg-white focus:rounded px-0.5 tabular-nums`}
    />
  );
}

export default function SpacingSection({ computedStyles, nodeId, cssSelector, isIframe }: SectionProps) {
  const addStyleOverride = useDesignEditorStore((s) => s.addStyleOverride);

  const override = useCallback((property: string, value: string) => {
    addStyleOverride({ nodeId, cssSelector, property, value, isIframe });
  }, [nodeId, cssSelector, isIframe, addStyleOverride]);

  return (
    <SectionCollapsible title="Spacing">
      <div className="flex items-center justify-center py-2">
        {/* Box model visualizer */}
        <div className="relative w-[220px] h-[140px]">
          {/* Margin box (outer) */}
          <div className="absolute inset-0 bg-stone-50 border border-stone-200 rounded-xl">
            <span className="absolute top-1 left-2 text-[8px] uppercase tracking-wider text-stone-300 font-medium">
              margin
            </span>
            <SpacingInput
              value={computedStyles.marginTop}
              onChange={(v) => override('marginTop', v)}
              position="top"
            />
            <SpacingInput
              value={computedStyles.marginRight}
              onChange={(v) => override('marginRight', v)}
              position="right"
            />
            <SpacingInput
              value={computedStyles.marginBottom}
              onChange={(v) => override('marginBottom', v)}
              position="bottom"
            />
            <SpacingInput
              value={computedStyles.marginLeft}
              onChange={(v) => override('marginLeft', v)}
              position="left"
            />

            {/* Padding box (inner) */}
            <div className="absolute inset-[24px] bg-stone-100 border border-dashed border-stone-300 rounded-lg">
              <span className="absolute top-1 left-2 text-[8px] uppercase tracking-wider text-stone-300 font-medium">
                padding
              </span>
              <SpacingInput
                value={computedStyles.paddingTop}
                onChange={(v) => override('paddingTop', v)}
                position="top"
              />
              <SpacingInput
                value={computedStyles.paddingRight}
                onChange={(v) => override('paddingRight', v)}
                position="right"
              />
              <SpacingInput
                value={computedStyles.paddingBottom}
                onChange={(v) => override('paddingBottom', v)}
                position="bottom"
              />
              <SpacingInput
                value={computedStyles.paddingLeft}
                onChange={(v) => override('paddingLeft', v)}
                position="left"
              />

              {/* Content placeholder */}
              <div className="absolute inset-[18px] bg-white border border-stone-200 rounded flex items-center justify-center">
                <span className="text-[9px] text-stone-300">content</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionCollapsible>
  );
}
