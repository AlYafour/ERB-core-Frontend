'use client';

import { formatPrice } from '@/lib/utils/format';
import type { POFormTotals } from '@/lib/hooks/use-po-form-totals';

interface Props {
  totals: POFormTotals;
  discount: number;
  taxRate?: number;
  transportationCharge?: number;
  transportVatIncluded?: boolean;
  lockDiscount?: boolean;
  onDiscountChange?: (v: number) => void;
  onTaxRateChange?: (v: number) => void;
  onTransportChange?: (v: number) => void;
  onTransportVatChange?: (checked: boolean) => void;
}

export function POFormSummary({
  totals,
  discount,
  taxRate,
  transportationCharge = 0,
  transportVatIncluded = true,
  lockDiscount = false,
  onDiscountChange,
  onTaxRateChange,
  onTransportChange,
  onTransportVatChange,
}: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-6)' }}>
      <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {/* Inputs */}
        {!lockDiscount && onDiscountChange && (
          <div>
            <label className="form-label">Discount (%)</label>
            <input type="number" min="0" max="100" step="0.01" className="form-input"
              value={discount || ''}
              onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)} />
          </div>
        )}

        {onTaxRateChange && (
          <div>
            <label className="form-label">Additional Tax Rate (%)</label>
            <input type="number" min="0" max="100" step="0.01" className="form-input"
              value={taxRate || ''}
              onChange={(e) => onTaxRateChange(parseFloat(e.target.value) || 0)} />
          </div>
        )}

        {onTransportChange && (
          <div>
            <label className="form-label">Transportation Charge (AED)</label>
            <input type="number" min="0" step="0.01" className="form-input" placeholder="0.00"
              value={transportationCharge || ''}
              onChange={(e) => onTransportChange(parseFloat(e.target.value) || 0)} />
            {onTransportVatChange && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={transportVatIncluded}
                  onChange={(e) => onTransportVatChange(e.target.checked)} />
                Apply VAT on transportation charge
              </label>
            )}
          </div>
        )}

        {/* Totals card */}
        <div className="card" style={{ padding: 'var(--space-4)', background: 'var(--surface-inset)' }}>
          <Row label="Subtotal" value={formatPrice(totals.subtotal)} />
          {totals.itemVat > 0 && <Row label="VAT (items)" value={formatPrice(totals.itemVat)} />}
          {discount > 0 && <Row label={`Discount (${discount}%)`} value={`– ${formatPrice((totals.subtotal + totals.itemVat) * (discount / 100))}`} accent="error" />}
          {transportationCharge > 0 && <Row label="Transportation" value={formatPrice(transportationCharge)} />}
          {totals.taxAmount > 0 && (taxRate || 0) === 0 && (
            <Row label={`VAT (transport ${Math.round(totals.effectiveVatRate * 100)}%)`} value={formatPrice(totals.taxAmount)} />
          )}
          {totals.taxAmount > 0 && (taxRate || 0) > 0 && (
            <Row label={`Additional Tax (${taxRate}%)`} value={formatPrice(totals.taxAmount)} />
          )}
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-base)' }}>
            <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>Total</span>
            <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>{formatPrice(totals.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: 'error' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 'var(--weight-semibold)', color: accent ? 'var(--color-error)' : 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
