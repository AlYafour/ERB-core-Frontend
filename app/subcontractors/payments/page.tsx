'use client';

import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subcontractorsApi, SubcontractorPayment } from '@/lib/api/subcontractors';
import Link from 'next/link';
import { Button, Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';
import { PAYMENT_STATUS } from '@/lib/utils/status-colors';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', paid: 'Paid', cancelled: 'Cancelled',
};

const filterFields: FilterField[] = [
  { name: 'status', label: 'Status', type: 'select', group: 'Payment',
    options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })) },
  { name: 'date_from', label: 'Payment Date From', type: 'date', group: 'Dates' },
  { name: 'date_to',   label: 'Payment Date To',   type: 'date', group: 'Dates' },
];

export default function PaymentsPage() {
  const tableState = useTableState();
  const { page, search, filters, selectedItems, clearSelection } = tableState;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isSuperuser = user?.is_superuser ?? false;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subcon-payments', page, search, filters],
    queryFn: () => subcontractorsApi.payments.list({ page, search: search || undefined, ...filters }),
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

  // Bulk delete — superusers can delete any status; others cannot delete 'paid'
  const DELETABLE = new Set(['pending', 'approved', 'cancelled']);
  const deletableIds = [...selectedItems].filter(id => {
    const row = rows.find(r => r.id === id);
    return row && (isSuperuser || DELETABLE.has(row.status));
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

  const columns: Column<SubcontractorPayment>[] = [
    {
      key: 'payment_no', header: 'Payment No.',
      render: p => (
        <Link href={`/subcontractors/payments/${p.id}`} style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-brand)', fontWeight: 600 }}>
          {p.payment_no}
        </Link>
      ),
    },
    {
      key: 'subcontractor_name', header: 'Subcontractor / Contract',
      render: p => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.subcontractor_name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{p.contract_no}</div>
        </div>
      ),
    },
    {
      key: 'project_name', header: 'Project',
      render: p => p.project_name
        ? <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{p.project_name}</span>
        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      key: 'payment_date', header: 'Payment Date',
      render: p => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{p.payment_date}</span>,
    },
    {
      key: 'certificate_no', header: 'IPC Ref.',
      render: p => p.certificate_no
        ? (
          <Link href={`/subcontractors/certificates/${p.certificate}`} style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-brand)' }}>
            {p.certificate_no}
          </Link>
        )
        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      key: 'gross_amount', header: 'Gross',
      render: p => <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>AED {Number(p.gross_amount).toLocaleString()}</span>,
    },
    {
      key: 'net_paid_amount', header: 'Net Paid',
      render: p => (
        <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
          AED {Number(p.net_paid_amount).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'payment_method', header: 'Method',
      render: p => (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
          {p.payment_method?.replace('_', ' ') || '—'}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: p => <Badge variant={PAYMENT_STATUS[p.status] ?? 'default'}>{STATUS_LABEL[p.status] || p.status}</Badge>,
    },
    {
      key: 'actions', header: '',
      render: p => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Link href={`/subcontractors/payments/${p.id}`}>
            <Button variant="view" size="sm">View</Button>
          </Link>
          {p.status === 'pending' && (
            <Button variant="primary" size="sm"
              onClick={() => approveMutation.mutate(p.id)}
              disabled={approveMutation.isPending}>
              Approve
            </Button>
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

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Subcontractor Payments"
          count={totalCount}
          breadcrumbs={[
            { label: 'Subcontractors', href: '/subcontractors' },
            { label: 'Payments' },
          ]}
          actions={
            <Link href="/subcontractors/payments/new">
              <Button variant="primary">+ New Payment</Button>
            </Link>
          }
        />

        <TableShell
          tableState={tableState}
          filterFields={filterFields}
          filterSaveKey="subcon-payments"
          searchPlaceholder="Search by payment number, subcontractor, contract..."
          columns={columns}
          data={rows}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          emptyMessage="No payments found."
          totalCount={totalCount}
          paginatedData={data}
          selectable
          toolbarActions={
            selectedItems.size > 0 ? (
              <>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  {selectedItems.size} selected
                </span>
                <Button variant="destructive" size="sm"
                  onClick={handleBulkDelete}
                  disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete Selected'}
                </Button>
                <Button variant="secondary" size="sm" onClick={clearSelection}>Clear</Button>
              </>
            ) : undefined
          }
        />
      </PageShell>
    </MainLayout>
  );
}
