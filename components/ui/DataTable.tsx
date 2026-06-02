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
  onRetry?: () => void;
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

  // Row styling & click
  rowStyle?: (item: T) => React.CSSProperties | undefined;
  onRowClick?: (item: T) => void;

  /**
   * When true, renders without outer card wrappers — designed to be placed
   * inside <WorkspaceSurface>. Loading/empty/error states fill the surface.
   * Pagination renders as an integrated footer row with a top border separator.
   */
  surface?: boolean;
}

// ── Pagination bar ───────────────────────────────────────────────────────────
function PaginationBar({
  page, totalCount, pageSize = 20, hasPrev, hasNext, onPageChange, surface,
}: {
  page: number; totalCount: number; pageSize?: number;
  hasPrev?: boolean; hasNext?: boolean;
  onPageChange: (p: number) => void;
  surface?: boolean;
}) {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, totalCount);

  const inner = (
    <>
      <p className="text-sm" style={{ color: 'var(--text-secondary)', margin: 0 }}>
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
    </>
  );

  if (surface) {
    return (
      <div className="flex items-center justify-between" style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        {inner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between card">
      {inner}
    </div>
  );
}

// ── DataTable ────────────────────────────────────────────────────────────────
export default function DataTable<T>({
  columns, data, getItemId,
  isLoading, error, onRetry, emptyMessage = 'No records found.', emptyAction,
  selectable, selectedItems, onToggleSelect, onToggleSelectAll,
  isAllSelected, isSomeSelected,
  page, totalCount, pageSize = 20, hasPrev, hasNext, onPageChange,
  rowStyle, onRowClick,
  surface = false,
}: DataTableProps<T>) {
  const getId = getItemId ?? ((item: T) => (item as { id: number }).id);
  const safeData = Array.isArray(data) ? data : [];
  const ids   = safeData.map(getId);

  if (isLoading) {
    const skeletons = (
      <div style={{ padding: surface ? '12px 16px' : undefined }} className={surface ? '' : 'card p-5 space-y-2.5'}>
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
    return skeletons;
  }

  if (error) {
    const content = (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--status-error-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--status-error)' }}>
            <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4m0 4h.01" />
          </svg>
        </div>
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Failed to load data
        </p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
          Something went wrong. Check your connection and try again.
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '0 16px', height: 32, borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)', background: 'var(--surface-subtle)',
              fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.51" />
            </svg>
            Try Again
          </button>
        )}
      </div>
    );
    return surface ? content : <div className="card">{content}</div>;
  }

  if (safeData.length === 0) {
    const content = (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
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
    return surface ? content : <div className="card">{content}</div>;
  }

  const tableContent = (
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
          {safeData.map((item, idx) => {
            const id = getId(item);
            const clickable = !!onRowClick;
            return (
              <tr
                key={id}
                style={{ ...rowStyle?.(item), cursor: clickable ? 'pointer' : undefined }}
                onClick={clickable ? () => onRowClick(item) : undefined}
              >
                {selectable && (
                  <td onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedItems?.has(id) ?? false}
                      onChange={() => onToggleSelect?.(id)}
                    />
                  </td>
                )}
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={col.className}
                    onClick={col.key === 'actions' ? e => e.stopPropagation() : undefined}
                  >
                    {col.render(item, idx)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const pagination = (
    <PaginationBar
      page={page}
      totalCount={totalCount}
      pageSize={pageSize}
      hasPrev={hasPrev}
      hasNext={hasNext}
      onPageChange={onPageChange}
      surface={surface}
    />
  );

  if (surface) {
    return (
      <>
        {tableContent}
        {pagination}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-0 overflow-hidden">
        {tableContent}
      </div>
      {pagination}
    </div>
  );
}
