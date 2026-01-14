// Auto-generated index for iteration components
// This file maps iteration filenames to their components

import { ComponentType } from 'react';

// Import iterations for SubscriptionExpiringBanner
import SubscriptionExpiringBannerIteration1 from './SubscriptionExpiringBanner.iteration-1';
import SubscriptionExpiringBannerIteration2 from './SubscriptionExpiringBanner.iteration-2';
import SubscriptionExpiringBannerIteration3 from './SubscriptionExpiringBanner.iteration-3';
import SubscriptionExpiringBannerIteration4 from './SubscriptionExpiringBanner.iteration-4';

// Map of filename to component
export const iterationComponents: Record<string, ComponentType<Record<string, unknown>>> = {
  'SubscriptionExpiringBanner.iteration-1.tsx': SubscriptionExpiringBannerIteration1 as ComponentType<Record<string, unknown>>,
  'SubscriptionExpiringBanner.iteration-2.tsx': SubscriptionExpiringBannerIteration2 as ComponentType<Record<string, unknown>>,
  'SubscriptionExpiringBanner.iteration-3.tsx': SubscriptionExpiringBannerIteration3 as ComponentType<Record<string, unknown>>,
  'SubscriptionExpiringBanner.iteration-4.tsx': SubscriptionExpiringBannerIteration4 as ComponentType<Record<string, unknown>>,
};

export function getIterationComponent(filename: string): ComponentType<Record<string, unknown>> | undefined {
  return iterationComponents[filename];
}
