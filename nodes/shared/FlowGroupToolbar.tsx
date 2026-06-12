'use client';

import { useCallback } from 'react';
import { Combine, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import { useFlowMocksStore } from '../../lib/flow-mocks-store';
import { findFlowDescriptorById } from '../../lib/flows/registry';
import { FLOW_ADOPT_EVENT, type FlowAdoptPayload } from '../../lib/constants';
import { getFlowPreviewUrl } from '../../lib/flow-preview-url';
import { NodeLabel, useInverseZoom } from './NodeLabel';
import { captureClient } from '../../lib/telemetry/client';

interface FlowGroupToolbarProps {
  flowId: string;
  descriptorId?: string;
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="currentColor" />
      <path d="M10 8 L16 12 L10 16 Z" fill="white" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function stopNodeDrag(e: React.PointerEvent | React.MouseEvent) {
  e.stopPropagation();
}

export function FlowGroupToolbar({ flowId, descriptorId }: FlowGroupToolbarProps) {
  const inv = useInverseZoom();
  const flow = useFlowMocksStore((s) => s.flows[flowId]);
  const descriptor = findFlowDescriptorById(descriptorId ?? flow?.descriptorId ?? '');
  const label = descriptor?.label ?? 'Flow';

  const hasCanonical = Object.keys(flow?.canonicalIterationByStage ?? {}).length > 0;

  const openPlay = useCallback(() => {
    captureClient('feature_used', { feature: 'flow_simulator_play' });
    window.open(getFlowPreviewUrl(flowId), '_blank', 'noopener,noreferrer');
  }, [flowId]);

  const openCombine = useCallback(() => {
    if (!hasCanonical) return;
    window.open(getFlowPreviewUrl(flowId, { useCanonical: true }), '_blank', 'noopener,noreferrer');
  }, [flowId, hasCanonical]);

  const fireAdopt = useCallback(() => {
    if (!hasCanonical) return;
    const payload: FlowAdoptPayload = { flowId };
    window.dispatchEvent(new CustomEvent(FLOW_ADOPT_EVENT, { detail: payload }));
  }, [flowId, hasCanonical]);

  const handleShare = useCallback(async () => {
    const route = descriptor?.sourceRoute;
    if (!route) return;
    const url = `${window.location.origin}${route}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied', { description: url });
    } catch {
      toast.error('Could not copy link');
    }
  }, [descriptor?.sourceRoute]);

  const iconBtn =
    'nodrag shrink-0 p-0 leading-none rounded-[5px] text-stone-400 hover:text-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  const iconScaleStyle = {
    display: 'inline-block' as const,
    transform: `scale(${inv})`,
    transformOrigin: 'left bottom',
    willChange: 'transform',
  };

  return (
    <div className="flex items-center gap-1.5 cursor-grab">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={openPlay}
            onPointerDown={stopNodeDrag}
            onMouseDown={stopNodeDrag}
            className={iconBtn}
            style={iconScaleStyle}
            aria-label="Play flow"
          >
            <PlayIcon />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Play flow with mock data</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={openCombine}
            onPointerDown={stopNodeDrag}
            onMouseDown={stopNodeDrag}
            disabled={!hasCanonical}
            className={iconBtn}
            style={iconScaleStyle}
            aria-label="Combine canonical variants"
          >
            <Combine className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>
            {hasCanonical
              ? 'Combine canonical variants into a stitched preview'
              : 'Pick a canonical variant per stage first'}
          </p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={fireAdopt}
            onPointerDown={stopNodeDrag}
            onMouseDown={stopNodeDrag}
            disabled={!hasCanonical}
            className={iconBtn}
            style={iconScaleStyle}
            aria-label="Adopt flow changes"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>
            {hasCanonical
              ? 'Generate a diff against the original source'
              : 'Pick a canonical variant per stage first'}
          </p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleShare}
            onPointerDown={stopNodeDrag}
            onMouseDown={stopNodeDrag}
            className={iconBtn}
            style={iconScaleStyle}
            aria-label="Copy flow URL"
          >
            <ShareIcon />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Copy flow URL</p>
        </TooltipContent>
      </Tooltip>

      <NodeLabel color="#A855F7">{label}</NodeLabel>
    </div>
  );
}
