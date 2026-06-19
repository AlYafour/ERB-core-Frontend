'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, SearchInput } from '@/components/ui';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { type FilterField } from '@/components/ui/FilterPanel';

/* ─── Types ─────────────────────────────────────── */

interface BreadcrumbItem { label: string; href?: string; }

interface StripItem {
  value: string;
  label: string;
  count?: number | null;
  loading?: boolean;
}

interface TableState {
  page: number;
  setPage: (page: number) => void;
  search: string;
  handleSearch: (value: string) => void;
  filters: Record<string, unknown>;
  handleFilterChange: (name: string, value: unknown) => void;
  handleFilterReset: () => void;
  handleRemoveFilter: (name: string) => void;
  selectedItems: Set<number>;
  toggleSelect: (id: number) => void;
  selectPage: (ids: number[]) => void;
  clearSelection: () => void;
  isAllPageSelected: (ids: number[]) => boolean;
  isSomePageSelected: (ids: number[]) => boolean;
}

interface PaginatedData {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: unknown[];
}

interface ProcListPageProps {
  /* Navigation */
  breadcrumbs: BreadcrumbItem[];
  /* Header */
  title: string;
  description: string;
  totalCount: number;
  pendingCount?: number;
  createAction?: ReactNode;
  /* Status strip */
  statusItems: StripItem[];
  totalAmount?: number;
  totalAmountLabel?: string;
  /* Search */
  searchPlaceholder?: string;
  /* Extra command bar actions (e.g. "My POs" toggle) */
  extraActions?: ReactNode;
  /* Filters */
  filterFields: FilterField[];
  advFilterTitle?: string;
  advFilterDesc?: string;
  /* Table */
  columns: Column<any>[];
  data: any[];
  isLoading: boolean;
  error: unknown;
  onRowClick?: (row: any) => void;
  rowStyle?: (row: any) => React.CSSProperties | undefined;
  selectable?: boolean;
  pageSize?: number;
  paginatedData?: PaginatedData;
  /* Empty state */
  emptyTitle?: string;
  emptyAction?: ReactNode;
  /* Bulk actions */
  bulkActions?: ReactNode;
  /* All table / filter state */
  tableState: TableState;
  /* Extra content rendered after the table (e.g. dialogs) */
  children?: ReactNode;
}

/* ─── Component ─────────────────────────────────── */

export function ProcListPage({
  breadcrumbs,
  title, description, totalCount, pendingCount, createAction,
  statusItems, totalAmount, totalAmountLabel,
  searchPlaceholder,
  extraActions,
  filterFields, advFilterTitle, advFilterDesc,
  columns, data, isLoading, error, onRowClick, rowStyle,
  selectable, pageSize = 50, paginatedData,
  emptyTitle, emptyAction,
  bulkActions,
  tableState,
  children,
}: ProcListPageProps) {
  const router = useRouter();
  const [advOpen, setAdvOpen] = useState(false);

  const {
    page, setPage, search, handleSearch,
    filters, handleFilterChange, handleFilterReset, handleRemoveFilter,
    selectedItems, toggleSelect, selectPage, clearSelection,
    isAllPageSelected, isSomePageSelected,
  } = tableState;

  const currentIds: number[] = data.map((r: any) => r.id);

  /* Status tab value lives in filters.status */
  const statusValue = (filters.status as string) ?? '';
  const handleStatusChange = (v: string) => {
    handleFilterChange('status', v);
    setPage(1);
  };

  /* Active filter chips — exclude 'status' (handled by strip) */
  const activeFilters = Object.entries(filters).filter(
    ([k, v]) => k !== 'status' && v !== '' && v != null,
  );

  /* Count badge on the Filters button */
  const activeFilterCount = activeFilters.length;

  /* Get human-readable label for a filter value */
  const filterLabel = (name: string, value: unknown): string => {
    const field = filterFields.find(f => f.name === name);
    if (!field) return `${name}: ${value}`;
    if (field.type === 'select' && field.options) {
      const opt = (field.options as any[]).find(o => String(o.value) === String(value));
      if (opt) return `${field.label}: ${opt.label}`;
    }
    return `${field.label}: ${value}`;
  };

  /* Group filter fields by .group */
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

          {/* ── Header card (nav + title merged) ── */}
          <div className="proc-list-header-card">

            {/* Nav row */}
            <div className="proc-lhc-nav">
              <button className="proc-list-nav-back" onClick={() => router.back()} aria-label="Go back">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5M5 12l7-7M5 12l7 7"/>
                </svg>
                Back
              </button>
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
            </div>

            {/* Title + actions row */}
            <div className="proc-lhc-body">
              <div className="proc-lhc-left">
                <div className="proc-lhc-title-row">
                  <h1 className="proc-lhc-title">{title}</h1>
                  {totalCount > 0 && <span className="proc-lhc-count">{totalCount}</span>}
                  {pendingCount != null && pendingCount > 0 && (
                    <span className="proc-lhc-pending">⚠ {pendingCount} pending</span>
                  )}
                </div>
                <p className="proc-lhc-desc">{description}</p>
              </div>
              {createAction && <div className="proc-lhc-right">{createAction}</div>}
            </div>

          </div>

          {/* ── Main surface ── */}
          <div className="proc-list-surface">

            {/* Status strip */}
            <div className="proc-strip">
              <div className="proc-strip-tabs">
                {statusItems.map(item => (
                  <button
                    key={item.value || '__all__'}
                    className={`proc-strip-tab${item.value === statusValue ? ' proc-strip-tab--active' : ''}`}
                    onClick={() => handleStatusChange(item.value)}
                    aria-pressed={item.value === statusValue}
                    aria-label={`Show ${item.label} items`}
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
                <button
                  className={`proc-cmd-btn${activeFilterCount > 0 ? ' proc-cmd-btn--active' : ''}`}
                  onClick={() => setAdvOpen(true)}
                  aria-label="Open advanced filters"
                  aria-expanded={advOpen}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                  </svg>
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="proc-cmd-filter-badge">{activeFilterCount}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Active filter chips */}
            {activeFilters.length > 0 && (
              <div className="proc-chips-bar">
                {activeFilters.map(([key, value]) => (
                  <span key={key} className="proc-chip">
                    {filterLabel(key, value)}
                    <button className="proc-chip-x" onClick={() => handleRemoveFilter(key)} aria-label={`Remove ${filterLabel(key, value)} filter`}>×</button>
                  </span>
                ))}
                <button className="proc-chips-clear" onClick={handleFilterReset} aria-label="Clear all active filters">Clear all</button>
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
                  isAllPageSelected(currentIds)
                    ? clearSelection()
                    : selectPage(currentIds)
                }
                isAllSelected={isAllPageSelected(currentIds)}
                isSomeSelected={isSomePageSelected(currentIds)}
                page={page}
                totalCount={totalCount}
                pageSize={pageSize}
                hasPrev={!!paginatedData?.previous}
                hasNext={!!paginatedData?.next}
                onPageChange={setPage}
              />
            </div>
          </div>

        </div>

        {/* Extra content (dialogs, etc.) */}
        {children}

      </PageShell>

      {/* ── Advanced filter modal ── */}
      {advOpen && (
        <div
          className="proc-adv-overlay"
          onClick={e => { if (e.target === e.currentTarget) setAdvOpen(false); }}
        >
          <div className="proc-adv-panel">

            <div className="proc-adv-head">
              <div className="proc-adv-head-text">
                <p className="proc-adv-head-title">{advFilterTitle ?? 'Advanced Filters'}</p>
                <p className="proc-adv-head-sub">
                  {advFilterDesc ?? `Filter and refine the ${title.toLowerCase()} list.`}
                </p>
              </div>
              <button className="proc-adv-close-btn" onClick={() => setAdvOpen(false)}>✕</button>
            </div>

            <div className="proc-adv-body">
              {filterFields.length === 0 ? (
                <p style={{ color: '#a59e98', fontSize: 13, textAlign: 'center', margin: '24px 0' }}>
                  No filters available.
                </p>
              ) : (
                Object.entries(groupedFields).map(([group, fields]) => (
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
                                <option key={String(opt.value)} value={String(opt.value)}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={
                                field.type === 'number' ? 'number'
                                : field.type === 'date' ? 'date'
                                : 'text'
                              }
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
                ))
              )}
            </div>

            <div className="proc-adv-foot">
              <button
                className="proc-adv-reset"
                onClick={() => { handleFilterReset(); }}
              >
                Reset all
              </button>
              <div className="proc-adv-foot-btns">
                <button className="proc-cmd-btn" onClick={() => setAdvOpen(false)}>Cancel</button>
                <button className="proc-adv-apply" onClick={() => setAdvOpen(false)}>
                  Apply Filters
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </MainLayout>
  );
}
