import { ComponentType } from 'react';
import type { ComponentSize } from './lib/constants';
import { getPlaygroundRoot } from './lib/playground-root';
import PricingCard from './examples/PricingCard';
import PricingPage from './examples/PricingPage';
import {
  formatChildrenSection,
  formatCustomInstructionsSection,
  formatSkillSection,
} from './prompts/utility';
import { iterationPrompt } from './prompts/iteration.prompt';
import { iterationFromIterationPrompt } from './prompts/iteration-from-iteration.prompt';
import { adoptIterationPrompt } from './prompts/adopt.prompt';

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
  // Iteration metadata
  sourcePath: string;
  propsInterface: string;
  children?: string[]; // Child component names that can be iterated
  size?: ComponentSize; // Display size for the component preview
}

export type RegistryItem = RegistryGroupItem | RegistryLeafItem;

export function isGroup(item: RegistryItem): item is RegistryGroupItem {
  return 'children' in item && !('Component' in item);
}

export function isLeaf(item: RegistryItem): item is RegistryLeafItem {
  return 'Component' in item;
}

// ---------------------------------------------------------------------------
// Sample data for components
// ---------------------------------------------------------------------------

const pricingCardProps = {
  planName: 'Pro',
  price: '$29',
  period: 'month',
  description: 'For growing teams that need more power and flexibility.',
  features: [
    'Unlimited projects',
    'Priority support',
    'Advanced analytics',
    'Custom integrations',
    'Team collaboration',
  ],
  ctaLabel: 'Get started',
  highlighted: true,
  badge: 'Most Popular',
};

const pricingPageProps = {
  headline: 'Simple pricing for every team',
  subheadline:
    'Start free and scale as you grow. No hidden fees, no surprises. Cancel anytime.',
  tiers: [
    {
      name: 'Starter',
      price: '$0',
      period: 'month',
      description: 'Perfect for side projects and trying things out.',
      features: [
        { label: '3 projects', included: true },
        { label: '1 GB storage', included: true },
        { label: 'Community support', included: true },
        { label: 'Basic analytics', included: true },
        { label: 'Custom domains', included: false },
        { label: 'Priority support', included: false },
        { label: 'SSO & SAML', included: false },
      ],
      ctaLabel: 'Get started free',
    },
    {
      name: 'Pro',
      price: '$29',
      period: 'month',
      description: 'For growing teams that need more power and flexibility.',
      features: [
        { label: 'Unlimited projects', included: true },
        { label: '100 GB storage', included: true },
        { label: 'Priority support', included: true },
        { label: 'Advanced analytics', included: true },
        { label: 'Custom domains', included: true },
        { label: 'Team collaboration', included: true },
        { label: 'SSO & SAML', included: false },
      ],
      ctaLabel: 'Start free trial',
      highlighted: true,
      badge: 'Most Popular',
    },
    {
      name: 'Enterprise',
      price: '$99',
      period: 'month',
      description: 'For organizations with advanced security and compliance needs.',
      features: [
        { label: 'Unlimited projects', included: true },
        { label: 'Unlimited storage', included: true },
        { label: 'Dedicated support', included: true },
        { label: 'Custom analytics', included: true },
        { label: 'Custom domains', included: true },
        { label: 'Team collaboration', included: true },
        { label: 'SSO & SAML', included: true },
      ],
      ctaLabel: 'Contact sales',
    },
  ],
  faqItems: [
    {
      question: 'Can I change plans later?',
      answer:
        'Yes, you can upgrade or downgrade at any time. Changes take effect at the start of your next billing cycle.',
    },
    {
      question: 'Is there a free trial?',
      answer:
        'The Pro plan comes with a 14-day free trial. No credit card required to start.',
    },
    {
      question: 'What payment methods do you accept?',
      answer:
        'We accept all major credit cards, PayPal, and wire transfers for annual Enterprise plans.',
    },
    {
      question: 'Can I cancel anytime?',
      answer:
        'Absolutely. Cancel with one click from your dashboard. No cancellation fees, ever.',
    },
  ],
};

// ---------------------------------------------------------------------------
// Registry tree
// ---------------------------------------------------------------------------

export const registry: RegistryItem[] = [
  {
    id: 'examples',
    label: 'Examples',
    children: [
      {
        id: 'pricing-card',
        label: 'Pricing Card',
        Component: PricingCard as unknown as ComponentType<Record<string, unknown>>,
        props: pricingCardProps,
        sourcePath: 'src/app/playground/examples/PricingCard.tsx',
        propsInterface: `interface PricingCardProps {
  planName: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
  badge?: string;
  onCtaClick?: () => void;
}`,
      },
      {
        id: 'pricing-page',
        label: 'Pricing Page',
        Component: PricingPage as unknown as ComponentType<Record<string, unknown>>,
        props: pricingPageProps,
        sourcePath: 'src/app/playground/examples/PricingPage.tsx',
        size: 'laptop' as ComponentSize,
        propsInterface: `interface PricingPageProps {
  headline: string;
  subheadline: string;
  tiers: {
    name: string;
    price: string;
    period: string;
    description: string;
    features: { label: string; included: boolean }[];
    ctaLabel: string;
    highlighted?: boolean;
    badge?: string;
  }[];
  faqItems: { question: string; answer: string }[];
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

// ---------------------------------------------------------------------------
// Prompt generator
// ---------------------------------------------------------------------------

/**
 * Resolve a sourcePath so it reflects the actual playground location.
 * Built-in examples use `src/app/playground/...` but the playground may live
 * at `src/playground/` (Vite) or another location.
 */
function resolveSourcePath(sourcePath: string): string {
  const root = getPlaygroundRoot();
  return sourcePath.replace(/^src\/app\/playground\//, `${root}/`);
}

export function generateIterationPrompt(
  componentId: string,
  iterationCount: number = 4,
  depth: 'shell' | '1-level' | 'all' = 'shell',
  customInstructions?: string,
  skillPrompt?: string,
): string {
  const item = flatRegistry[componentId];
  if (!item) return '';

  const playgroundRoot = getPlaygroundRoot();
  const componentName = item.label.replace(/\s*\(.*\)/, '');
  const cleanComponentName = componentName.replace(/\s+/g, '');
  const depthLabel = depth === 'shell' ? 'Shell only' : depth === '1-level' ? '1 level deep' : 'All levels';

  const childrenSection = formatChildrenSection(item.children);
  const customInstructionsSection = formatCustomInstructionsSection(customInstructions);
  const skillSection = formatSkillSection(skillPrompt);

  return iterationPrompt({
    skillSection,
    componentName,
    sourcePath: resolveSourcePath(item.sourcePath),
    iterationCount: String(iterationCount),
    depthLabel,
    childrenSection,
    propsInterface: item.propsInterface,
    cleanComponentName,
    componentId,
    customInstructionsSection,
    playgroundRoot,
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
): string {
  const item = flatRegistry[componentId];
  if (!item) return '';

  const playgroundRoot = getPlaygroundRoot();
  const componentName = item.label.replace(/\s*\(.*\)/, '');
  const cleanComponentName = componentName.replace(/\s+/g, '');
  const depthLabel = depth === 'shell' ? 'Shell only' : depth === '1-level' ? '1 level deep' : 'All levels';
  const endNumber = startNumber + iterationCount - 1;
  const iterationSourcePath = `${playgroundRoot}/iterations/${sourceIterationFilename}`;

  const childrenSection = formatChildrenSection(item.children);
  const customInstructionsSection = formatCustomInstructionsSection(customInstructions);
  const skillSection = formatSkillSection(skillPrompt);

  const iterationNumbers = Array.from(
    { length: iterationCount },
    (_, i) => startNumber + i,
  );

  const iterationSavesBlock = iterationNumbers
    .map((n) => `   - Save as ${playgroundRoot}/iterations/${cleanComponentName}.iteration-${n}.tsx`)
    .join('\n');

  return iterationFromIterationPrompt({
    skillSection,
    componentName,
    sourcePath: resolveSourcePath(item.sourcePath),
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
    playgroundRoot,
  });
}

// ---------------------------------------------------------------------------
// Adopt prompt generator
// ---------------------------------------------------------------------------

export function generateAdoptPrompt(
  componentId: string,
  iterationFilename: string
): string {
  const item = flatRegistry[componentId];
  const originalPath = item
    ? resolveSourcePath(item.sourcePath)
    : `src/components/${iterationFilename.split('.iteration')[0]}.tsx`;
  const iterationPath = `${getPlaygroundRoot()}/iterations/${iterationFilename}`;

  return adoptIterationPrompt({ originalPath, iterationPath });
}
