'use client';

import WelcomeCard, { type WelcomeCardProps } from './WelcomeCard';

/**
 * The "original" component in the first-run onboarding demo. Rendering it, and
 * the three WelcomeVariations, requires no repo discovery — they resolve through
 * the built-in demo registry (see demo-registry.tsx). Selecting this node and
 * clicking Iterate generates real variations from this source file.
 */
export default function Welcome(props: WelcomeCardProps) {
  return <WelcomeCard variant="classic" {...props} />;
}
