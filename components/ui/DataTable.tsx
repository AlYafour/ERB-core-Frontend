'use client';

import React from 'react';
import { Checkbox, Button, Loader, Skeleton } from '@/components/ui';

// ── Column definition ────────────────────────────────────────────────────────
export interface Column<T> {
  key: string;
  header: React.ReactNode;
  width?: number | string;
  className?: string;
  render: (item: T, index: number) => React.ReactNode;
}

// ── Props ────────────────────────────────────────────────────────────────────
interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  getItemId?: (item: T) => number;

  isLoading?: boolean;
  error?: unknown;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;

  // Selection
  selectable?: boolean;
  selectedItems?: Set<number>;
  onToggleSelect?: (id: number) => void;
  onToggleSelectAll?: (ids: number[]) => void;
  isAllSelected?: boolean;
  isSomeSelected?: boolean;

  // Pagination
  page: number;
  totalCount: number;
  pageSize?: number;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPageChange: (page: number) => void;

  // Row styling
  rowStyle?: (item: T) => React.CSSProperties | undefined;
}

// ── Pagination bar ───────────────────────────────────────────────────────────
function PaginationBar({
  page, totalCount, pageSize = 20, hasPrev, hasNext, onPageChange,
}: {
  page: number; totalCount: number; pageSize?: number;
  hasPrev?: boolean; hasNext?: boolean;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between card">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {from}–{to} of {totalCount}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev && page === 1}
        >
          Previous
        </Button>
        <span className="flex items-center px-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {page} / {totalPages}
        </span>
        <Button
          variant="secondary"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext && page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// ── DataTable ────────────────────────────────────────────────────────────────
export default function DataTable<T>({
  columns, data, getItemId,
  isLoading, error, emptyMessage = 'No records found.', emptyAction,
  selectable, selectedItems, onToggleSelect, onToggleSelectAll,
  isAllSelected, isSomeSelected,
  page, totalCount, pageSize = 20, hasPrev, hasNext, onPageChange,
  rowStyle,
}: DataTableProps<T>) {
  const getId = getItemId ?? ((item: T) => (item as { id: number }).id);
  const ids   = data.map(getId);

  if (isLoading) {
    return (
      <div className="card p-5 space-y-2.5">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          style={{ color: 'var(--status-error)', opacity: 0.7, margin: '0 auto 10px' }}>
          <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4m0 4h.01" />
        </svg>
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--status-error)', margin: 0 }}>
          Failed to load data. Please try again.
        </p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px', display: 'block' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4m4 0v-2a4 4 0 018 0v2" />
        </svg>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
          {emptyMessage}
        </p>
        {emptyAction}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                {selectable && (
                  <th style={{ width: 44 }}>
                    <Checkbox
                      checked={isAllSelected ?? false}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected ?? false;
                      }}
                      onChange={() => onToggleSelectAll?.(ids)}
                    />
                  </th>
                )}
                {columns.map(col => (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={col.className}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => {
                const id = getId(item);
                return (
                  <tr key={id} style={rowStyle?.(item)}>
                    {selectable && (
                      <td>
                        <Checkbox
                          checked={selectedItems?.has(id) ?? false}
                          onChange={() => onToggleSelect?.(id)}
                        />
                      </td>
                    )}
                    {columns.map(col => (
                      <td key={col.key} className={col.className}>
                        {col.render(item, idx)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationBar
        page={page}
        totalCount={totalCount}
        pageSize={pageSize}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPageChange={onPageChange}
      />
    </div>
  );
}
