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
  reviewed: 'Reviewed', approved: 'Approved', gm_approved: 'GM Approved',
  rejected: 'Rejected', paid: 'Paid', cancelled: 'Cancelled',
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

  const DELETABLE_STATUSES = new Set(['draft', 'submitted', 'under_review', 'reviewed', 'rejected', 'cancelled']);

  const deletableIds = rows
    .filter(r => selectedItems.has(r.id) && DELETABLE_STATUSES.has(r.status))
    .map(r => r.id);
  const nonDeletableCount = selectedItems.size - deletableIds.length;

  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      for (const id of ids) {
        await subcontractorsApi.certificates.delete(id);
      }
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['subcon-certificates'] });
      let msg = `Deleted ${ids.length} certificate(s)`;
      if (nonDeletableCount > 0) msg += `. ${nonDeletableCount} skipped (Approved/GM Approved/Paid cannot be deleted).`;
      toast(msg, 'success');
      clearSelection();
    },
    onError: () => toast('Failed to delete certificates', 'error'),
  });

  const handleBulkDelete = () => {
    if (!selectedItems.size) return;
    if (deletableIds.length === 0) {
      toast(`Cannot delete. Approved, GM Approved, and Paid certificates cannot be deleted.`, 'error');
      return;
    }
    const msg = nonDeletableCount > 0
      ? `Delete ${deletableIds.length} certificate(s)? ${nonDeletableCount} selected item(s) will be skipped (Approved/GM Approved/Paid are protected).`
      : `Delete ${deletableIds.length} selected certificate(s)?`;
    if (!confirm(msg)) return;
    deleteMutation.mutate(deletableIds);
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
