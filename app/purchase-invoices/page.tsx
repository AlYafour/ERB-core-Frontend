'use client';

import { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseInvoicesApi } from '@/lib/api/purchase-invoices';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils/format';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { type FilterField } from '@/components/ui/FilterPanel';
import { Button, Badge, type Column } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import { usePendingCounts } from '@/lib/hooks/use-pending-counts';
import { PurchaseInvoice } from '@/types';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';
import { INVOICE_STATUS } from '@/lib/utils/status-colors';
import { INVOICE_LABEL } from '@/lib/constants/status-labels';
import { ProcListPage } from '@/components/procurement/list/ProcListPage';

const filterFields: FilterField[] = [
  { name: 'invoice_number',      label: 'Invoice Number',    type: 'text', group: 'Invoice Info' },
  { name: 'invoice_date_after',  label: 'Invoice Date From', type: 'date', group: 'Dates' },
  { name: 'invoice_date_before', label: 'Invoice Date To',   type: 'date', group: 'Dates' },
  { name: 'due_date_after',      label: 'Due Date From',     type: 'date', group: 'Dates' },
  { name: 'due_date_before',     label: 'Due Date To',       type: 'date', group: 'Dates' },
];

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export default function PurchaseInvoicesPage() {
  const router = useRouter();
  const tableState = useTableState();
  const { page, search, filters, selectedItems } = tableState;
  const pending = usePendingCounts();

  const queryClient       = useQueryClient();
  const t                 = useT();
  const { hasPermission } = usePermissions();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin   = isTenantAdmin || isPlatformAdmin;
  const canCreate = isAdmin || (hasPermission('purchase_invoice', 'create') ?? false);
  const canDelete = isAdmin || (hasPermission('purchase_invoice', 'delete') ?? false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-invoices', page, search, filters],
    queryFn:  () => purchaseInvoicesApi.getAll({ page, search, ...filters }),
    staleTime: 2 * 60 * 1000,
  });

  const invAll = (extra?: object) => purchaseInvoicesApi.getAll({ page: 1, page_size: 1, ...extra } as any);
  const { data: kpiTotal }    = useQuery({ queryKey: ['inv-kpi', 'total'],    queryFn: () => invAll(),                      staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });
  const { data: kpiPending }  = useQuery({ queryKey: ['inv-kpi', 'pending'],  queryFn: () => invAll({ status: 'pending' }),  staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });
  const { data: kpiApproved } = useQuery({ queryKey: ['inv-kpi', 'approved'], queryFn: () => invAll({ status: 'approved' }), staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });
  const { data: kpiPaid }     = useQuery({ queryKey: ['inv-kpi', 'paid'],     queryFn: () => invAll({ status: 'paid' }),     staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });
  const { data: kpiRejected } = useQuery({ queryKey: ['inv-kpi', 'rejected'], queryFn: () => invAll({ status: 'rejected' }), staleTime: 5 * 60 * 1000, select: (d: any) => d.count ?? 0 });

  const deleteMutation = useMutation({
    mutationFn: purchaseInvoicesApi.delete,
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] }); queryClient.invalidateQueries({ queryKey: ['pending-count'] }); toast('Invoice deleted', 'success'); },
    onError:    () => toast('Failed to delete invoice', 'error'),
  });
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => { await Promise.all(ids.map(id => purchaseInvoicesApi.delete(id))); },
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] }); queryClient.invalidateQueries({ queryKey: ['pending-count'] }); toast(`${selectedItems.size} invoice(s) deleted`, 'success'); tableState.clearSelection(); },
    onError:    () => toast('Failed to delete some invoices', 'error'),
  });

  const handleDelete     = useCallback(async (id: number) => { if (await confirm('Delete this invoice?')) deleteMutation.mutate(id); }, [deleteMutation.mutate]);
  const handleBulkDelete = async () => { if (selectedItems.size && await confirm(`Delete ${selectedItems.size} invoice(s)?`)) bulkDeleteMutation.mutate(Array.from(selectedItems)); };

  const invoices   = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const columns = useMemo((): Column<PurchaseInvoice>[] => [
    { key: 'number', header: t('col', 'invoiceNumber'), render: i => <span className="font-medium">{i.invoice_number}</span> },
    { key: 'po',     header: t('col', 'relatedPO'),     render: i => <span>{typeof i.purchase_order === 'object' ? (i.purchase_order as any)?.order_number : 'N/A'}</span> },
    { key: 'date',   header: t('col', 'invoiceDate'),   render: i => <span style={{ color: 'var(--text-secondary)' }}>{fmtDate(i.invoice_date)}</span> },
    { key: 'due',    header: t('col', 'deliveryDate'),  render: i => <span style={{ color: 'var(--text-secondary)' }}>{i.due_date ? fmtDate(i.due_date) : '—'}</span> },
    { key: 'status', header: t('col', 'status'),        render: i => <Badge variant={INVOICE_STATUS[i.status] ?? 'info'}>{INVOICE_LABEL[i.status] || i.status}</Badge> },
    { key: 'total',  header: t('col', 'total'),         render: i => <span className="font-semibold">{formatPrice(Number(i.total || 0))}</span> },
    { key: 'paid',   header: t('misc', 'paidAmount'),   render: i => <span>{formatPrice(Number(i.paid_amount || 0))}</span> },
    {
      key: 'actions', header: '',
      render: i => (
        <RowActions actions={[
          { label: 'Print', href: `/print/invoice/${i.id}`, target: '_blank' },
          { separator: true, hidden: !canDelete },
          { label: 'Delete', onClick: () => handleDelete(i.id), variant: 'danger', hidden: !canDelete },
        ]} />
      ),
    },
  ], [t, canDelete, handleDelete]);

  return (
    <ProcListPage
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Purchase Management' }, { label: 'Purchase Invoices' }]}
      title="Purchase Invoices"
      description="Manage supplier invoices and payment tracking."
      totalCount={totalCount}
      pendingCount={pending.invoice > 0 ? pending.invoice : undefined}
      createAction={canCreate ? <Link href="/purchase-invoices/new"><Button variant="primary">Create Invoice</Button></Link> : undefined}
      statusItems={[
        { value: '',          label: 'All',       count: kpiTotal,    loading: kpiTotal === undefined },
        { value: 'draft',     label: 'Draft' },
        { value: 'pending',   label: 'Pending',   count: kpiPending,  loading: kpiPending === undefined },
        { value: 'approved',  label: 'Approved',  count: kpiApproved, loading: kpiApproved === undefined },
        { value: 'paid',      label: 'Paid',      count: kpiPaid,     loading: kpiPaid === undefined },
        { value: 'rejected',  label: 'Rejected',  count: kpiRejected, loading: kpiRejected === undefined },
        { value: 'cancelled', label: 'Cancelled' },
      ]}
      searchPlaceholder="Search invoices…"
      filterFields={filterFields}
      advFilterTitle="Invoice Filters"
      advFilterDesc="Filter by invoice number, dates, or payment status."
      columns={columns}
      data={invoices}
      isLoading={isLoading}
      error={error}
      onRowClick={i => router.push(`/purchase-invoices/${i.id}`)}
      selectable={isAdmin}
      rowStyle={(i) => i.due_date && !['paid', 'cancelled'].includes(i.status) && new Date(i.due_date) < new Date()
        ? { borderLeft: '3px solid var(--status-error)', background: 'rgba(220,38,38,.03)' }
        : undefined}
      tableState={tableState}
      paginatedData={data}
      pageSize={50}
      emptyTitle="No purchase invoices found"
      emptyAction={canCreate ? <Link href="/purchase-invoices/new"><Button variant="primary">Create Invoice</Button></Link> : undefined}
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
