'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { projectsApi } from '@/lib/api/projects';
import { PurchaseOrder } from '@/types';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { type FilterField } from '@/components/ui/FilterPanel';
import { Button, Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import StatusTabs from '@/components/ui/StatusTabs';
import { usePendingCounts } from '@/lib/hooks/use-pending-counts';
import { formatPrice } from '@/lib/utils/format';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';
import { PO_STATUS } from '@/lib/utils/status-colors';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', pending: 'Pending', approved: 'Approved',
  rejected: 'Rejected', completed: 'Completed', cancelled: 'Cancelled',
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
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin     = isTenantAdmin || isPlatformAdmin;
  const canCreate   = isAdmin || (hasPermission('purchase_order', 'create') ?? false);
  const canDelete   = isAdmin;

  // My POs — separate state so it never appears as a filter chip
  const [isMyPOs, setIsMyPOs] = useState(false);
  const toggleMyPOs = () => { setIsMyPOs(v => !v); tableState.setPage(1); };

  // Projects list for the dropdown filter
  const { data: projectsData } = useQuery({
    queryKey: ['projects-list-filter'],
    queryFn: () => projectsApi.getAll({ page: 1, page_size: 200, is_active: true }),
    staleTime: 10 * 60 * 1000,
  });

  const filterFields: FilterField[] = [
    { name: 'order_number', label: 'Order Number', type: 'text',   group: 'Order Info' },
    {
      name: 'project_name', label: 'Project', type: 'select', group: 'Order Info',
      options: projectsData?.results?.map(p => ({ value: p.name, label: p.name })) ?? [],
    },
    {
      name: 'status', label: 'Status', type: 'select', group: 'Status',
      options: Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l })),
    },
    { name: 'order_date_after',  label: 'Order Date From', type: 'date',   group: 'Dates' },
    { name: 'order_date_before', label: 'Order Date To',   type: 'date',   group: 'Dates' },
    { name: 'total_min',         label: 'Min Total',       type: 'number', group: 'Amount' },
    { name: 'total_max',         label: 'Max Total',       type: 'number', group: 'Amount' },
  ];

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-orders', page, search, filters, isMyPOs],
    queryFn: () => purchaseOrdersApi.getAll({
      page, search, ...filters,
      ...(isMyPOs && user?.id ? { pr_created_by: user.id } : {}),
    }),
    staleTime: 2 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => purchaseOrdersApi.delete(id),
    onSuccess: () => {
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
      key: 'number', header: 'Order #',
      render: o => (
        <Link href={`/purchase-orders/${o.id}`} className="font-mono font-semibold" style={{ color: 'var(--text-brand)' }}>
          {o.order_number}
        </Link>
      ),
    },
    {
      key: 'pr', header: 'PR #',
      render: o => {
        if (!o.purchase_request) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
        const prId = typeof o.purchase_request === 'object' ? (o.purchase_request as any).id : o.purchase_request;
        const prCode = typeof o.purchase_request === 'object'
          ? ((o.purchase_request as any).code || `#${prId}`)
          : `#${prId}`;
        return (
          <Link
            href={`/purchase-requests/${prId}`}
            className="font-mono"
            style={{ color: 'var(--text-brand)', fontWeight: 600, fontSize: 'var(--text-sm)' }}
            onClick={e => e.stopPropagation()}
          >
            {prCode}
          </Link>
        );
      },
    },
    {
      key: 'requested_by', header: 'Requested By',
      render: o => (
        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
          {o.pr_created_by_name || '—'}
        </span>
      ),
    },
    {
      key: 'project', header: t('col', 'project'),
      render: o => o.project_name ? (
        <div>
          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{o.project_name}</div>
          {o.project_code && (
            <div className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              {o.project_code}
            </div>
          )}
        </div>
      ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>,
    },
    {
      key: 'supplier', header: t('col', 'supplier'),
      render: o => <span style={{ color: 'var(--text-secondary)' }}>{typeof o.supplier === 'object' ? (o.supplier as any).name : '—'}</span>,
    },
    {
      key: 'date', header: 'Order Date',
      render: o => <span style={{ color: 'var(--text-secondary)' }}>{new Date(o.order_date).toLocaleDateString('en-US')}</span>,
    },
    {
      key: 'total', header: t('col', 'totalAmount'),
      render: o => <span className="font-semibold">{formatPrice(o.total)}</span>,
    },
    {
      key: 'status', header: t('col', 'status'),
      render: o => <Badge variant={PO_STATUS[o.status] ?? 'info'}>{STATUS_LABEL[o.status] || o.status}</Badge>,
    },
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
                { value: 'draft',      label: 'Draft'      },
                { value: 'pending',    label: 'Pending',   count: pending.po },
                { value: 'approved',   label: 'Approved'   },
                { value: 'rejected',   label: 'Rejected'   },
                { value: 'completed',  label: 'Completed'  },
                { value: 'cancelled',  label: 'Cancelled'  },
              ]}
              value={statusValue}
              onChange={handleStatusTab}
            />
          }
          filterFields={filterFields}
          searchPlaceholder="Search purchase orders…"
          toolbarActions={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={toggleMyPOs}
                className={isMyPOs ? 'btn btn-primary' : 'btn btn-secondary'}
              >
                {isMyPOs ? '✓ My POs' : 'My POs'}
              </button>
              {canDelete && selectedItems.size > 0 && (
                <Button variant="destructive" onClick={handleBulkDelete}>
                  Delete {selectedItems.size}
                </Button>
              )}
            </div>
          }
          columns={columns}
          data={orders}
          isLoading={isLoading}
          error={error}
          emptyMessage="No purchase orders found."
          emptyAction={
            canCreate
              ? <Link href="/purchase-orders/new"><Button variant="primary">Create Purchase Order</Button></Link>
              : undefined
          }
          onRowClick={o => router.push(`/purchase-orders/${o.id}`)}
          selectable={canDelete}
          totalCount={totalCount}
          paginatedData={data}
        />
      </PageShell>
    </MainLayout>
  );
}
