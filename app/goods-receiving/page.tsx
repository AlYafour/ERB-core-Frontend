'use client';

import { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goodsReceivingApi, GoodsReceivedNote } from '@/lib/api/goods-receiving';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { type FilterField } from '@/components/ui/FilterPanel';
import { Button, Badge, type Column } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';
import { GRN_STATUS } from '@/lib/utils/status-colors';
import { GRN_LABEL } from '@/lib/constants/status-labels';
import { ProcListPage } from '@/components/procurement/list/ProcListPage';

const filterFields: FilterField[] = [
  { name: 'receipt_date_after',  label: 'Receipt Date From', type: 'date', group: 'Dates' },
  { name: 'receipt_date_before', label: 'Receipt Date To',   type: 'date', group: 'Dates' },
];

export default function GoodsReceivingPage() {
  const router = useRouter();
  const tableState = useTableState();
  const { page, search, filters } = tableState;

  const queryClient       = useQueryClient();
  const t                 = useT();
  const { hasPermission } = usePermissions();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin   = isTenantAdmin || isPlatformAdmin;
  const canCreate = isAdmin || (hasPermission('goods_receiving', 'create') ?? false);
  const canDelete = isAdmin || (hasPermission('goods_receiving', 'delete') ?? false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['grns', page, search, filters],
    queryFn:  () => goodsReceivingApi.getAll({ page, search, ...filters }),
    staleTime: 2 * 60 * 1000,
  });

  const grnAll = (extra?: object) => goodsReceivingApi.getAll({ page: 1, page_size: 1, ...extra } as any);
  const { data: kpiTotal }     = useQuery({ queryKey: ['grn-kpi', 'total'],     queryFn: () => grnAll(),                       staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });
  const { data: kpiPartial }   = useQuery({ queryKey: ['grn-kpi', 'partial'],   queryFn: () => grnAll({ status: 'partial' }),   staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });
  const { data: kpiCompleted } = useQuery({ queryKey: ['grn-kpi', 'completed'], queryFn: () => grnAll({ status: 'completed' }), staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });
  const { data: kpiCancelled } = useQuery({ queryKey: ['grn-kpi', 'cancelled'], queryFn: () => grnAll({ status: 'cancelled' }), staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => goodsReceivingApi.delete(id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['grns'] }); toast('GRN deleted', 'success'); },
    onError:    () => toast('Failed to delete GRN', 'error'),
  });

  const handleDelete = useCallback(async (id: number) => {
    if (await confirm('Delete this GRN?')) deleteMutation.mutate(id);
  }, [deleteMutation.mutate]);

  const grns       = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const columns = useMemo((): Column<GoodsReceivedNote>[] => [
    { key: 'number',  header: 'GRN Number',      render: g => <span className="font-mono font-semibold" style={{ fontSize: 'var(--text-sm)' }}>{g.grn_number}</span> },
    { key: 'po',      header: 'Purchase Order',   render: g => <span style={{ color: 'var(--text-secondary)' }}>{typeof g.purchase_order === 'object' && g.purchase_order ? (g.purchase_order as any).order_number : g.purchase_order_id}</span> },
    { key: 'date',    header: 'Receipt Date',     render: g => <span style={{ color: 'var(--text-secondary)' }}>{new Date(g.receipt_date).toLocaleDateString('en-US')}</span> },
    { key: 'items',   header: 'Total Items',      render: g => g.total_items ?? g.items?.length ?? 0 },
    { key: 'status',  header: t('col', 'status'), render: g => <Badge variant={GRN_STATUS[g.status] ?? 'info'}>{GRN_LABEL[g.status] || g.status}</Badge> },
    {
      key: 'invoice', header: 'Invoice',
      render: g => <Badge variant={g.invoice_delivery_status === 'delivered' ? 'success' : 'warning'}>{g.invoice_delivery_status === 'delivered' ? 'Delivered' : 'Pending'}</Badge>,
    },
    {
      key: 'actions', header: '',
      render: g => (
        <RowActions actions={[
          { label: 'Print', href: `/print/grn/${g.id}`, target: '_blank' },
          { separator: true, hidden: !canDelete },
          { label: 'Delete', onClick: () => handleDelete(g.id), variant: 'danger', hidden: !canDelete },
        ]} />
      ),
    },
  ], [t, canDelete, handleDelete]);

  return (
    <ProcListPage
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Purchase Management' }, { label: 'Goods Receiving' }]}
      title="Goods Receiving"
      description="Record and verify goods receipt against purchase orders."
      totalCount={totalCount}
      createAction={canCreate ? <Link href="/goods-receiving/new"><Button variant="primary">+ New GRN</Button></Link> : undefined}
      statusItems={[
        { value: '',          label: 'All',       count: kpiTotal,     loading: kpiTotal === undefined },
        { value: 'draft',     label: 'Draft' },
        { value: 'partial',   label: 'Partial',   count: kpiPartial,   loading: kpiPartial === undefined },
        { value: 'completed', label: 'Completed', count: kpiCompleted, loading: kpiCompleted === undefined },
        { value: 'cancelled', label: 'Cancelled', count: kpiCancelled, loading: kpiCancelled === undefined },
      ]}
      searchPlaceholder="Search GRN records…"
      filterFields={filterFields}
      advFilterTitle="GRN Filters"
      advFilterDesc="Filter goods receiving notes by date range."
      columns={columns}
      data={grns}
      isLoading={isLoading}
      error={error}
      onRowClick={g => router.push(`/goods-receiving/${g.id}`)}
      tableState={tableState}
      paginatedData={data}
      pageSize={50}
      emptyTitle="No goods receiving notes found"
      emptyAction={canCreate ? <Link href="/goods-receiving/new"><Button variant="primary">Create GRN</Button></Link> : undefined}
    />
  );
}
