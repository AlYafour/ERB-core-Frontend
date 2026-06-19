'use client';
import React from 'react';
import { GRNItem } from '@/lib/api/goods-receiving';
import { QUALITY_LABEL } from '@/lib/constants/status-labels';

interface Props {
  items: GRNItem[];
  onUpdate: (index: number, field: string, value: any) => void;
  renderProduct: (item: GRNItem) => React.ReactNode;
  getUnit: (item: GRNItem) => string;
}

export function EditableGRNItemsTable({ items, onUpdate, renderProduct, getUnit }: Props) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Unit</th>
            <th>Ordered Qty</th>
            <th>Received Qty</th>
            <th>Rejected Qty</th>
            <th>Quality Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td>{renderProduct(item)}</td>
              <td style={{ color: 'var(--text-secondary)' }}>{getUnit(item)}</td>
              <td>{item.ordered_quantity}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  max={item.ordered_quantity}
                  step="any"
                  value={item.received_quantity}
                  onChange={(e) => onUpdate(index, 'received_quantity', parseFloat(e.target.value) || 0)}
                  className="form-input"
                  style={{ width: 96 }}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  max={item.ordered_quantity - item.received_quantity}
                  step="any"
                  value={item.rejected_quantity}
                  onChange={(e) => onUpdate(index, 'rejected_quantity', parseFloat(e.target.value) || 0)}
                  className="form-input"
                  style={{ width: 96 }}
                />
              </td>
              <td>
                <select
                  value={item.quality_status}
                  onChange={(e) => onUpdate(index, 'quality_status', e.target.value as GRNItem['quality_status'])}
                  className="form-select"
                >
                  {Object.entries(QUALITY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="text"
                  value={item.notes || ''}
                  onChange={(e) => onUpdate(index, 'notes', e.target.value)}
                  className="form-input"
                  placeholder="Notes..."
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
