'use client';

import { ArrowRight, Sparkles } from 'lucide-react';

export type WelcomeVariant = 'classic' | 'gradient' | 'minimal' | 'dark';

export interface WelcomeCardProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  ctaLabel?: string;
  /** Visual treatment — each demo variation fixes this to a different value. */
  variant?: WelcomeVariant;
}

interface VariantStyle {
  card: string;
  badge: string;
  title: string;
  subtitle: string;
  primaryBtn: string;
  secondaryBtn: string;
  stat: string;
  statLabel: string;
  divider: string;
}

const VARIANTS: Record<WelcomeVariant, VariantStyle> = {
  classic: {
    card: 'border border-gray-200 bg-white shadow-sm',
    badge: 'bg-blue-50 text-blue-700',
    title: 'text-gray-900',
    subtitle: 'text-gray-500',
    primaryBtn: 'bg-blue-600 text-white hover:bg-blue-700',
    secondaryBtn: 'border border-gray-200 text-gray-700 hover:bg-gray-50',
    stat: 'text-gray-900',
    statLabel: 'text-gray-400',
    divider: 'border-gray-100',
  },
  gradient: {
    card: 'border border-transparent bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-200',
    badge: 'bg-white/20 text-white',
    title: 'text-white',
    subtitle: 'text-white/80',
    primaryBtn: 'bg-white text-violet-700 hover:bg-white/90',
    secondaryBtn: 'border border-white/40 text-white hover:bg-white/10',
    stat: 'text-white',
    statLabel: 'text-white/70',
    divider: 'border-white/20',
  },
  minimal: {
    card: 'border border-gray-900 bg-white shadow-none',
    badge: 'bg-gray-900 text-white',
    title: 'text-gray-900',
    subtitle: 'text-gray-600',
    primaryBtn: 'bg-gray-900 text-white hover:bg-gray-800',
    secondaryBtn: 'border border-gray-300 text-gray-900 hover:bg-gray-50',
    stat: 'text-gray-900',
    statLabel: 'text-gray-400',
    divider: 'border-gray-200',
  },
  dark: {
    card: 'border border-slate-800 bg-slate-900 shadow-xl shadow-slate-900/30',
    badge: 'bg-emerald-400/15 text-emerald-300',
    title: 'text-white',
    subtitle: 'text-slate-400',
    primaryBtn: 'bg-emerald-400 text-slate-900 hover:bg-emerald-300',
    secondaryBtn: 'border border-slate-700 text-slate-200 hover:bg-slate-800',
    stat: 'text-white',
    statLabel: 'text-slate-500',
    divider: 'border-slate-800',
  },
};

export default function WelcomeCard({
  title = 'Design at the speed of thought',
  subtitle = 'Drop a component, generate AI variations, and compare them side by side — all on one canvas.',
  badge = 'Playground',
  ctaLabel = 'Get started',
  variant = 'classic',
}: WelcomeCardProps) {
  const s = VARIANTS[variant];

  return (
    <div
      className={`flex flex-col rounded-2xl p-6 ${s.card}`}
      style={{ width: 360, fontFamily: 'var(--pg-font-sans)' }}
    >
      {/* Badge */}
      <span
        className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${s.badge}`}
      >
        <Sparkles className="h-3 w-3" />
        {badge}
      </span>

      {/* Title */}
      <h2 className={`mt-4 text-2xl font-bold leading-tight ${s.title}`}>{title}</h2>

      {/* Subtitle */}
      <p className={`mt-2 text-sm leading-relaxed ${s.subtitle}`}>{subtitle}</p>

      {/* Actions */}
      <div className="mt-6 flex items-center gap-3">
        <button
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${s.primaryBtn}`}
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${s.secondaryBtn}`}
        >
          Learn more
        </button>
      </div>

      {/* Divider */}
      <hr className={`my-5 border-t ${s.divider}`} />

      {/* Footer stats */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className={`text-lg font-bold ${s.stat}`}>4 variations</span>
          <span className={`text-xs ${s.statLabel}`}>generated in seconds</span>
        </div>
        <div className="flex flex-col text-right">
          <span className={`text-lg font-bold ${s.stat}`}>1 canvas</span>
          <span className={`text-xs ${s.statLabel}`}>infinite ideas</span>
        </div>
      </div>
    </div>
  );
}
