// Static mock props for discovered components.
// Add a new entry here whenever a component is added to discovered/index.ts so
// that IterationNode can render its iteration variants with realistic data.

import { mockPost as articleCardPost, mockCategory as articleCardCategory } from './ArticleCard.discovered';
import { mockInsightsData } from './Insights.discovered';

export const discoveredProps: Record<string, Record<string, unknown>> = {
  'article-card': { post: articleCardPost, category: articleCardCategory },
  'insights-page': { data: mockInsightsData },
};
