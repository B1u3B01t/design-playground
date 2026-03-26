/**
 * Prompt generator functions for HTML page iterations.
 * These don't depend on the React component registry — they work with folder names directly.
 */

import { htmlIterationPrompt } from '../prompts/html-iteration.prompt';
import { htmlIterationFromIterationPrompt } from '../prompts/html-iteration-from-iteration.prompt';
import { htmlAdoptPrompt } from '../prompts/html-adopt.prompt';
import { formatSkillSection, formatCustomInstructionsSection, formatScreenshotSection } from '../prompts/shared-sections';

export function generateHtmlIterationPrompt(
  pageFolder: string,
  iterationCount: number,
  startNumber: number,
  customInstructions?: string,
  skillPrompt?: string,
  screenshotPath?: string,
): string {
  const numbers = Array.from({ length: iterationCount }, (_, i) => startNumber + i);
  return htmlIterationPrompt({
    skillSection: skillPrompt ? formatSkillSection(skillPrompt) : '',
    pageName: pageFolder,
    pageFolder,
    iterationCount: String(iterationCount),
    iterationNumbersList: numbers.join(', '),
    screenshotSection: screenshotPath ? formatScreenshotSection(screenshotPath) : '',
    customInstructionsSection: customInstructions ? formatCustomInstructionsSection(customInstructions) : '',
  });
}

export function generateHtmlIterationFromIterationPrompt(
  pageFolder: string,
  sourceIterationFolder: string,
  iterationCount: number,
  startNumber: number,
  customInstructions?: string,
  skillPrompt?: string,
  screenshotPath?: string,
): string {
  const numbers = Array.from({ length: iterationCount }, (_, i) => startNumber + i);
  return htmlIterationFromIterationPrompt({
    skillSection: skillPrompt ? formatSkillSection(skillPrompt) : '',
    pageName: pageFolder,
    pageFolder,
    sourceIterationFolder,
    iterationCount: String(iterationCount),
    iterationNumbersList: numbers.join(', '),
    screenshotSection: screenshotPath ? formatScreenshotSection(screenshotPath) : '',
    customInstructionsSection: customInstructions ? formatCustomInstructionsSection(customInstructions) : '',
  });
}

export function generateHtmlAdoptPrompt(pageFolder: string, iterationFolder: string): string {
  return htmlAdoptPrompt(pageFolder, iterationFolder);
}
