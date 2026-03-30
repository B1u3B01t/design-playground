import { useState, useRef, useCallback, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  extractElementContext,
  createHtmlElementContext,
  type SelectedElement,
  type ElementContext,
} from '../lib/element-context';
import { getHoldKey } from '../lib/keybindings';

// Selectors for playground chrome that should be excluded from element selection
const EXCLUDE_SELECTORS = [
  '[data-cursor-chat]',
  '.react-flow__controls',
  '.react-flow__minimap',
  '[data-playground-header]',
  '.react-flow__attribution',
];

export interface UseElementSelectionReturn {
  isAltHeld: boolean;
  hoveredElement: HTMLElement | null;
  hoveredRect: DOMRect | null;
  hoveredInfo: { tagName: string; displayName: string } | null;
  selectedElements: SelectedElement[];
  clearSelection: () => void;
  removeElement: (index: number) => void;
}

// -----------------------------------------------------------------------
// Iframe bridge helpers
// -----------------------------------------------------------------------

/** Find all iframes inside ReactFlow nodes */
function getNodeIframes(): HTMLIFrameElement[] {
  return Array.from(
    document.querySelectorAll<HTMLIFrameElement>('.react-flow__node iframe[sandbox]'),
  );
}

/** Send a message to all node iframes */
function broadcastToIframes(type: string) {
  for (const iframe of getNodeIframes()) {
    try {
      iframe.contentWindow?.postMessage({ type }, '*');
    } catch {
      // cross-origin or detached — ignore
    }
  }
}

/** Resolve which ReactFlow node an iframe belongs to */
function resolveNodeFromIframe(
  iframe: HTMLIFrameElement,
  getNodes: () => Array<{ id: string; data: Record<string, unknown> }>,
) {
  const nodeWrapper = iframe.closest('.react-flow__node') as HTMLElement | null;
  if (!nodeWrapper) return null;
  const nodeId = nodeWrapper.dataset.id;
  if (!nodeId) return null;
  const nodes = getNodes();
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const data = node.data as Record<string, unknown>;
  return {
    nodeId,
    componentName:
      (data.htmlFolder as string) ||
      (data.componentName as string) ||
      (data.name as string) ||
      node.id,
  };
}

/** Convert iframe-relative rect to page-absolute DOMRect */
function iframeRectToPage(
  iframeRect: { top: number; left: number; width: number; height: number },
  iframe: HTMLIFrameElement,
): DOMRect {
  const iframeBounds = iframe.getBoundingClientRect();
  return new DOMRect(
    iframeBounds.left + iframeRect.left,
    iframeBounds.top + iframeRect.top,
    iframeRect.width,
    iframeRect.height,
  );
}

// -----------------------------------------------------------------------
// Main hook
// -----------------------------------------------------------------------

export function useElementSelection(): UseElementSelectionReturn {
  const [isAltHeld, setIsAltHeld] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [hoveredInfo, setHoveredInfo] = useState<{ tagName: string; displayName: string } | null>(null);
  const [selectedElements, setSelectedElements] = useState<SelectedElement[]>([]);

  const altRef = useRef(false);
  const { getNodes } = useReactFlow();

  // -----------------------------------------------------------------------
  // Alt key tracking + iframe bridge enter/exit
  // -----------------------------------------------------------------------

  useEffect(() => {
    const holdKey = getHoldKey('element-select.hold');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === holdKey) {
        altRef.current = true;
        setIsAltHeld(true);
        document.documentElement.classList.add('element-select-mode');
        broadcastToIframes('element-select:enter');
      }
    };

    const reset = () => {
      altRef.current = false;
      setIsAltHeld(false);
      setHoveredElement(null);
      setHoveredRect(null);
      setHoveredInfo(null);
      document.documentElement.classList.remove('element-select-mode');
      broadcastToIframes('element-select:exit');
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === holdKey) reset();
    };

    const handleBlur = () => reset();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.documentElement.classList.remove('element-select-mode');
    };
  }, []);

  // -----------------------------------------------------------------------
  // Resolve ReactFlow node from a DOM element
  // -----------------------------------------------------------------------

  const resolveNode = useCallback(
    (el: HTMLElement) => {
      const nodeWrapper = el.closest('.react-flow__node') as HTMLElement | null;
      if (!nodeWrapper) return null;

      const nodeId = nodeWrapper.dataset.id;
      if (!nodeId) return null;

      const nodes = getNodes();
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return null;

      const data = node.data as Record<string, unknown>;
      return {
        nodeId,
        componentName: (data.componentName as string) || (data.name as string) || node.id,
      };
    },
    [getNodes],
  );

  // -----------------------------------------------------------------------
  // Hover detection (when Alt is held) — React components only
  // -----------------------------------------------------------------------

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!altRef.current) return;

      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!el) {
        setHoveredElement(null);
        setHoveredRect(null);
        setHoveredInfo(null);
        return;
      }

      // Filter out playground chrome
      for (const sel of EXCLUDE_SELECTORS) {
        if (el.closest(sel)) {
          setHoveredElement(null);
          setHoveredRect(null);
          setHoveredInfo(null);
          return;
        }
      }

      // Must be inside a ReactFlow node
      if (!el.closest('.react-flow__node')) {
        setHoveredElement(null);
        setHoveredRect(null);
        setHoveredInfo(null);
        return;
      }

      // If hovering an iframe, the bridge script handles hover detection
      if (el.tagName === 'IFRAME') return;

      setHoveredElement(el);
      setHoveredRect(el.getBoundingClientRect());

      // Lightweight info extraction (cheap)
      const tagName = el.tagName.toLowerCase();
      // Try to get React component name from fiber
      const fiberKey = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
      let displayName = tagName;
      if (fiberKey) {
        let fiber = (el as unknown as Record<string, unknown>)[fiberKey] as Record<string, unknown> | null;
        while (fiber) {
          const type = fiber.type as ((...args: unknown[]) => unknown) | string | null;
          if (typeof type === 'function' && (type as { name?: string }).name) {
            const name = (type as { name: string }).name;
            if (!name.startsWith('_') && name[0] === name[0].toUpperCase()) {
              displayName = name;
              break;
            }
          }
          fiber = fiber.return as Record<string, unknown> | null;
        }
      }
      setHoveredInfo({ tagName, displayName });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // -----------------------------------------------------------------------
  // Click handling (when Alt is held) — React components only
  // -----------------------------------------------------------------------

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;

      // Don't intercept clicks on cursor chat
      if (target.closest('[data-cursor-chat]')) return;

      // If Alt is NOT held, clear selections on any click
      if (!altRef.current) {
        setSelectedElements((prev) => (prev.length > 0 ? [] : prev));
        return;
      }

      // Must be inside a ReactFlow node
      if (!target.closest('.react-flow__node')) return;

      // If clicking on an iframe, the bridge script handles selection
      if (target.tagName === 'IFRAME') return;

      // Block event from reaching ReactFlow
      e.stopPropagation();
      e.preventDefault();

      const nodeInfo = resolveNode(target);
      if (!nodeInfo) return;

      const context = extractElementContext(target);

      const newElement: SelectedElement = {
        element: target,
        context,
        nodeId: nodeInfo.nodeId,
        componentName: nodeInfo.componentName,
      };

      setSelectedElements((prev) => {
        // Check if already selected — toggle off
        const existingIndex = prev.findIndex((s) => s.element === target);
        if (existingIndex !== -1) {
          return prev.filter((_, i) => i !== existingIndex);
        }

        // Shift = multi-select, otherwise replace
        if (e.shiftKey) {
          return [...prev, newElement];
        }
        return [newElement];
      });
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    return () => window.removeEventListener('mousedown', handleMouseDown, true);
  }, [resolveNode]);

  // -----------------------------------------------------------------------
  // Iframe postMessage bridge — hover & click from HTML iframes
  // -----------------------------------------------------------------------

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      const msg = e.data;
      if (!msg || typeof msg.type !== 'string') return;
      if (!msg.type.startsWith('element-select:')) return;

      // Find which iframe sent this message
      const sourceWindow = e.source as Window | null;
      if (!sourceWindow) return;

      const iframes = getNodeIframes();
      const iframe = iframes.find((f) => {
        try { return f.contentWindow === sourceWindow; }
        catch { return false; }
      });
      if (!iframe) return;

      if (msg.type === 'element-select:hover' && msg.data) {
        const pageRect = iframeRectToPage(msg.data.rect, iframe);
        setHoveredElement(iframe);
        setHoveredRect(pageRect);
        setHoveredInfo({
          tagName: msg.data.tagName,
          displayName: msg.data.displayName || msg.data.tagName,
        });
      } else if (msg.type === 'element-select:hover-clear') {
        setHoveredElement(null);
        setHoveredRect(null);
        setHoveredInfo(null);
      } else if (msg.type === 'element-select:click' && msg.data) {
        const nodeInfo = resolveNodeFromIframe(iframe, getNodes as () => Array<{ id: string; data: Record<string, unknown> }>);
        if (!nodeInfo) return;

        const context: ElementContext = createHtmlElementContext(msg.data);

        const newElement: SelectedElement = {
          element: iframe,
          context,
          nodeId: nodeInfo.nodeId,
          componentName: nodeInfo.componentName,
        };

        setSelectedElements((prev) => {
          // For iframe elements, toggle by matching cssSelector + nodeId
          const existingIndex = prev.findIndex(
            (s) => s.nodeId === nodeInfo.nodeId && s.context.cssSelector === context.cssSelector,
          );
          if (existingIndex !== -1) {
            return prev.filter((_, i) => i !== existingIndex);
          }
          // Check if shift is held via a flag we can't directly access from postMessage,
          // so always replace for iframe selections (single select)
          return [newElement];
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [getNodes]);

  // -----------------------------------------------------------------------
  // Stale element cleanup + rect refresh
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (selectedElements.length === 0) return;

    const interval = setInterval(() => {
      setSelectedElements((prev) => {
        const filtered = prev.filter((s) => document.contains(s.element));
        return filtered.length !== prev.length ? filtered : prev;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedElements.length]);

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  const clearSelection = useCallback(() => {
    setSelectedElements([]);
    setHoveredElement(null);
    setHoveredRect(null);
    setHoveredInfo(null);
  }, []);

  const removeElement = useCallback((index: number) => {
    setSelectedElements((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    isAltHeld,
    hoveredElement,
    hoveredRect,
    hoveredInfo,
    selectedElements,
    clearSelection,
    removeElement,
  };
}
