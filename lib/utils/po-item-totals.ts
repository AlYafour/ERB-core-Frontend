import { PurchaseOrderItem } from '@/types';

export interface POItemBreakdown {
  itemsSubtotal: number;
  itemsVat: number;
}

/**
 * Derives the pre-VAT subtotal and item-level VAT from saved PO items.
 *
 * Used by read-only views (PO detail, LPO print) where order.subtotal from
 * the backend already includes per-item VAT and cannot be displayed directly
 * as the "Subtotal" row.
 *
 * item.discount is stored as a percentage (0–100).
 */
export function poItemBreakdown(items: PurchaseOrderItem[]): POItemBreakdown {
  let itemsSubtotal = 0;
  let itemsVat = 0;
  for (const item of items) {
    const afterDiscount =
      Number(item.quantity) * Number(item.unit_price) *
      (1 - (Number(item.discount) || 0) / 100);
    itemsSubtotal += afterDiscount;
    itemsVat += afterDiscount * ((Number(item.tax_rate) || 0) / 100);
  }
  return { itemsSubtotal, itemsVat };
}
