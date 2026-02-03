// Auto-generated index for iteration components
// This file maps iteration filenames to their components

import type { ComponentType } from "react";

// Import all SubscribeBanner iterations
import SubscribeBannerIteration1 from "./SubscribeBanner.iteration-1";
import SubscribeBannerIteration2 from "./SubscribeBanner.iteration-2";
import SubscribeBannerIteration3 from "./SubscribeBanner.iteration-3";
import SubscribeBannerIteration4 from "./SubscribeBanner.iteration-4";

// Import all SubscriptionExpiringBanner iterations
import SubscriptionExpiringBannerIteration1 from "./SubscriptionExpiringBanner.iteration-1";
import SubscriptionExpiringBannerIteration2 from "./SubscriptionExpiringBanner.iteration-2";
import SubscriptionExpiringBannerIteration3 from "./SubscriptionExpiringBanner.iteration-3";

// Map of filename to component
export const iterationComponents: Record<string, ComponentType<Record<string, unknown>>> = {
  // SubscribeBanner iterations
  "SubscribeBanner.iteration-1.tsx": SubscribeBannerIteration1 as ComponentType<Record<string, unknown>>,
  "SubscribeBanner.iteration-2.tsx": SubscribeBannerIteration2 as ComponentType<Record<string, unknown>>,
  "SubscribeBanner.iteration-3.tsx": SubscribeBannerIteration3 as ComponentType<Record<string, unknown>>,
  "SubscribeBanner.iteration-4.tsx": SubscribeBannerIteration4 as ComponentType<Record<string, unknown>>,
  // SubscriptionExpiringBanner iterations
  "SubscriptionExpiringBanner.iteration-1.tsx": SubscriptionExpiringBannerIteration1 as ComponentType<Record<string, unknown>>,
  "SubscriptionExpiringBanner.iteration-2.tsx": SubscriptionExpiringBannerIteration2 as ComponentType<Record<string, unknown>>,
  "SubscriptionExpiringBanner.iteration-3.tsx": SubscriptionExpiringBannerIteration3 as ComponentType<Record<string, unknown>>,
};

export function getIterationComponent(
  filename: string,
): ComponentType<Record<string, unknown>> | undefined {
  return iterationComponents[filename];
}
