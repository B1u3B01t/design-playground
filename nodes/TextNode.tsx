'use client';

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { cn } from '../lib/utils';

export interface TextNodeData {
  text: string;
  autofocus?: boolean;
}

function TextNodeInner({ id, data, selected }: { id: string; data: TextNodeData; selected?: boolean }) {
  const { setNodes, updateNodeData } = useReactFlow();
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(data.text || '');
  const draftTextRef = useRef(data.text || '');
  const focusFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (data.autofocus) {
      setIsEditing(true);
      updateNodeData(id, { autofocus: false });
    }
  }, [data.autofocus, id, updateNodeData]);

  useLayoutEffect(() => {
    if (!isEditing || !editorRef.current) return;
    const el = editorRef.current;

    const focusAtEnd = () => {
      const currentText = draftTextRef.current;
      if (el.innerText.replace(/\n$/, '') !== currentText) {
        el.textContent = currentText;
      }
      el.focus({ preventScroll: true });
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    };

    focusAtEnd();
    focusFrameRef.current = requestAnimationFrame(focusAtEnd);
    return () => {
      if (focusFrameRef.current !== null) {
        cancelAnimationFrame(focusFrameRef.current);
        focusFrameRef.current = null;
      }
    };
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) {
      const nextText = data.text || '';
      draftTextRef.current = nextText;
      setDraftText(nextText);
    }
  }, [data.text, isEditing]);

  useEffect(() => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id && node.type === 'text'
          ? {
              ...node,
              style: {
                ...node.style,
                width: undefined,
                height: undefined,
                minWidth: undefined,
                minHeight: undefined,
              },
            }
          : node,
      ),
    );
  }, [id, setNodes]);

  const getEditorText = useCallback(() => {
    return editorRef.current?.innerText.replace(/\n$/, '') ?? '';
  }, []);

  const commitText = useCallback(() => {
    const text = editorRef.current ? getEditorText() : draftText;
    draftTextRef.current = text;
    setDraftText(text);
    updateNodeData(id, { text });
  }, [draftText, getEditorText, id, updateNodeData]);

  const stopEditing = useCallback(() => {
    commitText();
    setIsEditing(false);
  }, [commitText]);

  const handleInput = useCallback(() => {
    const text = getEditorText();
    draftTextRef.current = text;
    setDraftText(text);
    updateNodeData(id, { text });
  }, [getEditorText, id, updateNodeData]);

  const text = isEditing ? draftText : data.text || '';
  const showPlaceholder = text.length === 0 && !isEditing;

  return (
    <div
      data-screenshot-target
      className={cn(
        'relative inline-flex max-w-[900px] align-top font-sans',
        selected && 'outline outline-2 outline-[#1e9bff]',
      )}
      style={{
        fontFamily: 'var(--font-geist-sans), Geist, system-ui, sans-serif',
      }}
    >
      {selected && (
        <>
          {['left-0 top-0 -translate-x-1/2 -translate-y-1/2', 'right-0 top-0 translate-x-1/2 -translate-y-1/2', 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2', 'right-0 bottom-0 translate-x-1/2 translate-y-1/2'].map((position) => (
            <span
              key={position}
              className={`pointer-events-none absolute h-3.5 w-3.5 border-2 border-[#1e9bff] bg-white ${position}`}
            />
          ))}
        </>
      )}

      <div
        ref={editorRef}
        className={cn(
          'inline-block min-w-[0.35em] whitespace-pre-wrap break-words bg-transparent px-0.5 py-0 text-[20px] font-normal leading-[1.4] text-black outline-none',
          !selected && !isEditing && 'hover:underline hover:decoration-[#1e9bff] hover:decoration-2 hover:underline-offset-4',
          isEditing ? 'nodrag nopan nowheel cursor-text select-text' : 'cursor-move select-none',
          showPlaceholder && 'text-stone-400',
        )}
        style={{
          fontFamily: 'var(--font-geist-sans), Geist, system-ui, sans-serif',
          WebkitUserSelect: isEditing ? 'text' : 'none',
          userSelect: isEditing ? 'text' : 'none',
        }}
        contentEditable={isEditing}
        suppressContentEditableWarning
        spellCheck={false}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        onInput={handleInput}
        onBlur={stopEditing}
        onPointerDown={(e) => {
          if (isEditing) e.stopPropagation();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') {
            e.preventDefault();
            stopEditing();
          }
        }}
      >
        {!isEditing ? (showPlaceholder ? 'Text' : text) : null}
      </div>
    </div>
  );
}

const TextNode = memo(TextNodeInner);
export default TextNode;
