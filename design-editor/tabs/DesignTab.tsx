'use client';

import type { ComputedStyles } from '../../lib/computed-styles';
import LayoutSection from './sections/LayoutSection';
import SpacingSection from './sections/SpacingSection';
import SizeSection from './sections/SizeSection';
import TypographySection from './sections/TypographySection';
import ColorsSection from './sections/ColorsSection';
import BordersSection from './sections/BordersSection';
import EffectsSection from './sections/EffectsSection';

interface DesignTabProps {
  computedStyles: ComputedStyles | null;
  nodeId: string;
  cssSelector: string;
  isIframe: boolean;
  isTokenMode: boolean;
  iframeError?: string | null;
}

export default function DesignTab({ computedStyles, nodeId, cssSelector, isIframe, isTokenMode, iframeError }: DesignTabProps) {
  if (!computedStyles) {
    return (
      <div className="flex items-center justify-center h-32 text-[11px] text-stone-400">
        {iframeError ?? '⌘+click an element to inspect'}
      </div>
    );
  }

  const overrideProps = { computedStyles, nodeId, cssSelector, isIframe, isTokenMode };

  return (
    <div className="flex flex-col">
      <LayoutSection {...overrideProps} />
      <SpacingSection {...overrideProps} />
      <SizeSection {...overrideProps} />
      <TypographySection {...overrideProps} />
      <ColorsSection {...overrideProps} />
      <BordersSection {...overrideProps} />
      <EffectsSection {...overrideProps} />
    </div>
  );
}
