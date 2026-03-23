'use client';

import { Monitor, Smartphone } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import type { ComponentSize } from '../../lib/constants';

// Icon-only size switcher: Auto · Desktop · Mobile
export function SizeButtons({
  currentSize,
  onSizeChange,
}: {
  currentSize: ComponentSize;
  onSizeChange: (size: ComponentSize) => void;
}) {
  const sizes: { key: ComponentSize; icon: React.ReactNode; label: string }[] = [
    {
      key: 'default',
      label: 'Auto',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      ),
    },
    { key: 'laptop', label: 'Desktop', icon: <Monitor className="w-3 h-3" /> },
    { key: 'mobile', label: 'Mobile',  icon: <Smartphone className="w-3 h-3" /> },
  ];

  return (
    <div className="flex items-center gap-0.5">
      {sizes.map(({ key, icon, label }) => (
        <Tooltip key={key}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onSizeChange(key)}
              className={`p-1 rounded transition-colors ${
                currentSize === key
                  ? 'text-[#0B99FF] bg-blue-50'
                  : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
              }`}
              aria-label={label}
            >
              {icon}
            </button>
          </TooltipTrigger>
          <TooltipContent><p>{label}</p></TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
