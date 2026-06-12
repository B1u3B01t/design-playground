'use client';

import { use } from 'react';
import { FlowPreview } from '../components/FlowPreview';

interface FlowPageProps {
  searchParams: Promise<{
    flowId?: string;
    combine?: string;
  }>;
}

export default function FlowPreviewPage({ searchParams }: FlowPageProps) {
  const { flowId, combine } = use(searchParams);

  if (!flowId) {
    return (
      <div className="playground-iteration-view fixed inset-0 flex items-center justify-center bg-background app-theme p-8 text-sm text-stone-500">
        Missing flow id.
      </div>
    );
  }

  return (
    <FlowPreview
      flowId={flowId}
      useCanonical={combine === '1' || combine === 'true'}
    />
  );
}
