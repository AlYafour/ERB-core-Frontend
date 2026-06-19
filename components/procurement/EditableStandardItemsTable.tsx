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
  onUpdate: (index: number, field: string, value: number) => void;
  onRemove?: (index: number) => void;
  productOptions?: ProductOption[];
  renderProduct?: (item: T) => React.ReactNode;
  showUnit?: boolean;
  getUnit?: (item: T) => string;
  formatPrice: (n: number) => string;
  readOnly?: boolean;
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
  readOnly = false,
}: Props<T>) {
  const t = useT();

  if (items.length === 0) {
    return (
      <div className="proc-empty-items">
        <div className="proc-empty-items-icon">📦</div>
        <p className="proc-empty-items-title">No items added yet</p>
        <p className="proc-empty-items-desc">Use the panel above to add products</p>
      </div>
    );
  }

  return (
    <div className="proc-items-wrap">
      <table className="proc-items-table">
        <thead>
          <tr>
            <th style={{ width: 36, textAlign: 'center' }}>#</th>
            <th>{t('col', 'product')}</th>
            {showUnit && <th style={{ width: 80 }}>{t('col', 'unit')}</th>}
            <th style={{ width: 90 }}>{t('col', 'quantity')}</th>
            <th style={{ width: 110 }}>{t('col', 'unitPrice')}</th>
            <th style={{ width: 90 }}>{t('col', 'discountPct')}</th>
            <th style={{ width: 90 }}>{t('col', 'taxPct')}</th>
            <th style={{ width: 110, textAlign: 'right' }}>{t('col', 'total')}</th>
            {onRemove && <th style={{ width: 48 }} />}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td className="row-num">{index + 1}</td>
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
                <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
                  {getUnit ? getUnit(item) : '—'}
                </td>
              )}
              <td>
                <input type="number" min="0" step="any" className="form-input" style={{ width: 76 }}
                  value={item.quantity} disabled={readOnly}
                  onChange={(e) => onUpdate(index, 'quantity', parseFloat(e.target.value) || 0)} />
              </td>
              <td>
                <input type="number" min="0" step="0.01" className="form-input" style={{ width: 96 }}
                  value={item.unit_price} disabled={readOnly}
                  onChange={(e) => onUpdate(index, 'unit_price', parseFloat(e.target.value) || 0)} />
              </td>
              <td>
                <input type="number" min="0" max="100" step="0.01" className="form-input" style={{ width: 72 }}
                  value={item.discount ?? 0} disabled={readOnly}
                  onChange={(e) => onUpdate(index, 'discount', parseFloat(e.target.value) || 0)} />
              </td>
              <td>
                <input type="number" min="0" max="100" step="0.01" className="form-input" style={{ width: 72 }}
                  value={item.tax_rate ?? 0} disabled={readOnly}
                  onChange={(e) => onUpdate(index, 'tax_rate', parseFloat(e.target.value) || 0)} />
              </td>
              <td className="cell-total">
                {formatPrice(rowItemTotal(item))}
              </td>
              {onRemove && (
                <td style={{ textAlign: 'center' }}>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => onRemove(index)}
                    style={{ color: 'var(--status-error)', padding: '0 6px' }}
                  >✕</Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
