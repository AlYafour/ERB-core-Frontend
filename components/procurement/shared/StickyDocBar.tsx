'use client';

import { Badge } from '@/components/ui';
import type { BadgeProps } from '@/components/ui/Badge';

const ACCENT: Record<NonNullable<BadgeProps['variant']>, string> = {
  success: '#16a34a',
  warning: '#d97706',
  error:   '#dc2626',
  info:    'var(--brand)',
  default: 'var(--text-tertiary)',
};

interface Props {
  docTypeLabel: string;
  docNumber: string;
  statusVariant?: NonNullable<BadgeProps['variant']>;
  statusLabel?: string;
  children?: React.ReactNode;
}

export function StickyDocBar({ docTypeLabel, docNumber, statusVariant, statusLabel, children }: Props) {
  const accent = statusVariant ? (ACCENT[statusVariant] ?? 'var(--brand)') : 'var(--border-default)';

  return (
    <div
      className="animate-slide-up"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: 'var(--card-bg)',
        border: '1px solid var(--border-subtle)',
        borderLeft: `4px solid ${accent}`,
        borderRadius: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 18px',
        minHeight: 60,
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      {/* Doc type + number */}
      <div style={{ flexShrink: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>
          {docTypeLabel}
        </p>
        <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0, fontFamily: 'monospace' }}>
          {docNumber}
        </p>
      </div>

      {statusVariant && statusLabel && (
        <>
          <div style={{ width: 1, height: 28, background: 'var(--border-subtle)', flexShrink: 0 }} />
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </>
      )}

      <div style={{ flex: 1 }} />

      {children && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
          {children}
        </div>
      )}
    </div>
  );
}
