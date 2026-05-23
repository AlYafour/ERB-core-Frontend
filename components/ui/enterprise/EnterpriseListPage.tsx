'use client';

import React, { useState, useRef, useEffect } from 'react';
import PageHeader, { type Crumb } from '@/components/ui/PageHeader';
import { WorkspaceSurface } from '@/components/ui/WorkspaceSurface';
import { SearchInput } from '@/components/ui/SearchInput';
import FilterPanel, { type FilterField } from '@/components/ui/FilterPanel';
import FilterTags from '@/components/ui/FilterTags';
import { KpiCardRow, type KpiCardConfig } from './KpiCard';
import { BulkBar, type BulkAction } from './BulkBar';
import EnterpriseTable, { type EnterpriseColumn } from './EnterpriseTable';
import type { ListState } from '@/lib/hooks/use-list-state';
import { PageShell } from '@/components/ui';
import MainLayout from '@/components/layout/MainLayout';

// ── Column visibility dropdown ─────────────────────────────────────────────────

function ColumnVisibilityMenu<T>({
  columns,
  hiddenColumns,
  onToggle,
  onReset,
}: {
  columns: EnterpriseColumn<T>[];
  hiddenColumns: string[];
  onToggle: (key: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const hideableColumns = columns.filter(c => c.hideable !== false && c.key !== 'actions');
  if (hideableColumns.length === 0) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Column visibility"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          height: 36, padding: '0 10px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-default)',
          background: 'var(--surface-primary)',
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-xs)', fontWeight: 500,
          cursor: 'pointer', whiteSpace: 'nowrap',
          transition: 'border-color 120ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M3 5h18M3 12h18M3 19h18" />
        </svg>
        Columns
        {hiddenColumns.length > 0 && (
          <span style={{
            minWidth: 16, height: 16, borderRadius: 'var(--radius-full)',
            background: 'var(--brand)', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          }}>
            {hiddenColumns.length}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 30,
          minWidth: 180,
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Columns
            </span>
            {hiddenColumns.length > 0 && (
              <button
                onClick={onReset}
                style={{ fontSize: 'var(--text-xs)', color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Show all
              </button>
            )}
          </div>
          <div style={{ padding: '4px 0' }}>
            {hideableColumns.map(col => {
              const isHidden = hiddenColumns.includes(col.key);
              return (
                <label
                  key={col.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px', cursor: 'pointer',
                    fontSize: 'var(--text-sm)', color: 'var(--text-primary)',
                    transition: 'background 80ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-subtle)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <input
                    type="checkbox"
                    checked={!isHidden}
                    onChange={() => onToggle(col.key)}
                    style={{ accentColor: 'var(--brand)', width: 14, height: 14 }}
                  />
                  {typeof col.header === 'string' ? col.header : col.key}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Density toggle ─────────────────────────────────────────────────────────────

function DensityToggle({
  density,
  onChange,
}: {
  density: 'comfortable' | 'compact';
  onChange: (d: 'comfortable' | 'compact') => void;
}) {
  const next = density === 'comfortable' ? 'compact' : 'comfortable';
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={`Switch to ${next} density`}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36,
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        background: 'var(--surface-primary)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'border-color 120ms',
        flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
    >
      {density === 'comfortable' ? (
        // compact icon: tight lines
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path strokeLinecap="round" d="M1 3h12M1 6h12M1 9h12M1 12h12" />
        </svg>
      ) : (
        // comfortable icon: spaced lines
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path strokeLinecap="round" d="M1 2.5h12M1 7h12M1 11.5h12" />
        </svg>
      )}
    </button>
  );
}

// ── Refresh button ─────────────────────────────────────────────────────────────

function RefreshButton({ onRefetch, isLoading }: { onRefetch: () => void; isLoading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onRefetch}
      disabled={isLoading}
      title="Refresh"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36,
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        background: 'var(--surface-primary)',
        color: 'var(--text-secondary)',
        cursor: isLoading ? 'wait' : 'pointer',
        opacity: isLoading ? 0.6 : 1,
        transition: 'border-color 120ms',
        flexShrink: 0,
      }}
      onMouseEnter={e => { if (!isLoading) e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
    >
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ animation: isLoading ? 'spin 1s linear infinite' : undefined }}
      >
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
      </svg>
    </button>
  );
}

// ── EnterpriseListPage props ───────────────────────────────────────────────────

export interface EnterpriseListPageProps<T extends { id: number }> {
  // Header
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  primaryAction?: React.ReactNode;

  // KPI cards
  kpiCards?: KpiCardConfig[];

  // List state (from useListState)
  listState: ListState;

  // Filters
  filterFields?: FilterField[];
  filterSaveKey?: string;
  searchPlaceholder?: string;

  // Columns & data
  columns: EnterpriseColumn<T>[];
  data: T[];
  totalCount: number;
  isLoading?: boolean;
  error?: unknown;
  onRefetch: () => void;

  // DRF pagination: pass the raw data object to get hasPrev/hasNext
  paginatedData?: { next?: string | null; previous?: string | null } | null;

  // Selection + bulk
  selectable?: boolean;
  bulkActions?: BulkAction[];

  // Empty state
  emptyMessage?: string;
  emptyAction?: React.ReactNode;

  // Row behaviour
  onRowClick?: (item: T) => void;
  rowStyle?: (item: T) => React.CSSProperties | undefined;
}

// ── Main component ─────────────────────────────────────────────────────────────
// Pages calling this must wrap it (and the useListState call) in <Suspense>
// because useListState uses useSearchParams under the hood.

export function EnterpriseListPage<T extends { id: number }>({
  title, description, breadcrumbs, primaryAction,
  kpiCards,
  listState,
  filterFields = [], filterSaveKey, searchPlaceholder = 'Search…',
  columns, data, totalCount,
  isLoading, error, onRefetch,
  paginatedData,
  selectable, bulkActions = [],
  emptyMessage, emptyAction,
  onRowClick, rowStyle,
}: EnterpriseListPageProps<T>) {
  const {
    page, setPage,
    searchInput, handleSearch,
    sort, handleSort,
    filters, handleFilterChange, handleFilterReset, handleRemoveFilter,
    pageSize, setPageSize,
    density, setDensity,
    hiddenColumns, toggleColumn, resetColumnVisibility,
    selectedItems, toggleSelect, selectPage, clearSelection,
    isAllPageSelected, isSomePageSelected,
  } = listState;

  const pageIds = data.map(d => d.id);
  const allSelected = isAllPageSelected(pageIds);
  const someSelected = isSomePageSelected(pageIds);
  const hasActiveFilters = Object.keys(filters).some(k => filters[k] !== '' && filters[k] != null);

  const toolbar = (
    <>
      <SearchInput
        value={searchInput}
        onChange={handleSearch}
        placeholder={searchPlaceholder}
        width={260}
      />

      <div style={{ flex: 1 }} />

      <ColumnVisibilityMenu
        columns={columns}
        hiddenColumns={hiddenColumns}
        onToggle={toggleColumn}
        onReset={resetColumnVisibility}
      />

      <DensityToggle density={density} onChange={setDensity} />

      <RefreshButton onRefetch={onRefetch} isLoading={isLoading} />

      {filterFields.length > 0 && (
        <FilterPanel
          fields={filterFields}
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleFilterReset}
          saveKey={filterSaveKey}
        />
      )}
    </>
  );

  const filterTagsNode = hasActiveFilters && filterFields.length > 0 ? (
    <FilterTags
      filters={filters}
      fields={filterFields}
      onRemoveFilter={handleRemoveFilter}
      onClearAll={handleFilterReset}
    />
  ) : undefined;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={title}
          description={description}
          count={isLoading ? undefined : totalCount}
          breadcrumbs={breadcrumbs}
          actions={primaryAction}
        />

        {kpiCards && kpiCards.length > 0 && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <KpiCardRow cards={kpiCards} />
          </div>
        )}

        <WorkspaceSurface toolbar={toolbar} filterTags={filterTagsNode}>
          {selectable && (
            <BulkBar
              selectedCount={selectedItems.size}
              totalCount={totalCount}
              actions={bulkActions}
              onClearSelection={clearSelection}
              onSelectAllVisible={
                !allSelected ? () => selectPage(pageIds) : undefined
              }
              allVisibleSelected={allSelected}
            />
          )}

          <EnterpriseTable
            columns={columns}
            data={data}
            isLoading={isLoading}
            error={error}
            onRetry={onRefetch}
            emptyMessage={emptyMessage}
            emptyAction={emptyAction}
            selectable={selectable}
            selectedItems={selectedItems}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={ids => {
              if (allSelected) clearSelection();
              else selectPage(ids);
            }}
            isAllSelected={allSelected}
            isSomeSelected={someSelected}
            sort={sort}
            onSort={handleSort}
            density={density}
            hiddenColumns={hiddenColumns}
            onRowClick={onRowClick}
            rowStyle={rowStyle}
            page={page}
            totalCount={totalCount}
            pageSize={pageSize}
            hasPrev={!!paginatedData?.previous}
            hasNext={!!paginatedData?.next}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </WorkspaceSurface>
      </PageShell>
    </MainLayout>
  );
}

