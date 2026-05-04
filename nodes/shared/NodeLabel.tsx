'use client';

import { memo, type CSSProperties, type ReactNode } from 'react';
import { useStore } from '@xyflow/react';
import { NODE_LABEL_MAX_INV_SCALE, NODE_LABEL_SCALE_THRESHOLD } from '../../lib/constants';

type NodeLabelProps = {
  children: ReactNode;
  color?: string;
  className?: string;
  style?: CSSProperties;
};

function NodeLabelInner({ children, color, className, style }: NodeLabelProps) {
  const zoom = useStore((s) => s.transform[2]);
  const inv = Math.min(
    NODE_LABEL_MAX_INV_SCALE,
    Math.max(1, NODE_LABEL_SCALE_THRESHOLD / zoom),
  );

  return (
    <span
      className={`text-[11px] font-medium select-none leading-none ${className ?? ''}`}
      style={{
        fontFamily: 'var(--font-geist-mono), monospace',
        color,
        display: 'inline-block',
        transform: `scale(${inv})`,
        transformOrigin: 'left bottom',
        willChange: 'transform',
        position: 'relative',
        zIndex: 10,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export const NodeLabel = memo(NodeLabelInner);
