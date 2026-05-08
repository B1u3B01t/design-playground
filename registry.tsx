import { ComponentType } from 'react';
import dynamic from 'next/dynamic';
import type { ComponentSize, CursorChatSubmitPayload, StylingMode } from './lib/constants';
import { DEFAULT_STYLING_MODE } from './lib/constants';
import { iterationPrompt } from './prompts/iteration.prompt';
import { iterationFromIterationPrompt } from './prompts/iteration-from-iteration.prompt';
import { adoptIterationPrompt } from './prompts/adopt.prompt';
import {
  elementIterationPrompt,
  elementIterationFromIterationPrompt,
} from './prompts/element-iteration.prompt';
import {
  formatChildrenSection,
  formatCustomInstructionsSection,
  formatSkillSection,
  formatScreenshotSection,
  formatElementSelectionsSection,
  getStylingConstraint,
  getStylingQualityItem,
  getQualityChecklist,
} from './prompts/shared-sections';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegistryGroupItem {
  id: string;
  label: string;
  children: RegistryItem[];
}

// Re-export ComponentSize from constants for backward compatibility
export type { ComponentSize } from './lib/constants';

export interface RegistryLeafItem {
  id: string;
  label: string;
  Component: ComponentType<Record<string, unknown>>;
  props?: Record<string, unknown>;
  getProps?: () => Promise<Record<string, unknown>> | Record<string, unknown>;
  parentId?: string; // Optional parent component id for nested discovered components
  // Iteration metadata
  sourcePath: string;
  propsInterface: string;
  childComponents?: string[]; // Child component names that can be iterated
  size?: ComponentSize; // Display size for the component preview
  useAppTheme?: boolean; // Render with the main app's CSS variables instead of playground theme
}

export type RegistryItem = RegistryGroupItem | RegistryLeafItem;

export function isGroup(item: RegistryItem): item is RegistryGroupItem {
  return 'children' in item && !('Component' in item);
}

export function isLeaf(item: RegistryItem): item is RegistryLeafItem {
  return 'Component' in item;
}

// ---------------------------------------------------------------------------
// Mock data imports
// ---------------------------------------------------------------------------

import { mockData as newsletterClientMockData } from './data/NewsletterClient.mockData';
import { mockData as editInsightClientMockData } from './data/EditInsightClient.mockData';
import { mockData as blogPostSkeletonMockData } from './data/BlogPostSkeleton.mockData';
import { mockData as subscribeBannerMockData } from './data/SubscribeBanner.mockData';
import { mockData as patternFilterDropdownMockData } from './data/PatternFilterDropdown.mockData';
import { mockData as bitesClientMockData } from './data/BitesClient.mockData';
import { mockData as insightsClientMockData } from './data/InsightsClient.mockData';
import { mockData as categoryLinksMockData } from './data/CategoryLinks.mockData';
import { mockData as categoryBitesMockData } from './data/CategoryBites.mockData';
import { mockData as biteSlugClientMockData } from './data/BiteSlugClient.mockData';
import { mockData as communityClientMockData } from './data/CommunityClient.mockData';
import { mockData as insightEditorMockData } from './data/InsightEditor.mockData';
import { mockData as communityBlogSkeletonMockData } from './data/CommunityBlogSkeleton.mockData';
import { mockData as bitesGridMockData } from './data/BitesGrid.mockData';
import { mockData as carouselMockData } from './data/Carousel.mockData';
import { mockData as articleCardMockData } from './data/ArticleCard.mockData';
import { mockData as communityBlogClientMockData } from './data/CommunityBlogClient.mockData';
import { mockData as collectionClientMockData } from './data/CollectionClient.mockData';
import { mockData as largeArticleCardMockData } from './data/LargeArticleCard.mockData';
import { mockData as ctaMockData } from './data/CTA.mockData';
import { mockData as biteDetailCardMockData } from './data/BiteDetailCard.mockData';
import { mockData as socialProofMockData } from './data/SocialProof.mockData';
import { mockData as loginPageMockData } from './data/Login.mockData';
import { mockData as teamPageMockData } from './data/Team.mockData';
import { mockData as manifestoPageMockData } from './data/Manifesto.mockData';
import { mockData as pricingPageMockData } from './data/Pricing.mockData';
import { mockData as homeMockData } from './data/Home.mockData';
import { mockData as laurelQuoteMockData } from './data/LaurelQuote.mockData';
import { mockData as heroMockData } from './data/Hero.mockData';
import { mockData as referralDiscountBannerMockData } from './data/ReferralDiscountBanner.mockData';
import { mockData as bitesPreviewMockData } from './data/BitesPreview.mockData';
import { mockData as proAccessSectionMockData } from './data/ProAccessSection.mockData';
import { mockData as insightsTeaserMockData } from './data/InsightsTeaser.mockData';

// ---------------------------------------------------------------------------
// Dynamic component imports
// ---------------------------------------------------------------------------

const NewsletterClient = dynamic(() => import('@/app/newsletter/ui/NewsletterClient')) as ComponentType<Record<string, unknown>>;
const EditInsightClient = dynamic(() => import('@/app/insights/[slug]/edit/EditInsightClient')) as ComponentType<Record<string, unknown>>;
const BlogPostSkeleton = dynamic(() => import('@/app/insights/[slug]/BlogPostSkeleton')) as ComponentType<Record<string, unknown>>;
const SubscribeBanner = dynamic(() => import('@/components/SubscribeBanner')) as ComponentType<Record<string, unknown>>;
const PatternFilterDropdown = dynamic(() => import('@/app/browse/ui/PatternFilterDropdown')) as ComponentType<Record<string, unknown>>;
const BitesClient = dynamic(() => import('@/app/browse/ui/BitesClient')) as ComponentType<Record<string, unknown>>;
const InsightsClient = dynamic(() => import('@/app/insights/ui/InsightsClient')) as ComponentType<Record<string, unknown>>;
const CategoryLinks = dynamic(() => import('@/app/categories/ui/CategoryLinks')) as ComponentType<Record<string, unknown>>;
const CategoryBites = dynamic(() => import('@/app/categories/ui/CategoryBites')) as ComponentType<Record<string, unknown>>;
const BiteSlugClient = dynamic(() => import('@/app/browse/[slug]/BiteSlugClient')) as ComponentType<Record<string, unknown>>;
const InsightEditor = dynamic(() => import('@/components/editor/InsightEditor')) as unknown as ComponentType<
  Record<string, unknown>
>;
const CommunityClient = dynamic(() => import('@/app/community/ui/CommunityClient')) as ComponentType<Record<string, unknown>>;
const CommunityBlogSkeleton = dynamic(() => import('@/app/community/[slug]/ui/CommunityBlogSkeleton')) as ComponentType<Record<string, unknown>>;
const ArticleCard = dynamic(() => import('@/components/ArticleCard')) as ComponentType<Record<string, unknown>>;
const BitesGridComponent = dynamic(() => import('@/components/BitesGrid')) as ComponentType<Record<string, unknown>>;
const Carousel = dynamic(() => import('@/components/Carousel')) as ComponentType<Record<string, unknown>>;
const CommunityBlogClient = dynamic(() => import('@/app/community/[slug]/ui/CommunityBlogClient')) as ComponentType<Record<string, unknown>>;
const CollectionClient = dynamic(() => import('@/app/collection/ui/CollectionClient')) as ComponentType<Record<string, unknown>>;
const LargeArticleCard = dynamic(() => import('@/components/LargeArticleCard')) as ComponentType<Record<string, unknown>>;
const CTA = dynamic(() => import('@/app/ui/home/CTA')) as ComponentType<Record<string, unknown>>;
const BiteDetailCard = dynamic(() => import('@/components/BiteDetailCard')) as ComponentType<Record<string, unknown>>;
const SocialProof = dynamic(() => import('@/app/ui/home/SocialProof')) as ComponentType<Record<string, unknown>>;
const LoginPage = dynamic(() => import('@/app/login/page')) as ComponentType<Record<string, unknown>>;
const TeamPage = dynamic(() => import('@/app/team/page')) as ComponentType<Record<string, unknown>>;
const ManifestoPage = dynamic(() => import('@/app/manifesto/page')) as ComponentType<Record<string, unknown>>;
const PricingPage = dynamic(() => import('@/app/pricing/page')) as ComponentType<Record<string, unknown>>;
const Home = dynamic(() => import('@/app/page')) as ComponentType<Record<string, unknown>>;
const LaurelQuote = dynamic(() => import('@/app/ui/home/LaurelQuote')) as ComponentType<Record<string, unknown>>;
const Hero = dynamic(() => import('@/app/ui/home/Hero')) as ComponentType<Record<string, unknown>>;
const ReferralDiscountBanner = dynamic(
  () => import('@/components/ReferralDiscountBanner').then(m => m.ReferralDiscountBanner as unknown as ComponentType<Record<string, unknown>>),
) as ComponentType<Record<string, unknown>>;
const BitesPreview = dynamic(() => import('@/app/ui/home/BitesPreview')) as ComponentType<Record<string, unknown>>;
const ProAccessSection = dynamic(() => import('@/app/ui/home/ProAccessSection')) as ComponentType<Record<string, unknown>>;
const InsightsTeaser = dynamic(() => import('@/app/ui/home/InsightsTeaser')) as ComponentType<Record<string, unknown>>;

// ---------------------------------------------------------------------------
// Registry tree
// ---------------------------------------------------------------------------

export const registry: RegistryItem[] = [
  // ---------------------------------------------------------------------------
  // Discovered components — added via the playground discovery flow.
  // Each entry has its own data/<ComponentName>.mockData.ts file.
  // To add a new component, run discovery → analyze in the playground UI.
  // ---------------------------------------------------------------------------
  {
    id: 'components',
    label: 'Components',
    children: [
      {
        id: 'newsletter-client',
        label: 'Newsletter',
        Component: NewsletterClient as unknown as ComponentType<Record<string, unknown>>,
        props: newsletterClientMockData as Record<string, unknown>,
        sourcePath: 'src/app/newsletter/ui/NewsletterClient.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `{}`,
      },
      {
        id: 'edit-insight-client',
        label: 'Edit Insight Client',
        Component: EditInsightClient as unknown as ComponentType<Record<string, unknown>>,
        props: editInsightClientMockData as Record<string, unknown>,
        sourcePath: 'src/app/insights/[slug]/edit/EditInsightClient.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `{ post: { id: number; slug: string; title: string; subtitle: string; excerpt: string; contentHtml: string; heroImageUrl: string; imageUrl: string; publishedAt: string; readTimeMinutes: number; isDraft: boolean; tier: 'FREE' | 'PRO'; tags: string[]; categoryId: number | null; authorId: number | null }; categories: { id: number; name: string; slug: string; image_url: string | null }[]; authors: { id: number; name: string; title: string | null; avatar_url: string | null }[] }`,
      },
      {
        id: 'blog-post-skeleton',
        label: 'Blog Post Skeleton',
        Component: BlogPostSkeleton as unknown as ComponentType<Record<string, unknown>>,
        props: blogPostSkeletonMockData as Record<string, unknown>,
        sourcePath: 'src/app/insights/[slug]/BlogPostSkeleton.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `{}`,
      },
      {
        id: 'subscribe-banner',
        label: 'SubscribeBanner',
        Component: SubscribeBanner as unknown as ComponentType<Record<string, unknown>>,
        props: subscribeBannerMockData as Record<string, unknown>,
        sourcePath: 'src/components/SubscribeBanner.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{ variant?: "full" | "sidebar" | "homepage" | "newsletter"; disableAutoFill?: boolean; title?: string; pillText?: string; subtitle?: string; footnote?: string; }`,
        parentId: 'newsletter-client',
      },
      {
        id: 'pattern-filter-dropdown',
        label: 'Pattern Filter Dropdown',
        Component: PatternFilterDropdown as unknown as ComponentType<Record<string, unknown>>,
        props: patternFilterDropdownMockData as Record<string, unknown>,
        sourcePath: 'src/app/browse/ui/PatternFilterDropdown.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{ title: string; selected: string | null; onSelect: (value: string | null) => void; groups: Record<string, string[]>; activePhase: string | null; }`,
        parentId: 'bites-client',
      },
      {
        id: 'bites-client',
        label: 'Bites Client',
        Component: BitesClient as unknown as ComponentType<Record<string, unknown>>,
        props: bitesClientMockData as Record<string, unknown>,
        sourcePath: 'src/app/browse/ui/BitesClient.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `{ items: Bite[]; totalCount?: number; filters: Record<string, string[]>; modes: string[]; platforms: string[]; limit?: number; stickyFilters?: boolean; hideHeader?: boolean; limited?: boolean; overlayBasePath?: string; patternGroups?: Record<string, string[]>; livePatternNames?: string[] }`,
      },
      {
        id: 'insights-client',
        label: 'Insights Client',
        Component: InsightsClient as unknown as ComponentType<Record<string, unknown>>,
        props: insightsClientMockData as Record<string, unknown>,
        sourcePath: 'src/app/insights/ui/InsightsClient.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `{ data: { categories: { name: string; icon?: string; image?: string; isActive?: boolean }[]; posts: { id: number | string; title: string; subtitle?: string; excerpt?: string; category: string; badge?: string; author?: string; date?: string; image?: string; slug: string; tier?: 'FREE' | 'PRO'; authorAvatar?: string }[]; recentEssays: { id: number | string; title: string; subtitle?: string; excerpt?: string; category: string; badge?: string; author?: string; date?: string; image?: string; slug: string; tier?: 'FREE' | 'PRO'; authorAvatar?: string }[] } }`,
      },
      {
        id: 'category-links',
        label: 'Category Links',
        Component: CategoryLinks as unknown as ComponentType<Record<string, unknown>>,
        props: categoryLinksMockData as Record<string, unknown>,
        sourcePath: 'src/app/categories/ui/CategoryLinks.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{ label: string; values: string[] }`,
      },
      {
        id: 'category-bites',
        label: 'Category Bites',
        Component: CategoryBites as unknown as ComponentType<Record<string, unknown>>,
        props: categoryBitesMockData as Record<string, unknown>,
        sourcePath: 'src/app/categories/ui/CategoryBites.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{ value: string; label?: string; limit?: number }`,
      },
      {
        id: 'community-client',
        label: 'Community Client',
        Component: CommunityClient as unknown as ComponentType<Record<string, unknown>>,
        props: communityClientMockData as Record<string, unknown>,
        sourcePath: 'src/app/community/ui/CommunityClient.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `{ data: { blogs: { id: number; slug: string; title: string; content?: string; authorName: string; authorImageUrl?: string; category: string; imageUrl?: string; publishedAt?: string }[]; categories: { name: string; count: number }[] } }`,
      },
      {
        id: 'community-blog-skeleton',
        label: 'Community Blog Skeleton',
        Component: CommunityBlogSkeleton as unknown as ComponentType<Record<string, unknown>>,
        props: communityBlogSkeletonMockData as Record<string, unknown>,
        sourcePath: 'src/app/community/[slug]/ui/CommunityBlogSkeleton.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `{}`,
      },
      {
        id: 'insight-editor',
        label: 'InsightEditor',
        Component: InsightEditor as unknown as ComponentType<Record<string, unknown>>,
        props: insightEditorMockData as Record<string, unknown>,
        sourcePath: 'src/components/editor/InsightEditor.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{ initialContent: string; onUpdate: (html: string) => void }`,
        parentId: 'edit-insight-client',
      },
      {
        id: 'bite-slug-client',
        label: 'Bite Slug Client',
        Component: BiteSlugClient as unknown as ComponentType<Record<string, unknown>>,
        props: biteSlugClientMockData as Record<string, unknown>,
        sourcePath: 'src/app/browse/[slug]/BiteSlugClient.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `{ initialItem: { id: string | number; slug?: string; created_at?: string; title?: string; type?: string; [key: string]: unknown }; filters: Record<string, string[]>; modes: string[]; platforms: string[] }`,
      },
      {
        id: 'article-card',
        label: 'ArticleCard',
        Component: ArticleCard as unknown as ComponentType<Record<string, unknown>>,
        props: articleCardMockData as Record<string, unknown>,
        sourcePath: 'src/components/ArticleCard.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{ post: { id: number | string; title: string; subtitle?: string; excerpt?: string; category: string; badge?: string; author?: string; date?: string; image?: string; slug: string; tier?: 'FREE' | 'PRO'; authorAvatar?: string }; category?: { name: string; icon?: string; image?: string; isActive?: boolean }; variant?: 'minimal' | 'expanded'; className?: string; onClick?: () => void }`,
        parentId: 'insights-client',
      },
      {
        id: 'bites-grid',
        label: 'BitesGrid',
        Component: BitesGridComponent as unknown as ComponentType<Record<string, unknown>>,
        props: bitesGridMockData as Record<string, unknown>,
        sourcePath: 'src/components/BitesGrid.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{ items: BitesGridItem[]; columns?: 1 | 2 | 3 | 4; onItemClick?: (item: BitesGridItem) => void; paused?: boolean; }`,
        parentId: 'category-bites',
      },
      {
        id: 'carousel',
        label: 'Carousel',
        Component: Carousel as unknown as ComponentType<Record<string, unknown>>,
        props: carouselMockData as Record<string, unknown>,
        sourcePath: 'src/components/Carousel.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{ items: CarouselItem[]; currentIndex: number; onNavigate: (idx: number) => void; onClose: () => void; Detail: (props: { item: CarouselItem; onClose: () => void; expanded: boolean }) => ReactElement; }`,
        parentId: 'bites-client',
      },
      {
        id: 'collection-client',
        label: 'Collection Client',
        Component: CollectionClient as unknown as ComponentType<Record<string, unknown>>,
        props: collectionClientMockData as Record<string, unknown>,
        sourcePath: 'src/app/collection/ui/CollectionClient.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{ bites: { id: number | string; title?: string; pattern?: string | null; type?: string | null; video_id?: string | null; thumbnail_url?: string | null; logo?: string | null; screenshots?: string[] | null; published_at?: string | null }[] }`,
      },
      {
        id: 'large-article-card',
        label: 'LargeArticleCard',
        Component: LargeArticleCard as unknown as ComponentType<Record<string, unknown>>,
        props: largeArticleCardMockData as Record<string, unknown>,
        sourcePath: 'src/components/LargeArticleCard.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{ post: { id: number | string; title: string; subtitle?: string; excerpt?: string; category: string; badge?: string; author?: string; date?: string; image?: string; slug: string; tier?: 'FREE' | 'PRO'; authorAvatar?: string }; category?: { name: string; icon?: string; image?: string; isActive?: boolean }; variant?: 'large' | 'compact'; className?: string; onClick?: () => void }`,
        parentId: 'insights-client',
      },
      {
        id: 'cta',
        label: 'CTA',
        Component: CTA as unknown as ComponentType<Record<string, unknown>>,
        props: ctaMockData as Record<string, unknown>,
        sourcePath: 'src/app/ui/home/CTA.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{ overlay?: boolean; primaryQuoteText?: string; subText?: string; avatarUrl?: string; }`,
        parentId: 'bites-client',
      },
      {
        id: 'bite-detail-card',
        label: 'BiteDetailCard',
        Component: BiteDetailCard as unknown as ComponentType<Record<string, unknown>>,
        props: biteDetailCardMockData as Record<string, unknown>,
        sourcePath: 'src/components/BiteDetailCard.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{ item: { id: number | string; slug?: string; title?: string; subtitle?: string; media_source?: string | null; date?: string; tags?: string[]; type?: string; description?: string; thumbnail_url?: string | null; url?: string | null; video?: string | null; videoId?: string | null; gif?: string | null; poster?: string | null; patterns?: string[] | null }; onClose: () => void; expanded?: boolean; showRelated?: boolean }`,
        parentId: 'bites-client',
      },
      {
        id: 'social-proof',
        label: 'SocialProof',
        Component: SocialProof as unknown as ComponentType<Record<string, unknown>>,
        props: socialProofMockData as Record<string, unknown>,
        sourcePath: 'src/app/ui/home/SocialProof.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{}`,
        parentId: 'community-client',
      },
      {
        id: 'login-page',
        label: 'Login',
        Component: LoginPage as unknown as ComponentType<Record<string, unknown>>,
        props: loginPageMockData as Record<string, unknown>,
        sourcePath: 'src/app/login/page.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `{}`,
      },
      {
        id: 'team-page',
        label: 'Team',
        Component: TeamPage as unknown as ComponentType<Record<string, unknown>>,
        props: teamPageMockData as Record<string, unknown>,
        sourcePath: 'src/app/team/page.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `{}`,
      },
      {
        id: 'manifesto-page',
        label: 'Manifesto',
        Component: ManifestoPage as unknown as ComponentType<Record<string, unknown>>,
        props: manifestoPageMockData as Record<string, unknown>,
        sourcePath: 'src/app/manifesto/page.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `{}`,
      },
      {
        id: 'pricing-page',
        label: 'Pricing',
        Component: PricingPage as unknown as ComponentType<Record<string, unknown>>,
        props: pricingPageMockData as Record<string, unknown>,
        sourcePath: 'src/app/pricing/page.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `{}`,
      },
      {
        id: 'home',
        label: 'Home',
        Component: Home as unknown as ComponentType<Record<string, unknown>>,
        props: homeMockData as Record<string, unknown>,
        sourcePath: 'src/app/page.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `{}`,
      },
      {
        id: 'hero',
        label: 'Hero',
        Component: Hero as unknown as ComponentType<Record<string, unknown>>,
        props: heroMockData as Record<string, unknown>,
        sourcePath: 'src/app/ui/home/Hero.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `{}`,
        parentId: 'home',
      },
      {
        id: 'bites-preview',
        label: 'BitesPreview',
        Component: BitesPreview as unknown as ComponentType<Record<string, unknown>>,
        props: bitesPreviewMockData as Record<string, unknown>,
        sourcePath: 'src/app/ui/home/BitesPreview.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{}`,
        parentId: 'home',
      },
      {
        id: 'laurel-quote',
        label: 'LaurelQuote',
        Component: LaurelQuote as unknown as ComponentType<Record<string, unknown>>,
        props: laurelQuoteMockData as Record<string, unknown>,
        sourcePath: 'src/app/ui/home/LaurelQuote.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{ quote?: string; primaryQuote?: string; secondaryQuote?: string; subtext?: string; className?: string; avatarUrl?: string; avatarAlt?: string; }`,
        parentId: 'pricing-page',
      },
      {
        id: 'pro-access-section',
        label: 'ProAccessSection',
        Component: ProAccessSection as unknown as ComponentType<Record<string, unknown>>,
        props: proAccessSectionMockData as Record<string, unknown>,
        sourcePath: 'src/app/ui/home/ProAccessSection.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{}`,
        parentId: 'home',
      },
      {
        id: 'referral-discount-banner',
        label: 'ReferralDiscountBanner',
        Component: ReferralDiscountBanner as unknown as ComponentType<Record<string, unknown>>,
        props: referralDiscountBannerMockData as Record<string, unknown>,
        sourcePath: 'src/components/ReferralDiscountBanner.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{}`,
        parentId: 'pricing-page',
      },
      {
        id: 'insights-teaser',
        label: 'InsightsTeaser',
        Component: InsightsTeaser as unknown as ComponentType<Record<string, unknown>>,
        props: insightsTeaserMockData as Record<string, unknown>,
        sourcePath: 'src/app/ui/home/InsightsTeaser.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `{}`,
        parentId: 'home',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Flatten helper
// ---------------------------------------------------------------------------

export function flattenRegistry(
  items: RegistryItem[],
  result: Record<string, RegistryLeafItem> = {}
): Record<string, RegistryLeafItem> {
  for (const item of items) {
    if (isLeaf(item)) {
      result[item.id] = item;
    } else if (isGroup(item)) {
      flattenRegistry(item.children, result);
    }
  }
  return result;
}

export const flatRegistry = flattenRegistry(registry);

/**
 * Preload all dynamic components in the registry.
 * Calling .preload() on a next/dynamic component triggers chunk compilation
 * without rendering, preventing HMR cascades when components are first dropped
 * onto the canvas in dev mode.
 */
export function preloadAllComponents(): void {
  for (const item of Object.values(flatRegistry)) {
    const Component = item.Component as ComponentType<Record<string, unknown>> & { preload?: () => void };
    if (typeof Component?.preload === 'function') {
      Component.preload();
    }
  }
}

// ---------------------------------------------------------------------------
// Registry resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a component by ID from the flat registry.
 * All components — examples and discovered — live in the registry tree above.
 */
export function resolveRegistryItem(componentId: string): RegistryLeafItem | null {
  return flatRegistry[componentId] ?? null;
}

/**
 * Convert a kebab-case registry ID to PascalCase.
 * e.g. "manifesto-page" → "ManifestoPage", "signup-form" → "SignupForm"
 *
 * This is used for iteration filenames so that the filename prefix can be
 * reliably converted back to the registry ID via the inverse transformation
 * (PascalCase → kebab-case) during iteration scanning.
 */
export function registryIdToPascalCase(id: string): string {
  return id.replace(/(^|-)([a-z])/g, (_, _sep, char) => char.toUpperCase());
}

// ---------------------------------------------------------------------------
// Prompt generator
// ---------------------------------------------------------------------------

export function generateIterationPrompt(
  componentId: string,
  iterationCount: number = 4,
  startNumber: number = 1,
  depth: 'shell' | '1-level' | 'all' = 'shell',
  customInstructions?: string,
  skillPrompt?: string,
  stylingMode: StylingMode = DEFAULT_STYLING_MODE,
  screenshotPath?: string,
  referenceNodesSection?: string,
): string {
  const item = resolveRegistryItem(componentId);
  if (!item) return '';

  const componentName = item.label.replace(/\s*\(.*\)/, '');
  const cleanComponentName = registryIdToPascalCase(componentId);
  const depthLabel = depth === 'shell' ? 'Shell only' : depth === '1-level' ? '1 level deep' : 'All levels';

  const childrenSection = formatChildrenSection(item.childComponents);
  const customInstructionsSection = formatCustomInstructionsSection(customInstructions);
  const skillSection = formatSkillSection(skillPrompt);

  const iterationNumbers = Array.from(
    { length: iterationCount },
    (_, i) => startNumber + i,
  );

  const iterationSavesBlock = iterationNumbers
    .map((n) => `   - Save as src/app/playground/iterations/${cleanComponentName}.iteration-${n}.tsx`)
    .join('\n');

  return iterationPrompt({
    skillSection,
    componentName,
    sourcePath: item.sourcePath,
    iterationCount: String(iterationCount),
    depthLabel,
    childrenSection,
    propsInterface: item.propsInterface,
    cleanComponentName,
    componentId,
    customInstructionsSection,
    stylingConstraint: getStylingConstraint(stylingMode),
    qualityChecklist: getQualityChecklist(stylingMode),
    iterationNumbersList: iterationNumbers.join(', '),
    iterationSavesBlock,
    screenshotSection: formatScreenshotSection(screenshotPath),
    referenceNodesSection: referenceNodesSection || '',
  });
}

// ---------------------------------------------------------------------------
// Iteration-from-iteration prompt generator
// ---------------------------------------------------------------------------

export function generateIterationFromIterationPrompt(
  componentId: string,
  sourceIterationFilename: string,
  iterationCount: number,
  startNumber: number,
  depth: 'shell' | '1-level' | 'all' = 'shell',
  customInstructions?: string,
  skillPrompt?: string,
  stylingMode: StylingMode = DEFAULT_STYLING_MODE,
  screenshotPath?: string,
  referenceNodesSection?: string,
): string {
  const item = resolveRegistryItem(componentId);
  if (!item) return '';

  const componentName = item.label.replace(/\s*\(.*\)/, '');
  const cleanComponentName = registryIdToPascalCase(componentId);
  const depthLabel = depth === 'shell' ? 'Shell only' : depth === '1-level' ? '1 level deep' : 'All levels';
  const endNumber = startNumber + iterationCount - 1;
  const iterationSourcePath = `src/app/playground/iterations/${sourceIterationFilename}`;

  const childrenSection = formatChildrenSection(item.childComponents);
  const customInstructionsSection = formatCustomInstructionsSection(customInstructions);
  const skillSection = formatSkillSection(skillPrompt);

  const iterationNumbers = Array.from(
    { length: iterationCount },
    (_, i) => startNumber + i,
  );

  const iterationSavesBlock = iterationNumbers
    .map((n) => `   - Save as src/app/playground/iterations/${cleanComponentName}.iteration-${n}.tsx`)
    .join('\n');

  return iterationFromIterationPrompt({
    skillSection,
    componentName,
    sourcePath: item.sourcePath,
    iterationSourcePath,
    iterationCount: String(iterationCount),
    startNumber: String(startNumber),
    endNumber: String(endNumber),
    depthLabel,
    childrenSection,
    propsInterface: item.propsInterface,
    iterationSavesBlock,
    treeParent: sourceIterationFilename,
    customInstructionsSection,
    iterationNumbersList: iterationNumbers.join(', '),
    sourceIterationFilename,
    stylingConstraint: getStylingConstraint(stylingMode),
    screenshotSection: formatScreenshotSection(screenshotPath),
    referenceNodesSection: referenceNodesSection || '',
  });
}

// ---------------------------------------------------------------------------
// Element-targeted iteration prompt generator
// ---------------------------------------------------------------------------

export function generateElementIterationPrompt(
  componentId: string,
  startNumber: number,
  iterationCount: number,
  depth: 'shell' | '1-level' | 'all' = 'all',
  elementSelections: CursorChatSubmitPayload['elementSelections'],
  customInstructions?: string,
  skillPrompt?: string,
  stylingMode: StylingMode = DEFAULT_STYLING_MODE,
  screenshotPath?: string,
  referenceNodesSection?: string,
): string {
  const item = flatRegistry[componentId];
  if (!item) return '';

  const componentName = item.label.replace(/\s*\(.*\)/, '');
  const cleanComponentName = registryIdToPascalCase(componentId);
  const depthLabel = depth === 'shell' ? 'Shell only' : depth === '1-level' ? '1 level deep' : 'All levels';

  const childrenSection = formatChildrenSection(item.childComponents);
  const customInstructionsSection = formatCustomInstructionsSection(customInstructions);
  const skillSection = formatSkillSection(skillPrompt);
  const elementSelectionsSection = formatElementSelectionsSection(elementSelections);

  const iterationNumbers = Array.from(
    { length: iterationCount },
    (_, i) => startNumber + i,
  );

  const iterationSavesBlock = iterationNumbers
    .map((n) => `   - Save as src/app/playground/iterations/${cleanComponentName}.iteration-${n}.tsx`)
    .join('\n');

  return elementIterationPrompt({
    skillSection,
    componentName,
    sourcePath: item.sourcePath,
    depthLabel,
    childrenSection,
    propsInterface: item.propsInterface,
    cleanComponentName,
    componentId,
    customInstructionsSection,
    elementSelectionsSection,
    iterationCount: String(iterationCount),
    iterationNumbersList: iterationNumbers.join(', '),
    iterationSavesBlock,
    stylingQualityItem: getStylingQualityItem(stylingMode),
    screenshotSection: formatScreenshotSection(screenshotPath),
    referenceNodesSection: referenceNodesSection || '',
  });
}

export function generateElementIterationFromIterationPrompt(
  componentId: string,
  sourceIterationFilename: string,
  startNumber: number,
  iterationCount: number,
  depth: 'shell' | '1-level' | 'all' = 'all',
  elementSelections: CursorChatSubmitPayload['elementSelections'],
  customInstructions?: string,
  skillPrompt?: string,
  stylingMode: StylingMode = DEFAULT_STYLING_MODE,
  screenshotPath?: string,
  referenceNodesSection?: string,
): string {
  const item = flatRegistry[componentId];
  if (!item) return '';

  const componentName = item.label.replace(/\s*\(.*\)/, '');
  const cleanComponentName = registryIdToPascalCase(componentId);
  const depthLabel = depth === 'shell' ? 'Shell only' : depth === '1-level' ? '1 level deep' : 'All levels';
  const iterationSourcePath = `src/app/playground/iterations/${sourceIterationFilename}`;

  const childrenSection = formatChildrenSection(item.childComponents);
  const customInstructionsSection = formatCustomInstructionsSection(customInstructions);
  const skillSection = formatSkillSection(skillPrompt);
  const elementSelectionsSection = formatElementSelectionsSection(elementSelections);

  const iterationNumbers = Array.from(
    { length: iterationCount },
    (_, i) => startNumber + i,
  );

  const iterationSavesBlock = iterationNumbers
    .map((n) => `   - Save as src/app/playground/iterations/${cleanComponentName}.iteration-${n}.tsx`)
    .join('\n');

  return elementIterationFromIterationPrompt({
    skillSection,
    componentName,
    sourcePath: item.sourcePath,
    iterationSourcePath,
    depthLabel,
    childrenSection,
    propsInterface: item.propsInterface,
    cleanComponentName,
    componentId,
    customInstructionsSection,
    elementSelectionsSection,
    iterationCount: String(iterationCount),
    iterationNumbersList: iterationNumbers.join(', '),
    iterationSavesBlock,
    treeParent: sourceIterationFilename,
    sourceIterationFilename,
    stylingQualityItem: getStylingQualityItem(stylingMode),
    screenshotSection: formatScreenshotSection(screenshotPath),
    referenceNodesSection: referenceNodesSection || '',
  });
}

// ---------------------------------------------------------------------------
// Adopt prompt generator
// ---------------------------------------------------------------------------

export function generateAdoptPrompt(
  componentId: string,
  iterationFilename: string
): string {
  const item = resolveRegistryItem(componentId);
  const originalPath = item?.sourcePath || `src/components/${iterationFilename.split('.iteration')[0]}.tsx`;
  const iterationPath = `src/app/playground/iterations/${iterationFilename}`;

  return adoptIterationPrompt({ originalPath, iterationPath });
}
