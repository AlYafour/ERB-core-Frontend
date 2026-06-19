'use client';

import { formatPrice } from '@/lib/utils/format';

export interface SummaryRow {
  label: string;
  value: number | string | null | undefined;
  variant?: 'discount' | 'success' | 'brand' | 'bold';
  prefix?: string;
  hidden?: boolean;
}

interface Props {
  rows: SummaryRow[];
  total: number | string | null | undefined;
  totalLabel?: string;
}

const COLOR: Record<NonNullable<SummaryRow['variant']>, string> = {
  discount: 'var(--color-error)',
  success:  'var(--color-success)',
  brand:    'var(--brand)',
  bold:     'var(--text-primary)',
};

export function FinancialSummary({ rows, total, totalLabel = 'Total' }: Props) {
  const visible = rows.filter((r) => !r.hidden && r.value != null && Number(r.value) !== 0);

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ width: 272, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((row, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{row.label}:</span>
            <span style={{
              fontWeight: 'var(--weight-semibold)',
              color: row.variant ? COLOR[row.variant] : 'var(--text-primary)',
            }}>
              {row.prefix}{formatPrice(Number(row.value ?? 0))}
            </span>
          </div>
        ))}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 8,
          fontSize: 'var(--text-base)',
        }}>
          <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>{totalLabel}:</span>
          <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>
            {formatPrice(Number(total ?? 0))}
          </span>
        </div>
      </div>
    </div>
  );
}
