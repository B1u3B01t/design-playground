'use client';

/**
 * Lightweight logo strip for the signup flow shell — no framer-motion dependency.
 */
export function LogoMarquee() {
  const labels = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Stark', 'Wayne'];

  return (
    <div className="mt-10 max-w-md mx-auto w-full">
      <p className="text-sm font-medium text-stone-900 mb-1">Join 3,000+ designers</p>
      <p className="text-xs text-stone-500 uppercase tracking-wider mt-4 mb-2">
        Trusted by designers at
      </p>
      <div className="flex flex-wrap gap-3 items-center justify-center py-2">
        {labels.map((name) => (
          <span
            key={name}
            className="px-3 py-1.5 text-xs font-medium text-stone-500 bg-stone-900/5 rounded-lg"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
