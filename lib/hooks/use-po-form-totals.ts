import { useMemo } from 'react';

export interface POFormItem {
  quantity: number;
  unit_price: number;
  discount?: number | null;
  tax_rate?: number | null;
}

export interface POFormData {
  discount: number;
  tax_rate: number;
  transportation_charge?: number;
  transport_vat_included?: boolean;
}

export interface POFormCharge {
  charge_type: 'lump_sum' | 'per_unit';
  rate: string | number;
  quantity: string | number;
}

export interface POFormTotals {
  subtotal: number;
  itemVat: number;
  /** VAT on transportation only (Priority-2 derived rate). 0 when explicit tax_rate set. */
  transportVat: number;
  /** VAT on additional charges (Priority-2 derived rate). 0 when explicit tax_rate set. */
  chargesVat: number;
  /** Combined additional tax (Priority-1 explicit rate only). 0 when using derived rate. */
  additionalTax: number;
  effectiveVatRate: number;
  chargesTotal: number;
  total: number;
}

/**
 * Live-compute PO totals for edit/new forms.
 *
 * Priority 1 (tax_rate > 0 — explicit order-level tax):
 *   taxable_base = after_discount + charges + transport_if_included
 *   additionalTax = taxable_base × tax_rate%
 *   transportVat = chargesVat = 0  (no split — shown as one line)
 *
 * Priority 2 (tax_rate == 0, derived from item VAT):
 *   effective_rate = item_vat / item_pretax
 *   transportVat   = transport_if_included × effective_rate
 *   chargesVat     = charges_total × effective_rate
 *   additionalTax  = 0
 *
 * total = after_discount + transport + transportVat + chargesVat + additionalTax + charges
 */
export function usePOFormTotals(
  formData: POFormData,
  items: POFormItem[],
  charges: POFormCharge[] = [],
): POFormTotals {
  return useMemo(() => {
    // ── Item breakdown ──────────────────────────────────────────────────────
    let subtotal = 0;
    let itemVat = 0;
    for (const item of items) {
      const afterDiscount =
        Number(item.quantity) * Number(item.unit_price) *
        (1 - (Number(item.discount) || 0) / 100);
      subtotal += afterDiscount;
      itemVat += afterDiscount * ((Number(item.tax_rate) || 0) / 100);
    }

    // ── Charges total ───────────────────────────────────────────────────────
    let chargesTotal = 0;
    for (const c of charges) {
      const rate = Number(c.rate) || 0;
      const qty  = Number(c.quantity) || 1;
      chargesTotal += c.charge_type === 'lump_sum' ? rate : rate * qty;
    }

    // ── Discount ────────────────────────────────────────────────────────────
    const subtotalWithVat  = subtotal + itemVat;
    const discountPct      = Number(formData.discount) || 0;
    const afterDiscount    = subtotalWithVat * (1 - discountPct / 100);
    const transport        = Number(formData.transportation_charge) || 0;
    const taxRate          = Number(formData.tax_rate) || 0;
    const transportVatOn   = formData.transport_vat_included ?? true;

    let transportVat   = 0;
    let chargesVat     = 0;
    let additionalTax  = 0;
    let effectiveVatRate = 0;

    if (taxRate > 0) {
      // Priority 1 — one combined additional-tax line
      const taxableBase = afterDiscount + chargesTotal + (transportVatOn ? transport : 0);
      additionalTax = taxableBase * (taxRate / 100);
    } else if ((chargesTotal > 0 || (transportVatOn && transport > 0)) && subtotal > 0 && itemVat > 0) {
      // Priority 2 — split by recipient
      effectiveVatRate = itemVat / subtotal;
      transportVat  = transportVatOn ? transport * effectiveVatRate : 0;
      chargesVat    = chargesTotal   * effectiveVatRate;
    }

    const total = afterDiscount + transport + transportVat + chargesVat + additionalTax + chargesTotal;

    return {
      subtotal,
      itemVat,
      transportVat,
      chargesVat,
      additionalTax,
      effectiveVatRate,
      chargesTotal,
      total,
    };
  }, [
    formData.discount,
    formData.tax_rate,
    formData.transportation_charge,
    formData.transport_vat_included,
    items,
    charges,
  ]);
}
