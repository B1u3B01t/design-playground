export default function PlaygroundLoading() {
  return (
    <div className="fixed inset-0 flex bg-gray-50 z-50">
      {/* Skeleton sidebar */}
      <div className="w-56 h-full bg-white border-r border-gray-200 flex flex-col">
        <div className="px-2.5 py-2 border-b border-gray-200">
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-2.5 w-16 bg-gray-100 rounded animate-pulse mt-1" />
        </div>
        <div className="px-2 py-1.5 border-b border-gray-200">
          <div className="h-6 w-full bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="flex-1 p-1.5 space-y-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-5 bg-gray-100 rounded animate-pulse" style={{ width: `${70 + Math.random() * 30}%` }} />
          ))}
        </div>
      </div>

      {/* Skeleton canvas */}
      <div className="flex-1 relative bg-gray-50">
        {/* Dot pattern background */}
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        
        {/* Loading indicator */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            <span className="text-sm text-gray-500 font-mono">Loading playground...</span>
          </div>
        </div>

        {/* Skeleton controls (top-right) */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-9 h-9 bg-white border border-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>

        {/* Skeleton zoom controls (bottom-left) */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-0.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-7 h-7 bg-white border border-gray-200 rounded animate-pulse" />
          ))}
        </div>

        {/* Skeleton minimap (bottom-right) */}
        <div className="absolute bottom-4 right-4 w-32 h-24 bg-white border border-gray-200 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
