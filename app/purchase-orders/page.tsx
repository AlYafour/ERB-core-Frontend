'use client';

import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { PurchaseOrder } from '@/types';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { type FilterField } from '@/components/ui/FilterPanel';
import { Button, Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import { formatPrice } from '@/lib/utils/format';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';
import { PO_STATUS } from '@/lib/utils/status-colors';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', pending: 'Pending', approved: 'Approved',
  rejected: 'Rejected', completed: 'Completed', cancelled: 'Cancelled',
};

const filterFields: FilterField[] = [
  { name: 'order_number',      label: 'Order Number',    type: 'text',   group: 'Order Info' },
  { name: 'status',            label: 'Status',          type: 'select', group: 'Status',
    options: Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l })) },
  { name: 'order_date_after',  label: 'Order Date From', type: 'date',   group: 'Dates' },
  { name: 'order_date_before', label: 'Order Date To',   type: 'date',   group: 'Dates' },
  { name: 'total_min',         label: 'Min Total',       type: 'number', group: 'Amount' },
  { name: 'total_max',         label: 'Max Total',       type: 'number', group: 'Amount' },
];

export default function PurchaseOrdersPage() {
  const tableState = useTableState();
  const { page, search, filters, selectedItems, clearSelection } = tableState;

  const queryClient    = useQueryClient();
  const { user }       = useAuth();
  const t              = useT();
  const { hasPermission } = usePermissions();
  const isSuperuser = user?.is_superuser ?? false;
  const canCreate   = isSuperuser || (hasPermission('purchase_order', 'create') ?? false);
  const canDelete   = isSuperuser;

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-orders', page, search, filters],
    queryFn:  () => purchaseOrdersApi.getAll({ page, search, ...filters }),
    staleTime: 2 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => purchaseOrdersApi.delete(id),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      toast('Purchase Order deleted', 'success');
    },
    onError: () => toast('Failed to delete purchase order', 'error'),
  });

  const handleDelete = async (id: number) => {
    if (await confirm('Delete this purchase order?')) deleteMutation.mutate(id);
  };

  const handleBulkDelete = async () => {
    if (!selectedItems.size || !await confirm(`Delete ${selectedItems.size} purchase orders?`)) return;
    for (const id of selectedItems) await purchaseOrdersApi.delete(id).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    queryClient.invalidateQueries({ queryKey: ['pending-count'] });
    toast(`Deleted ${selectedItems.size} purchase orders`, 'success');
    clearSelection();
  };

  const orders     = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'number', header: 'Order Number',
      render: o => (
        <Link href={`/purchase-orders/${o.id}`} className="font-mono font-semibold" style={{ color: 'var(--text-brand)' }}>
          {o.order_number}
        </Link>
      ),
    },
    {
      key: 'project', header: t('col', 'project'),
      render: o => o.project_name
        ? (
          <div>
            <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{o.project_name}</div>
            {o.project_code && <div className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{o.project_code}</div>}
          </div>
        )
        : <span style={{ color: 'var(--text-secondary)' }}>—</span>,
    },
    { key: 'supplier',  header: t('col', 'supplier'),      render: o => <span style={{ color: 'var(--text-secondary)' }}>{typeof o.supplier === 'object' ? o.supplier.name : '—'}</span> },
    { key: 'date',      header: 'Order Date',              render: o => <span style={{ color: 'var(--text-secondary)' }}>{new Date(o.order_date).toLocaleDateString('en-US')}</span> },
    { key: 'delivery',  header: 'Delivery Date',           render: o => <span style={{ color: 'var(--text-secondary)' }}>{o.delivery_date ? new Date(o.delivery_date).toLocaleDateString('en-US') : '—'}</span> },
    { key: 'total',     header: t('col', 'totalAmount'),   render: o => <span className="font-semibold">{formatPrice(o.total)}</span> },
    { key: 'status',    header: t('col', 'status'),        render: o => <Badge variant={PO_STATUS[o.status] ?? 'info'}>{STATUS_LABEL[o.status] || o.status}</Badge> },
    {
      key: 'actions', header: t('col', 'actions'),
      render: o => (
        <div className="flex gap-2">
          <Link href={`/purchase-orders/${o.id}`}><Button variant="view" size="sm">{t('btn', 'view')}</Button></Link>
          <Link href={`/print/lpo/${o.id}`} target="_blank"><Button variant="secondary" size="sm">Print</Button></Link>
          {canDelete && <Button variant="destructive" size="sm" onClick={() => handleDelete(o.id)}>{t('btn', 'delete')}</Button>}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Purchase Orders"
          description="Issue and track purchase orders to suppliers."
          count={totalCount}
          breadcrumbs={[{ label: 'Purchase Orders' }]}
          actions={
            canCreate
              ? <Link href="/purchase-orders/new"><Button variant="primary">+ New Purchase Order</Button></Link>
              : undefined
          }
        />
        <TableShell
          tableState={tableState}
          filterFields={filterFields}
          searchPlaceholder="Search purchase orders…"
          toolbarActions={
            canDelete && selectedItems.size > 0 ? (
              <Button variant="destructive" onClick={handleBulkDelete}>Delete {selectedItems.size}</Button>
            ) : undefined
          }
          columns={columns}
          data={orders}
          isLoading={isLoading}
          error={error}
          emptyMessage="No purchase orders found."
          emptyAction={canCreate ? <Link href="/purchase-orders/new"><Button variant="primary">Create Purchase Order</Button></Link> : undefined}
          selectable={canDelete}
          totalCount={totalCount}
          paginatedData={data}
        />
      </PageShell>
    </MainLayout>
  );
}
