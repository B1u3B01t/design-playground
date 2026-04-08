'use client';

import { X } from 'lucide-react';
import { useDesignEditorStore, type DesignEditorTab } from '../lib/design-editor-store';

const TABS: { key: DesignEditorTab; label: string }[] = [
  { key: 'design', label: 'Design' },
  { key: 'props', label: 'Props' },
  { key: 'content', label: 'Content' },
];

interface DesignEditorHeaderProps {
  selectedLabel?: string;
  showTokenToggle?: boolean;
  tokenMode?: boolean;
  onTokenModeChange?: (mode: boolean) => void;
}

export default function DesignEditorHeader({
  selectedLabel,
  showTokenToggle = false,
  tokenMode = true,
  onTokenModeChange,
}: DesignEditorHeaderProps) {
  const { activeTab, setActiveTab, close } = useDesignEditorStore();

  return (
    <div className="flex flex-col gap-2 px-3 pt-3 pb-2 flex-shrink-0">
      {/* Top row: title + close */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-stone-400">
          {selectedLabel || 'Inspector'}
        </span>
        <div className="flex items-center gap-1">
          {showTokenToggle && (
            <button
              type="button"
              onClick={() => onTokenModeChange?.(!tokenMode)}
              className={`px-2 py-0.5 rounded-full text-[9px] font-medium transition-colors ${
                tokenMode
                  ? 'bg-stone-800 text-white'
                  : 'text-stone-400 hover:text-stone-600 bg-stone-100'
              }`}
            >
              {tokenMode ? 'Tokens' : 'Custom'}
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="w-[24px] h-[24px] flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-stone-50 rounded-full px-1 py-0.5 border border-stone-100">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-stone-800 text-white'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
