'use client';

import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subcontractorsApi, ProgressCertificate } from '@/lib/api/subcontractors';
import Link from 'next/link';
import { Button, Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';
import { CERTIFICATE_STATUS } from '@/lib/utils/status-colors';
import { toast } from '@/lib/hooks/use-toast';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review',
  reviewed: 'Reviewed', approved: 'Approved', rejected: 'Rejected',
  paid: 'Paid', cancelled: 'Cancelled',
};

const filterFields: FilterField[] = [
  {
    name: 'status', label: 'Status', type: 'select', group: 'Certificate',
    options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
  },
];

export default function CertificatesPage() {
  const tableState = useTableState();
  const { page, search, filters, selectedItems, clearSelection } = tableState;
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subcon-certificates', page, search, filters],
    queryFn: () => subcontractorsApi.certificates.list({ page, search: search || undefined, ...filters }),
  });

  const rows       = data?.results ?? [];
  const totalCount = data?.count ?? 0;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      for (const id of selectedItems) {
        await subcontractorsApi.certificates.delete(id).catch(() => {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcon-certificates'] });
      toast(`Deleted ${selectedItems.size} certificate(s)`, 'success');
      clearSelection();
    },
    onError: () => toast('Failed to delete some certificates', 'error'),
  });

  const handleBulkDelete = () => {
    if (!selectedItems.size) return;
    if (!confirm(`Delete ${selectedItems.size} selected certificate(s)? Only Draft/Rejected/Cancelled certificates can be deleted.`)) return;
    deleteMutation.mutate();
  };

  const columns: Column<ProgressCertificate>[] = [
    {
      key: 'certificate_no', header: 'IPC No.',
      render: c => <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{c.certificate_no}</span>,
    },
    {
      key: 'subcontractor_name', header: 'Subcontractor',
      render: c => (
        <div>
          <div className="font-medium">{c.subcontractor_name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{c.contract_no}</div>
        </div>
      ),
    },
    {
      key: 'certificate_date', header: 'Date',
      render: c => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{c.certificate_date}</span>,
    },
    {
      key: 'gross_approved_amount', header: 'Gross Approved',
      render: c => (
        <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>
          AED {Number(c.gross_approved_amount).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'retention_amount', header: 'Retention',
      render: c => (
        <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          AED {Number(c.retention_amount).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'net_payable_amount', header: 'Net Payable',
      render: c => (
        <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          AED {Number(c.net_payable_amount).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: c => <Badge variant={CERTIFICATE_STATUS[c.status] ?? 'default'}>{STATUS_LABEL[c.status] || c.status}</Badge>,
    },
    {
      key: 'actions', header: '',
      render: c => (
        <Link href={`/subcontractors/certificates/${c.id}`}>
          <Button variant="view" size="sm">View</Button>
        </Link>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Progress Certificates (IPC)"
          count={totalCount}
          breadcrumbs={[
            { label: 'Subcontractors', href: '/subcontractors' },
            { label: 'Certificates' },
          ]}
          actions={
            <Link href="/subcontractors/certificates/new">
              <Button variant="primary">+ New Certificate</Button>
            </Link>
          }
        />
        <TableShell
          tableState={tableState}
          filterFields={filterFields}
          filterSaveKey="subcon-certificates"
          searchPlaceholder="Search by IPC number, subcontractor..."
          columns={columns}
          data={rows}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          emptyMessage="No certificates found."
          totalCount={totalCount}
          paginatedData={data}
          selectable
          toolbarActions={
            selectedItems.size > 0 ? (
              <>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  {selectedItems.size} selected
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete Selected'}
                </Button>
                <Button variant="secondary" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              </>
            ) : undefined
          }
        />
      </PageShell>
    </MainLayout>
  );
}
