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
  chargesCount?: number;
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
  chargesCount = 0,
}: Props) {
  const combinedSubtotal = totals.subtotal + totals.chargesTotal;
  const combinedVat      = totals.itemVat + totals.transportVat + totals.chargesVat + totals.additionalTax;
  const discountAmt      = totals.subtotal * ((discount || 0) / 100);
  const vatPct           = Math.round(totals.effectiveVatRate * 100) || (taxRate ?? 0);

  return (
    <div className="proc-summary-wrap">
      <div className="proc-summary-panel">

        {/* Editable inputs */}
        {(!lockDiscount && onDiscountChange) || onTaxRateChange || onTransportChange ? (
          <div className="proc-summary-inputs">
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
                <label className="form-label">Additional Tax (%)</label>
                <input type="number" min="0" max="100" step="0.01" className="form-input"
                  value={taxRate || ''}
                  onChange={(e) => onTaxRateChange(parseFloat(e.target.value) || 0)} />
              </div>
            )}
            {onTransportChange && (
              <div>
                <label className="form-label">Transportation (AED)</label>
                <input type="number" min="0" step="0.01" className="form-input" placeholder="0.00"
                  value={transportationCharge || ''}
                  onChange={(e) => onTransportChange(parseFloat(e.target.value) || 0)} />
                {onTransportVatChange && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={transportVatIncluded}
                      onChange={(e) => onTransportVatChange(e.target.checked)} />
                    Apply VAT on transportation
                  </label>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* Totals card */}
        <div className="proc-summary-card">
          <div className="proc-summary-card-head">Order Summary</div>
          <div className="proc-summary-rows">
            <SRow label="Subtotal" value={formatPrice(combinedSubtotal)} />
            {(discount || 0) > 0 && (
              <SRow label={`Discount (${discount}%)`} value={`– ${formatPrice(discountAmt)}`} accent />
            )}
            {transportationCharge > 0 && (
              <SRow label="Transportation" value={formatPrice(transportationCharge)} />
            )}
            {combinedVat > 0 && (
              <SRow label={vatPct > 0 ? `VAT (${vatPct}%)` : 'VAT'} value={formatPrice(combinedVat)} />
            )}
          </div>
          <div className="proc-summary-total-row">
            <span className="proc-summary-total-label">Total</span>
            <span className="proc-summary-total-value">{formatPrice(totals.total)}</span>
          </div>
        </div>

      </div>
    </div>
  );
}

function SRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="proc-summary-row">
      <span className="proc-summary-row-label">{label}</span>
      <span className={`proc-summary-row-value${accent ? ' proc-summary-row-value--discount' : ''}`}>{value}</span>
    </div>
  );
}
