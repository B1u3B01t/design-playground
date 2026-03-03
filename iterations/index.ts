// Auto-generated index for iteration components
// This file maps iteration filenames to their components

import { ComponentType } from 'react';

import PricingCardIteration1 from './PricingCard.iteration-1';
import PricingCardIteration2 from './PricingCard.iteration-2';
import PricingCardIteration3 from './PricingCard.iteration-3';
import PricingCardIteration4 from './PricingCard.iteration-4';

// Map of filename to component
export const iterationComponents: Record<string, ComponentType<any>> = {
  'PricingCard.iteration-1.tsx': PricingCardIteration1 as ComponentType<any>,
  'PricingCard.iteration-2.tsx': PricingCardIteration2 as ComponentType<any>,
  'PricingCard.iteration-3.tsx': PricingCardIteration3 as ComponentType<any>,
  'PricingCard.iteration-4.tsx': PricingCardIteration4 as ComponentType<any>,
};

export function getIterationComponent(filename: string): ComponentType<any> | undefined {
  return iterationComponents[filename];
}
