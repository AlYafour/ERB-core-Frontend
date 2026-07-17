'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subcontractorsApi, SubcontractorPayment } from '@/lib/api/subcontractors';
import Link from 'next/link';
import { Button, Badge, type Column } from '@/components/ui';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';
import { PAYMENT_STATUS } from '@/lib/utils/status-colors';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { useRouter } from 'next/navigation';
import { AppListPage } from '@/components/app/AppListPage';

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
const money = (n: number | string) => `AED ${Number(n).toLocaleString()}`;
const RIGHT: React.CSSProperties = { display: 'block', textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)' };

export default function PaymentsPage() {
  const tableState = useTableState({ key: 'subcon-payments' });
  const { page, search, filters, selectedItems, clearSelection } = tableState;
  const queryClient = useQueryClient();
  const router = useRouter();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isPrivileged = isTenantAdmin || isPlatformAdmin;

  const { data, isLoading, error } = useQuery({
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

  const columns: Column<SubcontractorPayment>[] = [
    {
      key: 'payment_no', header: 'Payment No.', sortKey: 'payment_no',
      render: p => (
        <Link href={`/subcontractors/payments/${p.id}`} onClick={e => e.stopPropagation()}
              style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--brand)', fontWeight: 600 }}>
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
      key: 'payment_date', header: 'Payment Date', sortKey: 'payment_date',
      render: p => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{p.payment_date}</span>,
    },
    {
      key: 'certificate_no', header: 'IPC Ref.',
      render: p => p.certificate_no
        ? <Link href={`/subcontractors/certificates/${p.certificate}`} onClick={e => e.stopPropagation()} style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--brand)' }}>{p.certificate_no}</Link>
        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      key: 'gross_amount', header: 'Gross',
      render: p => <span style={RIGHT}>{money(p.gross_amount)}</span>,
    },
    {
      key: 'net_paid_amount', header: 'Net Paid', sortKey: 'net_paid_amount',
      render: p => <span style={{ ...RIGHT, fontWeight: 700 }}>{money(p.net_paid_amount)}</span>,
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
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
          <Link href={`/subcontractors/payments/${p.id}`}><Button variant="view" size="sm">View</Button></Link>
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

  const totalNet = rows.reduce((s, p) => s + Number(p.net_paid_amount || 0), 0);

  return (
    <AppListPage
      title="Subcontractor Payments"
      description="Payments to subcontractors against certificates and contracts."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Subcontractors', href: '/subcontractors' }, { label: 'Payments' }]}
      totalCount={totalCount}
      totalAmount={totalNet}
      totalAmountLabel="Page Net Total"
      createAction={<Link href="/subcontractors/payments/new"><Button variant="primary">+ New Payment</Button></Link>}
      statusItems={[{ value: '', label: 'All', count: totalCount },
        ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]}
      filterFields={filterFields}
      searchPlaceholder="Search by payment number, subcontractor, contract…"
      columns={columns}
      data={rows}
      isLoading={isLoading}
      error={error}
      selectable
      tableState={tableState}
      paginatedData={data}
      pageSize={50}
      onRowClick={r => router.push(`/subcontractors/payments/${r.id}`)}
      emptyTitle="No payments found."
      bulkActions={
        <Button variant="destructive" onClick={handleBulkDelete} isLoading={deleteMutation.isPending}>
          Delete {selectedItems.size}
        </Button>
      }
    />
  );
}
