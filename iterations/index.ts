// Auto-generated index for iteration components
// This file maps iteration filenames to their components

import { ComponentType } from 'react';

import PricingCardIteration1 from './PricingCard.iteration-1';
import PricingCardIteration2 from './PricingCard.iteration-2';
import PricingCardIteration3 from './PricingCard.iteration-3';
import PricingCardIteration4 from './PricingCard.iteration-4';
import PricingCardIteration5 from './PricingCard.iteration-5';
import PricingCardIteration6 from './PricingCard.iteration-6';
import PricingCardIteration7 from './PricingCard.iteration-7';
import PricingCardIteration8 from './PricingCard.iteration-8';
import PricingCardIteration9 from './PricingCard.iteration-9';
import PricingCardIteration10 from './PricingCard.iteration-10';

// Map of filename to component
// Each iteration component has its own props, but the registry treats them as
// generic components, so we intentionally erase their specific prop types here.
export const iterationComponents: Record<string, ComponentType<Record<string, unknown>>> = {
  'PricingCard.iteration-1.tsx':
    PricingCardIteration1 as unknown as ComponentType<Record<string, unknown>>,
  'PricingCard.iteration-2.tsx':
    PricingCardIteration2 as unknown as ComponentType<Record<string, unknown>>,
  'PricingCard.iteration-3.tsx':
    PricingCardIteration3 as unknown as ComponentType<Record<string, unknown>>,
  'PricingCard.iteration-4.tsx':
    PricingCardIteration4 as unknown as ComponentType<Record<string, unknown>>,
  'PricingCard.iteration-5.tsx':
    PricingCardIteration5 as unknown as ComponentType<Record<string, unknown>>,
  'PricingCard.iteration-6.tsx':
    PricingCardIteration6 as unknown as ComponentType<Record<string, unknown>>,
  'PricingCard.iteration-7.tsx':
    PricingCardIteration7 as unknown as ComponentType<Record<string, unknown>>,
  'PricingCard.iteration-8.tsx':
    PricingCardIteration8 as unknown as ComponentType<Record<string, unknown>>,
  'PricingCard.iteration-9.tsx':
    PricingCardIteration9 as unknown as ComponentType<Record<string, unknown>>,
  'PricingCard.iteration-10.tsx':
    PricingCardIteration10 as unknown as ComponentType<Record<string, unknown>>,
};

export function getIterationComponent(
  filename: string,
): ComponentType<Record<string, unknown>> | undefined {
  return iterationComponents[filename];
}
