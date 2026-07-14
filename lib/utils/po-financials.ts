import { PurchaseOrder, POFinancials } from '@/types';
import { poItemBreakdown } from './po-item-totals';

/**
 * Single access point for a PO's financial numbers.
 *
 * Primary source: `po.financials` — computed server-side by
 * PurchaseOrder.financial_breakdown(), the one canonical formula.
 * Fallback: derived client-side from the lines, ONLY for responses produced
 * by an older backend during a deploy overlap. New code must never read
 * po.total / po.subtotal / po.tax_amount directly for display.
 */
export function poFinancials(po: PurchaseOrder): POFinancials {
  if (po.financials) return po.financials;

  const { itemsSubtotal, itemsVat } = poItemBreakdown(po.items ?? []);
  const chargesTotal = (po.charges ?? []).reduce((s, c) => s + Number(c.total), 0);
  const transport = Number(po.transportation_charge) || 0;
  const discount = Number(po.discount) || 0;
  const chargesVat = Number(po.charges_vat) || 0;
  const taxAmount = Number(po.tax_amount) || 0;
  const hasExplicitTax = Number(po.tax_rate) > 0;
  const transportVat = hasExplicitTax ? 0 : Math.max(0, taxAmount - chargesVat);
  const vatTotal = itemsVat + transportVat + chargesVat + (hasExplicitTax ? taxAmount : 0);
  const subtotal = itemsSubtotal + chargesTotal;

  return {
    items_subtotal: itemsSubtotal,
    items_vat: itemsVat,
    charges_total: chargesTotal,
    subtotal,
    discount,
    transport,
    vat_total: vatTotal,
    grand_total: subtotal - discount + transport + vatTotal,
  };
}

/** Display VAT percentage for the document VAT row. */
export function poVatPercent(po: PurchaseOrder, fin: POFinancials): number {
  if (Number(po.tax_rate) > 0) return Number(po.tax_rate);
  if (fin.items_vat > 0 && fin.items_subtotal > 0) {
    return Math.round((fin.items_vat / fin.items_subtotal) * 100);
  }
  return 0;
}
