'use client';

import type { ReactNode } from 'react';

interface PropertyRowProps {
  label: string;
  children: ReactNode;
}

export default function PropertyRow({ label, children }: PropertyRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-[11px] font-medium text-stone-500 shrink-0 min-w-[60px]">
        {label}
      </span>
      <div className="flex items-center gap-1.5 flex-1 justify-end">
        {children}
      </div>
    </div>
  );
}
