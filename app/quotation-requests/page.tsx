'use client';

import { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotationRequestsApi } from '@/lib/api/quotation-requests';
import { QuotationRequest } from '@/types';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { type FilterField } from '@/components/ui/FilterPanel';
import { Button, type Column } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';
import { ProcListPage } from '@/components/procurement/list/ProcListPage';

const filterFields: FilterField[] = [
  { name: 'created_at_after',  label: 'Created From', type: 'date', group: 'Dates' },
  { name: 'created_at_before', label: 'Created To',   type: 'date', group: 'Dates' },
];

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export default function QuotationRequestsPage() {
  const router = useRouter();
  const tableState = useTableState();
  const { page, search, filters, selectedItems } = tableState;

  const queryClient       = useQueryClient();
  const t                 = useT();
  const { hasPermission } = usePermissions();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin   = isTenantAdmin || isPlatformAdmin;
  const canCreate = isAdmin || (hasPermission('quotation_request', 'create') ?? false);
  const canDelete = isAdmin || (hasPermission('quotation_request', 'delete') ?? false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['quotation-requests', page, search, filters],
    queryFn:  () => quotationRequestsApi.getAll({ page, search, ...filters }),
    staleTime: 2 * 60 * 1000,
  });

  const { data: kpiTotal } = useQuery({
    queryKey: ['qr-kpi', 'total'],
    queryFn:  () => quotationRequestsApi.getAll({ page: 1, page_size: 1 }),
    staleTime: 5 * 60 * 1000,
    select: (d: { count?: number }) => d.count ?? 0,
  });

  const deleteMutation = useMutation({
    mutationFn: quotationRequestsApi.delete,
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['quotation-requests'] }); toast('Request deleted', 'success'); },
    onError:    () => toast('Failed to delete request', 'error'),
  });
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => { await Promise.all(ids.map(id => quotationRequestsApi.delete(id))); },
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['quotation-requests'] }); toast(`${selectedItems.size} request(s) deleted`, 'success'); tableState.clearSelection(); },
    onError:    () => toast('Failed to delete some requests', 'error'),
  });

  const handleDelete     = useCallback(async (id: number) => { if (await confirm('Delete this request?')) deleteMutation.mutate(id); }, [deleteMutation.mutate]);
  const handleBulkDelete = async () => { if (selectedItems.size && await confirm(`Delete ${selectedItems.size} request(s)?`)) bulkDeleteMutation.mutate(Array.from(selectedItems)); };

  const requests   = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const columns = useMemo((): Column<QuotationRequest>[] => [
    {
      key: 'code', header: t('col', 'code'),
      render: r => (
        <span className="font-medium">
          {typeof r.purchase_request === 'object' && r.purchase_request ? (r.purchase_request as any).code || 'N/A' : 'N/A'}
        </span>
      ),
    },
    {
      key: 'project', header: 'Project',
      render: r => r.project_name
        ? <div><div className="font-medium">{r.project_name}</div>{r.project_code && <div className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{r.project_code}</div>}</div>
        : <span style={{ color: 'var(--text-secondary)' }}>â€”</span>,
    },
    {
      key: 'supplier', header: t('col', 'supplier'),
      render: r => <span>{typeof r.supplier === 'object' && r.supplier ? (r.supplier as any).business_name || (r.supplier as any).name || 'N/A' : 'N/A'}</span>,
    },
    { key: 'date', header: t('col', 'requestDate'), render: r => <span style={{ color: 'var(--text-secondary)' }}>{fmtDate(r.created_at)}</span> },
    {
      key: 'actions', header: '',
      render: r => (
        <RowActions actions={[
          { separator: true, hidden: !canDelete },
          { label: 'Delete', onClick: () => handleDelete(r.id), variant: 'danger', hidden: !canDelete },
        ]} />
      ),
    },
  ], [t, canDelete, handleDelete]);

  return (
    <ProcListPage
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Purchase Management' }, { label: 'Quotation Requests' }]}
      title="Quotation Requests"
      description="Manage vendor quotation requests from purchase requests."
      totalCount={totalCount}
      createAction={canCreate ? <Link href="/quotation-requests/new"><Button variant="primary">New Request</Button></Link> : undefined}
      statusItems={[{ value: '', label: 'All RFQs', count: kpiTotal, loading: kpiTotal === undefined }]}
      searchPlaceholder="Search by code, titleâ€¦"
      filterFields={filterFields}
      advFilterTitle="Quotation Request Filters"
      advFilterDesc="Filter by creation date range."
      columns={columns}
      data={requests}
      isLoading={isLoading}
      error={error}
      onRowClick={r => router.push(`/quotation-requests/${r.id}`)}
      selectable={isAdmin}
      tableState={tableState}
      paginatedData={data}
      pageSize={50}
      emptyTitle="No quotation requests found"
      emptyAction={canCreate ? <Link href="/quotation-requests/new"><Button variant="primary">New Request</Button></Link> : undefined}
      bulkActions={
        isAdmin ? (
          <Button variant="destructive" onClick={handleBulkDelete} isLoading={bulkDeleteMutation.isPending}>
            Delete {selectedItems.size}
          </Button>
        ) : undefined
      }
    />
  );
}
