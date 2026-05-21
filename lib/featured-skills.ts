export interface FeaturedSkill {
  /** What we pass to `skills add` — owner/repo or owner/repo@skill */
  source: string;
  /** Stable id used for de-duping the card list */
  id: string;
  /** Human-friendly name shown on the card */
  name: string;
  /** One-line pitch */
  description: string;
  /** Loose category for grouping */
  category: 'Design' | 'Frontend' | 'Workflow' | 'Vercel';
  /** Link to the skill's page on skills.sh for "Learn more" */
  url?: string;
}

export const FEATURED_SKILLS: FeaturedSkill[] = [
  {
    source: 'vercel-labs/agent-skills@web-design-guidelines',
    id: 'web-design-guidelines',
    name: 'Web design guidelines',
    description: 'Modern web design principles for clean, accessible interfaces.',
    category: 'Design',
    url: 'https://skills.sh/vercel-labs/agent-skills/web-design-guidelines',
  },
  {
    source: 'vercel-labs/agent-skills@vercel-react-best-practices',
    id: 'vercel-react-best-practices',
    name: 'React best practices',
    description: 'Patterns and pitfalls when writing modern React.',
    category: 'Frontend',
    url: 'https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices',
  },
  {
    source: 'vercel-labs/agent-skills@vercel-composition-patterns',
    id: 'vercel-composition-patterns',
    name: 'Composition patterns',
    description: 'Composable component patterns that scale across a codebase.',
    category: 'Frontend',
    url: 'https://skills.sh/vercel-labs/agent-skills/vercel-composition-patterns',
  },
  {
    source: 'vercel-labs/agent-skills@vercel-react-view-transitions',
    id: 'vercel-react-view-transitions',
    name: 'React view transitions',
    description: 'Smooth view-transition animations across route changes.',
    category: 'Frontend',
    url: 'https://skills.sh/vercel-labs/agent-skills/vercel-react-view-transitions',
  },
  {
    source: 'vercel-labs/agent-skills@vercel-optimize',
    id: 'vercel-optimize',
    name: 'Vercel optimize',
    description: 'Performance and bundle-size optimizations for Vercel projects.',
    category: 'Vercel',
    url: 'https://skills.sh/vercel-labs/agent-skills/vercel-optimize',
  },
  {
    source: 'vercel-labs/agent-skills@deploy-to-vercel',
    id: 'deploy-to-vercel',
    name: 'Deploy to Vercel',
    description: 'Guidance for deploying a project to Vercel cleanly.',
    category: 'Vercel',
    url: 'https://skills.sh/vercel-labs/agent-skills/deploy-to-vercel',
  },
  {
    source: 'vercel-labs/agent-skills@vercel-cli-with-tokens',
    id: 'vercel-cli-with-tokens',
    name: 'Vercel CLI with tokens',
    description: 'How to drive the Vercel CLI non-interactively with tokens.',
    category: 'Vercel',
    url: 'https://skills.sh/vercel-labs/agent-skills/vercel-cli-with-tokens',
  },
  {
    source: 'vercel-labs/agent-skills@vercel-react-native-skills',
    id: 'vercel-react-native-skills',
    name: 'React Native skills',
    description: 'Reusable patterns for cross-platform React Native work.',
    category: 'Frontend',
    url: 'https://skills.sh/vercel-labs/agent-skills/vercel-react-native-skills',
  },
];
