// Auto-generated index for iteration components
// This file maps iteration filenames to their components

import { ComponentType } from 'react';
import { default as TeamPageIteration1 } from './TeamPage.iteration-1';
import { default as TeamPageIteration2 } from './TeamPage.iteration-2';

// Map of filename to component
export const iterationComponents: Record<string, ComponentType<any>> = {
  'TeamPage.iteration-1.tsx': TeamPageIteration1,
  'TeamPage.iteration-2.tsx': TeamPageIteration2,
};

export function getIterationComponent(filename: string): ComponentType<any> | undefined {
  return iterationComponents[filename];
}
