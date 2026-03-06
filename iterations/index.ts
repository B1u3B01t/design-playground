// Auto-generated index for iteration components
// This file maps iteration filenames to their components

import { ComponentType } from 'react';

import TeamIteration1 from './Team.iteration-1';
import TeamIteration2 from './Team.iteration-2';
import TeamIteration3 from './Team.iteration-3';
import TeamIteration4 from './Team.iteration-4';

// Map of filename to component
export const iterationComponents: Record<string, ComponentType<any>> = {
  'Team.iteration-1.tsx': TeamIteration1 as ComponentType<any>,
  'Team.iteration-2.tsx': TeamIteration2 as ComponentType<any>,
  'Team.iteration-3.tsx': TeamIteration3 as ComponentType<any>,
  'Team.iteration-4.tsx': TeamIteration4 as ComponentType<any>,
};

export function getIterationComponent(filename: string): ComponentType<any> | undefined {
  return iterationComponents[filename];
}
