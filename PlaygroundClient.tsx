'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import PlaygroundSidebar from './PlaygroundSidebar';
import PlaygroundCanvas from './PlaygroundCanvas';

// Event for fullscreen mode
export const FULLSCREEN_NODE_EVENT = 'playground:fullscreen-node';

// Context for fullscreen state
interface PlaygroundContextType {
  fullscreenNodeId: string | null;
  enterFullscreen: (nodeId: string) => void;
  exitFullscreen: () => void;
}

const PlaygroundContext = createContext<PlaygroundContextType>({
  fullscreenNodeId: null,
  enterFullscreen: () => {},
  exitFullscreen: () => {},
});

export const usePlaygroundContext = () => useContext(PlaygroundContext);

export default function PlaygroundClient() {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [fullscreenNodeId, setFullscreenNodeId] = useState<string | null>(null);
  const [sidebarWasVisible, setSidebarWasVisible] = useState(true);

  const enterFullscreen = useCallback((nodeId: string) => {
    setSidebarWasVisible(sidebarVisible);
    setSidebarVisible(false);
    setFullscreenNodeId(nodeId);
    // Dispatch event so canvas can fitView to the node
    window.dispatchEvent(new CustomEvent(FULLSCREEN_NODE_EVENT, { detail: { nodeId, action: 'enter' } }));
  }, [sidebarVisible]);

  const exitFullscreen = useCallback(() => {
    setFullscreenNodeId(null);
    setSidebarVisible(sidebarWasVisible);
    window.dispatchEvent(new CustomEvent(FULLSCREEN_NODE_EVENT, { detail: { nodeId: null, action: 'exit' } }));
  }, [sidebarWasVisible]);

  // Listen for escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreenNodeId) {
        exitFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenNodeId, exitFullscreen]);

  return (
    <PlaygroundContext.Provider value={{ fullscreenNodeId, enterFullscreen, exitFullscreen }}>
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

          {/* Toggle Button - hide in fullscreen */}
          {!fullscreenNodeId && (
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
          )}

          {/* Exit fullscreen button */}
          {fullscreenNodeId && (
            <button
              onClick={exitFullscreen}
              className="absolute top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-black text-white rounded-lg shadow-lg transition-colors"
              aria-label="Exit fullscreen"
            >
              <X className="w-4 h-4" />
              <span className="text-sm font-medium">Exit Fullscreen</span>
              <kbd className="ml-1 px-1.5 py-0.5 text-[10px] bg-white/20 rounded">ESC</kbd>
            </button>
          )}

          {/* Canvas */}
          <div className="flex-1 relative">
            <PlaygroundCanvas />
          </div>
        </div>
      </ReactFlowProvider>
    </PlaygroundContext.Provider>
  );
}

