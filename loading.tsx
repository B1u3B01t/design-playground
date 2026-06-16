import {
  BACKGROUND_COLOR,
  BACKGROUND_GAP,
  CANVAS_BACKGROUND_COLOR,
} from './lib/constants';

const DOT_PATTERN = {
  backgroundColor: CANVAS_BACKGROUND_COLOR,
  backgroundImage: `radial-gradient(circle, ${BACKGROUND_COLOR} 1px, transparent 1px)`,
  backgroundSize: `${BACKGROUND_GAP}px ${BACKGROUND_GAP}px`,
} as const;

export default function PlaygroundLoading() {
  return (
    <div
      className="playground-main-view fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{
        fontFamily: 'var(--pg-font-sans)',
        background: '#f5f5f4',
      }}
    >
      {/* Header — matches PlaygroundHeader strip */}
      <header
        className="flex h-12 flex-shrink-0 items-center justify-between px-4"
        style={{ backgroundColor: CANVAS_BACKGROUND_COLOR }}
      >
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-[4.5rem] rounded bg-stone-300/70 animate-pulse" />
          <div className="h-7 w-[10.5rem] max-w-[40vw] rounded-md bg-stone-200/80 animate-pulse" />
        </div>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[34px] w-[34px] shrink-0 rounded-md bg-stone-200/60 animate-pulse"
            />
          ))}
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Canvas + dot grid */}
        <div className="relative flex-1">
          <div className="absolute inset-0" style={DOT_PATTERN} />

          {/* Floating sidebar — same slot as PlaygroundClient (left-[60px], w-[208px]) */}
          <div
            className="absolute top-3 bottom-3 left-[60px] z-10 flex w-[208px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            aria-hidden
          >
            <div className="flex flex-shrink-0 items-center justify-between px-3 pt-3 pb-2">
              <div className="h-3 w-16 rounded bg-stone-200/90 animate-pulse" />
              <div className="flex gap-0.5">
                <div className="h-6 w-6 rounded-lg bg-stone-100 animate-pulse" />
                <div className="h-6 w-6 rounded-lg bg-stone-100 animate-pulse" />
              </div>
            </div>
            <div className="flex-shrink-0 px-3 pb-3">
              <div className="h-9 w-full rounded-xl bg-stone-100 animate-pulse" />
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 px-2 py-0.5">
              {[100, 92, 88, 76, 95].map((pct, i) => (
                <div
                  key={i}
                  className="h-5 rounded-sm bg-stone-100 animate-pulse"
                  style={{ width: `${pct}%` }}
                />
              ))}
            </div>
            <div className="flex-shrink-0 border-t border-stone-100 px-3 py-2">
              <div className="mx-auto h-2.5 w-3/4 rounded bg-stone-100 animate-pulse" />
            </div>
          </div>

          {/* Left rail — matches floating tool stack */}
          <div
            className="absolute top-1/2 left-0 z-20 flex flex-col -translate-y-2/3 items-center gap-2 rounded-r-2xl border border-stone-200 bg-white p-2 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
            aria-hidden
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-9 w-9 rounded-xl bg-stone-100/90 animate-pulse"
              />
            ))}
          </div>

          {/* Center status */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700"
                aria-hidden
              />
              <span className="text-sm text-stone-500">Loading playground…</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
