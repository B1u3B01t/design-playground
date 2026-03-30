// ---------------------------------------------------------------------------
// Element Context Extraction
// ---------------------------------------------------------------------------
// Extracts rich context from DOM elements for targeted AI iterations.
// Uses React fiber walking to resolve component names without react-grab.
// ---------------------------------------------------------------------------

export interface ElementContext {
  tagName: string;
  displayName: string;
  textContent: string;
  attributes: Record<string, string>;
  cssSelector: string;
  ancestorComponents: string[];
  htmlSource: string;
}

export interface SelectedElement {
  element: HTMLElement;
  context: ElementContext;
  nodeId: string;
  componentName: string;
}

// ---------------------------------------------------------------------------
// React fiber helpers
// ---------------------------------------------------------------------------

function getReactFiber(el: HTMLElement): unknown | null {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  if (!key) return null;
  return (el as unknown as Record<string, unknown>)[key] ?? null;
}

function getReactComponentName(el: HTMLElement): string | null {
  let fiber = getReactFiber(el) as Record<string, unknown> | null;
  while (fiber) {
    const type = fiber.type as ((...args: unknown[]) => unknown) | string | null;
    if (typeof type === 'function' && (type as { name?: string }).name) {
      const name = (type as { name: string }).name;
      // Skip React internals and styled wrappers
      if (!name.startsWith('_') && name[0] === name[0].toUpperCase()) {
        return name;
      }
    }
    fiber = fiber.return as Record<string, unknown> | null;
  }
  return null;
}

function getAncestorComponents(el: HTMLElement, maxDepth = 10): string[] {
  const components: string[] = [];
  let current = el.parentElement;
  let depth = 0;

  while (current && depth < maxDepth) {
    const name = getReactComponentName(current);
    if (name && !components.includes(name)) {
      components.push(name);
    }
    current = current.parentElement;
    depth++;
  }

  return components;
}

// ---------------------------------------------------------------------------
// Attribute extraction
// ---------------------------------------------------------------------------

const MEANINGFUL_ATTRS = ['className', 'id', 'role', 'aria-label', 'href', 'src', 'type', 'placeholder'];

function getMeaningfulAttributes(el: HTMLElement): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of MEANINGFUL_ATTRS) {
    const domAttr = attr === 'className' ? 'class' : attr;
    const value = el.getAttribute(domAttr);
    if (value) attrs[attr === 'class' ? 'className' : attr] = value;
  }
  return attrs;
}

// ---------------------------------------------------------------------------
// CSS selector builder
// ---------------------------------------------------------------------------

function buildCssSelector(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id;
  if (id) return `${tag}#${id}`;

  const classes = Array.from(el.classList).slice(0, 3).join('.');
  return classes ? `${tag}.${classes}` : tag;
}

// ---------------------------------------------------------------------------
// Main extraction
// ---------------------------------------------------------------------------

/**
 * Creates an ElementContext from data received via postMessage from an
 * iframe's selection bridge script (no React fibers available).
 */
export function createHtmlElementContext(data: {
  tagName: string;
  displayName?: string;
  textContent: string;
  attributes: Record<string, string>;
  cssSelector: string;
  ancestorComponents: string[];
  htmlSource: string;
}): ElementContext {
  return {
    tagName: data.tagName,
    displayName: data.displayName || data.tagName,
    textContent: data.textContent,
    attributes: data.attributes,
    cssSelector: data.cssSelector,
    ancestorComponents: data.ancestorComponents,
    htmlSource: data.htmlSource,
  };
}

export function extractElementContext(el: HTMLElement): ElementContext {
  const tagName = el.tagName.toLowerCase();
  const displayName = getReactComponentName(el) || tagName;
  const rawText = (el.innerText || '').trim();
  const textContent = rawText.length > 150 ? rawText.slice(0, 150) + '…' : rawText;
  const attributes = getMeaningfulAttributes(el);
  const cssSelector = buildCssSelector(el);
  const ancestorComponents = getAncestorComponents(el);
  const rawHtml = el.outerHTML;
  const htmlSource = rawHtml.length > 500 ? rawHtml.slice(0, 500) + '…' : rawHtml;

  return {
    tagName,
    displayName,
    textContent,
    attributes,
    cssSelector,
    ancestorComponents,
    htmlSource,
  };
}

