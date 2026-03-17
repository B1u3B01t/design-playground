import { useState, useCallback } from 'react';
import { useOnSelectionChange } from '@xyflow/react';
import { flatRegistry } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SelectedNodeContext {
  nodeId: string;
  componentId: string;
  componentName: string;
  type: 'component' | 'iteration';
  sourceFilename?: string;
}

export interface UseNodeSelectionReturn {
  selectedNodes: SelectedNodeContext[];
  clearNodeSelection: () => void;
  removeNode: (nodeId: string) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNodeSelection(): UseNodeSelectionReturn {
  const [selectedNodes, setSelectedNodes] = useState<SelectedNodeContext[]>([]);

  useOnSelectionChange({
    onChange: useCallback(({ nodes }) => {
      const mapped: SelectedNodeContext[] = [];

      for (const node of nodes) {
        if (node.type !== 'component' && node.type !== 'iteration') continue;

        const data = node.data as Record<string, unknown>;

        if (node.type === 'component') {
          const compId = (data.componentId as string) || '';
          mapped.push({
            nodeId: node.id,
            componentId: compId,
            componentName: flatRegistry[compId]?.label || compId,
            type: 'component',
          });
        } else {
          mapped.push({
            nodeId: node.id,
            componentId:
              (data.componentName as string)
                ?.replace(/([A-Z])/g, '-$1')
                .toLowerCase()
                .replace(/^-/, '') || '',
            componentName: (data.componentName as string) || '',
            type: 'iteration',
            sourceFilename: (data.filename as string) || undefined,
          });
        }
      }

      setSelectedNodes(mapped);
    }, []),
  });

  const clearNodeSelection = useCallback(() => {
    setSelectedNodes([]);
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    setSelectedNodes((prev) => prev.filter((n) => n.nodeId !== nodeId));
  }, []);

  return {
    selectedNodes,
    clearNodeSelection,
    removeNode,
  };
}
