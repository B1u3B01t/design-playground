'use client';

import { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import PlaygroundSidebar from './PlaygroundSidebar';
import PlaygroundCanvas from './PlaygroundCanvas';
import PlaygroundHeader from './PlaygroundHeader';
import { PlaygroundToaster } from './ui/sonner';

export default function PlaygroundClient() {
  const [sidebarVisible, setSidebarVisible] = useState(true);

  return (
    <ReactFlowProvider>
      <div
        className="fixed inset-0 flex flex-col overflow-hidden z-50"
        style={{ fontFamily: 'var(--font-geist-sans), Geist, system-ui, sans-serif', background: '#f5f5f4' }}
      >
        {/* Top header — full width */}
        <PlaygroundHeader sidebarVisible={sidebarVisible} onToggleSidebar={() => setSidebarVisible(!sidebarVisible)} />

        {/* Body: sidebar + canvas */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Sidebar — floating panel, not a layout column */}
          <div
            className={`absolute top-3 left-3 bottom-3 z-10 transition-all duration-300 ease-in-out ${
              sidebarVisible ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 -translate-x-4 pointer-events-none'
            }`}
          >
            <PlaygroundSidebar onCollapse={() => setSidebarVisible(false)} />
          </div>

          {/* Sidebar reveal button — shown only when sidebar is hidden */}
          <button
            onClick={() => setSidebarVisible(true)}
            aria-label="Show sidebar"
            className={`group absolute top-3 left-3 z-10 p-2 rounded-xl bg-white border border-stone-200/80 text-stone-900 hover:bg-stone-50 transition-all duration-300 ease-in-out ${
              sidebarVisible ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
            }`}
          >
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
              style={{ transition: 'transform 600ms ease-in-out' }}
              className="group-hover:[transform:rotate(90deg)]"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          </button>

          {/* Canvas — always full size, sidebar overlays */}
          <div className="flex-1 relative">
            <PlaygroundCanvas />
          </div>
        </div>
      </div>
      <PlaygroundToaster />
    </ReactFlowProvider>
  );
}
