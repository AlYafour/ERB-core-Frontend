'use client';

import { Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subcontractorsApi, SubcontractorPayment } from '@/lib/api/subcontractors';
import Link from 'next/link';
import { Button, Badge } from '@/components/ui';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useListState } from '@/lib/hooks/use-list-state';
import { PAYMENT_STATUS } from '@/lib/utils/status-colors';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { EnterpriseListPage, type EnterpriseColumn, type BulkAction } from '@/components/ui/enterprise';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', paid: 'Paid', cancelled: 'Cancelled',
};

const filterFields: FilterField[] = [
  { name: 'status', label: 'Status', type: 'select', group: 'Payment',
    options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })) },
  { name: 'date_from', label: 'Payment Date From', type: 'date', group: 'Dates' },
  { name: 'date_to',   label: 'Payment Date To',   type: 'date', group: 'Dates' },
];

const DELETABLE_STATUSES = new Set(['pending', 'approved', 'cancelled']);

function PaymentsContent() {
  const listState = useListState('subcon-payments');
  const { page, search, filters, pageSize, selectedItems, clearSelection } = listState;
  const queryClient = useQueryClient();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isPrivileged = isTenantAdmin || isPlatformAdmin;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subcon-payments', page, pageSize, search, filters],
    queryFn: () => subcontractorsApi.payments.list({ page, page_size: pageSize, search: search || undefined, ...filters }),
    staleTime: 2 * 60 * 1000,
  });

  const rows       = data?.results ?? [];
  const totalCount = data?.count ?? 0;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['subcon-payments'] });

  const approveMutation = useMutation({
    mutationFn: (id: number) => subcontractorsApi.payments.approve(id),
    onSuccess: () => { invalidate(); toast('Payment approved', 'success'); },
    onError:   () => toast('Failed to approve payment', 'error'),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => subcontractorsApi.payments.markPaid(id, {}),
    onSuccess: () => { invalidate(); toast('Payment marked as paid', 'success'); },
    onError:   () => toast('Failed to mark as paid', 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => subcontractorsApi.payments.cancel(id),
    onSuccess: () => { invalidate(); toast('Payment cancelled', 'success'); },
    onError:   () => toast('Failed to cancel payment', 'error'),
  });

  const deletableIds = [...selectedItems].filter(id => {
    const row = rows.find(r => r.id === id);
    return row && (isPrivileged || DELETABLE_STATUSES.has(row.status));
  });
  const nonDeletableCount = selectedItems.size - deletableIds.length;

  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => { for (const id of ids) await subcontractorsApi.payments.delete(id); },
    onSuccess: (_, ids) => {
      invalidate();
      let msg = `Deleted ${ids.length} payment(s)`;
      if (nonDeletableCount > 0) msg += `. ${nonDeletableCount} skipped (Paid payments are protected).`;
      toast(msg, 'success');
      clearSelection();
    },
    onError: () => toast('Failed to delete payments', 'error'),
  });

  const handleBulkDelete = async () => {
    if (!selectedItems.size) return;
    if (deletableIds.length === 0) {
      toast('Cannot delete: Paid payments are protected.', 'error');
      return;
    }
    const msg = nonDeletableCount > 0
      ? `Delete ${deletableIds.length} payment(s)? ${nonDeletableCount} skipped (protected status).`
      : `Delete ${deletableIds.length} selected payment(s)?`;
    if (!await confirm(msg)) return;
    deleteMutation.mutate(deletableIds);
  };

  const columns: EnterpriseColumn<SubcontractorPayment>[] = [
    {
      key: 'payment_no', header: 'Payment No.', sortable: true, mobileMain: true, width: 130,
      render: p => (
        <Link href={`/subcontractors/payments/${p.id}`} style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-brand)', fontWeight: 600 }}>
          {p.payment_no}
        </Link>
      ),
    },
    {
      key: 'subcontractor_name', header: 'Subcontractor / Contract', minWidth: 200,
      render: p => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.subcontractor_name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{p.contract_no}</div>
        </div>
      ),
    },
    {
      key: 'project_name', header: 'Project', minWidth: 130, mobileHide: true,
      render: p => p.project_name
        ? <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{p.project_name}</span>
        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      key: 'payment_date', header: 'Payment Date', sortable: true, width: 120,
      render: p => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{p.payment_date}</span>,
    },
    {
      key: 'certificate_no', header: 'IPC Ref.', width: 110, mobileHide: true,
      render: p => p.certificate_no
        ? <Link href={`/subcontractors/certificates/${p.certificate}`} style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-brand)' }}>{p.certificate_no}</Link>
        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      key: 'gross_amount', header: 'Gross', align: 'right', width: 140,
      render: p => <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>AED {Number(p.gross_amount).toLocaleString()}</span>,
      aggregate: (data) => <span style={{ fontFamily: 'monospace' }}>AED {data.reduce((s, p) => s + Number(p.gross_amount), 0).toLocaleString()}</span>,
    },
    {
      key: 'net_paid_amount', header: 'Net Paid', align: 'right', sortable: true, width: 140,
      render: p => <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 700 }}>AED {Number(p.net_paid_amount).toLocaleString()}</span>,
      aggregate: (data) => <span style={{ fontFamily: 'monospace' }}>AED {data.reduce((s, p) => s + Number(p.net_paid_amount), 0).toLocaleString()}</span>,
    },
    {
      key: 'payment_method', header: 'Method', width: 120, mobileHide: true,
      render: p => (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
          {p.payment_method?.replace('_', ' ') || '—'}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status', width: 110,
      render: p => <Badge variant={PAYMENT_STATUS[p.status] ?? 'default'}>{STATUS_LABEL[p.status] || p.status}</Badge>,
    },
    {
      key: 'actions', header: '', hideable: false, width: 220,
      render: p => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Link href={`/subcontractors/payments/${p.id}`}>
            <Button variant="view" size="sm">View</Button>
          </Link>
          {p.status === 'pending' && (
            <Button variant="primary" size="sm" onClick={() => approveMutation.mutate(p.id)} disabled={approveMutation.isPending}>Approve</Button>
          )}
          {p.status === 'approved' && (
            <Button variant="primary" size="sm"
              onClick={async () => { if (await confirm('Mark this payment as paid?')) markPaidMutation.mutate(p.id); }}
              disabled={markPaidMutation.isPending}>
              Mark Paid
            </Button>
          )}
          {(p.status === 'pending' || p.status === 'approved') && (
            <Button variant="destructive" size="sm"
              onClick={async () => { if (await confirm('Cancel this payment?')) cancelMutation.mutate(p.id); }}
              disabled={cancelMutation.isPending}>
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  const paidCount    = rows.filter(p => p.status === 'paid').length;
  const pendingCount = rows.filter(p => p.status === 'pending').length;
  const totalNet     = rows.reduce((s, p) => s + Number(p.net_paid_amount), 0);

  const kpiCards = [
    { label: 'Total Payments', value: totalCount },
    { label: 'Pending', value: pendingCount, variant: 'warning' as const },
    { label: 'Paid', value: paidCount, variant: 'success' as const },
    { label: 'Page Net Total', value: `AED ${(totalNet / 1000).toFixed(0)}K`, variant: 'default' as const },
  ];

  const bulkActions: BulkAction[] = [
    {
      key: 'delete', label: 'Delete Selected', variant: 'destructive',
      onClick: handleBulkDelete,
      isLoading: deleteMutation.isPending,
      disabled: selectedItems.size === 0,
    },
  ];

  return (
    <EnterpriseListPage
      title="Subcontractor Payments"
      breadcrumbs={[{ label: 'Subcontractors', href: '/subcontractors' }, { label: 'Payments' }]}
      primaryAction={
        <Link href="/subcontractors/payments/new">
          <Button variant="primary">+ New Payment</Button>
        </Link>
      }
      kpiCards={kpiCards}
      listState={listState}
      filterFields={filterFields}
      filterSaveKey="subcon-payments"
      searchPlaceholder="Search by payment number, subcontractor, contract..."
      columns={columns}
      data={rows}
      totalCount={totalCount}
      isLoading={isLoading}
      error={error}
      onRefetch={refetch}
      paginatedData={data}
      selectable
      bulkActions={bulkActions}
      emptyMessage="No payments found."
    />
  );
}

export default function PaymentsPage() {
  return <Suspense><PaymentsContent /></Suspense>;
}
