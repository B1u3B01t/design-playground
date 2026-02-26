'use client';

import { Zap, Shield, Headphones } from 'lucide-react';
import PricingCard from './PricingCard';

export interface PricingPageProps {
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
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h4 className="text-sm font-semibold text-gray-900">{question}</h4>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{answer}</p>
    </div>
  );
}

export default function PricingPage({
  headline,
  subheadline,
  tiers,
  faqItems,
}: PricingPageProps) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-gray-50 to-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Design Playground</span>
          </div>
          <div className="hidden items-center gap-6 sm:flex">
            <a href="#" className="text-sm text-gray-600 hover:text-gray-900">
              Features
            </a>
            <a href="#" className="text-sm font-medium text-blue-600">
              Pricing
            </a>
            <a href="#" className="text-sm text-gray-600 hover:text-gray-900">
              Docs
            </a>
            <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
              Sign up
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 pb-16 text-center">
        <h1 className="mx-auto max-w-2xl text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
          {headline}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-gray-600">
          {subheadline}
        </p>
      </section>

      {/* Pricing Tiers */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div
          className={`grid gap-8 ${
            tiers.length === 3
              ? 'md:grid-cols-3'
              : tiers.length === 2
                ? 'md:grid-cols-2 max-w-3xl mx-auto'
                : 'max-w-md mx-auto'
          }`}
        >
          {tiers.map((tier, idx) => (
            <PricingCard
              key={idx}
              planName={tier.name}
              price={tier.price}
              period={tier.period}
              description={tier.description}
              features={tier.features
                .filter((feature) => feature.included)
                .map((feature) => feature.label)}
              ctaLabel={tier.ctaLabel}
              highlighted={tier.highlighted}
              badge={tier.badge}
            />
          ))}
        </div>
      </section>

      {/* Trust Badges */}
      <section className="border-t border-gray-200 bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="mt-4 text-sm font-semibold text-gray-900">
                30-day money back
              </h4>
              <p className="mt-1 text-xs text-gray-500">
                No questions asked refund policy
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="mt-4 text-sm font-semibold text-gray-900">
                Instant setup
              </h4>
              <p className="mt-1 text-xs text-gray-500">
                Get started in under 5 minutes
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                <Headphones className="h-6 w-6 text-purple-600" />
              </div>
              <h4 className="mt-4 text-sm font-semibold text-gray-900">
                24/7 support
              </h4>
              <p className="mt-1 text-xs text-gray-500">
                Real humans, always available
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      {faqItems.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 py-24">
          <h2 className="mb-10 text-center text-2xl font-bold text-gray-900">
            Frequently asked questions
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {faqItems.map((item, idx) => (
              <FAQItem key={idx} question={item.question} answer={item.answer} />
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600">
              <Zap className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-900">Design Playground</span>
          </div>
          <p className="text-xs text-gray-500">
            &copy; 2025 Design Playground. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
