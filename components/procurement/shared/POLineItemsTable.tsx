'use client';

import type { PurchaseOrderItem, PurchaseOrderCharge } from '@/types';
import { formatPrice } from '@/lib/utils/format';

/* ── Per-row math ──────────────────────────────────────────────────────── */

export interface POLineRow {
  num:        number;
  description:string;
  code?:      string;
  notes?:     string;
  unit?:      string;
  qty:        number;
  unitPrice:  number;
  exclVat:    number;
  vat:        number;
  totalIncl:  number;
}

export function buildLineRows(
  items:      PurchaseOrderItem[],
  charges:    PurchaseOrderCharge[] = [],
  chargesVat: number = 0,
): POLineRow[] {
  const itemRows: POLineRow[] = items.map((item, i) => {
    const afterDisc =
      Number(item.quantity) * Number(item.unit_price) *
      (1 - (Number(item.discount) || 0) / 100);
    const vat = afterDisc * ((Number(item.tax_rate) || 0) / 100);
    return {
      num:        i + 1,
      description: item.product?.name ?? `Item #${item.product_id}`,
      code:       item.product?.code,
      notes:      item.notes || undefined,
      unit:       item.product?.unit,
      qty:        Number(item.quantity),
      unitPrice:  Number(item.unit_price),
      exclVat:    afterDisc,
      vat,
      totalIncl:  afterDisc + vat,
    };
  });

  const totalChargesBase = charges.reduce((s, c) => s + Number(c.total), 0) || 1;
  const chargeRows: POLineRow[] = charges.map((ch, i) => {
    const excl = Number(ch.total);
    const vat  = chargesVat > 0 ? (excl / totalChargesBase) * chargesVat : 0;
    return {
      num:        items.length + i + 1,
      description: ch.description,
      unit:       ch.charge_type === 'per_unit' ? '—' : undefined,
      qty:        ch.charge_type === 'per_unit' ? Number(ch.quantity) : 1,
      unitPrice:  Number(ch.rate),
      exclVat:    excl,
      vat,
      totalIncl:  excl + vat,
    };
  });

  return [...itemRows, ...chargeRows];
}

/* ── UI Component (detail page / forms) ───────────────────────────────── */

const TH: React.CSSProperties = {
  padding: '9px 14px',
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  whiteSpace: 'nowrap',
  border: 'none',
  background: 'var(--surface-subtle)',
};

const TD: React.CSSProperties = {
  padding: '11px 14px',
  border: 'none',
  borderBottom: '1px solid var(--border-subtle)',
  fontSize: 13,
};

interface Props {
  items:      PurchaseOrderItem[];
  charges?:   PurchaseOrderCharge[];
  chargesVat?: number;
}

export function POLineItemsTable({ items, charges = [], chargesVat = 0 }: Props) {
  const rows = buildLineRows(items, charges, chargesVat);
  const hasMultiple = rows.length > 1;

  const totalExcl  = rows.reduce((s, r) => s + r.exclVat,    0);
  const totalVat   = rows.reduce((s, r) => s + r.vat,        0);
  const totalIncl  = rows.reduce((s, r) => s + r.totalIncl,  0);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <colgroup>
          <col style={{ width: 32 }} />
          <col />
          <col style={{ width: 54 }} />
          <col style={{ width: 64 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 112 }} />
          <col style={{ width: 96 }} />
          <col style={{ width: 128 }} />
        </colgroup>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border-subtle)' }}>
            <th style={{ ...TH, textAlign: 'center' }}>#</th>
            <th style={{ ...TH, textAlign: 'left'   }}>Description</th>
            <th style={{ ...TH, textAlign: 'center' }}>Unit</th>
            <th style={{ ...TH, textAlign: 'right'  }}>Qty</th>
            <th style={{ ...TH, textAlign: 'right'  }}>Unit Price</th>
            <th style={{ ...TH, textAlign: 'right'  }}>Excl. VAT</th>
            <th style={{ ...TH, textAlign: 'right'  }}>VAT</th>
            <th style={{ ...TH, textAlign: 'right'  }}>Total incl. VAT</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.num}>
              <td style={{ ...TD, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                {row.num}
              </td>
              <td style={TD}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                  {row.description}
                </div>
                {row.code && (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginTop: 2 }}>
                    {row.code}
                  </div>
                )}
                {row.notes && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, fontStyle: 'italic' }}>
                    {row.notes}
                  </div>
                )}
              </td>
              <td style={{ ...TD, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
                {row.unit?.toUpperCase() || '—'}
              </td>
              <td style={{ ...TD, textAlign: 'right', fontFamily: 'monospace' }}>
                {row.qty.toFixed(2)}
              </td>
              <td style={{ ...TD, textAlign: 'right', fontFamily: 'monospace' }}>
                {formatPrice(row.unitPrice)}
              </td>
              <td style={{ ...TD, textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                {formatPrice(row.exclVat)}
              </td>
              <td style={{ ...TD, textAlign: 'right', fontFamily: 'monospace', color: row.vat > 0 ? '#d97706' : 'var(--text-tertiary)', fontWeight: row.vat > 0 ? 600 : 400 }}>
                {row.vat > 0 ? formatPrice(row.vat) : '—'}
              </td>
              <td style={{ ...TD, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatPrice(row.totalIncl)}
              </td>
            </tr>
          ))}
        </tbody>

        {hasMultiple && (
          <tfoot>
            <tr style={{ background: 'var(--surface-subtle)', borderTop: '2px solid var(--border-subtle)' }}>
              <td colSpan={5} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Totals
              </td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {formatPrice(totalExcl)}
              </td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: totalVat > 0 ? '#d97706' : 'var(--text-tertiary)' }}>
                {totalVat > 0 ? formatPrice(totalVat) : '—'}
              </td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-primary)' }}>
                {formatPrice(totalIncl)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
