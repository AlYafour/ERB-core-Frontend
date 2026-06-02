'use client';

import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goodsReceivingApi, GoodsReceivedNote } from '@/lib/api/goods-receiving';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { type FilterField } from '@/components/ui/FilterPanel';
import { Button, Badge, PageHeader, PageShell, TableShell, RowActions, type Column } from '@/components/ui';
import StatusTabs from '@/components/ui/StatusTabs';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';
import { GRN_STATUS } from '@/lib/utils/status-colors';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', partial: 'Partial', completed: 'Completed', cancelled: 'Cancelled',
};

const filterFields: FilterField[] = [
  { name: 'status', label: 'Status', type: 'select', group: 'Status',
    options: [
      { value: 'draft', label: 'Draft' }, { value: 'partial', label: 'Partial' },
      { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' },
    ]},
  { name: 'receipt_date_after',  label: 'Receipt Date From', type: 'date', group: 'Dates' },
  { name: 'receipt_date_before', label: 'Receipt Date To',   type: 'date', group: 'Dates' },
];

export default function GoodsReceivingPage() {
  const router = useRouter();
  const tableState = useTableState();
  const { page, search, filters } = tableState;
  const statusValue = (filters.status as string) || '';
  const handleStatusTab = (v: string) => { tableState.handleFilterChange('status', v); tableState.setPage(1); };

  const queryClient    = useQueryClient();
  const { user }       = useAuth();
  const t              = useT();
  const { hasPermission } = usePermissions();
  const isSuperuser = user?.is_superuser ?? false;
  const canCreate   = isSuperuser || (hasPermission('goods_receiving', 'create') ?? false);
  const canDelete   = isSuperuser;

  const { data, isLoading, error } = useQuery({
    queryKey: ['grns', page, search, filters],
    queryFn:  () => goodsReceivingApi.getAll({ page, search, ...filters }),
    staleTime: 2 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => goodsReceivingApi.delete(id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['grns'] }); toast('GRN deleted', 'success'); },
    onError:    () => toast('Failed to delete GRN', 'error'),
  });

  const handleDelete = async (id: number) => { if (await confirm('Delete this GRN?')) deleteMutation.mutate(id); };

  const grns       = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const columns: Column<GoodsReceivedNote>[] = [
    {
      key: 'number', header: 'GRN Number',
      render: g => <span className="font-mono font-semibold" style={{ fontSize: 'var(--text-sm)' }}>{g.grn_number}</span>,
    },
    { key: 'po',    header: 'Purchase Order', render: g => <span style={{ color: 'var(--text-secondary)' }}>{typeof g.purchase_order === 'object' && g.purchase_order ? (g.purchase_order as any).order_number : g.purchase_order_id}</span> },
    { key: 'date',  header: 'Receipt Date',   render: g => <span style={{ color: 'var(--text-secondary)' }}>{new Date(g.receipt_date).toLocaleDateString('en-US')}</span> },
    { key: 'items', header: 'Total Items',    render: g => g.total_items ?? g.items?.length ?? 0 },
    { key: 'status', header: t('col', 'status'), render: g => <Badge variant={GRN_STATUS[g.status] ?? 'info'}>{STATUS_LABEL[g.status] || g.status}</Badge> },
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
  ];

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Purchase Management', href: '#' }, { label: 'Goods Receiving' }]}
          title="Goods Receiving"
          description="Record and verify goods receipt against purchase orders."
          count={totalCount}
          actions={canCreate ? <Link href="/goods-receiving/new"><Button variant="primary">+ New GRN</Button></Link> : undefined}
        />
        <TableShell
          tableState={tableState}
          tabs={
            <StatusTabs
              options={[
                { value: 'draft',     label: 'Draft'     },
                { value: 'partial',   label: 'Partial'   },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              value={statusValue}
              onChange={handleStatusTab}
            />
          }
          filterFields={filterFields}
          filterSaveKey="goods-receiving"
          searchPlaceholder="Search GRN records…"
          columns={columns}
          data={grns}
          isLoading={isLoading}
          error={error}
          emptyMessage="No goods receiving notes found."
          emptyAction={canCreate ? <Link href="/goods-receiving/new"><Button variant="primary">Create GRN</Button></Link> : undefined}
          onRowClick={g => router.push(`/goods-receiving/${g.id}`)}
          totalCount={totalCount}
          paginatedData={data}
        />
      </PageShell>
    </MainLayout>
  );
}
