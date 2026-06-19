'use client';

import { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseQuotationsApi } from '@/lib/api/purchase-quotations';
import { PurchaseQuotation } from '@/types';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import FilterPanel, { FilterField } from '@/components/ui/FilterPanel';
import FilterTags from '@/components/ui/FilterTags';
import StatusTabs from '@/components/ui/StatusTabs';
import { Button, Badge, PageHeader, SearchInput, PageShell, WorkspaceSurface } from '@/components/ui';
import { ProcKPIBar } from '@/components/procurement/shared/ProcKPIBar';
import { RowActions } from '@/components/ui/RowActions';
import { formatPrice } from '@/lib/utils/format';
import { useT } from '@/lib/i18n/useT';
import DataTable, { Column } from '@/components/ui/DataTable';
import { useTableState } from '@/lib/hooks/use-table-state';
import { PQ_STATUS } from '@/lib/utils/status-colors';
import { PQ_LABEL } from '@/lib/constants/status-labels';

const filterFields: FilterField[] = [
  { name: 'quotation_number',      label: 'Quotation Number',   type: 'text',   group: 'Quotation Info' },
  { name: 'status',                label: 'Status',             type: 'select', group: 'Status',
    options: [{ value: 'pending', label: 'Pending' }, { value: 'awarded', label: 'Awarded' }, { value: 'rejected', label: 'Rejected' }, { value: 'expired', label: 'Expired' }] },
  { name: 'quotation_date_after',  label: 'Quotation Date From', type: 'date', group: 'Dates' },
  { name: 'quotation_date_before', label: 'Quotation Date To',   type: 'date', group: 'Dates' },
  { name: 'valid_until_after',     label: 'Valid Until From',    type: 'date', group: 'Dates' },
  { name: 'valid_until_before',    label: 'Valid Until To',      type: 'date', group: 'Dates' },
];

function resolveId(val: number | { id: number } | null | undefined): number | null {
  if (!val) return null;
  if (typeof val === 'number') return val;
  return val.id ?? null;
}

export default function PurchaseQuotationsPage() {
  const router = useRouter();
  const tableState = useTableState();
  const {
    page, setPage, search, filters, selectedItems,
    handleSearch, handleFilterChange, handleFilterReset, handleRemoveFilter,
    toggleSelect, selectPage, clearSelection, isAllPageSelected, isSomePageSelected,
  } = tableState;
  const statusValue = (filters.status as string) || '';
  const handleStatusTab = (v: string) => { handleFilterChange('status', v); setPage(1); };

  const queryClient    = useQueryClient();
  const t              = useT();
  const { hasPermission } = usePermissions();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin     = isTenantAdmin || isPlatformAdmin;
  const canCreate   = isAdmin || (hasPermission('purchase_quotation', 'create') ?? false);
  const canDelete   = isAdmin || (hasPermission('purchase_quotation', 'delete') ?? false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-quotations', page, search, filters],
    queryFn:  () => purchaseQuotationsApi.getAll({ page, search, ...filters }),
    staleTime: 2 * 60 * 1000,
  });

  const pqAll = (extra?: object) => purchaseQuotationsApi.getAll({ page: 1, page_size: 1, ...extra } as any);
  const { data: kpiTotal }    = useQuery({ queryKey: ['pq-kpi', 'total'],    queryFn: () => pqAll(),                      staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });
  const { data: kpiPending }  = useQuery({ queryKey: ['pq-kpi', 'pending'],  queryFn: () => pqAll({ status: 'pending' }),  staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });
  const { data: kpiAwarded }  = useQuery({ queryKey: ['pq-kpi', 'awarded'],  queryFn: () => pqAll({ status: 'awarded' }),  staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });
  const { data: kpiRejected } = useQuery({ queryKey: ['pq-kpi', 'rejected'], queryFn: () => pqAll({ status: 'rejected' }), staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });
  const { data: kpiExpired }  = useQuery({ queryKey: ['pq-kpi', 'expired'],  queryFn: () => pqAll({ status: 'expired' }),  staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });

  const deleteMutation = useMutation({
    mutationFn: purchaseQuotationsApi.delete,
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['purchase-quotations'] }); queryClient.invalidateQueries({ queryKey: ['pending-count'] }); toast('Quotation deleted', 'success'); },
    onError:    () => toast('Failed to delete quotation', 'error'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => { await Promise.all(ids.map(id => purchaseQuotationsApi.delete(id))); },
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['purchase-quotations'] }); queryClient.invalidateQueries({ queryKey: ['pending-count'] }); toast(`${selectedItems.size} quotation(s) deleted`, 'success'); clearSelection(); },
    onError:    () => toast('Failed to delete some quotations', 'error'),
  });

  const handleDelete     = useCallback(async (id: number) => {
    if (await confirm('Delete this quotation?')) deleteMutation.mutate(id);
  }, [deleteMutation.mutate]);
  const handleBulkDelete = async () => { if (selectedItems.size && await confirm(`Delete ${selectedItems.size} quotation(s)?`)) bulkDeleteMutation.mutate(Array.from(selectedItems)); };

  const quotations = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const currentIds = quotations.map((q: PurchaseQuotation) => q.id);

  const columns = useMemo((): Column<PurchaseQuotation>[] => [
    { key: 'number', header: t('col', 'quotationNumber'), render: q => <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>{q.quotation_number}</span> },
    {
      key: 'status', header: t('col', 'status'),
      render: q => <Badge variant={PQ_STATUS[q.status ?? 'pending'] ?? 'info'}>{PQ_LABEL[q.status ?? 'pending'] || q.status}</Badge>,
    },
    {
      key: 'pr', header: 'PR',
      render: q => {
        const prId = q.purchase_request_id ?? resolveId(q.purchase_request as any);
        return q.purchase_request_code && prId
          ? <Link href={`/purchase-requests/${prId}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }} onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }} onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}>{q.purchase_request_code}</Link>
          : <span style={{ color: 'var(--text-secondary)' }}>—</span>;
      },
    },
    {
      key: 'qr', header: 'QR',
      render: q => {
        const qrId = q.quotation_request_id ?? resolveId(q.quotation_request as any);
        return q.quotation_request_code && qrId
          ? <Link href={`/quotation-requests/${qrId}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }} onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }} onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}>{q.quotation_request_code}</Link>
          : <span style={{ color: 'var(--text-secondary)' }}>—</span>;
      },
    },
    {
      key: 'project', header: 'Project',
      render: q => q.project_name
        ? <div><div style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>{q.project_name}</div>{q.project_code && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{q.project_code}</div>}</div>
        : <span style={{ color: 'var(--text-secondary)' }}>—</span>,
    },
    {
      key: 'supplier', header: t('col', 'supplier'),
      render: q => <span style={{ color: 'var(--text-primary)' }}>{typeof q.supplier === 'object' && q.supplier ? q.supplier.business_name || q.supplier.name || 'N/A' : 'N/A'}</span>,
    },
    { key: 'date',     header: t('col', 'requestDate'),  render: q => <span style={{ color: 'var(--text-secondary)' }}>{new Date(q.quotation_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span> },
    { key: 'delivery', header: t('col', 'deliveryMethod'), render: q => <span style={{ color: 'var(--text-primary)' }}>{q.delivery_method ? (q.delivery_method === 'pickup' ? 'Pick Up' : 'Delivery') : '—'}</span> },
    { key: 'total',    header: t('col', 'totalAmount'),  render: q => <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>{formatPrice(q.total || 0)}</span> },
    {
      key: 'actions', header: '',
      render: q => (
        <RowActions actions={[
          { separator: true, hidden: !canDelete },
          { label: 'Delete', onClick: () => handleDelete(q.id), variant: 'danger', hidden: !canDelete },
        ]} />
      ),
    },
  ], [t, canDelete, handleDelete]);

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Purchase Quotations"
          description="Review and award vendor quotations."
          count={totalCount}
          breadcrumbs={[{ label: 'Purchase Quotations' }]}
          actions={
            canCreate
              ? <Link href="/purchase-quotations/new"><Button variant="primary">New Quotation</Button></Link>
              : undefined
          }
        />

        <ProcKPIBar items={[
          { label: 'Total',         value: kpiTotal    ?? '—', variant: 'total',   loading: kpiTotal    == null },
          { label: 'Pending',       value: kpiPending  ?? '—', variant: 'warning', loading: kpiPending  == null },
          { label: 'Awarded',       value: kpiAwarded  ?? '—', variant: 'success', loading: kpiAwarded  == null },
          { label: 'Rejected',      value: kpiRejected ?? '—', variant: 'error',   loading: kpiRejected == null },
          { label: 'Expired',       value: kpiExpired  ?? '—', variant: 'neutral', loading: kpiExpired  == null },
        ]} />
        <WorkspaceSurface
          tabs={
            <StatusTabs
              options={[
                { value: 'pending',  label: 'Pending'  },
                { value: 'awarded',  label: 'Awarded'  },
                { value: 'rejected', label: 'Rejected' },
                { value: 'expired',  label: 'Expired'  },
              ]}
              value={statusValue}
              onChange={handleStatusTab}
            />
          }
          toolbar={
            <>
              <SearchInput value={search} onChange={handleSearch} placeholder="Search quotations…" width={260} />
              <div style={{ flex: 1 }} />
              {isAdmin && selectedItems.size > 0 && (
                <Button variant="destructive" onClick={handleBulkDelete} isLoading={bulkDeleteMutation.isPending}>
                  Delete {selectedItems.size}
                </Button>
              )}
              <FilterPanel fields={filterFields} filters={filters} onFilterChange={handleFilterChange} onReset={handleFilterReset} saveKey="purchase-quotations" />
            </>
          }
          filterTags={
            Object.keys(filters).length > 0
              ? <FilterTags filters={filters} fields={filterFields} onRemoveFilter={handleRemoveFilter} onClearAll={handleFilterReset} />
              : undefined
          }
        >
          <DataTable
            surface
            columns={columns}
            data={quotations}
            isLoading={isLoading}
            error={error}
            emptyMessage={t('empty', 'noPQ')}
            onRowClick={q => router.push(`/purchase-quotations/${q.id}`)}
            selectable={isAdmin}
            selectedItems={selectedItems}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={() => isAllPageSelected(currentIds) ? clearSelection() : selectPage(currentIds)}
            isAllSelected={isAllPageSelected(currentIds)}
            isSomeSelected={isSomePageSelected(currentIds)}
            page={page}
            totalCount={totalCount}
            pageSize={50}
            hasPrev={!!data?.previous}
            hasNext={!!data?.next}
            onPageChange={setPage}
          />
        </WorkspaceSurface>
      </PageShell>
    </MainLayout>
  );
}
