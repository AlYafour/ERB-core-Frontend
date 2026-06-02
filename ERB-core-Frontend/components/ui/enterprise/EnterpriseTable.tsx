'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Checkbox, Skeleton } from '@/components/ui';
import type { SortState } from '@/lib/hooks/use-list-state';

// ── Column definition ────────────────────────────────────────────────────────

export interface EnterpriseColumn<T> {
  key: string;
  header: React.ReactNode;
  render: (item: T, index: number) => React.ReactNode;

  // Layout
  width?: number | string;
  minWidth?: number;
  className?: string;
  align?: 'left' | 'right' | 'center';

  // Behaviour
  sortable?: boolean;
  hideable?: boolean;        // default true — set false for checkbox/actions columns
  sticky?: 'left' | 'right';

  // Mobile
  mobileHide?: boolean;      // don't show in mobile card
  mobileLabel?: string;      // label override in mobile card
  mobileMain?: boolean;      // use as card title in mobile

  // Aggregates footer
  aggregate?: (data: T[]) => React.ReactNode;
}

// ── Sort header icon ─────────────────────────────────────────────────────────

function SortIcon({ sorted, dir }: { sorted: boolean; dir?: 'asc' | 'desc' }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 1,
        marginLeft: 5,
        verticalAlign: 'middle',
        opacity: sorted ? 1 : 0.3,
      }}
    >
      <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor"
        style={{ opacity: !sorted || dir === 'asc' ? 1 : 0.25 }}>
        <path d="M4 0L8 5H0L4 0Z" />
      </svg>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor"
        style={{ opacity: !sorted || dir === 'desc' ? 1 : 0.25 }}>
        <path d="M4 5L0 0H8L4 5Z" />
      </svg>
    </span>
  );
}

// ── Cell tooltip (truncated text) ─────────────────────────────────────────────

function TruncatedCell({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setTruncated(el.scrollWidth > el.clientWidth);
  }, [children]);

  return (
    <div
      ref={ref}
      title={truncated && typeof children === 'string' ? children : undefined}
      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
    >
      {children}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function PaginationFooter({
  page, totalCount, pageSize, hasPrev, hasNext, onPageChange, onPageSizeChange,
}: {
  page: number; totalCount: number; pageSize: number;
  hasPrev?: boolean; hasNext?: boolean;
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: number) => void;
}) {
  const totalPages = Math.ceil(totalCount / pageSize);
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, totalCount);

  // Page numbers window: current ± 2
  const pages: number[] = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) pages.push(p);

  const btnBase: React.CSSProperties = {
    minWidth: 32, height: 32, padding: '0 8px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-default)', background: 'var(--surface-primary)',
    fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-secondary)',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 120ms, border-color 120ms',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      padding: '10px 16px', borderTop: '1px solid var(--border-subtle)',
    }}>
      {/* Count info */}
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', flex: 1, minWidth: 120 }}>
        {totalCount === 0
          ? 'No results'
          : `Showing ${from}–${to} of ${totalCount.toLocaleString()}`}
      </span>

      {/* Page size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Rows</span>
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          style={{
            ...btnBase,
            border: '1px solid var(--border-default)',
            background: 'var(--surface-primary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            paddingRight: 22,
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%239ca3af' d='M5 7L1 3h8z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 6px center',
          }}
          aria-label="Rows per page"
        >
          {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {/* Page nav */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            style={{ ...btnBase, opacity: (!hasPrev && page <= 1) ? 0.4 : 1 }}
            disabled={!hasPrev && page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            ‹
          </button>

          {pages[0] > 1 && (
            <>
              <button style={btnBase} onClick={() => onPageChange(1)}>1</button>
              {pages[0] > 2 && <span style={{ color: 'var(--text-tertiary)', padding: '0 4px' }}>…</span>}
            </>
          )}

          {pages.map(p => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              style={{
                ...btnBase,
                background: p === page ? 'var(--brand)' : 'var(--surface-primary)',
                color:      p === page ? '#fff'         : 'var(--text-secondary)',
                borderColor:p === page ? 'var(--brand)' : 'var(--border-default)',
                fontWeight: p === page ? 700 : 500,
              }}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ))}

          {pages[pages.length - 1] < totalPages && (
            <>
              {pages[pages.length - 1] < totalPages - 1 && <span style={{ color: 'var(--text-tertiary)', padding: '0 4px' }}>…</span>}
              <button style={btnBase} onClick={() => onPageChange(totalPages)}>{totalPages}</button>
            </>
          )}

          <button
            style={{ ...btnBase, opacity: (!hasNext && page >= totalPages) ? 0.4 : 1 }}
            disabled={!hasNext && page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

// ── Mobile card ───────────────────────────────────────────────────────────────

function MobileCard<T extends { id: number }>({
  item, index, columns, selected, onToggleSelect, selectable, onRowClick,
}: {
  item: T; index: number;
  columns: EnterpriseColumn<T>[];
  selected: boolean;
  onToggleSelect?: (id: number) => void;
  selectable?: boolean;
  onRowClick?: (item: T) => void;
}) {
  const mainCol   = columns.find(c => c.mobileMain) ?? columns[0];
  const otherCols = columns.filter(c => !c.mobileMain && c.key !== 'actions' && !c.mobileHide);
  const actionsCol = columns.find(c => c.key === 'actions');

  return (
    <div
      style={{
        background: selected ? 'var(--brand-subtle)' : 'var(--card-bg)',
        border: `1px solid ${selected ? 'var(--brand)' : 'var(--card-border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        cursor: onRowClick ? 'pointer' : 'default',
        transition: 'border-color 120ms',
      }}
      onClick={() => onRowClick?.(item)}
      role={onRowClick ? 'button' : undefined}
      tabIndex={onRowClick ? 0 : undefined}
      onKeyDown={e => e.key === 'Enter' && onRowClick?.(item)}
    >
      {/* Top row: checkbox + title + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {selectable && (
          <span onClick={e => { e.stopPropagation(); onToggleSelect?.(item.id); }}>
            <Checkbox checked={selected} onChange={() => onToggleSelect?.(item.id)} />
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {mainCol.render(item, index)}
          </div>
        </div>
      </div>

      {/* Fields grid */}
      {otherCols.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 16px', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
          {otherCols.slice(0, 6).map(col => (
            <div key={col.key} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 2 }}>
                {col.mobileLabel ?? (typeof col.header === 'string' ? col.header : col.key)}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {col.render(item, index)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions row */}
      {actionsCol && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 6, flexWrap: 'wrap' }}
          onClick={e => e.stopPropagation()}>
          {actionsCol.render(item, index)}
        </div>
      )}
    </div>
  );
}

// ── Main EnterpriseTable ──────────────────────────────────────────────────────

interface EnterpriseTableProps<T extends { id: number }> {
  columns: EnterpriseColumn<T>[];
  data: T[];

  // States
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

  // Sort
  sort?: SortState | null;
  onSort?: (key: string) => void;

  // Display
  density?: 'comfortable' | 'compact';
  hiddenColumns?: string[];

  // Row
  onRowClick?: (item: T) => void;
  rowStyle?: (item: T) => React.CSSProperties | undefined;

  // Pagination
  page: number;
  totalCount: number;
  pageSize?: number;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: number) => void;
}

export default function EnterpriseTable<T extends { id: number }>({
  columns, data,
  isLoading, error, onRetry, emptyMessage = 'No records found.', emptyAction,
  selectable, selectedItems = new Set(), onToggleSelect, onToggleSelectAll,
  isAllSelected, isSomeSelected,
  sort, onSort,
  density = 'comfortable', hiddenColumns = [],
  onRowClick, rowStyle,
  page, totalCount, pageSize = 25, hasPrev, hasNext, onPageChange, onPageSizeChange,
}: EnterpriseTableProps<T>) {
  const visibleColumns = columns.filter(c => !hiddenColumns.includes(c.key));
  const ids = data.map(i => i.id);

  const cellPadding = density === 'compact' ? '6px 14px' : '11px 14px';

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
        </div>
        <PaginationFooter
          page={page} totalCount={0} pageSize={pageSize}
          onPageChange={onPageChange} onPageSizeChange={onPageSizeChange}
        />
      </>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--status-error-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--status-error)' }}>
            <circle cx="12" cy="12" r="10" strokeWidth="1.5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4m0 4h.01" />
          </svg>
        </div>
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Failed to load data</p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 16px' }}>Check your connection and try again.</p>
        {onRetry && (
          <button onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 16px', height: 32, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--surface-subtle)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.51" /></svg>
            Try Again
          </button>
        )}
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <>
        <div style={{ padding: '56px 24px', textAlign: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--text-tertiary)', margin: '0 auto 14px', display: 'block' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4m4 0v-2a4 4 0 018 0v2" />
          </svg>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 14px' }}>{emptyMessage}</p>
          {emptyAction}
        </div>
        <PaginationFooter
          page={page} totalCount={0} pageSize={pageSize}
          onPageChange={onPageChange} onPageSizeChange={onPageSizeChange}
        />
      </>
    );
  }

  const hasAggregates = visibleColumns.some(c => c.aggregate);

  return (
    <>
      {/* ── Desktop table ──────────────────────────────────────────────────── */}
      <div className="hidden md:block" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
          <thead style={{ background: 'var(--table-header-bg)' }}>
            <tr>
              {selectable && (
                <th style={{ width: 44, padding: cellPadding, textAlign: 'left', borderBottom: '1px solid var(--table-border)', position: 'sticky', left: 0, background: 'var(--table-header-bg)', zIndex: 2 }}>
                  <Checkbox
                    checked={isAllSelected ?? false}
                    ref={(el) => { if (el) el.indeterminate = isSomeSelected ?? false; }}
                    onChange={() => onToggleSelectAll?.(ids)}
                    aria-label="Select all"
                  />
                </th>
              )}
              {visibleColumns.map(col => (
                <th
                  key={col.key}
                  style={{
                    padding: cellPadding,
                    textAlign: col.align ?? 'left',
                    fontWeight: 600,
                    fontSize: 'var(--text-xs)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--table-header-text)',
                    borderBottom: '1px solid var(--table-border)',
                    whiteSpace: 'nowrap',
                    width: col.width,
                    minWidth: col.minWidth,
                    cursor: col.sortable && onSort ? 'pointer' : 'default',
                    userSelect: col.sortable ? 'none' : undefined,
                    ...(col.sticky ? { position: 'sticky', [col.sticky]: 0, background: 'var(--table-header-bg)', zIndex: 2 } : {}),
                  }}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                  aria-sort={col.sortable ? (sort?.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {col.header}
                    {col.sortable && (
                      <SortIcon sorted={sort?.key === col.key} dir={sort?.key === col.key ? sort.dir : undefined} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.map((item, idx) => {
              const id = item.id;
              const isSelected = selectedItems.has(id);
              return (
                <tr
                  key={id}
                  onClick={() => onRowClick?.(item)}
                  style={{
                    background: isSelected ? 'var(--brand-subtle)' : undefined,
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background 80ms',
                    ...(rowStyle?.(item)),
                  }}
                >
                  {selectable && (
                    <td
                      style={{ padding: cellPadding, width: 44, position: 'sticky', left: 0, background: isSelected ? 'var(--brand-subtle)' : 'var(--card-bg)', zIndex: 1, borderBottom: '1px solid var(--table-border)' }}
                      onClick={e => { e.stopPropagation(); onToggleSelect?.(id); }}
                    >
                      <Checkbox checked={isSelected} onChange={() => onToggleSelect?.(id)} aria-label={`Select row ${id}`} />
                    </td>
                  )}
                  {visibleColumns.map(col => (
                    <td
                      key={col.key}
                      style={{
                        padding: cellPadding,
                        textAlign: col.align ?? 'left',
                        borderBottom: '1px solid var(--table-border)',
                        maxWidth: col.minWidth ?? 280,
                        ...(col.sticky ? { position: 'sticky', [col.sticky]: 0, background: isSelected ? 'var(--brand-subtle)' : 'var(--card-bg)', zIndex: 1 } : {}),
                      }}
                      className={col.className}
                      onClick={col.key === 'actions' ? e => e.stopPropagation() : undefined}
                    >
                      <TruncatedCell>{col.render(item, idx)}</TruncatedCell>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>

          {/* Aggregates footer */}
          {hasAggregates && (
            <tfoot>
              <tr style={{ background: 'var(--surface-secondary)', borderTop: '2px solid var(--border-default)' }}>
                {selectable && <td style={{ padding: cellPadding, borderTop: '2px solid var(--border-default)' }} />}
                {visibleColumns.map((col, i) => (
                  <td
                    key={col.key}
                    style={{
                      padding: cellPadding,
                      textAlign: col.align ?? 'left',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      borderTop: '2px solid var(--border-default)',
                    }}
                  >
                    {col.aggregate ? col.aggregate(data) : (i === 0 ? <span style={{ color: 'var(--text-tertiary)' }}>Totals</span> : null)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Mobile cards ───────────────────────────────────────────────────── */}
      <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
        {data.map((item, idx) => (
          <MobileCard
            key={item.id}
            item={item}
            index={idx}
            columns={visibleColumns}
            selected={selectedItems.has(item.id)}
            onToggleSelect={onToggleSelect}
            selectable={selectable}
            onRowClick={onRowClick}
          />
        ))}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      <PaginationFooter
        page={page} totalCount={totalCount} pageSize={pageSize}
        hasPrev={hasPrev} hasNext={hasNext}
        onPageChange={onPageChange} onPageSizeChange={onPageSizeChange}
      />
    </>
  );
}

export type { EnterpriseTableProps };
