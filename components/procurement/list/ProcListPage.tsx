'use client';

/**
 * ProcListPage — thin adapter over AppListPage.
 *
 * The procurement list pages were built on their own component that has
 * since become a byte-for-byte duplicate of AppListPage (same MainLayout +
 * proc-list-surface + DataTable + status strip). To guarantee the two can
 * never visually drift again, ProcListPage now DELEGATES to AppListPage —
 * there is exactly ONE list-page rendering path in the whole app.
 *
 * The prop surface is preserved so the 7 existing call sites keep working
 * unchanged (breadcrumbs/statusItems/tableState shapes are identical).
 */

import { type ReactNode } from 'react';
import { type Column } from '@/components/ui/DataTable';
import { type FilterField } from '@/components/ui/FilterPanel';
import { AppListPage, type AppListPageProps } from '@/components/app/AppListPage';

interface BreadcrumbItem { label: string; href?: string; }

interface StripItem {
  value: string;
  label: string;
  count?: number | null;
  loading?: boolean;
}

interface PaginatedData {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: unknown[];
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
  deselectPage?: (ids: number[]) => void;
  clearSelection: () => void;
  isAllPageSelected: (ids: number[]) => boolean;
  isSomePageSelected: (ids: number[]) => boolean;
}

export interface ProcListPageProps {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  description: string;
  totalCount: number;
  pendingCount?: number;
  createAction?: ReactNode;
  headerExtra?: ReactNode;
  statusItems: StripItem[];
  totalAmount?: number;
  totalAmountLabel?: string;
  searchPlaceholder?: string;
  extraActions?: ReactNode;
  filterFields: FilterField[];
  advFilterTitle?: string;
  advFilterDesc?: string;
  columns: Column<any>[];
  data: any[];
  isLoading: boolean;
  error: unknown;
  onRowClick?: (row: any) => void;
  rowStyle?: (row: any) => React.CSSProperties | undefined;
  selectable?: boolean;
  pageSize?: number;
  paginatedData?: PaginatedData;
  emptyTitle?: string;
  emptyAction?: ReactNode;
  bulkActions?: ReactNode;
  tableState: TableState;
  children?: ReactNode;
}

export function ProcListPage(props: ProcListPageProps) {
  // Shapes are structurally identical to AppListPage's — safe pass-through.
  return <AppListPage {...(props as unknown as AppListPageProps)} />;
}
