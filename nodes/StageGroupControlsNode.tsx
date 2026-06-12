'use client';

import { memo } from 'react';
import { FlowGroupToolbar } from './shared/FlowGroupToolbar';

interface StageGroupControlsNodeProps {
  data?: {
    flowId?: string;
    descriptorId?: string;
  };
}

function StageGroupControlsNode({ data }: StageGroupControlsNodeProps) {
  if (!data?.flowId) return null;

  return (
    <div className="relative h-full w-full nodrag nopan">
      <FlowGroupToolbar flowId={data.flowId} descriptorId={data.descriptorId} />
    </div>
  );
}

export default memo(StageGroupControlsNode);
