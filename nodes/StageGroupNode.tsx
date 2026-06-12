'use client';

import { memo } from 'react';

interface StageGroupNodeProps {
  data?: {
    reveal?: boolean;
  };
}

function StageGroupNode({ data }: StageGroupNodeProps) {
  return (
    <div
      className={`h-full w-full rounded-xl ${data?.reveal ? 'playground-stage-group-reveal' : ''}`}
      style={{
        border: '1.25px dashed #78716c',
        pointerEvents: 'none',
      }}
    />
  );
}

export default memo(StageGroupNode);
