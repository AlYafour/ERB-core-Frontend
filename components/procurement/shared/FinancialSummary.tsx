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

const VALUE_CLASS: Record<NonNullable<SummaryRow['variant']>, string> = {
  discount: 'proc-summary-row-value proc-summary-row-value--discount',
  success:  'proc-summary-row-value',
  brand:    'proc-summary-row-value',
  bold:     'proc-summary-row-value',
};

export function FinancialSummary({ rows, total, totalLabel = 'Total' }: Props) {
  const visible = rows.filter((r) => !r.hidden && r.value != null && Number(r.value) !== 0);

  return (
    <div className="proc-financial-grid">
      <div className="proc-financial-box">
        {visible.map((row, i) => (
          <div key={i} className="proc-financial-row">
            <span className="proc-financial-row-label">{row.label}</span>
            <span className={row.variant ? VALUE_CLASS[row.variant] : 'proc-financial-row-value'}>
              {row.prefix}{formatPrice(Number(row.value ?? 0))}
            </span>
          </div>
        ))}
        <div className="proc-financial-total">
          <span className="proc-financial-total-label">{totalLabel}</span>
          <span className="proc-financial-total-value">{formatPrice(Number(total ?? 0))}</span>
        </div>
      </div>
    </div>
  );
}
