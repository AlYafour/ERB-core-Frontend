'use client';

import { Badge } from '@/components/ui';
import type { BadgeProps } from '@/components/ui/Badge';

const BAR_CLASS: Record<NonNullable<BadgeProps['variant']>, string> = {
  success: 'proc-bar--success',
  warning: 'proc-bar--warning',
  error:   'proc-bar--error',
  info:    'proc-bar--info',
  default: 'proc-bar--default',
};

interface Props {
  docTypeLabel: string;
  docNumber: string;
  statusVariant?: NonNullable<BadgeProps['variant']>;
  statusLabel?: string;
  chain?: React.ReactNode;
  children?: React.ReactNode;
}

export function StickyDocBar({ docTypeLabel, docNumber, statusVariant, statusLabel, chain, children }: Props) {
  const barClass = statusVariant ? (BAR_CLASS[statusVariant] ?? 'proc-bar--default') : 'proc-bar--default';

  return (
    <div className={`proc-bar ${barClass}`}>
      <div className="proc-bar-meta">
        <span className="proc-bar-label">{docTypeLabel}</span>
        <span className="proc-bar-number">{docNumber}</span>
      </div>

      {statusVariant && statusLabel && (
        <>
          <div className="proc-bar-sep" />
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </>
      )}

      {chain && <div className="proc-bar-chain">{chain}</div>}

      <div className="proc-bar-actions">
        {children}
      </div>
    </div>
  );
}
