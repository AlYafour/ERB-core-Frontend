'use client';

import { ReactNode } from 'react';
import { SearchInput } from '@/components/ui/SearchInput';
import { WorkspaceSurface } from '@/components/ui/WorkspaceSurface';
import FilterPanel, { FilterField } from '@/components/ui/FilterPanel';
import FilterTags from '@/components/ui/FilterTags';
import DataTable, { Column } from '@/components/ui/DataTable';
import { useTableState } from '@/lib/hooks/use-table-state';

interface TableShellProps<T extends { id: number }> {
  tableState: ReturnType<typeof useTableState>;
  tabs?: ReactNode;
  filterFields?: FilterField[];
  filterSaveKey?: string;
  searchPlaceholder?: string;
  toolbarActions?: ReactNode;
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  totalCount: number;
  pageSize?: number;
  paginatedData?: { previous?: string | null; next?: string | null } | null;
  selectable?: boolean;
  rowStyle?: (item: T) => React.CSSProperties | undefined;
  onRowClick?: (item: T) => void;
}

export default function TableShell<T extends { id: number }>({
  tableState,
  tabs,
  filterFields = [],
  filterSaveKey,
  searchPlaceholder = 'Search...',
  toolbarActions,
  columns,
  data,
  isLoading,
  error,
  onRetry,
  emptyMessage,
  emptyAction,
  totalCount,
  pageSize = 20,
  paginatedData,
  selectable,
  rowStyle,
  onRowClick,
}: TableShellProps<T>) {
  const {
    page, setPage, search, filters,
    handleSearch, handleFilterChange, handleFilterReset, handleRemoveFilter,
    selectedItems, toggleSelect, selectPage, clearSelection,
    isAllPageSelected, isSomePageSelected,
  } = tableState;

  const currentIds = data.map(item => item.id);

  return (
    <WorkspaceSurface
      tabs={tabs}
      toolbar={
        <>
          <SearchInput value={search} onChange={handleSearch} placeholder={searchPlaceholder} />
          <div className="flex-1" />
          {toolbarActions}
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
      }
      filterTags={
        Object.keys(filters).length > 0 ? (
          <FilterTags
            filters={filters}
            fields={filterFields}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleFilterReset}
          />
        ) : undefined
      }
    >
      <DataTable
        surface
        columns={columns}
        data={data}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        emptyMessage={emptyMessage}
        emptyAction={emptyAction}
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
        rowStyle={rowStyle}
        onRowClick={onRowClick}
      />
    </WorkspaceSurface>
  );
}
