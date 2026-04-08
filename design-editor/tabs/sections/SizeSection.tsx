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

export default function SizeSection({ computedStyles, nodeId, cssSelector, isIframe }: SectionProps) {
  const addStyleOverride = useDesignEditorStore((s) => s.addStyleOverride);

  const override = useCallback((property: string, value: string) => {
    addStyleOverride({ nodeId, cssSelector, property, value, isIframe });
  }, [nodeId, cssSelector, isIframe, addStyleOverride]);

  return (
    <SectionCollapsible title="Size">
      <div className="flex flex-col gap-0.5">
        <PropertyRow label="Width">
          <UnitInput value={computedStyles.width} onChange={(v) => override('width', v)} />
        </PropertyRow>
        <PropertyRow label="Height">
          <UnitInput value={computedStyles.height} onChange={(v) => override('height', v)} />
        </PropertyRow>
        <PropertyRow label="Min W">
          <UnitInput value={computedStyles.minWidth} onChange={(v) => override('minWidth', v)} />
        </PropertyRow>
        <PropertyRow label="Min H">
          <UnitInput value={computedStyles.minHeight} onChange={(v) => override('minHeight', v)} />
        </PropertyRow>
        <PropertyRow label="Max W">
          <UnitInput value={computedStyles.maxWidth} onChange={(v) => override('maxWidth', v)} />
        </PropertyRow>
        <PropertyRow label="Max H">
          <UnitInput value={computedStyles.maxHeight} onChange={(v) => override('maxHeight', v)} />
        </PropertyRow>
      </div>
    </SectionCollapsible>
  );
}
