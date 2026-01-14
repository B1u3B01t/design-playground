'use client';

import { Zap, ArrowUpRight, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const BILLING_PORTAL_URL = 'https://aiverse-design.lemonsqueezy.com/billing';

export interface SubscriptionExpiringBannerPreviewProps {
  /** Number of days remaining until subscription ends */
  daysRemaining: number;
  /** Whether the subscription has already expired */
  isExpired?: boolean;
}

/**
 * Preview version of SubscriptionExpiringBanner for playground iteration.
 * Takes explicit props instead of reading from store.
 */
export function SubscriptionExpiringBannerPreview({
  daysRemaining,
  isExpired = false,
}: SubscriptionExpiringBannerPreviewProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  const getDaysLabel = () => {
    if (isExpired) return 'Expired';
    if (daysRemaining === 1) return 'Today';
    return `${daysRemaining} days`;
  };

  const getMessage = () => {
    if (isExpired) {
      return 'Your subscription has ended. Renew to unlock Pro features.';
    }
    return 'Your Pro access is ending soon. Keep your premium features active.';
  };

  return (
    <div
      className={cn(
        'flex items-stretch rounded-xl overflow-hidden',
        'border border-text-brown-light/30',
        'bg-background'
      )}
    >
      {/* Left section - Status indicator (orange) */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-accent-orange border-r border-accent-orange">
        <Zap size={16} className="text-white flex-shrink-0" />
        <span className="text-sm font-semibold text-white whitespace-nowrap">{getDaysLabel()}</span>
      </div>

      {/* Middle section - Message */}
      <div className="flex-1 flex items-center px-4 py-2.5 min-w-0">
        <p className="text-sm text-text-brown-dark truncate">{getMessage()}</p>
      </div>

      {/* Right section - Actions */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-l border-text-brown-light/20 bg-accent/30 flex-shrink-0">
        <a
          href={BILLING_PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg',
            'bg-accent-orange border border-accent-orange',
            'text-sm font-medium text-white whitespace-nowrap',
            'hover:bg-accent-orange/90',
            'transition-all duration-200'
          )}
        >
          Renew
          <ArrowUpRight size={14} />
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 rounded-lg hover:bg-text-brown-light/20 transition-colors text-text-brown flex-shrink-0"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
