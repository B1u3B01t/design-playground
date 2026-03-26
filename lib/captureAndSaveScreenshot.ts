import { toPng } from 'html-to-image';

/**
 * Capture a screenshot of a React Flow node's component frame and save it.
 * If an image with the given filename already exists, returns its path without recapturing.
 *
 * @param nodeId - The React Flow node ID (used to find the DOM element via data-id)
 * @param filename - Target filename, e.g. "PricingCard.png" or "PricingCard.iteration-3.png"
 * @returns The relative path to the saved image, or null on failure
 */
export async function captureAndSaveScreenshot(
  nodeId: string,
  filename: string,
): Promise<string | null> {
  try {
    // Always recapture — the node may have been resized since the last capture.

    // Find the node's DOM element
    const nodeEl = document.querySelector(`[data-id="${nodeId}"]`);
    if (!nodeEl) {
      console.warn(`[screenshot] Node element not found for id: ${nodeId}`);
      return null;
    }

    // Find the inner component frame
    const frameEl =
      nodeEl.querySelector('.bg-white.overflow-hidden.rounded-xl') ??
      nodeEl.querySelector('.bg-white.overflow-hidden') ??
      nodeEl;

    if (!(frameEl instanceof HTMLElement)) {
      console.warn(`[screenshot] Frame element is not an HTMLElement`);
      return null;
    }

    // Use a higher pixel ratio for small elements so the AI can read details.
    // Scale up small components (< 300px in either dimension) to ensure
    // the output image is at least ~600px on its shortest side.
    const rect = frameEl.getBoundingClientRect();
    const minDim = Math.min(rect.width, rect.height);
    const pixelRatio = minDim < 150 ? 4 : minDim < 300 ? 3 : minDim < 700 ? 2 : 1;

    // html-to-image clones the DOM and reads cssRules from every stylesheet.
    // Turbopack / cross-origin sheets throw SecurityError on that access.
    // Temporarily patch the getter to return an empty list instead of throwing,
    // so all stylesheets are kept (preserving styles) but the error is silenced.
    const desc = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'cssRules');
    const descRules = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'rules');
    const safeGetter = function (this: CSSStyleSheet) {
      try {
        return desc!.get!.call(this);
      } catch {
        return [] as unknown as CSSRuleList;
      }
    };
    Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', { get: safeGetter, configurable: true });
    Object.defineProperty(CSSStyleSheet.prototype, 'rules', { get: safeGetter, configurable: true });

    let dataUrl: string;
    try {
      dataUrl = await toPng(frameEl, {
        cacheBust: true,
        pixelRatio,
      });
    } finally {
      // Restore original getters
      if (desc) Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', desc);
      if (descRules) Object.defineProperty(CSSStyleSheet.prototype, 'rules', descRules);
    }

    // Save via API
    const saveRes = await fetch('/playground/api/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: dataUrl, filename }),
    });

    if (!saveRes.ok) {
      console.warn(`[screenshot] Failed to save screenshot: ${saveRes.statusText}`);
      return null;
    }

    const saveData = (await saveRes.json()) as { success: boolean; path?: string };
    return saveData.path ?? null;
  } catch (error) {
    console.warn('[screenshot] Capture failed, proceeding without image:', error);
    return null;
  }
}

/**
 * Derive the screenshot filename for a component or iteration node.
 */
export function getScreenshotFilename(
  componentName: string,
  sourceFilename?: string,
): string {
  if (sourceFilename) {
    // Iteration node: "PricingCard.iteration-3.tsx" → "PricingCard.iteration-3.png"
    return sourceFilename.replace(/\.tsx$/, '.png');
  }
  // Component node: "Pricing Card" → "PricingCard.png"
  return `${componentName.replace(/\s+/g, '')}.png`;
}
