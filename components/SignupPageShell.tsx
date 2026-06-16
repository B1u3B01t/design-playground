"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check } from "lucide-react";
import { LogoMarquee } from "./flow/LogoMarquee";
import type { Plan, BillingCycle } from "./flow/PlanCards";

/**
 * Full signup-page chrome reused per stage so each StageNode on the canvas
 * reads as a real page rather than a bare component card. Mirrors the layout
 * of src/app/signup/page.tsx exactly, parameterised by stage so the headline,
 * step indicators, and column contents match what a real user would see.
 *
 * For the 'plan' stage the shell also renders the selected-plan summary and
 * "Continue with X" button in the left column — the same chrome the real
 * signup page draws around the PlanCards selector.
 */

interface SignupPageShellProps {
  stageId: "account" | "verify" | "plan";
  /** Used in the step 2 welcome headline */
  firstName?: string;
  selectedPlan?: Plan;
  billingCycle?: BillingCycle;
  /**
   * Form content for the left column. Used by 'account' (SignupForm) and
   * 'verify' (EmailSentPanel). Ignored for 'plan' since that stage's left
   * column is the welcome/summary/Continue block.
   */
  formSlot?: ReactNode;
  /**
   * Right column override. Used by 'plan' to render PlanCards. When omitted,
   * the right column shows the default "Designing AI Products" hero.
   */
  rightSlot?: ReactNode;
  /** Continue button callback for the plan stage. */
  onPlanContinue?: () => void;
}

export function SignupPageShell({
  stageId,
  firstName,
  selectedPlan = "pro",
  billingCycle = "annual",
  formSlot,
  rightSlot,
  onPlanContinue,
}: SignupPageShellProps) {
  const isStep1 = stageId === "account" || stageId === "verify";
  const isStep2 = stageId === "plan";

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row min-h-[88svh] lg:h-[100svh] rounded-3xl overflow-hidden">
        {/* ───── Left column ───── */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center bg-stone-50 px-6 sm:px-10 py-10 lg:py-12">
          <div className="flex flex-col justify-center max-w-md mx-auto w-full">
            <Link href="/" className="mb-8 inline-block">
              <Image
                src="https://test-aiverse.b-cdn.net/brand-assets/logo.png"
                alt="Aiverse"
                width={44}
                height={44}
                className="rounded-full"
              />
            </Link>

            {isStep1 && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-stone-900 text-white text-xs font-semibold">
                    1
                  </span>
                  <h1 className="text-2xl font-semibold text-stone-900">
                    Create your free account
                  </h1>
                </div>
                <p className="text-sm text-stone-500 mb-8 ml-8">
                  Get instant access to 200+ AI-UX examples.
                </p>
                {formSlot}
              </>
            )}

            {isStep2 && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-stone-900/10 text-stone-900/40 text-xs font-semibold">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-sm text-stone-500 line-through">
                    Create your free account
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-4 mb-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-stone-900 text-white text-xs font-semibold">
                    2
                  </span>
                  <h1 className="text-2xl font-semibold text-stone-900">
                    {firstName ? `Welcome, ${firstName}` : "Choose your plan"}
                  </h1>
                </div>
                <p className="text-sm text-stone-500 mb-8 ml-8">
                  Pick a plan to get started.
                </p>

                <div className="bg-white rounded-2xl border border-stone-200/40 p-5 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">
                        Selected plan
                      </p>
                      <h3 className="text-xl font-semibold text-stone-900">
                        {selectedPlan === "team"
                          ? "Team"
                          : selectedPlan === "pro"
                          ? "PRO"
                          : "Free"}
                      </h3>
                    </div>
                    <div className="text-right">
                      {selectedPlan === "pro" ? (
                        <>
                          <span className="text-2xl font-semibold text-stone-900">
                            ${billingCycle === "annual" ? 8 : 12}
                          </span>
                          <span className="text-sm text-stone-500">/mo</span>
                          <p className="text-xs text-stone-500">
                            {billingCycle === "annual" ? "billed annually" : "billed quarterly"}
                          </p>
                        </>
                      ) : selectedPlan === "team" ? (
                        <span className="text-sm font-medium text-stone-500">
                          Custom pricing
                        </span>
                      ) : (
                        <span className="text-2xl font-semibold text-stone-900">$0</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={onPlanContinue}
                  className="w-full h-12 rounded-full bg-stone-900 text-white hover:bg-stone-900/90 font-medium transition-colors cursor-pointer"
                >
                  {selectedPlan === "team"
                    ? "Contact us"
                    : selectedPlan === "pro"
                    ? "Continue with PRO"
                    : "Continue with free"}
                </button>

                {selectedPlan === "free" && (
                  <p className="text-xs text-center text-stone-500 mt-3">
                    You can upgrade to PRO anytime from{" "}
                    <Link href="/pricing" className="underline hover:no-underline">
                      pricing
                    </Link>
                    .
                  </p>
                )}
                {selectedPlan === "team" && (
                  <p className="text-xs text-center text-stone-500 mt-3">
                    We&rsquo;ll get back to you via email.
                  </p>
                )}
              </>
            )}
          </div>

          <LogoMarquee />
        </div>

        {/* ───── Right column ───── */}
        <div className="w-full lg:w-1/2 bg-stone-200/40 px-6 sm:px-10 py-12 lg:py-16 lg:overflow-y-auto">
          <div className="max-w-lg mx-auto">
            {rightSlot ?? (
              <>
                <h2 className="text-4xl sm:text-5xl font-serif tracking-tight text-stone-900 text-center leading-tight mb-8">
                  The missing playbook for<br />
                  <em>Designing AI Products</em>
                </h2>

                <ul className="space-y-3 mb-10 max-w-sm mx-auto">
                  {[
                    "200+ real AI-UX examples from top products",
                    "Pattern library with implementation guidance",
                    "Monthly insights on emerging trends",
                  ].map((prop) => (
                    <li key={prop} className="flex items-start gap-2.5 text-sm text-stone-500">
                      <Check className="w-4 h-4 text-stone-900 mt-0.5 shrink-0" />
                      <span>{prop}</span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-4">
                  <p className="text-xs text-stone-500 uppercase tracking-wider text-center">
                    Don&rsquo;t just take our word for it
                  </p>
                  <div className="bg-white rounded-2xl p-5 border border-stone-200/40">
                    <div className="flex items-center gap-1 mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className="text-orange-600 text-sm">★</span>
                      ))}
                    </div>
                    <p className="text-stone-900 text-sm italic leading-relaxed">
                      &ldquo;It&rsquo;s basically like Mobbin, but specifically for AI&rdquo;
                    </p>
                    <p className="text-stone-500 text-xs mt-2">— @sakkydesign</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
