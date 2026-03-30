// Auto-generated index for iteration components
// This file maps iteration filenames to their components

import { ComponentType } from 'react';

// Import all GlossaryPage iterations
import GlossaryPageIteration1 from './GlossaryPage.iteration-1';
import GlossaryPageIteration2 from './GlossaryPage.iteration-2';
import GlossaryPageIteration3 from './GlossaryPage.iteration-3';
import GlossaryPageIteration4 from './GlossaryPage.iteration-4';
import GlossaryPageIteration5 from './GlossaryPage.iteration-5';

// Import all ManifestoPage iterations
import ManifestoPageIteration1 from './ManifestoPage.iteration-1';
import ManifestoPageIteration2 from './ManifestoPage.iteration-2';
import ManifestoPageIteration3 from './ManifestoPage.iteration-3';
import ManifestoPageIteration4 from './ManifestoPage.iteration-4';
import ManifestoPageIteration5 from './ManifestoPage.iteration-5';
import ManifestoPageIteration6 from './ManifestoPage.iteration-6';

// Import all SignupForm iterations
import SignupFormIteration1 from './SignupForm.iteration-1';
import SignupFormIteration2 from './SignupForm.iteration-2';
import SignupFormIteration3 from './SignupForm.iteration-3';

// Map of filename to component
export const iterationComponents: Record<string, ComponentType<any>> = {
  'GlossaryPage.iteration-1.tsx': GlossaryPageIteration1 as ComponentType<any>,
  'GlossaryPage.iteration-2.tsx': GlossaryPageIteration2 as ComponentType<any>,
  'GlossaryPage.iteration-3.tsx': GlossaryPageIteration3 as ComponentType<any>,
  'GlossaryPage.iteration-4.tsx': GlossaryPageIteration4 as ComponentType<any>,
  'GlossaryPage.iteration-5.tsx': GlossaryPageIteration5 as ComponentType<any>,
  'ManifestoPage.iteration-1.tsx': ManifestoPageIteration1 as ComponentType<any>,
  'ManifestoPage.iteration-2.tsx': ManifestoPageIteration2 as ComponentType<any>,
  'ManifestoPage.iteration-3.tsx': ManifestoPageIteration3 as ComponentType<any>,
  'ManifestoPage.iteration-4.tsx': ManifestoPageIteration4 as ComponentType<any>,
  'ManifestoPage.iteration-5.tsx': ManifestoPageIteration5 as ComponentType<any>,
  'ManifestoPage.iteration-6.tsx': ManifestoPageIteration6 as ComponentType<any>,
  'SignupForm.iteration-1.tsx': SignupFormIteration1 as ComponentType<any>,
  'SignupForm.iteration-2.tsx': SignupFormIteration2 as ComponentType<any>,
  'SignupForm.iteration-3.tsx': SignupFormIteration3 as ComponentType<any>,
};

export function getIterationComponent(filename: string): ComponentType<any> | undefined {
  return iterationComponents[filename];
}
