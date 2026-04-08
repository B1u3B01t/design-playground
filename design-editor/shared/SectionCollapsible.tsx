'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface SectionCollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function SectionCollapsible({ title, defaultOpen = true, children }: SectionCollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-stone-100">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 w-full px-2 py-2 text-left hover:bg-stone-100 rounded-none transition-colors"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 shrink-0 text-stone-400 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
        />
        <span className="uppercase tracking-[0.08em] text-[10px] font-semibold text-stone-400">
          {title}
        </span>
      </button>
      {isOpen && (
        <div className="px-2 pb-2 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}
