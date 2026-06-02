'use client';

import React from 'react';

export interface KpiCardConfig {
  label: string;
  value: string | number;
  sub?: string;
  delta?: string;
  deltaUp?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
  icon?: React.ReactNode;
}

const VARIANT_COLORS: Record<string, { icon: string; delta: string }> = {
  default: { icon: 'var(--brand)',          delta: 'var(--text-secondary)' },
  success: { icon: 'var(--status-success)', delta: 'var(--status-success)' },
  warning: { icon: 'var(--status-warning)', delta: 'var(--status-warning)' },
  error:   { icon: 'var(--status-error)',   delta: 'var(--status-error)'   },
};

export function KpiCard({ label, value, sub, delta, deltaUp, variant = 'default', icon }: KpiCardConfig) {
  const colors = VARIANT_COLORS[variant];

  return (
    <div
      className="card"
      style={{ flex: '1 1 0', minWidth: 160, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>
          {label}
        </span>
        {icon && (
          <span style={{ color: colors.icon, display: 'flex', alignItems: 'center' }}>{icon}</span>
        )}
      </div>

      {/* Value */}
      <div style={{ fontSize: 'var(--text-2xl, 1.5rem)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>

      {/* Sub + delta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 18 }}>
        {sub && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{sub}</span>
        )}
        {delta && (
          <span style={{
            fontSize: 'var(--text-xs)', fontWeight: 600,
            color: colors.delta,
            display: 'inline-flex', alignItems: 'center', gap: 2,
          }}>
            {deltaUp !== undefined && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ transform: deltaUp ? 'none' : 'rotate(180deg)' }}>
                <path d="M5 2L9 8H1L5 2Z" />
              </svg>
            )}
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

export function KpiCardRow({ cards }: { cards: KpiCardConfig[] }) {
  if (!cards.length) return null;
  return (
    <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
      {cards.map((c, i) => <KpiCard key={i} {...c} />)}
    </div>
  );
}
