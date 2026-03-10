/**
 * DOM element → react-grab-style context extraction.
 * Provides component hierarchy and HTML frame for selected elements.
 */

/**
 * Get element context string for a DOM element, including HTML frame and
 * React component hierarchy (via fiber tree).
 */
export function getElementContext(domElement: HTMLElement): string {
  const htmlFrame = getHtmlFrame(domElement);
  const componentHierarchy = getComponentHierarchy(domElement);

  const parts = ['<selected_element>'];
  parts.push('## HTML Frame:');
  parts.push(htmlFrame);

  if (componentHierarchy) {
    parts.push('');
    parts.push('## Code Location:');
    parts.push(componentHierarchy);
  }

  parts.push('</selected_element>');
  return parts.join('\n');
}

/**
 * Get a truncated outerHTML representation of the element.
 */
function getHtmlFrame(element: HTMLElement): string {
  const html = element.outerHTML;
  // Truncate if too long (keep first 500 chars)
  if (html.length > 500) {
    // Try to close the tag cleanly
    const tagName = element.tagName.toLowerCase();
    return html.slice(0, 500) + `... </${tagName}>`;
  }
  return html;
}

/**
 * Walk up the React fiber tree to get component names + source locations.
 * Returns null if fiber data is unavailable.
 */
function getComponentHierarchy(element: HTMLElement): string | null {
  const fiber = getReactFiber(element);
  if (!fiber) {
    // Fallback: CSS selector path
    return getCssSelectorPath(element);
  }

  const components: string[] = [];
  let current = fiber;

  while (current) {
    if (current.type && typeof current.type === 'function') {
      const name = current.type.displayName || current.type.name;
      if (name && !name.startsWith('_') && name !== 'Fragment') {
        const source = current._debugSource;
        if (source) {
          components.push(`at ${name} in ${source.fileName}:${source.lineNumber}:${source.columnNumber || 0}`);
        } else {
          components.push(`at ${name}`);
        }
      }
    }
    current = current.return;
  }

  if (components.length === 0) {
    return getCssSelectorPath(element);
  }

  return components.join('\n');
}

/**
 * Find React fiber instance on a DOM element.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getReactFiber(element: HTMLElement): any {
  const keys = Object.keys(element);
  const fiberKey = keys.find(
    (key) => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$'),
  );
  if (!fiberKey) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (element as any)[fiberKey];
}

/**
 * Fallback: build a CSS selector path for the element.
 */
function getCssSelectorPath(element: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  let depth = 0;

  while (current && depth < 5) {
    const tag = current.tagName.toLowerCase();
    const id = current.id ? `#${current.id}` : '';
    const classes = current.className && typeof current.className === 'string'
      ? '.' + current.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.')
      : '';
    parts.unshift(`${tag}${id}${classes}`);
    current = current.parentElement;
    depth++;
  }

  return parts.join(' > ');
}

/**
 * Find the closest ReactFlow node container from a DOM element.
 * Returns the node's data-id attribute value, or null.
 */
export function findReactFlowNodeId(element: HTMLElement): string | null {
  let current: HTMLElement | null = element;
  while (current) {
    const nodeId = current.getAttribute('data-id');
    if (nodeId && current.classList.contains('react-flow__node')) {
      return nodeId;
    }
    current = current.parentElement;
  }
  return null;
}
