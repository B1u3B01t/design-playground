'use client';

import WelcomeCard, { type WelcomeCardProps } from './WelcomeCard';

// Three visually distinct "AI variations" of the Welcome component, shown pre-placed
// on the canvas during first-run onboarding so users see the iterate/compare flow
// instantly. Each fixes a different visual treatment on the shared WelcomeCard.

export function WelcomeVariationOne(props: WelcomeCardProps) {
  return <WelcomeCard variant="gradient" {...props} />;
}

export function WelcomeVariationTwo(props: WelcomeCardProps) {
  return <WelcomeCard variant="minimal" {...props} />;
}

export function WelcomeVariationThree(props: WelcomeCardProps) {
  return <WelcomeCard variant="dark" {...props} />;
}
