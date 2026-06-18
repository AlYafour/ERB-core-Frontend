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

export interface POFormTotals {
  subtotal: number;
  itemVat: number;
  taxAmount: number;
  effectiveVatRate: number;
  total: number;
}

/**
 * Live-compute PO totals for edit/new forms.
 *
 * Mirrors backend PurchaseOrder.calculate_total() exactly:
 *
 *   Priority 1 (tax_rate > 0):
 *     taxable_base = (after_discount + transport) if transport_vat_included else after_discount
 *     tax_amount   = taxable_base × tax_rate%
 *
 *   Priority 2 (tax_rate == 0, transport_vat_included, transport > 0):
 *     effective_rate = item_vat / item_pretax
 *     tax_amount     = transport × effective_rate
 *
 *   total = after_discount + transport + tax_amount
 *
 * order.discount is treated as a percentage of subtotalWithVat (consistent with
 * form inputs which show discount as 0-100%). The backend stores it as a flat
 * AED amount — these should be aligned in a future cleanup.
 */
export function usePOFormTotals(formData: POFormData, items: POFormItem[]): POFormTotals {
  return useMemo(() => {
    // Step 1 — item-level breakdown (item.discount is a percentage 0-100)
    let subtotal = 0;
    let itemVat = 0;
    for (const item of items) {
      const afterDiscount =
        Number(item.quantity) * Number(item.unit_price) *
        (1 - (Number(item.discount) || 0) / 100);
      subtotal += afterDiscount;
      itemVat += afterDiscount * ((Number(item.tax_rate) || 0) / 100);
    }

    // Step 2 — mirror backend calculate_total()
    // Backend self.subtotal = SUM(item.total) = pre-VAT + item VAT
    const subtotalWithVat = subtotal + itemVat;
    const discountPct = Number(formData.discount) || 0;
    const discountAmount = subtotalWithVat * (discountPct / 100);
    const afterDiscount = subtotalWithVat - discountAmount;
    const transport = Number(formData.transportation_charge) || 0;
    const taxRate = Number(formData.tax_rate) || 0;
    const transportVatIncluded = formData.transport_vat_included ?? true;

    let taxAmount = 0;
    let effectiveVatRate = 0;

    if (taxRate > 0) {
      // Priority 1: explicit order-level tax rate
      const taxableBase = transportVatIncluded ? afterDiscount + transport : afterDiscount;
      taxAmount = taxableBase * (taxRate / 100);
    } else if (transportVatIncluded && transport > 0 && subtotal > 0 && itemVat > 0) {
      // Priority 2: transport VAT derived from item effective VAT rate
      effectiveVatRate = itemVat / subtotal;
      taxAmount = transport * effectiveVatRate;
    }

    return {
      subtotal,
      itemVat,
      taxAmount,
      effectiveVatRate,
      total: afterDiscount + transport + taxAmount,
    };
  }, [
    formData.discount,
    formData.tax_rate,
    formData.transportation_charge,
    formData.transport_vat_included,
    items,
  ]);
}
