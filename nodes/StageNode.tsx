'use client';

import { memo, useState, useMemo, useEffect, useCallback } from 'react';
import { Handle, Position, useNodeId, useReactFlow } from '@xyflow/react';
import { Star, Loader2 } from 'lucide-react';
import { resolveRegistryItem } from '../registry';
import { findFlowDescriptorById } from '../lib/flows/registry';
import { useFlowMocksStore } from '../lib/flow-mocks-store';
import { useInteractiveNodeStore, useIsInteractiveNode } from '../lib/interactive-node-store';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { NodeLabel } from './shared/NodeLabel';
import { useFrameHoverHint } from './shared/FrameHoverHint';
import ComponentErrorBoundary from './ComponentErrorBoundary';
import IterateDialog from './shared/IterateDialog';
import { stageRenderers } from '../components/stage-renderers';
import { getIterationComponent } from '../iterations';
import {
  GENERATION_START_EVENT,
  GENERATION_COMPLETE_EVENT,
  GENERATION_ERROR_EVENT,
  SIZE_CONFIG,
  type ComponentSize,
} from '../lib/constants';
import type { StageNodeData } from '../lib/flows/types';

interface StageNodeProps {
  data: StageNodeData;
  selected?: boolean;
}

/**
 * Display size for stages on the canvas. Stages render the FULL signup page
 * (chrome + content), so we use the laptop preset by default so the two-
 * column layout reads correctly. Scaled to ~882×499 via zoom scaling.
 */
const STAGE_SIZE: ComponentSize = 'laptop';

function StageNode({ data, selected = false }: StageNodeProps) {
  const nodeId = useNodeId();
  const { setNodes, setEdges, getNode, setCenter } = useReactFlow();
  const [isGlobalGenerating, setIsGlobalGenerating] = useState(false);

  // Interactive mode: when a user double-clicks the frame, we hand pointer
  // events through to the rendered page so they can actually fill the form,
  // click plan cards, etc. Escape (or deselecting) exits interactive mode.
  // Mirrors the pattern used by ComponentNode.
  const isInteractive = useIsInteractiveNode(nodeId);
  const setInteractiveNodeId = useInteractiveNodeStore((s) => s.setInteractiveNodeId);
  const handleFrameDoubleClick = useCallback(() => {
    if (nodeId) setInteractiveNodeId(nodeId);
  }, [nodeId, setInteractiveNodeId]);
  const hoverHint = useFrameHoverHint(!isInteractive);

  useEffect(() => {
    if (!selected && isInteractive) setInteractiveNodeId(null);
  }, [selected, isInteractive, setInteractiveNodeId]);

  useEffect(() => {
    if (!isInteractive) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInteractiveNodeId(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isInteractive, setInteractiveNodeId]);

  const registryItem = useMemo(
    () => resolveRegistryItem(data.componentId),
    [data.componentId],
  );

  const flow = useFlowMocksStore((s) => s.flows[data.flowId]);
  const stageMock = flow?.stageMocks?.[data.stageId];
  const canonicalFilename = flow?.canonicalIterationByStage?.[data.stageId];

  useEffect(() => {
    const on = () => setIsGlobalGenerating(true);
    const off = () => setIsGlobalGenerating(false);
    window.addEventListener(GENERATION_START_EVENT, on);
    window.addEventListener(GENERATION_COMPLETE_EVENT, off);
    window.addEventListener(GENERATION_ERROR_EVENT, off);
    return () => {
      window.removeEventListener(GENERATION_START_EVENT, on);
      window.removeEventListener(GENERATION_COMPLETE_EVENT, off);
      window.removeEventListener(GENERATION_ERROR_EVENT, off);
    };
  }, []);

  const descriptor = findFlowDescriptorById(data.descriptorId);
  const stage = descriptor?.stages.find((s) => s.id === data.stageId);
  const label = stage?.label ?? data.label;

  const Renderer = stageRenderers[data.componentId];
  const ComponentOverride = canonicalFilename ? getIterationComponent(canonicalFilename) : undefined;

  const removeStage = () => {
    if (!nodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  };

  /**
   * Called when the rendered page fires its "advance" action (e.g. clicking
   * "Create account" on the account stage). Finds the next stage on this
   * flow, selects it, pans the canvas to centre it, and enters interactive
   * mode on it so the user can immediately fill in the next form.
   */
  const handleStageContinue = useCallback(() => {
    if (!flow) return;
    const nextEdge = descriptor?.defaultEdges.find((e) => e.from === data.stageId);
    if (!nextEdge) return;
    const nextNodeId = flow.stageNodeIds[nextEdge.to];
    if (!nextNodeId) return;
    const nextNode = getNode(nextNodeId);
    if (!nextNode) return;

    setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === nextNodeId })));

    const width = nextNode.measured?.width ?? STAGE_NODE_FRAME_WIDTH;
    const height = nextNode.measured?.height ?? STAGE_NODE_DEFAULT_HEIGHT;
    setCenter(
      nextNode.position.x + width / 2,
      nextNode.position.y + height / 2,
      { duration: 600, zoom: 0.9 },
    );

    setInteractiveNodeId(nextNodeId);
  }, [flow, descriptor, data.stageId, getNode, setNodes, setCenter, setInteractiveNodeId]);

  const config = SIZE_CONFIG[STAGE_SIZE];
  const displayDims = {
    width: STAGE_NODE_FRAME_WIDTH,
    height: STAGE_NODE_DEFAULT_HEIGHT,
  };

  return (
    <div
      className="flex flex-col"
      style={{
        width: displayDims.width,
        fontFamily: 'var(--pg-font-sans)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#A855F7' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#A855F7' }} />

      {/* Header */}
      <div className="flex items-center justify-between px-0.5 pb-1.5 cursor-grab">
        <div className="flex items-center gap-1.5">
          <NodeLabel color="#A855F7">
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-500/15 text-purple-600 text-[10px] font-semibold">
                {(descriptor?.stages.findIndex((s) => s.id === data.stageId) ?? 0) + 1}
              </span>
              {label}
              {data.synthetic && (
                <span className="text-[10px] uppercase tracking-wider text-stone-400">
                  synthetic
                </span>
              )}
            </span>
          </NodeLabel>
        </div>

        <div className={`flex items-center gap-1.5 transition-opacity nodrag ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {canonicalFilename && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                  <Star className="w-2.5 h-2.5 fill-current" />
                  canonical
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Using iteration: {canonicalFilename}</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={removeStage}
                className="text-[11px] text-stone-400 hover:text-stone-700"
                aria-label="Remove stage from canvas"
              >
                Remove
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Remove this stage from the canvas</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Frame — laptop preset with zoom scaling, mirrors ComponentNode pattern */}
      <div className="relative flex items-start">
        <div
          data-screenshot-target
          data-interactive={isInteractive ? 'true' : undefined}
          onDoubleClick={handleFrameDoubleClick}
          onMouseMove={hoverHint.onMouseMove}
          onMouseLeave={hoverHint.onMouseLeave}
          className={`relative app-theme bg-background overflow-hidden rounded-xl transition-all ${
            selected ? 'ring-2 ring-purple-400' : 'ring-1 ring-purple-200/60'
          } ${isInteractive ? 'ring-offset-2' : ''}`}
          style={{ width: displayDims.width }}
        >
          <div
            className={`bg-gray-100 overflow-x-hidden overflow-y-auto ${isInteractive ? 'nodrag nowheel nopan' : ''}`}
            style={{ width: displayDims.width, height: displayDims.height }}
          >
            <div
              className="bg-background"
              style={{ width: config.width, minHeight: config.height, zoom: config.scale }}
            >
              {Renderer ? (
                <ComponentErrorBoundary componentName={label}>
                  <Renderer
                    mock={stageMock ?? {}}
                    onContinue={handleStageContinue}
                    Component={ComponentOverride}
                  />
                </ComponentErrorBoundary>
              ) : (
                <div className="p-6 text-xs text-red-500">
                  No renderer for component: {data.componentId}
                </div>
              )}
            </div>
          </div>
          {!isInteractive && <div className="absolute inset-0" data-iframe-overlay />}
        </div>

        {hoverHint.tooltip}

        {/* Right-side toolbar — Iterate */}
        <div className={`absolute top-0 left-full pl-2 flex flex-col items-center gap-2 nodrag transition-opacity ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {registryItem && !data.synthetic && (
            <IterateDialog
              componentId={data.componentId}
              componentName={registryItem.label.replace(/\s*\(.*\)/, '')}
              parentNodeId={nodeId ?? ''}
              isGlobalGenerating={isGlobalGenerating}
            />
          )}
          {isGlobalGenerating && (
            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(StageNode);

/** Width of a StageNode frame on the canvas — used by the decompose layout */
export const STAGE_NODE_FRAME_WIDTH = Math.round(
  SIZE_CONFIG[STAGE_SIZE].width * SIZE_CONFIG[STAGE_SIZE].scale,
);
/** Height of a StageNode frame on the canvas — used by the decompose layout */
export const STAGE_NODE_DEFAULT_HEIGHT = Math.round(
  SIZE_CONFIG[STAGE_SIZE].height * SIZE_CONFIG[STAGE_SIZE].scale,
);

/**
 * Approximate height of the StageNode header row (label + actions) that sits
 * above the frame. Used by the decompose layout so the group backdrop can
 * include the header in its overall bounds.
 */
export const STAGE_NODE_HEADER_HEIGHT = 28;
