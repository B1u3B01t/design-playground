'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useDesignEditorStore } from '../lib/design-editor-store';
import { extractComputedStyles, type ComputedStyles } from '../lib/computed-styles';
import { requestIframeComputedStyles, applyIframeStyleOverrides } from '../lib/style-injector';
import {
  ELEMENT_SELECTION_CHANGE_EVENT,
  NODE_SELECTION_CHANGE_EVENT,
} from '../lib/constants';
import type { SelectedElement } from '../lib/element-context';
import type { SelectedNodeContext } from '../hooks/useNodeSelection';
import DesignEditorHeader from './DesignEditorHeader';
import DesignTab from './tabs/DesignTab';
import PropsTab from './tabs/PropsTab';
import ContentTab from './tabs/ContentTab';
import CommitPanel from './CommitPanel';

export default function DesignEditorSidebar() {
  const { isOpen, activeTab, setComputedStyles, computedStyles, styleOverrides, tokenMode, setTokenMode } = useDesignEditorStore();

  // Local selection state received from canvas events
  const [selectedElements, setSelectedElements] = useState<SelectedElement[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<SelectedNodeContext[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track which iframe style requests are pending (to detect timeouts)
  const [iframeError, setIframeError] = useState<string | null>(null);

  // Listen for selection change events from PlaygroundCanvas
  useEffect(() => {
    const handleElementChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSelectedElements(detail?.elements ?? []);
    };
    const handleNodeChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSelectedNodes(detail?.nodes ?? []);
    };

    window.addEventListener(ELEMENT_SELECTION_CHANGE_EVENT, handleElementChange);
    window.addEventListener(NODE_SELECTION_CHANGE_EVENT, handleNodeChange);
    return () => {
      window.removeEventListener(ELEMENT_SELECTION_CHANGE_EVENT, handleElementChange);
      window.removeEventListener(NODE_SELECTION_CHANGE_EVENT, handleNodeChange);
    };
  }, []);

  // Extract computed styles when selection changes (debounced)
  useEffect(() => {
    if (!isOpen) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      setIframeError(null);
      if (iframeTimeoutRef.current) clearTimeout(iframeTimeoutRef.current);

      let pendingIframeRequest = false;

      // For element selections, extract computed styles
      for (const sel of selectedElements) {
        if (sel.iframeRect) {
          // Iframe element — request styles via postMessage
          requestIframeComputedStyles(sel.nodeId, sel.context.cssSelector);
          pendingIframeRequest = true;
        } else if (sel.element && document.contains(sel.element)) {
          const styles = extractComputedStyles(sel.element);
          const key = `${sel.nodeId}:${sel.context.cssSelector}`;
          setComputedStyles(key, styles);
        }
      }

      // For node selections without element selections, try to get the root element
      if (selectedElements.length === 0 && selectedNodes.length > 0) {
        for (const node of selectedNodes) {
          if (node.renderMode === 'html') {
            // HTML iframe node — request styles for body via postMessage
            requestIframeComputedStyles(node.nodeId, 'body');
            pendingIframeRequest = true;
          } else {
            const frameEl = document.querySelector(
              `.react-flow__node[data-id="${CSS.escape(node.nodeId)}"] [data-screenshot-target]`
            );
            if (frameEl) {
              const rootEl = frameEl.querySelector(':scope > *:not(style)') as HTMLElement | null;
              if (rootEl) {
                const styles = extractComputedStyles(rootEl);
                const key = `${node.nodeId}:root`;
                setComputedStyles(key, styles);
              }
            }
          }
        }
      }

      // Set a 2s timeout for iframe responses — cleared when response arrives
      if (pendingIframeRequest) {
        iframeTimeoutRef.current = setTimeout(() => {
          setIframeError('Could not read styles from this frame');
        }, 2000);
      }
    }, 100);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (iframeTimeoutRef.current) clearTimeout(iframeTimeoutRef.current);
    };
  }, [isOpen, selectedElements, selectedNodes, setComputedStyles]);

  // Listen for iframe computed style responses and ready signals
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data?.type) return;

      if (e.data.type === 'design-editor:styles' && e.data.cssSelector && e.data.styles) {
        // Clear timeout and error — we got a response
        if (iframeTimeoutRef.current) {
          clearTimeout(iframeTimeoutRef.current);
          iframeTimeoutRef.current = null;
        }
        setIframeError(null);

        // Find the node that owns this iframe
        const iframes = document.querySelectorAll('.react-flow__node iframe');
        for (const iframe of iframes) {
          if ((iframe as HTMLIFrameElement).contentWindow === e.source) {
            const nodeEl = iframe.closest('.react-flow__node');
            const nodeId = nodeEl?.getAttribute('data-id') ?? '';
            if (nodeId) {
              const key = `${nodeId}:${e.data.cssSelector}`;
              setComputedStyles(key, e.data.styles);
            }
            break;
          }
        }
      } else if (e.data.type === 'design-editor:ready') {
        // Iframe bridge just loaded — re-inject any pending overrides for this node
        const iframes = document.querySelectorAll('.react-flow__node iframe');
        for (const iframe of iframes) {
          if ((iframe as HTMLIFrameElement).contentWindow === e.source) {
            const nodeEl = iframe.closest('.react-flow__node');
            const nodeId = nodeEl?.getAttribute('data-id') ?? '';
            if (nodeId) {
              const nodeOverrides = styleOverrides.filter((o) => o.nodeId === nodeId);
              if (nodeOverrides.length > 0) {
                applyIframeStyleOverrides(nodeId, nodeOverrides);
              }
            }
            break;
          }
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [setComputedStyles, styleOverrides]);

  // Determine what to show
  const activeElement = selectedElements[0] ?? null;
  const activeNode = selectedNodes[0] ?? null;

  const activeNodeId = activeElement?.nodeId ?? activeNode?.nodeId ?? '';

  // For HTML iframe nodes, the bridge resolves 'body' to the first meaningful child element
  // and returns the actual selector. Find whatever key the store has for this node.
  let activeCssSelector = activeElement?.context.cssSelector ?? '';
  if (!activeCssSelector && activeNode?.renderMode === 'html' && activeNodeId) {
    const prefix = `${activeNodeId}:`;
    for (const key of computedStyles.keys()) {
      if (key.startsWith(prefix)) {
        activeCssSelector = key.slice(prefix.length);
        break;
      }
    }
    // Fallback: still request 'body' if nothing stored yet (will be resolved by bridge)
    if (!activeCssSelector) activeCssSelector = 'body';
  }

  const activeKey = activeNodeId ? `${activeNodeId}:${activeCssSelector || 'root'}` : '';
  const activeStyles: ComputedStyles | null = activeKey ? (computedStyles.get(activeKey) ?? null) : null;

  // Merge style overrides on top of computed styles so inputs reflect current values
  const effectiveStyles = useMemo<ComputedStyles | null>(() => {
    if (!activeStyles) return null;
    const merged = { ...activeStyles };
    const sel = activeCssSelector || 'root';
    for (const o of styleOverrides) {
      if (o.nodeId === activeNodeId && o.cssSelector === sel) {
        (merged as unknown as Record<string, string>)[o.property] = o.value;
      }
    }
    return merged;
  }, [activeStyles, styleOverrides, activeNodeId, activeCssSelector]);

  const isIframe = activeNode?.renderMode === 'html';
  const isReact = !activeNode?.renderMode || activeNode.renderMode === 'react';
  const currentTokenMode = tokenMode.get(activeNodeId) ?? isReact;

  const handleTokenModeChange = useCallback((mode: boolean) => {
    if (activeNodeId) setTokenMode(activeNodeId, mode);
  }, [activeNodeId, setTokenMode]);

  // Build label
  const selectedLabel = activeElement
    ? `${activeElement.context.displayName}`
    : activeNode
      ? activeNode.componentName
      : undefined;

  return (
    <div
      data-design-editor-sidebar
      className={`w-[280px] h-full bg-white rounded-2xl border border-border flex flex-col overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-[250ms] ease-in-out ${
        isOpen ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-3 pointer-events-none'
      }`}
    >
      <DesignEditorHeader
        selectedLabel={selectedLabel}
        showTokenToggle={activeNodeId !== ''}
        tokenMode={currentTokenMode}
        onTokenModeChange={handleTokenModeChange}
      />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 [&::-webkit-scrollbar-thumb]:rounded">
        {activeTab === 'design' && (
          <DesignTab
            computedStyles={effectiveStyles}
            nodeId={activeNodeId}
            cssSelector={activeCssSelector || 'root'}
            isIframe={isIframe}
            isTokenMode={currentTokenMode}
            iframeError={iframeError}
          />
        )}
        {activeTab === 'props' && <PropsTab selectedNodes={selectedNodes} />}
        {activeTab === 'content' && <ContentTab selectedElements={selectedElements} />}
      </div>

      {/* Commit panel at the bottom */}
      <CommitPanel />
    </div>
  );
}
