'use client';

import React from 'react';

export interface ColumnDef<T> {
  header: React.ReactNode;
  cell: (item: T, index: number) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
}

interface Props<T> {
  items: T[];
  columns: ColumnDef<T>[];
  emptyMessage?: string;
}

export function ReadOnlyItemsTable<T>({
  items,
  columns,
  emptyMessage = 'No items.',
}: Props<T>) {
  return (
    <div className="proc-detail-table-wrap">
      <table className="proc-detail-table">
        <thead>
          <tr>
            <th className="col-num">#</th>
            {columns.map((col, i) => (
              <th key={i} className={col.align === 'right' ? 'col-right' : col.align === 'center' ? 'col-num' : undefined}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '28px 16px', fontStyle: 'italic', fontSize: 'var(--text-sm)' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            items.map((item, i) => (
              <tr key={i}>
                <td className="col-num">{i + 1}</td>
                {columns.map((col, j) => (
                  <td key={j} className={col.align === 'right' ? 'col-right' : col.align === 'center' ? 'col-num' : undefined}>
                    {col.cell(item, i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
