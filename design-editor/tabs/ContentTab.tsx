'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDesignEditorStore } from '../../lib/design-editor-store';
import { ELEMENT_SELECTION_CHANGE_EVENT } from '../../lib/constants';
import type { SelectedElement } from '../../lib/element-context';
import { applyIframeTextOverride, applyIframeAttributeOverride } from '../../lib/style-injector';
import PropertyRow from '../shared/PropertyRow';

export default function ContentTab() {
  const [selectedElements, setSelectedElements] = useState<SelectedElement[]>([]);
  const { addContentOverride } = useDesignEditorStore();

  useEffect(() => {
    const handler = (e: Event) => {
      setSelectedElements((e as CustomEvent).detail?.elements ?? []);
    };
    window.addEventListener(ELEMENT_SELECTION_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ELEMENT_SELECTION_CHANGE_EVENT, handler);
  }, []);

  const activeElement = selectedElements[0] ?? null;

  const handleTextChange = useCallback((value: string) => {
    if (!activeElement) return;

    addContentOverride({
      nodeId: activeElement.nodeId,
      cssSelector: activeElement.context.cssSelector,
      type: 'text',
      value,
      originalValue: activeElement.context.textContent,
      isIframe: !!activeElement.iframeRect,
    });

    // Apply live
    if (activeElement.iframeRect) {
      applyIframeTextOverride(activeElement.nodeId, activeElement.context.cssSelector, value);
    } else if (activeElement.element && document.contains(activeElement.element)) {
      activeElement.element.textContent = value;
    }
  }, [activeElement, addContentOverride]);

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeElement) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const src = activeElement.context.attributes.src || '';

    addContentOverride({
      nodeId: activeElement.nodeId,
      cssSelector: activeElement.context.cssSelector,
      type: 'image',
      value: objectUrl,
      originalValue: src,
      isIframe: !!activeElement.iframeRect,
    });

    // Apply live
    if (activeElement.iframeRect) {
      applyIframeAttributeOverride(activeElement.nodeId, activeElement.context.cssSelector, 'src', objectUrl);
    } else if (activeElement.element && document.contains(activeElement.element)) {
      (activeElement.element as HTMLImageElement).src = objectUrl;
    }
  }, [activeElement, addContentOverride]);

  if (!activeElement) {
    return (
      <div className="flex items-center justify-center h-32 text-[11px] text-stone-400">
        Alt+click an element to edit its content
      </div>
    );
  }

  const hasText = !!activeElement.context.textContent;
  const isImage = activeElement.context.tagName === 'img' || !!activeElement.context.attributes.src;

  return (
    <div className="px-2 py-2 flex flex-col gap-2">
      <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-stone-400 px-1">
        {activeElement.context.displayName}
      </div>

      {hasText && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-stone-500 px-1">Text Content</span>
          <textarea
            value={activeElement.context.textContent}
            onChange={(e) => handleTextChange(e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 text-[13px] bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-2 focus:ring-stone-400/15 outline-none resize-none [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-stone-300 [&::-webkit-scrollbar-thumb]:rounded"
          />
        </div>
      )}

      {isImage && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-stone-500 px-1">Image Source</span>
          <div className="flex flex-col gap-1.5">
            {activeElement.context.attributes.src && (
              <div className="w-full h-16 rounded-lg border border-stone-200 overflow-hidden bg-stone-50">
                <img
                  src={activeElement.context.attributes.src}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <label className="flex items-center justify-center py-2 rounded-xl text-[11px] font-medium text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer">
              Choose Image
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
          </div>
        </div>
      )}

      {!hasText && !isImage && (
        <div className="flex items-center justify-center h-16 text-[11px] text-stone-400">
          No editable content on this element
        </div>
      )}
    </div>
  );
}
