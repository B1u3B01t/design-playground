'use client';

import { Check } from 'lucide-react';

export interface PricingCardProps {
  planName: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
  badge?: string;
  onCtaClick?: () => void;
}

export default function PricingCard({
  planName,
  price,
  period,
  description,
  features,
  ctaLabel,
  highlighted = false,
  badge,
  onCtaClick,
}: PricingCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 ${
        highlighted
          ? 'border-blue-600 bg-blue-50 shadow-lg shadow-blue-100'
          : 'border-gray-200 bg-white shadow-sm'
      }`}
      style={{ width: 320 }}
    >
      {/* Badge */}
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
          {badge}
        </span>
      )}

      {/* Plan name */}
      <h3
        className={`text-sm font-semibold uppercase tracking-wide ${
          highlighted ? 'text-blue-700' : 'text-gray-500'
        }`}
      >
        {planName}
      </h3>

      {/* Price */}
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-gray-900">{price}</span>
        <span className="text-sm text-gray-500">/{period}</span>
      </div>

      {/* Description */}
      <p className="mt-2 text-sm text-gray-600">{description}</p>

      {/* Divider */}
      <hr className="my-5 border-gray-200" />

      {/* Features */}
      <ul className="flex-1 space-y-3">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
            <Check
              className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                highlighted ? 'text-blue-600' : 'text-green-500'
              }`}
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <button
        onClick={onCtaClick}
        className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
          highlighted
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-900 text-white hover:bg-gray-800'
        }`}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
