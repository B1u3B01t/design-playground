'use client';

import { useState, useEffect, type ComponentType } from 'react';
import { SignupForm } from './flow/SignupForm';
import { PlanCards, type Plan, type BillingCycle } from './flow/PlanCards';
import { EmailSentPanel } from './flow/EmailSentPanel';
import { BrowseShell } from './BrowseShell';
import { SignupPageShell } from './SignupPageShell';

/**
 * Stage renderers used by the FlowSimulator and the StageNode preview.
 * Each stage renders the full signup page chrome (via SignupPageShell) with
 * the stage-specific inner content swapped in, so each stage on the canvas
 * looks like a real page — not a bare component card.
 *
 * If a `Component` override is supplied (the canonical iteration of a stage),
 * it is used in place of the base inner component. The page chrome around it
 * stays the same. We assume iterations preserve the inner prop interface —
 * that's already a hard requirement for the existing IterationNode preview
 * and Adopt flows.
 */

export interface StageRendererProps {
  mock: Record<string, unknown>;
  onContinue: () => void;
  Component?: ComponentType<Record<string, unknown>>;
}

/**
 * Renderers are real React components — render them via JSX
 * (`<Renderer ... />`), NOT by calling them as functions. Each renderer uses
 * hooks (`useState`) for its local form state; calling them as functions
 * would attach those hooks to the caller's hook stack and explode the moment
 * the stage changes.
 */
export type StageRenderer = ComponentType<StageRendererProps>;

function deriveFirstName(mock: Record<string, unknown>): string {
  if (typeof mock.firstName === 'string' && mock.firstName) return mock.firstName;
  if (typeof mock.fullName === 'string' && mock.fullName) {
    return mock.fullName.trim().split(' ')[0] ?? '';
  }
  return '';
}

function SignupAccountRenderer({ mock, onContinue, Component }: StageRendererProps) {
  const [fullName, setFullName] = useState((mock.fullName as string) ?? '');
  const [email, setEmail] = useState((mock.email as string) ?? '');
  const [password, setPassword] = useState((mock.password as string) ?? '');

  // Keep local state in sync with mock-panel edits. Without this, useState's
  // initial value sticks across mock changes and the field appears stale until
  // the renderer remounts.
  useEffect(() => { setFullName((mock.fullName as string) ?? ''); }, [mock.fullName]);
  useEffect(() => { setEmail((mock.email as string) ?? ''); }, [mock.email]);
  useEffect(() => { setPassword((mock.password as string) ?? ''); }, [mock.password]);

  const Form = Component ?? SignupForm;

  return (
    <SignupPageShell
      stageId="account"
      formSlot={
        <Form
          fullName={fullName}
          setFullName={setFullName}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          loading={false}
          error={null}
          emailSent={false}
          setEmailSent={() => {}}
          onEmailSignup={(e: React.FormEvent) => {
            e.preventDefault();
            onContinue();
          }}
          onGoogleSignup={onContinue}
          callbackUrl="/browse"
          flowMode
          onContinue={onContinue}
        />
      }
    />
  );
}

function SignupVerifyRenderer({ mock, onContinue, Component }: StageRendererProps) {
  const Panel = Component ?? EmailSentPanel;
  return (
    <SignupPageShell
      stageId="verify"
      formSlot={
        <Panel
          email={(mock.email as string) ?? ''}
          onContinue={onContinue}
        />
      }
    />
  );
}

function SignupPlanRenderer({ mock, onContinue, Component }: StageRendererProps) {
  const [selectedPlan, setSelectedPlan] = useState<Plan>(
    ((mock.selectedPlan as Plan) ?? 'pro') as Plan,
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    ((mock.billingCycle as BillingCycle) ?? 'annual') as BillingCycle,
  );

  // Sync with mock-panel edits (see SignupAccountRenderer for rationale).
  useEffect(() => {
    setSelectedPlan(((mock.selectedPlan as Plan) ?? 'pro') as Plan);
  }, [mock.selectedPlan]);
  useEffect(() => {
    setBillingCycle(((mock.billingCycle as BillingCycle) ?? 'annual') as BillingCycle);
  }, [mock.billingCycle]);

  const Cards = Component ?? PlanCards;
  const firstName = deriveFirstName(mock);

  return (
    <SignupPageShell
      stageId="plan"
      firstName={firstName}
      selectedPlan={selectedPlan}
      billingCycle={billingCycle}
      onPlanContinue={onContinue}
      rightSlot={
        <Cards
          selectedPlan={selectedPlan}
          onSelectPlan={setSelectedPlan}
          billingCycle={billingCycle}
          onBillingCycleChange={setBillingCycle}
          firstName={firstName}
        />
      }
    />
  );
}

function SignupLandedRenderer({ mock, Component }: StageRendererProps) {
  // The destination is intentionally NOT wrapped in SignupPageShell — once
  // the user has signed up, they're past the signup chrome and into the app.
  const Shell = Component ?? BrowseShell;
  return <Shell firstName={deriveFirstName(mock) || 'there'} />;
}

export const stageRenderers: Record<string, StageRenderer> = {
  'signup-form': SignupAccountRenderer,
  'email-sent-panel': SignupVerifyRenderer,
  'plan-cards': SignupPlanRenderer,
  'browse-shell': SignupLandedRenderer,
};
