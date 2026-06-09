'use client';

import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { usersApi } from '@/lib/api/users';
import { PurchaseOrder } from '@/types';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { type FilterField } from '@/components/ui/FilterPanel';
import { Button, Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import StatusTabs from '@/components/ui/StatusTabs';
import { usePendingCounts } from '@/lib/hooks/use-pending-counts';
import { formatPrice } from '@/lib/utils/format';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';
import { PO_STATUS } from '@/lib/utils/status-colors';
import { useMemo } from 'react';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', pending: 'Pending', approved: 'Approved',
  rejected: 'Rejected', completed: 'Completed', cancelled: 'Cancelled',
  amendment_requested: 'Amendment Requested', superseded: 'Superseded',
};

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const tableState = useTableState();
  const { page, search, filters, selectedItems, clearSelection } = tableState;
  const pending = usePendingCounts();
  const statusValue = (filters.status as string) || '';
  const handleStatusTab = (v: string) => { tableState.handleFilterChange('status', v); tableState.setPage(1); };

  const queryClient    = useQueryClient();
  const { user }       = useAuth();
  const t              = useT();
  const { hasPermission } = usePermissions();
  const isSuperuser = user?.is_superuser ?? false;
  const isAdmin     = user?.role === 'admin' || user?.is_staff || isSuperuser;
  const canCreate   = isSuperuser || (hasPermission('purchase_order', 'create') ?? false);
  const canDelete   = isAdmin;

  const isMineActive = filters.pr_created_by === user?.id;
  const toggleMine = () => {
    tableState.handleFilterChange('pr_created_by', isMineActive ? '' : user?.id);
    tableState.setPage(1);
  };

  /* Fetch all users for the engineer dropdowns */
  const { data: usersData } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => usersApi.getAll({ page_size: 200 }),
    staleTime: 5 * 60 * 1000,
  });

  const userOptions = useMemo(() => {
    const list = Array.isArray(usersData?.results) ? usersData!.results : [];
    return list.map(u => ({
      value: u.id,
      label: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username,
    }));
  }, [usersData]);

  const engineerOptions = useMemo(() => {
    const list = Array.isArray(usersData?.results) ? usersData!.results : [];
    return list
      .filter(u => u.role === 'site_engineer')
      .map(u => ({
        value: u.id,
        label: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username,
      }));
  }, [usersData]);

  const filterFields: FilterField[] = [
    { name: 'order_number',    label: 'Order Number', type: 'text',   group: 'Order Info' },
    { name: 'status',          label: 'Status',       type: 'select', group: 'Status',
      options: Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l })) },
    { name: 'pr_created_by',   label: 'Responsible Engineer', type: 'select', group: 'People', options: userOptions },
    { name: 'project_engineer', label: 'Project Engineer',   type: 'select', group: 'People', options: engineerOptions },
    { name: 'order_date_after',  label: 'Order Date From', type: 'date',   group: 'Dates' },
    { name: 'order_date_before', label: 'Order Date To',   type: 'date',   group: 'Dates' },
    { name: 'total_min',         label: 'Min Total',       type: 'number', group: 'Amount' },
    { name: 'total_max',         label: 'Max Total',       type: 'number', group: 'Amount' },
  ];

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
    onError: (e: unknown) => toast(getApiError(e, 'Failed to delete purchase order'), 'error'),
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
    { key: 'supplier',  header: t('col', 'supplier'),    render: o => <span style={{ color: 'var(--text-secondary)' }}>{typeof o.supplier === 'object' ? o.supplier.name : '—'}</span> },
    {
      key: 'engineer', header: 'Engineer',
      render: o => o.pr_created_by_name
        ? <span style={{ color: 'var(--text-primary)' }}>{o.pr_created_by_name}</span>
        : <span style={{ color: 'var(--text-secondary)' }}>—</span>,
    },
    { key: 'date',     header: 'Order Date',            render: o => <span style={{ color: 'var(--text-secondary)' }}>{new Date(o.order_date).toLocaleDateString('en-US')}</span> },
    { key: 'total',    header: t('col', 'totalAmount'),  render: o => <span className="font-semibold">{formatPrice(o.total)}</span> },
    { key: 'status',   header: t('col', 'status'),       render: o => <Badge variant={PO_STATUS[o.status] ?? 'info'}>{STATUS_LABEL[o.status] || o.status}</Badge> },
    {
      key: 'actions', header: '',
      render: o => (
        <RowActions actions={[
          { label: 'Print', href: `/print/lpo/${o.id}`, target: '_blank' },
          { separator: true, hidden: !canDelete },
          { label: 'Delete', onClick: () => handleDelete(o.id), variant: 'danger', hidden: !canDelete },
        ]} />
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
          metrics={pending.po > 0 ? [{ label: 'pending approval', value: pending.po, variant: 'warning' }] : undefined}
          actions={
            canCreate
              ? <Link href="/purchase-orders/new"><Button variant="primary">+ New Purchase Order</Button></Link>
              : undefined
          }
        />
        <TableShell
          tableState={tableState}
          tabs={
            <StatusTabs
              options={[
                { value: 'draft',                label: 'Draft'      },
                { value: 'pending',              label: 'Pending',   count: pending.po },
                { value: 'approved',             label: 'Approved'   },
                { value: 'amendment_requested',  label: 'Amendment'  },
                { value: 'rejected',             label: 'Rejected'   },
                { value: 'completed',            label: 'Completed'  },
                { value: 'cancelled',            label: 'Cancelled'  },
                { value: 'superseded',           label: 'Superseded' },
              ]}
              value={statusValue}
              onChange={handleStatusTab}
            />
          }
          filterFields={filterFields}
          filterSaveKey="purchase-orders"
          searchPlaceholder="Search purchase orders…"
          toolbarActions={
            <>
              <button
                onClick={toggleMine}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: '1.5px solid', transition: 'all 0.15s',
                  backgroundColor: isMineActive ? 'var(--color-wine-500)' : 'transparent',
                  borderColor: isMineActive ? 'var(--color-wine-500)' : 'var(--border)',
                  color: isMineActive ? 'white' : 'var(--text-secondary)',
                }}
              >
                {isMineActive ? '✕ My LPOs' : 'My LPOs'}
              </button>
              {canDelete && selectedItems.size > 0 && (
                <Button variant="destructive" onClick={handleBulkDelete}>Delete {selectedItems.size}</Button>
              )}
            </>
          }
          columns={columns}
          data={orders}
          isLoading={isLoading}
          error={error}
          emptyMessage="No purchase orders found."
          emptyAction={canCreate ? <Link href="/purchase-orders/new"><Button variant="primary">Create Purchase Order</Button></Link> : undefined}
          onRowClick={o => router.push(`/purchase-orders/${o.id}`)}
          selectable={isAdmin}
          totalCount={totalCount}
          paginatedData={data}
        />
      </PageShell>
    </MainLayout>
  );
}
