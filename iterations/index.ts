// Auto-generated index for iteration components
// This file maps iteration filenames to their components

import { ComponentType } from 'react';

// Import all KeyboardShortcutsModal iterations
import KeyboardShortcutsModalIteration1 from './KeyboardShortcutsModal.iteration-1';
import KeyboardShortcutsModalIteration2 from './KeyboardShortcutsModal.iteration-2';
import KeyboardShortcutsModalIteration4 from './KeyboardShortcutsModal.iteration-4';

// Import all Team iterations
import TeamIteration1 from './Team.iteration-1';
import TeamIteration2 from './Team.iteration-2';
import TeamIteration3 from './Team.iteration-3';

// Map of filename to component
export const iterationComponents: Record<string, ComponentType<any>> = {
  'KeyboardShortcutsModal.iteration-1.tsx': KeyboardShortcutsModalIteration1 as ComponentType<any>,
  'KeyboardShortcutsModal.iteration-2.tsx': KeyboardShortcutsModalIteration2 as ComponentType<any>,
  'KeyboardShortcutsModal.iteration-4.tsx': KeyboardShortcutsModalIteration4 as ComponentType<any>,
  'Team.iteration-1.tsx': TeamIteration1 as ComponentType<any>,
  'Team.iteration-2.tsx': TeamIteration2 as ComponentType<any>,
  'Team.iteration-3.tsx': TeamIteration3 as ComponentType<any>,
};

export function getIterationComponent(filename: string): ComponentType<any> | undefined {
  return iterationComponents[filename];
}
