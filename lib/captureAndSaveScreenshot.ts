import { toPng } from 'html-to-image';

/**
 * Capture a screenshot of a React Flow node's component frame and save it.
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
    // Find the node's DOM element
    const nodeEl = document.querySelector(`[data-id="${nodeId}"]`);
    if (!nodeEl) {
      console.warn(`[screenshot] Node element not found for id: ${nodeId}`);
      return null;
    }

    // Find the inner component frame via dedicated data attribute
    const frameEl = nodeEl.querySelector('[data-screenshot-target]') ?? nodeEl;

    if (!(frameEl instanceof HTMLElement)) {
      console.warn(`[screenshot] Frame element is not an HTMLElement`);
      return null;
    }

    // Use a higher pixel ratio for small elements so the AI can read details.
    const rect = frameEl.getBoundingClientRect();
    const minDim = Math.min(rect.width, rect.height);
    const pixelRatio = minDim < 150 ? 4 : minDim < 300 ? 3 : minDim < 700 ? 2 : 1;

    // Wait for all images inside the frame to load
    const images = frameEl.querySelectorAll('img');
    const pendingImages = Array.from(images)
      .filter((img) => !img.complete)
      .map(
        (img) =>
          new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }),
      );
    if (pendingImages.length > 0) {
      await Promise.race([
        Promise.all(pendingImages),
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ]);
    }

    // Wait for fonts to be ready
    await document.fonts.ready;

    // html-to-image clones the DOM and reads cssRules from every stylesheet.
    // Turbopack / cross-origin sheets throw SecurityError on that access.
    // Temporarily patch the getter to return an empty list instead of throwing,
    // so the cloning process doesn't crash. Styles from cross-origin sheets
    // won't be captured, but same-origin and inline styles will be preserved.
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
      // First call is a warm-up — html-to-image often returns a blank image
      // on the first attempt because resources haven't been fully resolved
      // in the cloned DOM. Discard the result and capture again.
      // Use the element's current rendered dimensions so the clone
      // matches what's on screen (the clone loses parent constraints).
      const captureWidth = Math.ceil(rect.width);
      const captureHeight = Math.ceil(rect.height);

      await toPng(frameEl, { pixelRatio: 1, width: captureWidth, height: captureHeight }).catch(() => {});

      dataUrl = await toPng(frameEl, {
        pixelRatio,
        width: captureWidth,
        height: captureHeight,
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
    // Iteration node: "PricingCard.iteration-3.tsx" -> "PricingCard.iteration-3.png"
    return sourceFilename.replace(/\.\w+$/, '.png');
  }
  // Component node: "Pricing Card" -> "PricingCard.png"
  return `${componentName.replace(/\s+/g, '')}.png`;
}
