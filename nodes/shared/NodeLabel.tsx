'use client';

import { memo, type CSSProperties, type ReactNode } from 'react';
import { useNodeId, useStore } from '@xyflow/react';
import { NODE_LABEL_MAX_INV_SCALE, NODE_LABEL_SCALE_THRESHOLD } from '../../lib/constants';

/** Inverse-zoom factor: grows as the canvas zooms out, capped by the constants. */
export function useInverseZoom(): number {
  const zoom = useStore((s) => s.transform[2]);
  return Math.min(
    NODE_LABEL_MAX_INV_SCALE,
    Math.max(1, NODE_LABEL_SCALE_THRESHOLD / zoom),
  );
}

type NodeLabelProps = {
  children: ReactNode;
  color?: string;
  className?: string;
  style?: CSSProperties;
};

function NodeLabelInner({ children, color, className, style }: NodeLabelProps) {
  const inv = useInverseZoom();

  const nodeId = useNodeId();
  const nodeWidth = useStore((s) => {
    if (!nodeId) return 0;
    const node = s.nodeLookup?.get(nodeId);
    return node?.measured?.width ?? (typeof node?.width === 'number' ? node.width : 0);
  });
  const isSelected = useStore((s) => {
    if (!nodeId) return false;
    return Boolean(s.nodeLookup?.get(nodeId)?.selected);
  });

  // Cap the label's intrinsic max-width so that, after the visual scale by `inv`,
  // it never exceeds the node's own width. Truncate excess with an ellipsis.
  const maxIntrinsicWidth = nodeWidth > 0 ? nodeWidth / inv : undefined;

  // Labels are muted-grey by default; show their accent color only when the
  // owning node is selected.
  const effectiveColor = isSelected ? color : '#A8A29E';

  return (
    <span
      className={`text-[11px] font-medium select-none leading-none ${className ?? ''}`}
      style={{
        fontFamily: 'var(--font-geist-sans), sans-serif',
        color: effectiveColor,
        display: 'inline-block',
        transform: `scale(${inv})`,
        transformOrigin: 'left bottom',
        willChange: 'transform',
        position: 'relative',
        zIndex: 10,
        maxWidth: maxIntrinsicWidth,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export const NodeLabel = memo(NodeLabelInner);
