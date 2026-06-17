'use client';

// ---------------------------------------------------------------------------
// Shared chat composer bits
// ---------------------------------------------------------------------------
// Small presentational pieces shared between the cursor-following chat
// (CursorChat.tsx) and the bottom-docked composer (DockedChatBar.tsx).
// These were originally local to CursorChat; lifted here so both surfaces can
// reuse them without importing the whole CursorChat module (and its cursor
// tracking machinery) just for icons.
// ---------------------------------------------------------------------------

import React, { useCallback, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ITERATION_COUNT_OPTIONS } from '../lib/constants';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

export function BracketIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
      <path d="M3.5 2L1.5 6L3.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 2L10.5 6L8.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FrameIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
  );
}

// Edit / Explore icons — sourced from src/app/playground/assets/{edit,explore}-icon.svg.
// Inlined so they pick up `currentColor` from the active toggle segment.
export function EditIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 10 10" fill="none" className={className} aria-hidden>
      <path
        d="M7.21853 0.821105C7.42413 0.615505 7.70299 0.5 7.99375 0.5C8.28451 0.5 8.56337 0.615505 8.76897 0.821105C8.97457 1.0267 9.09007 1.30556 9.09007 1.59632C9.09007 1.88708 8.97457 2.16594 8.76897 2.37154L2.56724 8.57326L0.5 9.09007L1.01681 7.02283L7.21853 0.821105Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ExploreIcon({ className }: { className?: string }) {
  return (
    <svg width="13" height="14" viewBox="0 0 11 13" fill="currentColor" className={className} aria-hidden>
      <circle cx="1.04653" cy="8.34829" r="1.04653" />
      <circle cx="1.04653" cy="3.93227" r="1.04653" />
      <circle cx="5.30825" cy="1.04653" r="1.04653" />
      <circle cx="9.70083" cy="3.93227" r="1.04653" />
      <circle cx="5.3102" cy="6.02553" r="1.04653" />
      <circle cx="9.70083" cy="8.34829" r="1.04653" />
      <circle cx="5.3102" cy="11.0045" r="1.04653" />
    </svg>
  );
}

/** Send-arrow glyph used by the circular send button. */
export function SendArrowIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={className} aria-hidden>
      <path d="M7 11V3M7 3L3 7M7 3L11 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// PillLeadingRemoveSlot
// ---------------------------------------------------------------------------

/** Leading pill icon that swaps to a remove control on row hover (`group` on parent). */
export function PillLeadingRemoveSlot({
  icon,
  onRemove,
  slotClassName = 'h-3 w-3',
}: {
  icon: ReactNode;
  onRemove?: () => void;
  slotClassName?: string;
}) {
  if (!onRemove) {
    return (
      <span className={`inline-flex flex-shrink-0 items-center justify-center ${slotClassName}`}>
        {icon}
      </span>
    );
  }
  return (
    <span className={`relative inline-flex flex-shrink-0 items-center justify-center ${slotClassName}`}>
      <span className="flex items-center justify-center group-hover:invisible group-focus-within:invisible">{icon}</span>
      {/* Always in the DOM (not display:none) so keyboard users can Tab to it;
          invisible + non-interactive until the row is hovered or it's focused. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRemove();
        }}
        className="absolute inset-0 flex items-center justify-center rounded-full text-current opacity-0 pointer-events-none transition-opacity hover:bg-black/10 group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
        aria-label="Remove reference"
      >
        <span className="text-[14px] leading-none font-light">×</span>
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// IterationCountDragger
// ---------------------------------------------------------------------------

const DRAG_STEP_PX = 24; // pixels of vertical drag per ±1 count
const MIN_COUNT = ITERATION_COUNT_OPTIONS[0];
const MAX_COUNT = ITERATION_COUNT_OPTIONS[ITERATION_COUNT_OPTIONS.length - 1];

export function IterationCountDragger({ count, onChange }: { count: number; onChange: (n: number) => void }) {
  const dragStartY = useRef(0);
  const dragStartCount = useRef(count);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
    dragStartCount.current = count;
  }, [count]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!(e.target as HTMLElement).hasPointerCapture(e.pointerId)) return;
    const delta = dragStartY.current - e.clientY; // up = positive
    const steps = Math.round(delta / DRAG_STEP_PX);
    const next = Math.min(MAX_COUNT, Math.max(MIN_COUNT, dragStartCount.current + steps));
    onChange(next);
  }, [onChange]);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="inline-flex items-center justify-center py-1 pl-1.5 pr-2 gap-1 rounded-full text-[9px] font-medium transition-transform duration-150 ease-out select-none bg-stone-50 text-stone-500 border border-stone-100 hover:text-stone-700 hover:scale-[1.05] active:scale-[0.95]"
      style={{ cursor: 'ns-resize', touchAction: 'none' }}
    >
      <span className="cursor-ns-resize flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 20 20">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M15.6 3.396H4.25c-.314 0-.568.283-.568.633v12.665c0 .35.254.633.568.633H15.6c.314 0 .568-.284.568-.633V4.029c0-.35-.254-.633-.567-.633ZM6.8 10.361h6.25M9.925 7.236v6.25" />
          <path stroke="currentColor" strokeLinecap="round" d="M17.747 5.02v10.682M19.312 6.019v8.685" />
        </svg>
      </span>
      <span className="text-nowrap">{count}x</span>
    </button>
  );
}
