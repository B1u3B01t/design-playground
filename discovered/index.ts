// Auto-generated index for discovered components
// This file maps discovery entry IDs to their wrapper components

import { ComponentType } from 'react';
import dynamic from 'next/dynamic';

export const discoveredComponents: Record<string, ComponentType<any>> = {
  'insights-page': dynamic(() => import('./Insights.discovered')),
  'article-card': dynamic(() => import('./ArticleCard.discovered')),
};

export function getDiscoveredComponent(id: string): ComponentType<any> | undefined {
  return discoveredComponents[id];
}
