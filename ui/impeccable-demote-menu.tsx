'use client';

import { useState, useEffect, useCallback } from 'react';
import { IMPECCABLE_COMMANDS } from '../lib/impeccable-skill';
import type { ImpeccableDemoteState } from '../hooks/useImpeccableSkillPicker';

interface ImpeccableDemoteMenuProps {
  demoteState: ImpeccableDemoteState;
  onSelect: (command: string) => void;
  onClose: () => void;
}

export function ImpeccableDemoteMenu({
  demoteState,
  onSelect,
  onClose,
}: ImpeccableDemoteMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [demoteState.pillEl]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => Math.min(i + 1, IMPECCABLE_COMMANDS.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        const cmd = IMPECCABLE_COMMANDS[activeIndex];
        if (cmd) onSelect(cmd.id);
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    },
    [activeIndex, onSelect, onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-slot="impeccable-demote-menu"]')) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  return (
    <div
      data-slot="impeccable-demote-menu"
      className="absolute z-[55] min-w-[280px] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg animate-in fade-in-0 zoom-in-95"
      style={{
        top: demoteState.position.top,
        left: demoteState.position.left,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-1.5 px-2 pb-1 pt-2">
        <span className="text-[11px] font-semibold text-stone-500 tracking-wide uppercase">
          impeccable
        </span>
      </div>
      <div className="max-h-[256px] overflow-y-auto p-1">
        {IMPECCABLE_COMMANDS.map((cmd, index) => (
          <button
            key={cmd.id}
            type="button"
            data-selected={index === activeIndex}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(cmd.id);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left data-[selected=true]:bg-stone-100"
          >
            <span className="impeccable-cmd-category">{cmd.category}</span>
            <span className="text-[13px] font-medium text-stone-800">{cmd.id}</span>
            <span className="ml-1 text-[11px] text-stone-400 truncate">{cmd.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
