// ---------------------------------------------------------------------------
// Style Override Injector
// ---------------------------------------------------------------------------
// Injects <style> tags into node frame containers to apply ephemeral
// CSS overrides from the design editor sidebar.
// ---------------------------------------------------------------------------

import type { StyleOverride } from './design-editor-store';

// ---------------------------------------------------------------------------
// React / JSX node style injection
// ---------------------------------------------------------------------------

/**
 * Applies CSS style overrides for a given node by injecting/updating a <style>
 * tag inside the node's `[data-screenshot-target]` frame container.
 */
export function applyStyleOverrides(nodeId: string, overrides: StyleOverride[]): void {
  const frameEl = document.querySelector(
    `.react-flow__node[data-id="${CSS.escape(nodeId)}"] [data-screenshot-target]`
  );
  if (!frameEl) return;

  const styleId = `design-override-${nodeId}`;
  let styleEl = frameEl.querySelector(`style#${CSS.escape(styleId)}`) as HTMLStyleElement | null;

  if (overrides.length === 0) {
    styleEl?.remove();
    return;
  }

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.setAttribute('data-design-editor', 'true');
    frameEl.prepend(styleEl);
  }

  // Group overrides by selector for efficient CSS rules
  const rulesBySelector = new Map<string, string[]>();
  for (const override of overrides) {
    const declarations = rulesBySelector.get(override.cssSelector) ?? [];
    declarations.push(`${camelToKebab(override.property)}: ${override.value} !important`);
    rulesBySelector.set(override.cssSelector, declarations);
  }

  const rules = Array.from(rulesBySelector.entries())
    .map(([selector, declarations]) => `${selector} { ${declarations.join('; ')}; }`)
    .join('\n');

  styleEl.textContent = rules;
}

/**
 * Removes all design editor style overrides for a given node.
 */
export function clearStyleOverrides(nodeId: string): void {
  const styleEl = document.querySelector(
    `.react-flow__node[data-id="${CSS.escape(nodeId)}"] style[data-design-editor]`
  );
  styleEl?.remove();
}

/**
 * Removes all design editor style overrides across all nodes.
 */
export function clearAllStyleOverrides(): void {
  document.querySelectorAll('style[data-design-editor]').forEach((el) => el.remove());
}

// ---------------------------------------------------------------------------
// Iframe style injection (via postMessage)
// ---------------------------------------------------------------------------

/**
 * Sends style overrides to an HTML iframe node via postMessage.
 */
export function applyIframeStyleOverrides(
  nodeId: string,
  overrides: StyleOverride[]
): void {
  const iframe = getIframeForNode(nodeId);
  if (!iframe?.contentWindow) return;

  if (overrides.length === 0) {
    iframe.contentWindow.postMessage({ type: 'design-editor:remove-style' }, '*');
    return;
  }

  // Build CSS rules string
  const rulesBySelector = new Map<string, string[]>();
  for (const override of overrides) {
    const declarations = rulesBySelector.get(override.cssSelector) ?? [];
    declarations.push(`${camelToKebab(override.property)}: ${override.value} !important`);
    rulesBySelector.set(override.cssSelector, declarations);
  }

  const rules = Array.from(rulesBySelector.entries())
    .map(([selector, declarations]) => `${selector} { ${declarations.join('; ')}; }`)
    .join('\n');

  iframe.contentWindow.postMessage({ type: 'design-editor:inject-style', rules }, '*');
}

/**
 * Sends a text content update to an element inside an iframe.
 */
export function applyIframeTextOverride(
  nodeId: string,
  cssSelector: string,
  text: string
): void {
  const iframe = getIframeForNode(nodeId);
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage({ type: 'design-editor:set-text', cssSelector, text }, '*');
}

/**
 * Sends an attribute update to an element inside an iframe.
 */
export function applyIframeAttributeOverride(
  nodeId: string,
  cssSelector: string,
  attr: string,
  value: string
): void {
  const iframe = getIframeForNode(nodeId);
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage({ type: 'design-editor:set-attribute', cssSelector, attr, value }, '*');
}

/**
 * Requests computed styles for an element inside an iframe.
 * The response arrives via postMessage and must be handled by the caller.
 */
export function requestIframeComputedStyles(
  nodeId: string,
  cssSelector: string
): void {
  const iframe = getIframeForNode(nodeId);
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage({ type: 'design-editor:get-styles', cssSelector }, '*');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getIframeForNode(nodeId: string): HTMLIFrameElement | null {
  return document.querySelector(
    `.react-flow__node[data-id="${CSS.escape(nodeId)}"] iframe`
  );
}

function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}
