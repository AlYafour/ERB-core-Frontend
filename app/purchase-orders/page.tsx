'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { projectsApi } from '@/lib/api/projects';
import { suppliersApi } from '@/lib/api/suppliers';
import { usersApi } from '@/lib/api/users';
import { PurchaseOrder } from '@/types';
import Link from 'next/link';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { type FilterField } from '@/components/ui/FilterPanel';
import { Button, Badge, PersonCell, type Column } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import { usePendingCounts } from '@/lib/hooks/use-pending-counts';
import { formatPrice } from '@/lib/utils/format';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';
import { PO_STATUS } from '@/lib/utils/status-colors';
import { PO_LABEL } from '@/lib/constants/status-labels';
import { ProcListPage } from '@/components/procurement/list/ProcListPage';

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const tableState = useTableState();
  const { page, search, filters, selectedItems, clearSelection } = tableState;
  const pending = usePendingCounts();

  const queryClient       = useQueryClient();
  const { user }          = useAuth();
  const t                 = useT();
  const { hasPermission } = usePermissions();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin   = isTenantAdmin || isPlatformAdmin;
  const canCreate = isAdmin || (hasPermission('purchase_order', 'create') ?? false);
  const canDelete = isAdmin || (hasPermission('purchase_order', 'delete') ?? false);

  const [isMyPOs, setIsMyPOs] = useState(false);
  const toggleMyPOs = () => { setIsMyPOs(v => !v); tableState.setPage(1); };

  const { data: projectsData } = useQuery({
    queryKey: ['projects-list-filter'],
    queryFn:  () => projectsApi.getAll({ page: 1, page_size: 200, is_active: true }),
    staleTime: 10 * 60 * 1000,
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list-filter'],
    queryFn:  () => suppliersApi.getAll({ page: 1, page_size: 500, is_active: true }),
    staleTime: 10 * 60 * 1000,
  });

  const { data: engineersData } = useQuery({
    queryKey: ['users-engineers-filter'],
    queryFn:  () => usersApi.getAll({ page: 1, page_size: 200, role: 'site_engineer' }),
    staleTime: 10 * 60 * 1000,
  });

  const filterFields: FilterField[] = [
    { name: 'order_number', label: 'Order Number', type: 'text',   group: 'Order Info' },
    { name: 'project_name', label: 'Project',      type: 'select', group: 'Order Info',
      options: projectsData?.results?.map(p => ({ value: p.name, label: p.name })) ?? [] },
    { name: 'supplier',     label: 'Supplier',     type: 'select', group: 'Order Info',
      options: (Array.isArray((suppliersData as any)?.results) ? (suppliersData as any).results : Array.isArray(suppliersData) ? suppliersData : [])
        .map((s: any) => ({ value: String(s.id), label: s.name })) },
    { name: 'project_engineer', label: 'Project Engineer', type: 'select', group: 'Order Info',
      options: (Array.isArray((engineersData as any)?.results) ? (engineersData as any).results : Array.isArray(engineersData) ? engineersData : [])
        .map((u: any) => ({ value: String(u.id), label: u.full_name || u.username || `User ${u.id}` })) },
    { name: 'order_date_after',  label: 'Order Date From', type: 'date',   group: 'Dates' },
    { name: 'order_date_before', label: 'Order Date To',   type: 'date',   group: 'Dates' },
    { name: 'total_min',         label: 'Min Total',       type: 'number', group: 'Amount' },
    { name: 'total_max',         label: 'Max Total',       type: 'number', group: 'Amount' },
  ];

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-orders', page, search, filters, isMyPOs],
    queryFn:  () => purchaseOrdersApi.getAll({
      page, search, ...filters,
      ...(isMyPOs && user?.id ? { pr_created_by: user.id } : {}),
    }),
    staleTime: 2 * 60 * 1000,
  });

  const poAll = (extra?: object) => purchaseOrdersApi.getAll({ page: 1, page_size: 1, ...extra } as any);
  const { data: kpiTotal }     = useQuery({ queryKey: ['po-kpi', 'total'],     queryFn: () => poAll(),                       staleTime: 5 * 60 * 1000, select: (d: { count?: number }) => d.count ?? 0 });
  const { data: kpiPending }   = useQuery({ queryKey: ['po-kpi', 'pending'],   queryFn: () => poAll({ status: 'pending' }),   staleTime: 5 * 60 * 1000, select: (d: { count?: number }) => d.count ?? 0 });
  const { data: kpiApproved }  = useQuery({ queryKey: ['po-kpi', 'approved'],  queryFn: () => poAll({ status: 'approved' }),  staleTime: 5 * 60 * 1000, select: (d: { count?: number }) => d.count ?? 0 });
  const { data: kpiCompleted } = useQuery({ queryKey: ['po-kpi', 'completed'], queryFn: () => poAll({ status: 'completed' }), staleTime: 5 * 60 * 1000, select: (d: { count?: number }) => d.count ?? 0 });
  const { data: kpiCancelled } = useQuery({ queryKey: ['po-kpi', 'cancelled'], queryFn: () => poAll({ status: 'cancelled' }), staleTime: 5 * 60 * 1000, select: (d: { count?: number }) => d.count ?? 0 });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => purchaseOrdersApi.delete(id),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['po-kpi'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      toast('Purchase Order deleted', 'success');
    },
    onError: () => toast('Failed to delete purchase order', 'error'),
  });

  const handleDelete = useCallback(async (id: number) => {
    if (await confirm('Delete this purchase order?')) deleteMutation.mutate(id);
  }, [deleteMutation.mutate]);

  const handleBulkDelete = async () => {
    if (!selectedItems.size || !await confirm(`Delete ${selectedItems.size} purchase orders?`)) return;
    const ids = Array.from(selectedItems);
    const failed: number[] = [];
    for (const id of ids) {
      try { await purchaseOrdersApi.delete(id); } catch { failed.push(id); }
    }
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    queryClient.invalidateQueries({ queryKey: ['po-kpi'] });
    queryClient.invalidateQueries({ queryKey: ['pending-count'] });
    const ok = ids.length - failed.length;
    if (failed.length === 0)    toast(`Deleted ${ok} purchase order${ok !== 1 ? 's' : ''}`, 'success');
    else if (ok === 0)          toast(`Failed to delete all ${failed.length} purchase orders`, 'error');
    else                        toast(`Deleted ${ok}, failed to delete ${failed.length}`, 'warning');
    clearSelection();
  };

  const orders     = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const columns = useMemo((): Column<PurchaseOrder>[] => [
    {
      key: 'number', header: 'Order #',
      render: o => <Link href={`/purchase-orders/${o.id}`} className="font-mono font-semibold" style={{ color: 'var(--text-brand)' }}>{o.order_number}</Link>,
    },
    {
      key: 'pr', header: 'PR #',
      render: o => {
        if (!o.purchase_request) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
        const prId   = typeof o.purchase_request === 'object' ? (o.purchase_request as any).id   : o.purchase_request;
        const prCode = typeof o.purchase_request === 'object' ? ((o.purchase_request as any).code || `#${prId}`) : `#${prId}`;
        return <Link href={`/purchase-requests/${prId}`} className="font-mono" style={{ color: 'var(--text-brand)', fontWeight: 600, fontSize: 'var(--text-sm)' }} onClick={e => e.stopPropagation()}>{prCode}</Link>;
      },
    },
    { key: 'requested_by', header: 'Requested By', render: o => <PersonCell name={o.pr_created_by_name || '—'} avatarUrl={null} /> },
    {
      key: 'project', header: t('col', 'project'),
      render: o => o.project_name
        ? <div><div className="font-medium" style={{ color: 'var(--text-primary)' }}>{o.project_name}</div>{o.project_code && <div className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{o.project_code}</div>}</div>
        : <span style={{ color: 'var(--text-secondary)' }}>—</span>,
    },
    { key: 'supplier', header: t('col', 'supplier'),    render: o => <span style={{ color: 'var(--text-secondary)' }}>{typeof o.supplier === 'object' ? (o.supplier as any).name : '—'}</span> },
    { key: 'date',     header: 'Order Date',             render: o => <span style={{ color: 'var(--text-secondary)' }}>{new Date(o.order_date).toLocaleDateString('en-US')}</span> },
    { key: 'total',    header: t('col', 'totalAmount'),  render: o => <span className="font-semibold">{formatPrice(o.total)}</span> },
    { key: 'status',   header: t('col', 'status'),       render: o => <Badge variant={PO_STATUS[o.status] ?? 'info'}>{PO_LABEL[o.status] || o.status}</Badge> },
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
  ], [t, canDelete, handleDelete]);

  return (
    <ProcListPage
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Purchase Management' }, { label: 'Purchase Orders' }]}
      title="Purchase Orders"
      description="Issue and track purchase orders to suppliers."
      totalCount={totalCount}
      pendingCount={pending.po > 0 ? pending.po : undefined}
      createAction={canCreate ? <Link href="/purchase-orders/new"><Button variant="primary">+ New Purchase Order</Button></Link> : undefined}
      statusItems={[
        { value: '',          label: 'All',       count: kpiTotal,     loading: kpiTotal === undefined },
        { value: 'draft',     label: 'Draft' },
        { value: 'pending',   label: 'Pending',   count: kpiPending,   loading: kpiPending === undefined },
        { value: 'approved',  label: 'Approved',  count: kpiApproved,  loading: kpiApproved === undefined },
        { value: 'completed', label: 'Completed', count: kpiCompleted, loading: kpiCompleted === undefined },
        { value: 'cancelled', label: 'Cancelled', count: kpiCancelled, loading: kpiCancelled === undefined },
      ]}
      searchPlaceholder="Search purchase orders…"
      extraActions={
        <button
          className={`proc-cmd-btn${isMyPOs ? ' proc-cmd-btn--active' : ''}`}
          onClick={toggleMyPOs}
        >
          {isMyPOs ? '✓ My POs' : 'My POs'}
        </button>
      }
      filterFields={filterFields}
      advFilterTitle="Purchase Order Filters"
      advFilterDesc="Narrow by project, date range, or amount."
      columns={columns}
      data={orders}
      isLoading={isLoading}
      error={error}
      onRowClick={o => router.push(`/purchase-orders/${o.id}`)}
      selectable={canDelete}
      tableState={tableState}
      paginatedData={data}
      pageSize={50}
      emptyTitle="No purchase orders found"
      emptyAction={canCreate ? <Link href="/purchase-orders/new"><Button variant="primary">Create Purchase Order</Button></Link> : undefined}
      bulkActions={
        canDelete ? (
          <Button variant="destructive" onClick={handleBulkDelete}>
            Delete {selectedItems.size}
          </Button>
        ) : undefined
      }
    />
  );
}
