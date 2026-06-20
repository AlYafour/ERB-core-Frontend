'use client';

/**
 * AppListPage — single source of truth for all list/table pages in the system.
 *
 * Replaces both ProcListPage (purchase) and TableShell (HR, suppliers, etc.)
 * with one config-driven component.
 *
 * Usage:
 *   <AppListPage
 *     title="Purchase Orders"
 *     description="Track all purchase orders."
 *     breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Purchase Orders' }]}
 *     totalCount={data?.count ?? 0}
 *     createAction={<Button>+ New</Button>}
 *     statusItems={[...]}   ← optional
 *     filterFields={[...]}  ← optional
 *     columns={columns}
 *     data={results}
 *     isLoading={isLoading}
 *     error={error}
 *     tableState={tableState}
 *   />
 */

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, SearchInput } from '@/components/ui';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { type FilterField } from '@/components/ui/FilterPanel';

// ── Types ──────────────────────────────────────────────────────

export interface AppBreadcrumb { label: string; href?: string; }

export interface AppStatusItem {
  value:    string;
  label:    string;
  count?:   number | null;
  loading?: boolean;
}

export interface AppTableState {
  page:               number;
  setPage:            (p: number) => void;
  search:             string;
  handleSearch:       (v: string) => void;
  filters:            Record<string, unknown>;
  handleFilterChange: (name: string, value: unknown) => void;
  handleFilterReset:  () => void;
  handleRemoveFilter: (name: string) => void;
  selectedItems:      Set<number>;
  toggleSelect:       (id: number) => void;
  selectPage:         (ids: number[]) => void;
  clearSelection:     () => void;
  isAllPageSelected:  (ids: number[]) => boolean;
  isSomePageSelected: (ids: number[]) => boolean;
}

interface PaginatedData {
  count?:    number;
  next?:     string | null;
  previous?: string | null;
  results?:  unknown[];
}

export interface AppListPageProps {
  /* ── Navigation ── */
  breadcrumbs?: AppBreadcrumb[];
  showBack?: boolean;

  /* ── Header ── */
  title:         string;
  description?:  string;
  totalCount?:   number;
  pendingCount?: number;
  createAction?: ReactNode;
  headerExtra?:  ReactNode;

  /* ── Status strip (optional) ── */
  statusItems?:      AppStatusItem[];
  totalAmount?:      number;
  totalAmountLabel?: string;

  /* ── Command bar ── */
  searchPlaceholder?: string;
  extraActions?:      ReactNode;

  /* ── Filters (optional) ── */
  filterFields?:   FilterField[];
  advFilterTitle?: string;
  advFilterDesc?:  string;

  /* ── Table ── */
  columns:    Column<any>[];
  data:       any[];
  isLoading:  boolean;
  error?:     unknown;
  onRowClick?: (row: any) => void;
  rowStyle?:   (row: any) => React.CSSProperties | undefined;
  selectable?: boolean;
  pageSize?:   number;
  paginatedData?: PaginatedData;

  /* ── Empty state ── */
  emptyTitle?:  string;
  emptyAction?: ReactNode;

  /* ── Bulk actions ── */
  bulkActions?: ReactNode;

  /* ── State (from useTableState) ── */
  tableState: AppTableState;

  /* ── Extra content (dialogs, modals, etc.) ── */
  children?: ReactNode;
}

// ── Component ──────────────────────────────────────────────────

export function AppListPage({
  breadcrumbs = [],
  showBack = true,
  title, description, totalCount = 0, pendingCount, createAction, headerExtra,
  statusItems = [],
  totalAmount, totalAmountLabel,
  searchPlaceholder,
  extraActions,
  filterFields = [], advFilterTitle, advFilterDesc,
  columns, data, isLoading, error, onRowClick, rowStyle,
  selectable, pageSize = 50, paginatedData,
  emptyTitle, emptyAction,
  bulkActions,
  tableState,
  children,
}: AppListPageProps) {
  const router = useRouter();
  const [advOpen, setAdvOpen] = useState(false);

  const {
    page, setPage, search, handleSearch,
    filters, handleFilterChange, handleFilterReset, handleRemoveFilter,
    selectedItems, toggleSelect, selectPage, clearSelection,
    isAllPageSelected, isSomePageSelected,
  } = tableState;

  const currentIds: number[] = data.map((r: any) => r.id);

  const statusValue = (filters.status as string) ?? '';
  const handleStatusChange = (v: string) => {
    handleFilterChange('status', v);
    setPage(1);
  };

  const activeFilters = Object.entries(filters).filter(
    ([k, v]) => k !== 'status' && v !== '' && v != null,
  );
  const activeFilterCount = activeFilters.length;

  const filterLabel = (name: string, value: unknown): string => {
    const field = filterFields.find(f => f.name === name);
    if (!field) return `${name}: ${value}`;
    if (field.type === 'select' && field.options) {
      const opt = (field.options as any[]).find(o => String(o.value) === String(value));
      if (opt) return `${field.label}: ${opt.label}`;
    }
    return `${field.label}: ${value}`;
  };

  const groupedFields = filterFields.reduce<Record<string, FilterField[]>>((acc, f) => {
    const g = f.group ?? 'Filters';
    if (!acc[g]) acc[g] = [];
    acc[g].push(f);
    return acc;
  }, {});

  return (
    <MainLayout>
      <PageShell compact>
        <div className="proc-list-page">

          {/* ── Header card ── */}
          <div className="proc-list-header-card">

            {/* Nav row */}
            {(showBack || breadcrumbs.length > 0) && (
              <div className="proc-lhc-nav">
                {showBack && (
                  <button className="proc-list-nav-back" onClick={() => router.back()} aria-label="Go back">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M19 12H5M5 12l7-7M5 12l7 7"/>
                    </svg>
                    Back
                  </button>
                )}
                {breadcrumbs.length > 0 && (
                  <div className="proc-list-nav-crumb">
                    {breadcrumbs.map((crumb, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                        {i > 0 && <span className="proc-list-nav-sep">/</span>}
                        {crumb.href
                          ? <Link href={crumb.href} className="proc-list-nav-link">{crumb.label}</Link>
                          : <span className="proc-list-nav-current">{crumb.label}</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Title + actions */}
            <div className="proc-lhc-body">
              <div className="proc-lhc-left">
                <div className="proc-lhc-title-row">
                  <h1 className="proc-lhc-title">{title}</h1>
                  {totalCount > 0 && <span className="proc-lhc-count">{totalCount}</span>}
                  {pendingCount != null && pendingCount > 0 && (
                    <span className="proc-lhc-pending">⚠ {pendingCount} pending</span>
                  )}
                </div>
                {description && <p className="proc-lhc-desc">{description}</p>}
              </div>
              <div className="proc-lhc-right">
                {headerExtra}
                {createAction}
              </div>
            </div>

          </div>

          {/* ── Main surface ── */}
          <div className="proc-list-surface">

            {/* Status strip (only if items provided) */}
            {statusItems.length > 0 && (
              <div className="proc-strip">
                <div className="proc-strip-tabs">
                  {statusItems.map(item => (
                    <button
                      key={item.value || '__all__'}
                      className={`proc-strip-tab${item.value === statusValue ? ' proc-strip-tab--active' : ''}`}
                      onClick={() => handleStatusChange(item.value)}
                      aria-pressed={item.value === statusValue}
                    >
                      {item.label}
                      {item.loading
                        ? <span className="proc-strip-badge proc-strip-badge--loading">…</span>
                        : item.count != null
                          ? <span className="proc-strip-badge">{item.count}</span>
                          : null}
                    </button>
                  ))}
                </div>
                {totalAmount != null && (
                  <div className="proc-strip-meta">
                    <span className="proc-strip-meta-label">{totalAmountLabel ?? 'Total Value'}</span>
                    <span className="proc-strip-meta-value">
                      {new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', minimumFractionDigits: 2 }).format(totalAmount)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Command bar */}
            <div className="proc-cmd">
              <div className="proc-cmd-search-wrap">
                <SearchInput
                  value={search}
                  onChange={handleSearch}
                  placeholder={searchPlaceholder ?? `Search ${title.toLowerCase()}…`}
                  width="100%"
                />
              </div>
              <div className="proc-cmd-right">
                {extraActions}
                {filterFields.length > 0 && (
                  <button
                    className={`proc-cmd-btn${activeFilterCount > 0 ? ' proc-cmd-btn--active' : ''}`}
                    onClick={() => setAdvOpen(true)}
                    aria-label="Open advanced filters"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                    </svg>
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="proc-cmd-filter-badge">{activeFilterCount}</span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Applied filter chips */}
            {activeFilters.length > 0 && (
              <div className="proc-chips-bar">
                {activeFilters.map(([key, value]) => (
                  <span key={key} className="proc-chip">
                    {filterLabel(key, value)}
                    <button className="proc-chip-x" onClick={() => handleRemoveFilter(key)}>×</button>
                  </span>
                ))}
                <button className="proc-chips-clear" onClick={handleFilterReset}>Clear all</button>
              </div>
            )}

            {/* Bulk action bar */}
            {bulkActions && selectedItems.size > 0 && (
              <div className="proc-bulk-bar">
                <span className="proc-bulk-label">{selectedItems.size} selected</span>
                {bulkActions}
              </div>
            )}

            {/* Table */}
            <div className="proc-list-table-wrap">
              <DataTable
                columns={columns}
                data={data}
                isLoading={isLoading}
                error={error as any}
                emptyMessage={emptyTitle ?? `No ${title.toLowerCase()} found.`}
                emptyAction={emptyAction}
                onRowClick={onRowClick}
                rowStyle={rowStyle}
                selectable={selectable}
                selectedItems={selectedItems}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={() =>
                  isAllPageSelected(currentIds) ? clearSelection() : selectPage(currentIds)
                }
                isAllSelected={isAllPageSelected(currentIds)}
                isSomeSelected={isSomePageSelected(currentIds)}
                page={page}
                totalCount={totalCount}
                pageSize={pageSize}
                hasPrev={!!paginatedData?.previous}
                hasNext={!!paginatedData?.next}
                onPageChange={setPage}
                surface
              />
            </div>
          </div>

        </div>

        {children}

      </PageShell>

      {/* ── Advanced filter modal ── */}
      {advOpen && filterFields.length > 0 && (
        <div className="proc-adv-overlay" onClick={e => { if (e.target === e.currentTarget) setAdvOpen(false); }}>
          <div className="proc-adv-panel">
            <div className="proc-adv-head">
              <div className="proc-adv-head-text">
                <p className="proc-adv-head-title">{advFilterTitle ?? 'Advanced Filters'}</p>
                <p className="proc-adv-head-sub">{advFilterDesc ?? `Refine the ${title.toLowerCase()} list.`}</p>
              </div>
              <button className="proc-adv-close-btn" onClick={() => setAdvOpen(false)}>✕</button>
            </div>
            <div className="proc-adv-body">
              {Object.entries(groupedFields).map(([group, fields]) => (
                <div key={group}>
                  <p className="proc-adv-sec-head">{group}</p>
                  <div className={`proc-adv-grid${fields.length === 1 ? ' proc-adv-grid--wide' : ''}`}>
                    {fields.map(field => (
                      <div key={field.name} className="proc-adv-field">
                        <label className="proc-adv-label">{field.label}</label>
                        {field.type === 'select' ? (
                          <select
                            className="proc-adv-select"
                            value={String(filters[field.name] ?? '')}
                            onChange={e => handleFilterChange(field.name, e.target.value || undefined)}
                          >
                            <option value="">All</option>
                            {(field.options as any[] ?? []).map((opt: any) => (
                              <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                            className="proc-adv-input"
                            value={String(filters[field.name] ?? '')}
                            onChange={e => handleFilterChange(field.name, e.target.value || undefined)}
                            placeholder={field.label}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="proc-adv-foot">
              <button className="proc-adv-reset" onClick={() => handleFilterReset()}>Reset all</button>
              <div className="proc-adv-foot-btns">
                <button className="proc-cmd-btn" onClick={() => setAdvOpen(false)}>Cancel</button>
                <button className="proc-adv-apply" onClick={() => setAdvOpen(false)}>Apply Filters</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </MainLayout>
  );
}
