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
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} style={col.align ? { textAlign: col.align } : undefined}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  padding: 'var(--space-4)',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            items.map((item, i) => (
              <tr key={i}>
                {columns.map((col, j) => (
                  <td key={j} style={col.align ? { textAlign: col.align } : undefined}>
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
