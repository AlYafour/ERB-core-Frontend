'use client';

import MainLayout from '@/components/layout/MainLayout';
import { useQuery } from '@tanstack/react-query';
import { subcontractorsApi, SubcontractorPayment } from '@/lib/api/subcontractors';
import Link from 'next/link';
import { Button, Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';
import { PAYMENT_STATUS } from '@/lib/utils/status-colors';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', paid: 'Paid', cancelled: 'Cancelled',
};

const filterFields: FilterField[] = [
  {
    name: 'status', label: 'Status', type: 'select', group: 'Payment',
    options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
  },
];

export default function PaymentsPage() {
  const tableState = useTableState();
  const { page, search, filters } = tableState;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subcon-payments', page, search, filters],
    queryFn: () => subcontractorsApi.payments.list({ page, search: search || undefined, ...filters }),
  });

  const rows       = data?.results ?? [];
  const totalCount = data?.count ?? 0;

  const columns: Column<SubcontractorPayment>[] = [
    {
      key: 'payment_no', header: 'Payment No.',
      render: p => <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{p.payment_no}</span>,
    },
    {
      key: 'subcontractor_name', header: 'Subcontractor',
      render: p => (
        <div>
          <div className="font-medium">{p.subcontractor_name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{p.contract_no}</div>
        </div>
      ),
    },
    {
      key: 'payment_date', header: 'Payment Date',
      render: p => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{p.payment_date}</span>,
    },
    {
      key: 'certificate_no', header: 'IPC No.',
      render: p => <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{p.certificate_no || '—'}</span>,
    },
    {
      key: 'gross_amount', header: 'Gross',
      render: p => <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>AED {Number(p.gross_amount).toLocaleString()}</span>,
    },
    {
      key: 'net_paid_amount', header: 'Net Paid',
      render: p => (
        <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
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
        <Link href={`/subcontractors/payments/${p.id}`}>
          <Button variant="view" size="sm">View</Button>
        </Link>
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
        />
        <TableShell
          tableState={tableState}
          filterFields={filterFields}
          filterSaveKey="subcon-payments"
          searchPlaceholder="Search by payment number, subcontractor..."
          columns={columns}
          data={rows}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          emptyMessage="No payments found."
          totalCount={totalCount}
          paginatedData={data}
        />
      </PageShell>
    </MainLayout>
  );
}
