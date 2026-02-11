'use client';

import { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PlaygroundSidebar from './PlaygroundSidebar';
import PlaygroundCanvas from './PlaygroundCanvas';

export default function PlaygroundClient() {
  const [sidebarVisible, setSidebarVisible] = useState(true);

  return (
    <ReactFlowProvider>
      <div className="fixed inset-0 flex bg-gray-50 text-gray-900 overflow-hidden z-50">
        {/* Sidebar */}
        <div
          className={`transition-all duration-300 ease-in-out h-full ${
            sidebarVisible ? 'w-56' : 'w-0'
          } overflow-hidden flex-shrink-0`}
        >
          <PlaygroundSidebar />
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setSidebarVisible(!sidebarVisible)}
          className={`absolute top-1/2 -translate-y-1/2 z-10 bg-white border border-gray-200 rounded-r-md p-1 shadow-sm hover:bg-gray-50 transition-all duration-300 ${
            sidebarVisible ? 'left-56' : 'left-0'
          }`}
          aria-label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
        >
          {sidebarVisible ? (
            <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
          )}
        </button>

        {/* Canvas */}
        <div className="flex-1 relative">
          <PlaygroundCanvas />
        </div>
      </div>
    </ReactFlowProvider>
  );
}

