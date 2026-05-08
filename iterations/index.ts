// Auto-generated index for iteration components
// This file maps iteration filenames to their components

import { ComponentType } from 'react';

// Import all CTA iterations
import CtaIteration1 from './Cta.iteration-1';
import CtaIteration2 from './Cta.iteration-2';
import CtaIteration3 from './Cta.iteration-3';

// Import all CursorChatPanel iterations
import CursorChatPanelIteration1 from './CursorChatPanel.iteration-1';

// Import all CursorChatRedesign iterations
import CursorChatRedesignIteration1 from './CursorChatRedesign.iteration-1';

// Import all FloatingChat iterations
import FloatingChatIteration1 from './FloatingChat.iteration-1';

// Import all FriendlyPromptInput iterations
import FriendlyPromptInputIteration1 from './FriendlyPromptInput.iteration-1';
import FriendlyPromptInputIteration2 from './FriendlyPromptInput.iteration-2';
import FriendlyPromptInputIteration3 from './FriendlyPromptInput.iteration-3';

// Import all PlaygroundChatInput iterations
import PlaygroundChatInputIteration1 from './PlaygroundChatInput.iteration-1';
import PlaygroundChatInputIteration2 from './PlaygroundChatInput.iteration-2';
import PlaygroundChatInputIteration3 from './PlaygroundChatInput.iteration-3';

// Import all ProCta iterations
import ProCtaIteration1 from './ProCta.iteration-1';
import ProCtaIteration2 from './ProCta.iteration-2';
import ProCtaIteration3 from './ProCta.iteration-3';

// Import all TeamPage iterations
import TeamPageIteration2 from './TeamPage.iteration-2';
import TeamPageIteration3 from './TeamPage.iteration-3';
import TeamPageIteration4 from './TeamPage.iteration-4';
import TeamPageIteration5 from './TeamPage.iteration-5';
import TeamPageIteration6 from './TeamPage.iteration-6';

// Map of filename to component
export const iterationComponents: Record<string, ComponentType<any>> = {
  'Cta.iteration-1.tsx': CtaIteration1 as ComponentType<any>,
  'Cta.iteration-2.tsx': CtaIteration2 as ComponentType<any>,
  'Cta.iteration-3.tsx': CtaIteration3 as ComponentType<any>,
  'CursorChatPanel.iteration-1.tsx': CursorChatPanelIteration1 as ComponentType<any>,
  'CursorChatRedesign.iteration-1.tsx': CursorChatRedesignIteration1 as ComponentType<any>,
  'FloatingChat.iteration-1.tsx': FloatingChatIteration1 as ComponentType<any>,
  'FriendlyPromptInput.iteration-1.tsx': FriendlyPromptInputIteration1 as ComponentType<any>,
  'FriendlyPromptInput.iteration-2.tsx': FriendlyPromptInputIteration2 as ComponentType<any>,
  'FriendlyPromptInput.iteration-3.tsx': FriendlyPromptInputIteration3 as ComponentType<any>,
  'PlaygroundChatInput.iteration-1.tsx': PlaygroundChatInputIteration1 as ComponentType<any>,
  'PlaygroundChatInput.iteration-2.tsx': PlaygroundChatInputIteration2 as ComponentType<any>,
  'PlaygroundChatInput.iteration-3.tsx': PlaygroundChatInputIteration3 as ComponentType<any>,
  'ProCta.iteration-1.tsx': ProCtaIteration1 as ComponentType<any>,
  'ProCta.iteration-2.tsx': ProCtaIteration2 as ComponentType<any>,
  'ProCta.iteration-3.tsx': ProCtaIteration3 as ComponentType<any>,
  'TeamPage.iteration-2.tsx': TeamPageIteration2 as ComponentType<any>,
  'TeamPage.iteration-3.tsx': TeamPageIteration3 as ComponentType<any>,
  'TeamPage.iteration-4.tsx': TeamPageIteration4 as ComponentType<any>,
  'TeamPage.iteration-5.tsx': TeamPageIteration5 as ComponentType<any>,
  'TeamPage.iteration-6.tsx': TeamPageIteration6 as ComponentType<any>,
};

export function getIterationComponent(filename: string): ComponentType<any> | undefined {
  return iterationComponents[filename];
}
