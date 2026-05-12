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
import FilterPanel, { FilterField } from '@/components/ui/FilterPanel';
import FilterTags from '@/components/ui/FilterTags';
import { Button, TextField } from '@/components/ui';
import { formatPrice } from '@/lib/utils/format';
import { useT } from '@/lib/i18n/useT';
import DataTable, { Column } from '@/components/ui/DataTable';
import { useTableState } from '@/lib/hooks/use-table-state';

const STATUS_CLASS: Record<string, string> = {
  draft: 'badge-info', pending: 'badge-warning', approved: 'badge-success',
  rejected: 'badge-error', completed: 'badge-success', cancelled: 'badge-error',
};
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
  const {
    page, setPage, search, filters, selectedItems,
    handleSearch, handleFilterChange, handleFilterReset, handleRemoveFilter,
    toggleSelect, selectPage, clearSelection, isAllPageSelected, isSomePageSelected,
  } = useTableState();

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
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => purchaseOrdersApi.delete(id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); queryClient.invalidateQueries({ queryKey: ['pending-count'] }); toast('Purchase Order deleted', 'success'); },
    onError:    () => toast('Failed to delete purchase order', 'error'),
  });

  const handleDelete = async (id: number) => { if (await confirm('Delete this purchase order?')) deleteMutation.mutate(id); };

  const handleBulkDelete = async () => {
    if (!selectedItems.size || !await confirm(`Delete ${selectedItems.size} purchase orders?`)) return;
    for (const id of selectedItems) await purchaseOrdersApi.delete(id).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    queryClient.invalidateQueries({ queryKey: ['pending-count'] });
    toast(`Deleted ${selectedItems.size} purchase orders`, 'success');
    clearSelection();
  };

  const orders     = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const currentIds = orders.map((o: PurchaseOrder) => o.id);

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'number', header: 'Order Number',
      render: o => <Link href={`/purchase-orders/${o.id}`} className="text-primary hover:underline font-mono font-semibold">{o.order_number}</Link>,
    },
    {
      key: 'project', header: t('col', 'project'),
      render: o => o.project_name
        ? <div><div className="font-medium text-foreground">{o.project_name}</div>{o.project_code && <div className="text-xs text-muted-foreground font-mono">{o.project_code}</div>}</div>
        : <span className="text-muted-foreground">—</span>,
    },
    { key: 'supplier',  header: t('col', 'supplier'),      render: o => <span className="text-muted-foreground">{typeof o.supplier === 'object' ? o.supplier.name : '—'}</span> },
    { key: 'date',      header: 'Order Date',              render: o => <span className="text-muted-foreground">{new Date(o.order_date).toLocaleDateString('en-US')}</span> },
    { key: 'delivery',  header: 'Delivery Date',           render: o => <span className="text-muted-foreground">{o.delivery_date ? new Date(o.delivery_date).toLocaleDateString('en-US') : '—'}</span> },
    { key: 'total',     header: t('col', 'totalAmount'),   render: o => <span className="font-semibold">{formatPrice(o.total)}</span> },
    { key: 'status',    header: t('col', 'status'),        render: o => <span className={`badge ${STATUS_CLASS[o.status] || 'badge-info'}`}>{STATUS_LABEL[o.status] || o.status}</span> },
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
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Purchase Orders</h1>
            <p className="text-sm text-muted-foreground mt-1">{totalCount} total purchase orders</p>
          </div>
          <div className="flex gap-2">
            {canDelete && selectedItems.size > 0 && (
              <Button variant="destructive" onClick={handleBulkDelete}>Delete {selectedItems.size}</Button>
            )}
            {canCreate && <Link href="/purchase-orders/new"><Button variant="primary">+ New Purchase Order</Button></Link>}
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="flex-1">
            <TextField placeholder="Search purchase orders..." value={search} onChange={e => handleSearch(e.target.value)} />
          </div>
          <FilterPanel fields={filterFields} filters={filters} onFilterChange={handleFilterChange} onReset={handleFilterReset} />
        </div>

        <FilterTags filters={filters} fields={filterFields} onRemoveFilter={handleRemoveFilter} onClearAll={handleFilterReset} />

        <DataTable
          columns={columns}
          data={orders}
          isLoading={isLoading}
          error={error}
          emptyMessage="No purchase orders found."
          emptyAction={canCreate ? <Link href="/purchase-orders/new"><Button variant="primary">Create Purchase Order</Button></Link> : undefined}
          selectable={canDelete}
          selectedItems={selectedItems}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={() => isAllPageSelected(currentIds) ? clearSelection() : selectPage(currentIds)}
          isAllSelected={isAllPageSelected(currentIds)}
          isSomeSelected={isSomePageSelected(currentIds)}
          page={page}
          totalCount={totalCount}
          pageSize={20}
          hasPrev={!!data?.previous}
          hasNext={!!data?.next}
          onPageChange={setPage}
        />
      </div>
    </MainLayout>
  );
}
