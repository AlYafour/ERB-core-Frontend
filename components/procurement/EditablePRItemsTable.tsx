'use client';
import React from 'react';
import SearchableDropdown, { DropdownOption } from '@/components/ui/SearchableDropdown';
import { useT } from '@/lib/i18n/useT';

export interface BasePRItem {
  product_id: number;
  quantity: number;
  unit: string;
  reason: string;
  notes: string;
}

interface Props<T extends BasePRItem> {
  items: T[];
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
  renderProduct: (item: T) => React.ReactNode;
  unitOptions: DropdownOption[];
}

export function EditablePRItemsTable<T extends BasePRItem>({
  items,
  onUpdate,
  onRemove,
  renderProduct,
  unitOptions,
}: Props<T>) {
  const t = useT();

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>{t('col', 'product')}</th>
            <th>{t('col', 'quantity')}</th>
            <th>{t('col', 'unit')}</th>
            <th>{t('field', 'reason')}</th>
            <th>{t('col', 'notes')}</th>
            <th style={{ width: 60 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td>{renderProduct(item)}</td>
              <td>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={(e) => onUpdate(index, 'quantity', Math.floor(Number(e.target.value)) || 1)}
                  className="form-input"
                  style={{ width: 80 }}
                />
              </td>
              <td>
                <SearchableDropdown
                  options={unitOptions}
                  value={item.unit || ''}
                  onChange={(val) => onUpdate(index, 'unit', val || '')}
                  placeholder="Unit"
                  searchPlaceholder="Search unit..."
                  allowClear
                />
              </td>
              <td>
                <input
                  type="text"
                  value={item.reason || ''}
                  onChange={(e) => onUpdate(index, 'reason', e.target.value)}
                  placeholder="Purpose"
                  className="form-input"
                  style={{ width: 150 }}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={item.notes || ''}
                  onChange={(e) => onUpdate(index, 'notes', e.target.value)}
                  placeholder="Notes"
                  className="form-input"
                  style={{ width: 150 }}
                />
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  title="Remove"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
                    background: 'transparent', border: '1px solid transparent',
                    color: 'var(--status-error)', transition: 'all 100ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(220,38,38,0.07)';
                    e.currentTarget.style.borderColor = 'rgba(220,38,38,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6m4-6v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
