import { memo } from 'react';

function StageGroupNode() {
  return (
    <div
      className="h-full w-full rounded-2xl border-5 border-dotted border"
      style={{ pointerEvents: 'none' }}
    />
  );
}

export default memo(StageGroupNode);
