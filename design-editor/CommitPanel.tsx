'use client';

import { useCallback } from 'react';
import { Sparkles, PenLine, Trash2 } from 'lucide-react';
import { useDesignEditorStore } from '../lib/design-editor-store';
import { CURSOR_CHAT_OPEN_EVENT, type CursorChatOpenPayload } from '../lib/constants';

export default function CommitPanel() {
  const { styleOverrides, propOverrides, contentOverrides, formatDeltaDescription, clearAllOverrides } = useDesignEditorStore();

  const hasChanges = styleOverrides.length > 0 || propOverrides.length > 0 || contentOverrides.length > 0;

  const handleApplyAsIteration = useCallback(() => {
    const delta = formatDeltaDescription();
    if (!delta) return;

    // Dispatch cursor chat open event with delta context
    // The CursorChat component will pre-fill with the delta text
    window.dispatchEvent(
      new CustomEvent<CursorChatOpenPayload>(CURSOR_CHAT_OPEN_EVENT, {
        detail: {
          targetNode: null as unknown as CursorChatOpenPayload['targetNode'],
          screenX: window.innerWidth / 2,
          screenY: window.innerHeight / 2,
          editMode: false,
          deltaContext: delta,
        },
      })
    );
  }, [formatDeltaDescription]);

  const handleEditInPlace = useCallback(() => {
    const delta = formatDeltaDescription();
    if (!delta) return;

    window.dispatchEvent(
      new CustomEvent<CursorChatOpenPayload>(CURSOR_CHAT_OPEN_EVENT, {
        detail: {
          targetNode: null as unknown as CursorChatOpenPayload['targetNode'],
          screenX: window.innerWidth / 2,
          screenY: window.innerHeight / 2,
          editMode: true,
          deltaContext: delta,
        },
      })
    );
  }, [formatDeltaDescription]);

  if (!hasChanges) return null;

  const changeCount = styleOverrides.length + propOverrides.length + contentOverrides.length;

  return (
    <div className="flex-shrink-0 border-t border-stone-100 px-3 py-2 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-stone-400">
          {changeCount} change{changeCount !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={clearAllOverrides}
          className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Clear
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleApplyAsIteration}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-medium text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Iterate
        </button>
        <button
          type="button"
          onClick={handleEditInPlace}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold text-white bg-stone-900 hover:bg-stone-700 transition-colors"
        >
          <PenLine className="w-3.5 h-3.5" />
          Edit
        </button>
      </div>
    </div>
  );
}
