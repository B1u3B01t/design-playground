import type { FlowDescriptor } from '../../lib/flows/types';

/**
 * Stages a real /signup user moves through:
 *   1. Account details form
 *   2. Email verification ("check your inbox") UI state
 *   3. Plan selection
 *   4. Landed on the destination home/browse page (synthetic — exists only
 *      to give the simulator a destination to render)
 */
export const signupFlow: FlowDescriptor = {
  id: 'signup',
  label: 'Signup',
  sourceRoute: '/signup',
  sourceFiles: [
    'src/app/signup/page.tsx',
    'src/app/signup/SignupForm.tsx',
    'src/app/signup/PlanCards.tsx',
    'src/app/signup/EmailSentPanel.tsx',
  ],
  stages: [
    {
      id: 'account',
      label: 'Account Details',
      componentId: 'signup-form',
      mockKey: 'account',
    },
    {
      id: 'verify',
      label: 'Verify Email',
      componentId: 'email-sent-panel',
      mockKey: 'verify',
    },
    {
      id: 'plan',
      label: 'Choose Plan',
      componentId: 'plan-cards',
      mockKey: 'plan',
    },
    {
      id: 'landed',
      label: 'Landed Home',
      componentId: 'browse-shell',
      mockKey: 'landed',
      synthetic: true,
    },
  ],
  defaultEdges: [
    { from: 'account', to: 'verify' },
    { from: 'verify', to: 'plan' },
    { from: 'plan', to: 'landed' },
  ],
  seedMocks: {
    account: {
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      password: '',
    },
    verify: {
      email: 'ada@example.com',
    },
    plan: {
      selectedPlan: 'pro',
      billingCycle: 'annual',
      firstName: 'Ada',
    },
    landed: {
      firstName: 'Ada',
    },
  },
};
