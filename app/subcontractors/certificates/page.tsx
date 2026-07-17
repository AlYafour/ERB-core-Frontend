'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subcontractorsApi, ProgressCertificate } from '@/lib/api/subcontractors';
import Link from 'next/link';
import { Button, Badge, type Column } from '@/components/ui';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';
import { CERTIFICATE_STATUS } from '@/lib/utils/status-colors';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { AppListPage } from '@/components/app/AppListPage';

const money = (n: number | string) => `AED ${Number(n).toLocaleString()}`;
const RIGHT: React.CSSProperties = { display: 'block', textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)' };

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review',
  reviewed: 'Reviewed', approved: 'Approved', gm_approved: 'GM Approved',
  rejected: 'Rejected', paid: 'Paid', cancelled: 'Cancelled',
};

const filterFields: FilterField[] = [
  { name: 'status', label: 'Status', type: 'select', group: 'Certificate',
    options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })) },
  { name: 'date_from', label: 'Cert. Date From', type: 'date', group: 'Dates' },
  { name: 'date_to',   label: 'Cert. Date To',   type: 'date', group: 'Dates' },
];

const DELETABLE_STATUSES = new Set(['draft', 'submitted', 'under_review', 'reviewed', 'rejected', 'cancelled']);

interface RejectDialog { id: number; reason: string }

export default function CertificatesPage() {
  const router = useRouter();
  const tableState = useTableState({ key: 'subcon-certificates' });
  const { page, search, filters, selectedItems, clearSelection } = tableState;
  const queryClient = useQueryClient();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isPrivileged = isTenantAdmin || isPlatformAdmin;

  const [rejectDialog, setRejectDialog] = useState<RejectDialog | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['subcon-certificates', page, search, filters],
    queryFn: () => subcontractorsApi.certificates.list({ page, search: search || undefined, ...filters }),
    staleTime: 2 * 60 * 1000,
  });

  const rows       = data?.results ?? [];
  const totalCount = data?.count ?? 0;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['subcon-certificates'] });

  const submitMutation = useMutation({
    mutationFn: (id: number) => subcontractorsApi.certificates.submit(id),
    onSuccess: () => { invalidate(); toast('Certificate submitted', 'success'); },
    onError:   () => toast('Failed to submit certificate', 'error'),
  });

  const reviewMutation = useMutation({
    mutationFn: (id: number) => subcontractorsApi.certificates.review(id, {}),
    onSuccess: () => { invalidate(); toast('Certificate reviewed', 'success'); },
    onError:   () => toast('Failed to review certificate', 'error'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => subcontractorsApi.certificates.approve(id, {}),
    onSuccess: () => { invalidate(); toast('Certificate approved', 'success'); },
    onError:   () => toast('Failed to approve certificate', 'error'),
  });

  const gmApproveMutation = useMutation({
    mutationFn: (id: number) => subcontractorsApi.certificates.gmApprove(id),
    onSuccess: () => { invalidate(); toast('Certificate GM approved', 'success'); },
    onError:   () => toast('Failed to GM approve', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      subcontractorsApi.certificates.reject(id, { reason }),
    onSuccess: () => { invalidate(); toast('Certificate rejected', 'success'); setRejectDialog(null); },
    onError:   () => toast('Failed to reject certificate', 'error'),
  });

  const deletableIds = [...selectedItems].filter(id => {
    const row = rows.find(r => r.id === id);
    return row && (isPrivileged || DELETABLE_STATUSES.has(row.status));
  });
  const nonDeletableCount = selectedItems.size - deletableIds.length;

  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => { for (const id of ids) await subcontractorsApi.certificates.delete(id); },
    onSuccess: (_, ids) => {
      invalidate();
      let msg = `Deleted ${ids.length} certificate(s)`;
      if (nonDeletableCount > 0) msg += `. ${nonDeletableCount} skipped (Approved/GM Approved/Paid are protected).`;
      toast(msg, 'success');
      clearSelection();
    },
    onError: () => toast('Failed to delete certificates', 'error'),
  });

  const handleBulkDelete = async () => {
    if (!selectedItems.size) return;
    if (deletableIds.length === 0) {
      toast('Cannot delete: Approved, GM Approved, and Paid certificates are protected.', 'error');
      return;
    }
    const msg = nonDeletableCount > 0
      ? `Delete ${deletableIds.length} certificate(s)? ${nonDeletableCount} skipped (protected status).`
      : `Delete ${deletableIds.length} selected certificate(s)?`;
    if (!await confirm(msg)) return;
    deleteMutation.mutate(deletableIds);
  };

  const columns: Column<ProgressCertificate>[] = [
    {
      key: 'certificate_no', header: 'IPC No.', sortKey: 'certificate_no',
      render: c => (
        <Link href={`/subcontractors/certificates/${c.id}`} onClick={e => e.stopPropagation()}
              style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--brand)', fontWeight: 600 }}>
          {c.certificate_no}
        </Link>
      ),
    },
    {
      key: 'subcontractor_name', header: 'Subcontractor / Contract',
      render: c => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.subcontractor_name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{c.contract_no}</div>
        </div>
      ),
    },
    {
      key: 'project_name', header: 'Project',
      render: c => c.project_name
        ? <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{c.project_name}</span>
        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      key: 'certificate_date', header: 'Date', sortKey: 'certificate_date',
      render: c => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{c.certificate_date}</span>,
    },
    {
      key: 'gross_approved_amount', header: 'Gross Approved', sortKey: 'gross_approved_amount',
      render: c => <span style={RIGHT}>{money(c.gross_approved_amount)}</span>,
    },
    {
      key: 'retention_amount', header: 'Retention',
      render: c => <span style={{ ...RIGHT, color: 'var(--text-secondary)' }}>{money(c.retention_amount)}</span>,
    },
    {
      key: 'net_payable_amount', header: 'Net Payable', sortKey: 'net_payable_amount',
      render: c => <span style={{ ...RIGHT, fontWeight: 700 }}>{money(c.net_payable_amount)}</span>,
    },
    {
      key: 'status', header: 'Status',
      render: c => <Badge variant={CERTIFICATE_STATUS[c.status] ?? 'default'}>{STATUS_LABEL[c.status] || c.status}</Badge>,
    },
    {
      key: 'actions', header: '',
      render: c => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
          <Link href={`/subcontractors/certificates/${c.id}`}>
            <Button variant="view" size="sm">View</Button>
          </Link>
          {c.status === 'draft' && (
            <Button variant="secondary" size="sm" onClick={() => submitMutation.mutate(c.id)} disabled={submitMutation.isPending}>Submit</Button>
          )}
          {(c.status === 'submitted' || c.status === 'under_review') && (
            <Button variant="secondary" size="sm" onClick={() => reviewMutation.mutate(c.id)} disabled={reviewMutation.isPending}>Review</Button>
          )}
          {c.status === 'reviewed' && (
            <Button variant="primary" size="sm" onClick={() => approveMutation.mutate(c.id)} disabled={approveMutation.isPending}>Approve</Button>
          )}
          {c.status === 'approved' && (
            <Button variant="primary" size="sm" onClick={() => gmApproveMutation.mutate(c.id)} disabled={gmApproveMutation.isPending}>GM Approve</Button>
          )}
          {(c.status === 'submitted' || c.status === 'under_review' || c.status === 'reviewed') && (
            <Button variant="destructive" size="sm" onClick={() => setRejectDialog({ id: c.id, reason: '' })}>Reject</Button>
          )}
        </div>
      ),
    },
  ];

  const totalNet = rows.reduce((s, c) => s + Number(c.net_payable_amount || 0), 0);

  return (
    <>
      <AppListPage
        title="Progress Certificates (IPC)"
        description="Interim payment certificates — approvals, retention and net payable."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Subcontractors', href: '/subcontractors' }, { label: 'Certificates' }]}
        totalCount={totalCount}
        totalAmount={totalNet}
        totalAmountLabel="Page Net Payable"
        createAction={<Link href="/subcontractors/certificates/new"><Button variant="primary">+ New Certificate</Button></Link>}
        statusItems={[{ value: '', label: 'All', count: totalCount },
          ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]}
        filterFields={filterFields}
        searchPlaceholder="Search by IPC number, subcontractor, contract…"
        columns={columns}
        data={rows}
        isLoading={isLoading}
        error={error}
        selectable
        tableState={tableState}
        paginatedData={data}
        pageSize={50}
        onRowClick={c => router.push(`/subcontractors/certificates/${c.id}`)}
        emptyTitle="No certificates found."
        bulkActions={
          <Button variant="destructive" onClick={handleBulkDelete} isLoading={deleteMutation.isPending}>
            Delete {selectedItems.size}
          </Button>
        }
      />

      {/* Reject dialog */}
      {rejectDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface-primary)', borderRadius: 10, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-lg)', fontWeight: 700 }}>Reject Certificate</h3>
            <p style={{ margin: '0 0 16px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Please provide a reason for rejecting this certificate.
            </p>
            <textarea
              value={rejectDialog.reason}
              onChange={e => setRejectDialog(d => d ? { ...d, reason: e.target.value } : null)}
              rows={3}
              placeholder="Enter rejection reason..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--surface-secondary)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <Button variant="secondary" size="sm" onClick={() => setRejectDialog(null)}>Cancel</Button>
              <Button variant="destructive" size="sm"
                disabled={!rejectDialog.reason.trim() || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ id: rejectDialog.id, reason: rejectDialog.reason })}>
                {rejectMutation.isPending ? 'Rejecting…' : 'Reject Certificate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
