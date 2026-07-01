import type { ComponentType } from 'react';
import dynamic from 'next/dynamic';
import type { RegistryLeafItem } from '../../registry';

// ---------------------------------------------------------------------------
// Built-in demo components for the first-run onboarding canvas.
//
// These are intentionally kept OUT of the main `registry` tree (and therefore
// out of the sidebar and `flatRegistry`) so a fresh install shows only the
// user's discovered pages. They exist solely so the seeded onboarding nodes can
// resolve their components via `resolveRegistryItem()` — see registry.tsx.
// ---------------------------------------------------------------------------

const asComponent = <P,>(c: ComponentType<P>) => c as unknown as ComponentType<Record<string, unknown>>;

const Welcome = dynamic(() => import('./Welcome'));
const WelcomeVariationOne = dynamic(() =>
  import('./WelcomeVariations').then((m) => ({ default: m.WelcomeVariationOne })),
);
const WelcomeVariationTwo = dynamic(() =>
  import('./WelcomeVariations').then((m) => ({ default: m.WelcomeVariationTwo })),
);
const WelcomeVariationThree = dynamic(() =>
  import('./WelcomeVariations').then((m) => ({ default: m.WelcomeVariationThree })),
);

const WELCOME_PROPS_INTERFACE = `export interface WelcomeCardProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  ctaLabel?: string;
  variant?: 'classic' | 'gradient' | 'minimal' | 'dark';
}`;

const sharedProps: Record<string, unknown> = {
  title: 'Design at the speed of thought',
  subtitle:
    'Drop a component, generate AI variations, and compare them side by side — all on one canvas.',
  badge: 'Playground',
  ctaLabel: 'Get started',
};

export const demoRegistryItems: Record<string, RegistryLeafItem> = {
  welcome: {
    id: 'welcome',
    label: 'Welcome',
    Component: asComponent(Welcome),
    props: sharedProps,
    sourcePath: 'src/app/playground/examples/welcome/Welcome.tsx',
    propsInterface: WELCOME_PROPS_INTERFACE,
    size: 'default',
  },
  'welcome-variation-1': {
    id: 'welcome-variation-1',
    label: 'Welcome — Variation 1',
    Component: asComponent(WelcomeVariationOne),
    props: sharedProps,
    sourcePath: 'src/app/playground/examples/welcome/WelcomeVariations.tsx',
    propsInterface: WELCOME_PROPS_INTERFACE,
    size: 'default',
  },
  'welcome-variation-2': {
    id: 'welcome-variation-2',
    label: 'Welcome — Variation 2',
    Component: asComponent(WelcomeVariationTwo),
    props: sharedProps,
    sourcePath: 'src/app/playground/examples/welcome/WelcomeVariations.tsx',
    propsInterface: WELCOME_PROPS_INTERFACE,
    size: 'default',
  },
  'welcome-variation-3': {
    id: 'welcome-variation-3',
    label: 'Welcome — Variation 3',
    Component: asComponent(WelcomeVariationThree),
    props: sharedProps,
    sourcePath: 'src/app/playground/examples/welcome/WelcomeVariations.tsx',
    propsInterface: WELCOME_PROPS_INTERFACE,
    size: 'default',
  },
};
