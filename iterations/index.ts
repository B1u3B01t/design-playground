// Auto-generated index for iteration components
// This file maps iteration filenames to their components

import { ComponentType } from 'react';
import ArticleCardIteration1 from './ArticleCard.iteration-1';

export const iterationComponents: Record<string, ComponentType<any>> = {
  'ArticleCard.iteration-1.tsx': ArticleCardIteration1 as ComponentType<any>,
};

export function getIterationComponent(filename: string): ComponentType<any> | undefined {
  return iterationComponents[filename];
}
