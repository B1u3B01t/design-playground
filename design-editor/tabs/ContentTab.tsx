'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDesignEditorStore } from '../../lib/design-editor-store';
import type { SelectedElement } from '../../lib/element-context';
import { applyIframeTextOverride, applyIframeAttributeOverride } from '../../lib/style-injector';

interface ContentTabProps {
  selectedElements: SelectedElement[];
}

export default function ContentTab({ selectedElements }: ContentTabProps) {
  const { addContentOverride, contentOverrides } = useDesignEditorStore();

  // Local text state — initialized from selection, updated by user input
  const [localText, setLocalText] = useState('');
  // Track the current image preview (overridden or original)
  const [imagePreview, setImagePreview] = useState('');
  const prevObjectUrlRef = useRef<string | null>(null);

  const activeElement = selectedElements[0] ?? null;

  // Sync local text and image preview when selection changes
  useEffect(() => {
    if (!activeElement) {
      setLocalText('');
      setImagePreview('');
      return;
    }

    // Check if there's an existing content override for this element
    const textOverride = contentOverrides.find(
      (o) => o.nodeId === activeElement.nodeId && o.cssSelector === activeElement.context.cssSelector && o.type === 'text'
    );
    const imageOverride = contentOverrides.find(
      (o) => o.nodeId === activeElement.nodeId && o.cssSelector === activeElement.context.cssSelector && o.type === 'image'
    );

    setLocalText(textOverride?.value ?? activeElement.context.textContent ?? '');
    setImagePreview(imageOverride?.value ?? activeElement.context.attributes.src ?? '');
  }, [activeElement, contentOverrides]);

  const handleTextChange = useCallback((value: string) => {
    if (!activeElement) return;

    setLocalText(value);

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

    // Revoke previous object URL to prevent memory leak
    if (prevObjectUrlRef.current) {
      URL.revokeObjectURL(prevObjectUrlRef.current);
    }

    const isIframe = !!activeElement.iframeRect;

    // Use data URL for iframe (blob: URLs are origin-scoped), object URL otherwise
    if (isIframe) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        prevObjectUrlRef.current = null;
        setImagePreview(dataUrl);

        addContentOverride({
          nodeId: activeElement.nodeId,
          cssSelector: activeElement.context.cssSelector,
          type: 'image',
          value: dataUrl,
          originalValue: activeElement.context.attributes.src || '',
          isIframe: true,
        });

        applyIframeAttributeOverride(activeElement.nodeId, activeElement.context.cssSelector, 'src', dataUrl);
      };
      reader.readAsDataURL(file);
    } else {
      const objectUrl = URL.createObjectURL(file);
      prevObjectUrlRef.current = objectUrl;
      setImagePreview(objectUrl);

      addContentOverride({
        nodeId: activeElement.nodeId,
        cssSelector: activeElement.context.cssSelector,
        type: 'image',
        value: objectUrl,
        originalValue: activeElement.context.attributes.src || '',
        isIframe: false,
      });

      if (activeElement.element && document.contains(activeElement.element)) {
        (activeElement.element as HTMLImageElement).src = objectUrl;
      }
    }
  }, [activeElement, addContentOverride]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (prevObjectUrlRef.current) {
        URL.revokeObjectURL(prevObjectUrlRef.current);
      }
    };
  }, []);

  if (!activeElement) {
    return (
      <div className="flex items-center justify-center h-32 text-[11px] text-stone-400">
        ⌘+click an element to edit its content
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
            value={localText}
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
            {imagePreview && (
              <div className="w-full h-16 rounded-lg border border-stone-200 overflow-hidden bg-stone-50">
                <img
                  src={imagePreview}
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
