/**
 * Prompt generator functions for JSX canvas-component iterations.
 * These work with filenames in canvas-components/ directly.
 */

import { jsxIterationPrompt } from '../prompts/jsx-iteration.prompt';
import { jsxIterationFromIterationPrompt } from '../prompts/jsx-iteration-from-iteration.prompt';
import { formatSkillSection, formatCustomInstructionsSection, formatScreenshotSection } from '../prompts/shared-sections';

export function generateJsxIterationPrompt(
  baseFilename: string,
  iterationCount: number,
  startNumber: number,
  customInstructions?: string,
  skillPrompt?: string,
  screenshotPath?: string,
): string {
  const baseName = baseFilename.replace('.tsx', '');
  const numbers = Array.from({ length: iterationCount }, (_, i) => startNumber + i);
  return jsxIterationPrompt({
    skillSection: skillPrompt ? formatSkillSection(skillPrompt) : '',
    componentName: baseName,
    baseFilename,
    baseName,
    iterationCount: String(iterationCount),
    iterationNumbersList: numbers.join(', '),
    screenshotSection: screenshotPath ? formatScreenshotSection(screenshotPath) : '',
    customInstructionsSection: customInstructions ? formatCustomInstructionsSection(customInstructions) : '',
  });
}

export function generateJsxIterationFromIterationPrompt(
  baseFilename: string,
  sourceFilename: string,
  iterationCount: number,
  startNumber: number,
  customInstructions?: string,
  skillPrompt?: string,
  screenshotPath?: string,
): string {
  const baseName = baseFilename.replace('.tsx', '');
  const numbers = Array.from({ length: iterationCount }, (_, i) => startNumber + i);
  return jsxIterationFromIterationPrompt({
    skillSection: skillPrompt ? formatSkillSection(skillPrompt) : '',
    componentName: baseName,
    baseFilename,
    baseName,
    sourceFilename,
    iterationCount: String(iterationCount),
    iterationNumbersList: numbers.join(', '),
    screenshotSection: screenshotPath ? formatScreenshotSection(screenshotPath) : '',
    customInstructionsSection: customInstructions ? formatCustomInstructionsSection(customInstructions) : '',
  });
}

export function generateJsxAdoptPrompt(baseFilename: string, iterationFilename: string): string {
  return `Copy the contents of src/app/playground/canvas-components/${iterationFilename} to src/app/playground/canvas-components/${baseFilename}.
Keep the 'use client' directive and default export. Do not change any imports or component logic.`;
}
