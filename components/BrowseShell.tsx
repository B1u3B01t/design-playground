"use client";

/**
 * Synthetic destination shell rendered as the final "landed" stage in the
 * signup flow. It is NOT part of the real /signup page — it exists purely
 * to give the flow simulator a destination viewport to transition to.
 */

interface BrowseShellProps {
  firstName?: string;
}

export function BrowseShell({ firstName = "there" }: BrowseShellProps) {
  return (
    <div className="min-h-[420px] w-full bg-stone-50 p-10">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs uppercase tracking-wider text-stone-500 mb-2">
          Welcome
        </p>
        <h1 className="text-4xl font-serif tracking-tight text-stone-900 mb-3">
          You&rsquo;re in, <em>{firstName}</em>.
        </h1>
        <p className="text-sm text-stone-500 mb-8 max-w-md">
          Browse 200+ real AI-UX examples, save your favourites into
          collections, and unlock the pattern library.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] rounded-2xl bg-stone-200/50 border border-stone-200/40"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
