'use client';
import React from 'react';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { Button } from '@/components/ui';
import { useT } from '@/lib/i18n/useT';
import { rowItemTotal } from '@/lib/utils/po-item-totals';

export interface ProductOption {
  value: number;
  label: string;
  searchText?: string;
}

interface BaseEditableItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  discount?: number;
  tax_rate?: number;
}

interface Props<T extends BaseEditableItem> {
  items: T[];
  /** Called for every numeric field change: quantity, unit_price, discount, tax_rate (and product_id when productOptions used). */
  onUpdate: (index: number, field: string, value: number) => void;
  /** When provided, each row gets a remove button. */
  onRemove?: (index: number) => void;
  /** When provided, product cell renders a SearchableDropdown; otherwise renderProduct is used. */
  productOptions?: ProductOption[];
  /** Custom product cell renderer — used when productOptions is absent. */
  renderProduct?: (item: T) => React.ReactNode;
  /** Show Unit column (default true). PO edit omits it. */
  showUnit?: boolean;
  /** Resolve unit label from an item — called only when showUnit is true. */
  getUnit?: (item: T) => string;
  formatPrice: (n: number) => string;
}

export function EditableStandardItemsTable<T extends BaseEditableItem>({
  items,
  onUpdate,
  onRemove,
  productOptions,
  renderProduct,
  showUnit = true,
  getUnit,
  formatPrice,
}: Props<T>) {
  const t = useT();

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>{t('col', 'product')}</th>
            {showUnit && <th>{t('col', 'unit')}</th>}
            <th>{t('col', 'quantity')}</th>
            <th>{t('col', 'unitPrice')}</th>
            <th>{t('col', 'discountPct')}</th>
            <th>{t('col', 'taxPct')}</th>
            <th>{t('col', 'total')}</th>
            {onRemove && <th></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td>
                {productOptions ? (
                  <SearchableDropdown
                    options={productOptions}
                    value={item.product_id}
                    onChange={(val) => onUpdate(index, 'product_id', val ? Number(val) : 0)}
                    placeholder="Select product..."
                    searchPlaceholder="Search products..."
                  />
                ) : renderProduct ? (
                  renderProduct(item)
                ) : null}
              </td>
              {showUnit && (
                <td style={{ color: 'var(--text-secondary)' }}>
                  {getUnit ? getUnit(item) : '—'}
                </td>
              )}
              <td>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={item.quantity}
                  onChange={(e) => onUpdate(index, 'quantity', parseFloat(e.target.value) || 0)}
                  className="form-input"
                  style={{ width: 80 }}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => onUpdate(index, 'unit_price', parseFloat(e.target.value) || 0)}
                  className="form-input"
                  style={{ width: 96 }}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={item.discount ?? 0}
                  onChange={(e) => onUpdate(index, 'discount', parseFloat(e.target.value) || 0)}
                  className="form-input"
                  style={{ width: 80 }}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={item.tax_rate ?? 0}
                  onChange={(e) => onUpdate(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                  className="form-input"
                  style={{ width: 80 }}
                />
              </td>
              <td>
                <div style={{ fontWeight: 'var(--weight-semibold)' }}>
                  {formatPrice(rowItemTotal(item))}
                </div>
              </td>
              {onRemove && (
                <td>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => onRemove(index)}
                  >
                    {t('btn', 'delete')}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
