// Auto-generated index for iteration components
// This file maps iteration filenames to their components

import { ComponentType } from 'react';
import RedBgHero from './RedBgHero.iteration-1';
import BlueBgHero from './BlueBgHero.iteration-1';
import GreenBgHero from './GreenBgHero.iteration-1';

// Map of filename to component
export const iterationComponents: Record<string, ComponentType<any>> = {
  'RedBgHero.iteration-1.tsx': RedBgHero,
  'BlueBgHero.iteration-1.tsx': BlueBgHero,
  'GreenBgHero.iteration-1.tsx': GreenBgHero,
};

export function getIterationComponent(filename: string): ComponentType<any> | undefined {
  return iterationComponents[filename];
}
