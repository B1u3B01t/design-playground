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
import { mockData as glossaryPageMockData } from './data/Glossary.mockData';
import { mockData as signupMockData } from './data/Signup.mockData';
import { mockData as collectionGridClientMockData } from './data/CollectionGridClient.mockData';
import { mockData as subscribeBannerMockData } from './data/SubscribeBanner.mockData';
import { mockData as signupFormMockData } from './data/SignupForm.mockData';
import { mockData as planCardsMockData } from './data/PlanCards.mockData';
import { mockData as logoMarqueeMockData } from './data/LogoMarquee.mockData';
import { mockData as playPauseButtonMockData } from './data/PlayPauseButton.mockData';
import { mockData as homeMockData } from './data/Home.mockData';
import { mockData as heroMockData } from './data/Hero.mockData';
import { mockData as bitesPreviewMockData } from './data/BitesPreview.mockData';
import { mockData as proAccessSectionMockData } from './data/ProAccessSection.mockData';
import { mockData as socialProofMockData } from './data/SocialProof.mockData';
import { mockData as rewind2025PageMockData } from './data/2025Rewind.mockData';
import { mockData as insightsTeaserMockData } from './data/InsightsTeaser.mockData';
import { mockData as bunnyStreamPlayerMockData } from './data/BunnyStreamPlayer.mockData';
import { mockData as bitesClientMockData } from './data/BitesClient.mockData';
import { mockData as biteSlugClientMockData } from './data/BiteSlugClient.mockData';
import { mockData as categoryLinksMockData } from './data/CategoryLinks.mockData';
import { mockData as categoryBitesMockData } from './data/CategoryBites.mockData';
import { mockData as changelogPageMockData } from './data/Changelog.mockData';
import { mockData as communityClientMockData } from './data/CommunityClient.mockData';
import { mockData as communityBlogClientMockData } from './data/CommunityBlogClient.mockData';
import { mockData as collectionShareButtonMockData } from './data/CollectionShareButton.mockData';
import { mockData as createCollectionsInteractiveButtonMockData } from './data/CreateCollectionsInteractiveButton.mockData';
import { mockData as createCollectionsInteractiveCardMockData } from './data/CreateCollectionsInteractiveCard.mockData';
import { mockData as forgotPasswordPageMockData } from './data/ForgotPassword.mockData';
import { mockData as loginPageMockData } from './data/Login.mockData';
import { mockData as blogPostClientMockData } from './data/BlogPostClient.mockData';
import { mockData as insightsClientMockData } from './data/InsightsClient.mockData';
import { mockData as manifestoPageMockData } from './data/Manifesto.mockData';
import { mockData as collectionsProBannerMockData } from './data/CollectionsProBanner.mockData';
import { mockData as deleteCollectionButtonMockData } from './data/DeleteCollectionButton.mockData';
import { mockData as aiuxPatternsClientMockData } from './data/AIUXPatternsClient.mockData';
import { mockData as pricingPageMockData } from './data/Pricing.mockData';
import { mockData as patternContentClientMockData } from './data/PatternContentClient.mockData';
import { mockData as laurelQuoteMockData } from './data/LaurelQuote.mockData';
import { mockData as referralDiscountBannerMockData } from './data/ReferralDiscountBanner.mockData';


const GlossaryPage = dynamic(() => import('@/app/glossary/page')) as ComponentType<Record<string, unknown>>;
const SignupPage = dynamic(() => import('@/app/signup/page')) as ComponentType<Record<string, unknown>>;
const CollectionGridClient = dynamic(
  () => import('@/app/collection/ui/CollectionGridClient'),
) as ComponentType<Record<string, unknown>>;
const SignupForm = dynamic(
  () => import('@/app/signup/SignupForm').then(m => m.SignupForm as unknown as ComponentType<Record<string, unknown>>),
) as ComponentType<Record<string, unknown>>;
const SubscribeBanner = dynamic(() => import('@/components/SubscribeBanner')) as ComponentType<Record<string, unknown>>;
const PlanCards = dynamic(
  () => import('@/app/signup/PlanCards').then(m => m.PlanCards as unknown as ComponentType<Record<string, unknown>>),
) as ComponentType<Record<string, unknown>>;
const LogoMarquee = dynamic(
  () => import('@/app/signup/LogoMarquee').then(m => m.LogoMarquee as unknown as ComponentType<Record<string, unknown>>),
) as ComponentType<Record<string, unknown>>;
const PlayPauseButton = dynamic(() => import('@/app/collection/ui/PlayPauseButton')) as ComponentType<Record<string, unknown>>;
const Home = dynamic(() => import('@/app/page')) as ComponentType<Record<string, unknown>>;
const Hero = dynamic(() => import('@/app/ui/home/Hero')) as ComponentType<Record<string, unknown>>;
const BitesPreview = dynamic(() => import('@/app/ui/home/BitesPreview')) as ComponentType<Record<string, unknown>>;
const ProAccessSection = dynamic(() => import('@/app/ui/home/ProAccessSection')) as ComponentType<Record<string, unknown>>;
const SocialProof = dynamic(() => import('@/app/ui/home/SocialProof')) as ComponentType<Record<string, unknown>>;
const Rewind2025Page = dynamic(() => import('@/app/2025/page')) as ComponentType<Record<string, unknown>>;
const InsightsTeaser = dynamic(() => import('@/app/ui/home/InsightsTeaser')) as ComponentType<Record<string, unknown>>;
const BunnyStreamPlayer = dynamic(() => import('@/components/BunnyStreamPlayer')) as ComponentType<Record<string, unknown>>;
const BitesClient = dynamic(() => import('@/app/browse/ui/BitesClient')) as ComponentType<Record<string, unknown>>;
const BiteSlugClient = dynamic(() => import('@/app/browse/[slug]/BiteSlugClient')) as ComponentType<Record<string, unknown>>;
const CategoryLinks = dynamic(() => import('@/app/categories/ui/CategoryLinks')) as ComponentType<Record<string, unknown>>;
const CategoryBites = dynamic(() => import('@/app/categories/ui/CategoryBites')) as ComponentType<Record<string, unknown>>;
const ChangelogPage = dynamic(() => import('@/app/changelog/page')) as ComponentType<Record<string, unknown>>;
const CommunityClient = dynamic(() => import('@/app/community/ui/CommunityClient')) as ComponentType<Record<string, unknown>>;
const CommunityBlogClient = dynamic(() => import('@/app/community/[slug]/ui/CommunityBlogClient')) as ComponentType<Record<string, unknown>>;
const CollectionShareButton = dynamic(() => import('@/app/collection/ui/CollectionShareButton')) as ComponentType<Record<string, unknown>>;
const CreateCollectionsInteractiveButton = dynamic(
  () => import('@/app/collection/ui/CreateCollectionsInteractive').then(m => m.CreateCollectionsInteractiveButton as unknown as ComponentType<Record<string, unknown>>),
) as ComponentType<Record<string, unknown>>;
const CreateCollectionsInteractiveCard = dynamic(
  () => import('@/app/collection/ui/CreateCollectionsInteractive').then(m => m.CreateCollectionsInteractiveCard as unknown as ComponentType<Record<string, unknown>>),
) as ComponentType<Record<string, unknown>>;
const ForgotPasswordPage = dynamic(() => import('@/app/forgot-password/page')) as ComponentType<Record<string, unknown>>;
const LoginPage = dynamic(() => import('@/app/login/page')) as ComponentType<Record<string, unknown>>;
const BlogPostClient = dynamic(() => import('@/app/insights/[slug]/BlogPostClient')) as ComponentType<Record<string, unknown>>;
const InsightsClient = dynamic(() => import('@/app/insights/ui/InsightsClient')) as ComponentType<Record<string, unknown>>;
const CollectionsProBanner = dynamic(() => import('@/app/collection/ui/CollectionsProBanner')) as ComponentType<Record<string, unknown>>;
const ManifestoPage = dynamic(() => import('@/app/manifesto/page')) as ComponentType<Record<string, unknown>>;
const AIUXPatternsClient = dynamic(() => import('@/app/patterns/ui/AIUXPatternsClient')) as ComponentType<Record<string, unknown>>;
const DeleteCollectionButton = dynamic(() => import('@/app/collection/ui/DeleteCollectionButton')) as ComponentType<Record<string, unknown>>;
const PricingPageComponent = dynamic(() => import('@/app/pricing/page')) as ComponentType<Record<string, unknown>>;
const PatternContentClient = dynamic(() => import('@/app/patterns/[slug]/PatternContentClient')) as ComponentType<Record<string, unknown>>;
const LaurelQuote = dynamic(() => import('@/app/ui/home/LaurelQuote')) as ComponentType<Record<string, unknown>>;
const ReferralDiscountBanner = dynamic(
  () => import('@/components/ReferralDiscountBanner').then(m => m.ReferralDiscountBanner as unknown as ComponentType<Record<string, unknown>>),
) as ComponentType<Record<string, unknown>>;


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
        id: 'glossary-page',
        label: 'Glossary',
        Component: GlossaryPage as unknown as ComponentType<Record<string, unknown>>,
        props: glossaryPageMockData as Record<string, unknown>,
        sourcePath: 'src/app/glossary/page.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `// GlossaryPage takes no props`,
      },
      {
        id: 'signup',
        label: 'Signup',
        Component: SignupPage as unknown as ComponentType<Record<string, unknown>>,
        props: signupMockData as Record<string, unknown>,
        sourcePath: 'src/app/signup/page.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `// SignupPage takes no props`,
      },
      {
        id: 'collection-grid-client',
        label: 'CollectionGridClient',
        Component: CollectionGridClient as unknown as ComponentType<Record<string, unknown>>,
        props: collectionGridClientMockData as Record<string, unknown>,
        sourcePath: 'src/app/collection/ui/CollectionGridClient.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `interface CollectionGridClientProps {
  items: {
    id: number | string;
    videoId?: string | null;
    poster?: string | null;
    title?: string;
    macro?: string;
    logo?: string | null;
    publishedAt?: string | null;
    slug?: string | null;
  }[];
  interactions: Array<Record<string, unknown> & { id: number | string; slug: string; published_at?: string | null }>;
  overlayBasePath: string;
}`,
        parentId: 'collection-detail-page',
      },
      {
        id: 'subscribe-banner',
        label: 'SubscribeBanner',
        Component: SubscribeBanner as unknown as ComponentType<Record<string, unknown>>,
        props: subscribeBannerMockData as Record<string, unknown>,
        sourcePath: 'src/components/SubscribeBanner.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `interface SubscribeBannerProps {
  variant?: "full" | "sidebar" | "homepage";
  disableAutoFill?: boolean;
  title?: string;
  pillText?: string;
  subtitle?: string;
}`,
        parentId: 'glossary-page',
      },
      {
        id: 'signup-form',
        label: 'SignupForm',
        Component: SignupForm as unknown as ComponentType<Record<string, unknown>>,
        props: signupFormMockData as Record<string, unknown>,
        sourcePath: 'src/app/signup/SignupForm.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `interface SignupFormProps {
  fullName: string;
  setFullName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  loading: boolean;
  error: string | null;
  emailSent: boolean;
  setEmailSent: (value: boolean) => void;
  onEmailSignup: (e: React.FormEvent) => void;
  onGoogleSignup: () => void;
  callbackUrl: string;
}`,
        parentId: 'signup',
      },
      {
        id: 'plan-cards',
        label: 'PlanCards',
        Component: PlanCards as unknown as ComponentType<Record<string, unknown>>,
        props: planCardsMockData as Record<string, unknown>,
        sourcePath: 'src/app/signup/PlanCards.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `interface PlanCardsProps {
  selectedPlan: "free" | "pro" | "team";
  onSelectPlan: (plan: Plan) => void;
  billingCycle: "annual" | "quarterly";
  onBillingCycleChange: (cycle: BillingCycle) => void;
  firstName: string;
}`,
        parentId: 'signup',
      },
      {
        id: 'logo-marquee',
        label: 'LogoMarquee',
        Component: LogoMarquee as unknown as ComponentType<Record<string, unknown>>,
        props: logoMarqueeMockData as Record<string, unknown>,
        sourcePath: 'src/app/signup/LogoMarquee.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `// LogoMarquee takes no props`,
        parentId: 'signup',
      },
      {
        id: 'play-pause-button',
        label: 'PlayPauseButton',
        Component: PlayPauseButton as unknown as ComponentType<Record<string, unknown>>,
        props: playPauseButtonMockData as Record<string, unknown>,
        sourcePath: 'src/app/collection/ui/PlayPauseButton.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `// PlayPauseButton takes no props — uses useBrowseStore and useUserStore internally`,
        parentId: 'collection-detail-page',
      },
      {
        id: 'home',
        label: 'Home',
        Component: Home as unknown as ComponentType<Record<string, unknown>>,
        props: homeMockData as Record<string, unknown>,
        sourcePath: 'src/app/page.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `// Home takes no props`,
      },
      {
        id: 'hero',
        label: 'Hero',
        Component: Hero as unknown as ComponentType<Record<string, unknown>>,
        props: heroMockData as Record<string, unknown>,
        sourcePath: 'src/app/ui/home/Hero.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `// Hero takes no props — uses internal data from company-logos.json`,
        parentId: 'home',
      },
      {
        id: 'bites-preview',
        label: 'BitesPreview',
        Component: BitesPreview as unknown as ComponentType<Record<string, unknown>>,
        props: bitesPreviewMockData as Record<string, unknown>,
        sourcePath: 'src/app/ui/home/BitesPreview.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `// BitesPreview takes no props — fetches data internally via useEffect`,
        parentId: 'home',
      },
      {
        id: 'social-proof',
        label: 'SocialProof',
        Component: SocialProof as unknown as ComponentType<Record<string, unknown>>,
        props: socialProofMockData as Record<string, unknown>,
        sourcePath: 'src/app/ui/home/SocialProof.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `// SocialProof takes no props`,
        parentId: 'home',
      },
      {
        id: 'pro-access-section',
        label: 'ProAccessSection',
        Component: ProAccessSection as unknown as ComponentType<Record<string, unknown>>,
        props: proAccessSectionMockData as Record<string, unknown>,
        sourcePath: 'src/app/ui/home/ProAccessSection.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `// ProAccessSection takes no props — all content is hardcoded internally`,
        parentId: 'home',
      },
      {
        id: 'rewind-2025-page',
        label: '2025 Rewind',
        Component: Rewind2025Page as unknown as ComponentType<Record<string, unknown>>,
        props: rewind2025PageMockData as Record<string, unknown>,
        sourcePath: 'src/app/2025/page.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `// Rewind2025Page takes no props — reads data from rewind2025.json`,
      },
      {
        id: 'bunny-stream-player',
        label: 'BunnyStreamPlayer',
        Component: BunnyStreamPlayer as unknown as ComponentType<Record<string, unknown>>,
        props: bunnyStreamPlayerMockData as Record<string, unknown>,
        sourcePath: 'src/components/BunnyStreamPlayer.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `interface BunnyStreamPlayerProps {
  videoId: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  className?: string;
}`,
        parentId: 'rewind-2025-page',
      },
      {
        id: 'insights-teaser',
        label: 'InsightsTeaser',
        Component: InsightsTeaser as unknown as ComponentType<Record<string, unknown>>,
        props: insightsTeaserMockData as Record<string, unknown>,
        sourcePath: 'src/app/ui/home/InsightsTeaser.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `// InsightsTeaser takes no props — fetches data internally via useEffect from Supabase`,
        parentId: 'home',
      },
      {
        id: 'bites-client',
        label: 'Browse',
        Component: BitesClient as unknown as ComponentType<Record<string, unknown>>,
        props: bitesClientMockData as Record<string, unknown>,
        sourcePath: 'src/app/browse/ui/BitesClient.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `interface BitesClientProps {
  items: Bite[];
  totalCount?: number;
  filters: Record<string, string[]>;
  modes: string[];
  platforms: string[];
  limit?: number;
  stickyFilters?: boolean;
  hideHeader?: boolean;
  limited?: boolean;
  overlayBasePath?: string;
  patternGroups?: Record<string, string[]>;
  livePatternNames?: string[];
}`,
      },
      {
        id: 'bite-slug-client',
        label: 'Browse Detail',
        Component: BiteSlugClient as unknown as ComponentType<Record<string, unknown>>,
        props: biteSlugClientMockData as Record<string, unknown>,
        sourcePath: 'src/app/browse/[slug]/BiteSlugClient.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `interface BiteSlugClientProps {
  initialItem: Bite;
  filters: Record<string, string[]>;
  modes: string[];
  platforms: string[];
}`,
      },
      {
        id: 'category-links',
        label: 'Categories',
        Component: CategoryLinks as unknown as ComponentType<Record<string, unknown>>,
        props: categoryLinksMockData as Record<string, unknown>,
        sourcePath: 'src/app/categories/ui/CategoryLinks.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `interface CategoryLinksProps {
  label: string;
  values: string[];
}`,
      },
      {
        id: 'category-bites',
        label: 'Category Detail',
        Component: CategoryBites as unknown as ComponentType<Record<string, unknown>>,
        props: categoryBitesMockData as Record<string, unknown>,
        sourcePath: 'src/app/categories/ui/CategoryBites.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `interface CategoryBitesProps {
  value: string;
  label?: string;
  limit?: number;
}`,
      },
      {
        id: 'changelog-page',
        label: 'Changelog',
        Component: ChangelogPage as unknown as ComponentType<Record<string, unknown>>,
        props: changelogPageMockData as Record<string, unknown>,
        sourcePath: 'src/app/changelog/page.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `// ChangelogPage takes no props`,
      },
      {
        id: 'community-client',
        label: 'Community',
        Component: CommunityClient as unknown as ComponentType<Record<string, unknown>>,
        props: communityClientMockData as Record<string, unknown>,
        sourcePath: 'src/app/community/ui/CommunityClient.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `interface CommunityClientProps {
  data: {
    blogs: {
      id: number;
      slug: string;
      title: string;
      content?: string;
      authorName: string;
      authorImageUrl?: string;
      category: string;
      imageUrl?: string;
      publishedAt?: string;
    }[];
    categories: { name: string; count: number }[];
  };
}`,
      },
      {
        id: 'community-blog-client',
        label: 'CommunityBlogClient',
        Component: CommunityBlogClient as unknown as ComponentType<Record<string, unknown>>,
        props: communityBlogClientMockData as Record<string, unknown>,
        sourcePath: 'src/app/community/[slug]/ui/CommunityBlogClient.tsx',
        size: 'laptop' as ComponentSize,
        parentId: 'community-blog-client',
        propsInterface: `type CommunityBlogClientProps = {
  blog: {
    id: number;
    slug: string;
    title: string;
    content: string;
    authorName: string;
    authorImageUrl?: string;
    authorSocial?: string;
    authorDesignation?: string;
    category: string;
    imageUrl?: string;
    publishedAt?: string;
  } | null;
  relatedBlogs: {
    id: number;
    slug: string;
    title: string;
    publishedAt?: string;
  }[];
}`,
      },
      {
        id: 'create-collections-interactive-button',
        label: 'CreateCollectionsInteractiveButton',
        Component: CreateCollectionsInteractiveButton as unknown as ComponentType<Record<string, unknown>>,
        props: createCollectionsInteractiveButtonMockData as Record<string, unknown>,
        sourcePath: 'src/app/collection/ui/CreateCollectionsInteractive.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `// CreateCollectionsInteractiveButton takes no props — all state is internal`,
        parentId: 'collections-page',
      },
      {
        id: 'create-collections-interactive-card',
        label: 'CreateCollectionsInteractiveCard',
        Component: CreateCollectionsInteractiveCard as unknown as ComponentType<Record<string, unknown>>,
        props: createCollectionsInteractiveCardMockData as Record<string, unknown>,
        sourcePath: 'src/app/collection/ui/CreateCollectionsInteractive.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `// CreateCollectionsInteractiveCard takes no props — all state is internal`,
        parentId: 'collections-page',
      },
      {
        id: 'forgot-password-page',
        label: 'Forgot Password',
        Component: ForgotPasswordPage as unknown as ComponentType<Record<string, unknown>>,
        props: forgotPasswordPageMockData as Record<string, unknown>,
        sourcePath: 'src/app/forgot-password/page.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `// ForgotPasswordPage takes no props`,
      },
      {
        id: 'collection-share-button',
        label: 'CollectionShareButton',
        Component: CollectionShareButton as unknown as ComponentType<Record<string, unknown>>,
        props: collectionShareButtonMockData as Record<string, unknown>,
        sourcePath: 'src/app/collection/ui/CollectionShareButton.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `interface CollectionShareButtonProps {
  title?: string;
}`,
        parentId: 'collection-detail-page',
      },
      {
        id: 'login-page',
        label: 'Login',
        Component: LoginPage as unknown as ComponentType<Record<string, unknown>>,
        props: loginPageMockData as Record<string, unknown>,
        sourcePath: 'src/app/login/page.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `// LoginPage takes no props — all state is internal`,
      },
      {
        id: 'delete-collection-button',
        label: 'DeleteCollectionButton',
        Component: DeleteCollectionButton as unknown as ComponentType<Record<string, unknown>>,
        props: deleteCollectionButtonMockData as Record<string, unknown>,
        sourcePath: 'src/app/collection/ui/DeleteCollectionButton.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `interface DeleteCollectionButtonProps {
  slug: string;
}`,
        parentId: 'collections-page',
      },
      {
        id: 'blog-post-client',
        label: 'BlogPostClient',
        Component: BlogPostClient as unknown as ComponentType<Record<string, unknown>>,
        props: blogPostClientMockData as Record<string, unknown>,
        sourcePath: 'src/app/insights/[slug]/BlogPostClient.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `interface BlogPostClientProps {
  post: {
    id: string;
    title: string;
    subtitle?: string;
    date?: string;
    readTime?: string;
    category: string;
    author: { name: string; title?: string; description?: string; avatar?: string };
    heroImage?: string;
    contentHtml: string;
    excerptHtml?: string;
    tags?: string[];
    tier?: 'FREE' | 'PRO';
  } | null;
  categories: { name: string; image?: string }[];
  relatedInsights: { id: string; title: string; slug: string; category: string; image?: string; subtitle?: string }[];
}`,
        parentId: 'blog-post-client',
      },
      {
        id: 'insights-client',
        label: 'InsightsClient',
        Component: InsightsClient as unknown as ComponentType<Record<string, unknown>>,
        props: insightsClientMockData as Record<string, unknown>,
        sourcePath: 'src/app/insights/ui/InsightsClient.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `interface InsightsClientProps {
  data: {
    categories: { name: string; image?: string }[];
    posts: {
      id: number | string;
      title: string;
      subtitle?: string;
      category: string;
      badge?: string;
      author?: string;
      authorAvatar?: string;
      date?: string;
      image?: string;
      slug: string;
      tier?: 'FREE' | 'PRO';
    }[];
    recentEssays: {
      id: number | string;
      title: string;
      subtitle?: string;
      category: string;
      badge?: string;
      author?: string;
      date?: string;
      image?: string;
      slug: string;
      tier?: 'FREE' | 'PRO';
    }[];
  };
}`,
        parentId: 'insights-client',
      },
      {
        id: 'manifesto-page',
        label: 'Manifesto',
        Component: ManifestoPage as unknown as ComponentType<Record<string, unknown>>,
        props: manifestoPageMockData as Record<string, unknown>,
        sourcePath: 'src/app/manifesto/page.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `// ManifestoPage takes no props`,
      },
      {
        id: 'collections-pro-banner',
        label: 'CollectionsProBanner',
        Component: CollectionsProBanner as unknown as ComponentType<Record<string, unknown>>,
        props: collectionsProBannerMockData as Record<string, unknown>,
        sourcePath: 'src/app/collection/ui/CollectionsProBanner.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `type CollectionsProBannerProps = {
  className?: string;
}`,
        parentId: 'collections-page',
      },
      {
        id: 'pricing-page',
        label: 'Pricing',
        Component: PricingPageComponent as unknown as ComponentType<Record<string, unknown>>,
        props: pricingPageMockData as Record<string, unknown>,
        sourcePath: 'src/app/pricing/page.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `// PricingPage takes no props — all content and state is internal`,
      },
      {
        id: 'laurel-quote',
        label: 'LaurelQuote',
        Component: LaurelQuote as unknown as ComponentType<Record<string, unknown>>,
        props: laurelQuoteMockData as Record<string, unknown>,
        sourcePath: 'src/app/ui/home/LaurelQuote.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `type LaurelQuoteProps = {
  quote?: string;
  primaryQuote?: string;
  secondaryQuote?: string;
  subtext?: string;
  className?: string;
  avatarUrl?: string;
  avatarAlt?: string;
}`,
        parentId: 'pricing-page',
      },
      {
        id: 'referral-discount-banner',
        label: 'ReferralDiscountBanner',
        Component: ReferralDiscountBanner as unknown as ComponentType<Record<string, unknown>>,
        props: referralDiscountBannerMockData as Record<string, unknown>,
        sourcePath: 'src/components/ReferralDiscountBanner.tsx',
        size: 'default' as ComponentSize,
        propsInterface: `// No props — uses useReferral() hook internally`,
        parentId: 'pricing-page',
      },
      {
        id: 'pattern-content-client',
        label: 'Pattern Detail',
        Component: PatternContentClient as unknown as ComponentType<Record<string, unknown>>,
        props: patternContentClientMockData as Record<string, unknown>,
        sourcePath: 'src/app/patterns/[slug]/PatternContentClient.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `type PatternContentClientProps = {
  slug: string;
  initialPattern: {
    slug: string;
    title: string;
    description: string;
    overview?: string;
    markdownBody: string;
    isPaid: boolean;
    isFree?: boolean;
    patternName?: string;
    phase?: string;
    phaseId?: number;
    principle?: string;
    principleId?: number;
    createdAt: string;
    updatedAt: string;
  } | null;
  proviewData?: { name: string } | null;
}`,
      },
      {
        id: 'aiux-patterns-client',
        label: 'Patterns',
        Component: AIUXPatternsClient as unknown as ComponentType<Record<string, unknown>>,
        props: aiuxPatternsClientMockData as Record<string, unknown>,
        sourcePath: 'src/app/patterns/ui/AIUXPatternsClient.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `interface AIUXPatternsClientProps {
  stages: Stage[];
  patternExamples?: Record<string, PatternExampleInfo>;
}`,
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
