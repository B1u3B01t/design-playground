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
  type: 'component' | 'iteration' | 'image' | 'text';
  sourceFilename?: string;
  renderMode?: 'react' | 'html' | 'jsx';
  htmlPageSlug?: string;
  htmlIterationFolder?: string;
  jsxFile?: string;
  imagePath?: string;
  imageUrl?: string;
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
        if (node.type !== 'component' && node.type !== 'iteration' && node.type !== 'image' && node.type !== 'text') continue;

        const data = node.data as Record<string, unknown>;

        if (node.type === 'component') {
          const compId = (data.componentId as string) || '';
          const isJsx = data.renderMode === 'jsx';
          const isHtml = data.renderMode === 'html';
          mapped.push({
            nodeId: node.id,
            componentId: compId,
            componentName: isJsx
              ? ((data.jsxFile as string)?.replace('.tsx', '') || compId)
              : isHtml
                ? ((data.htmlFolder as string) || compId)
                : flatRegistry[compId]?.label || compId,
            type: 'component',
            renderMode: isJsx ? 'jsx' : isHtml ? 'html' : 'react',
            htmlPageSlug: isHtml ? (data.htmlFolder as string) : undefined,
            jsxFile: isJsx ? (data.jsxFile as string) : undefined,
          });
        } else if (node.type === 'image') {
          mapped.push({
            nodeId: node.id,
            componentId: '',
            componentName: (data.originalName as string) || 'Image',
            type: 'image',
            imagePath: (data.imagePath as string) || undefined,
            imageUrl: (data.imageUrl as string) || undefined,
          });
        } else if (node.type === 'text') {
          mapped.push({
            nodeId: node.id,
            componentId: '',
            componentName: 'Text Note',
            type: 'text',
          });
        } else {
          const isJsx = data.renderMode === 'jsx';
          const isHtml = data.renderMode === 'html';
          mapped.push({
            nodeId: node.id,
            componentId: isJsx
              ? `jsx:${data.componentName as string}`
              : isHtml
                ? `html:${data.htmlFolder as string}`
                : (data.componentName as string)
                    ?.replace(/([A-Z])/g, '-$1')
                    .toLowerCase()
                    .replace(/^-/, '') || '',
            componentName: (data.componentName as string) || '',
            type: 'iteration',
            sourceFilename: (data.filename as string) || undefined,
            renderMode: isJsx ? 'jsx' : isHtml ? 'html' : 'react',
            htmlPageSlug: isHtml ? (data.htmlFolder as string) : undefined,
            htmlIterationFolder: isHtml ? (data.htmlIterationFolder as string) : undefined,
            jsxFile: isJsx ? (data.jsxFile as string) : undefined,
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
