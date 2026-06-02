'use client';

import { Suspense, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subcontractorsApi, ProgressCertificate } from '@/lib/api/subcontractors';
import Link from 'next/link';
import { Button, Badge } from '@/components/ui';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useListState } from '@/lib/hooks/use-list-state';
import { CERTIFICATE_STATUS } from '@/lib/utils/status-colors';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { EnterpriseListPage, type EnterpriseColumn, type BulkAction } from '@/components/ui/enterprise';

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

function CertificatesContent() {
  const listState = useListState('subcon-certificates');
  const { page, search, filters, pageSize, selectedItems, clearSelection } = listState;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isSuperuser = user?.is_superuser ?? false;

  const [rejectDialog, setRejectDialog] = useState<RejectDialog | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subcon-certificates', page, pageSize, search, filters],
    queryFn: () => subcontractorsApi.certificates.list({ page, page_size: pageSize, search: search || undefined, ...filters }),
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
    return row && (isSuperuser || DELETABLE_STATUSES.has(row.status));
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

  const columns: EnterpriseColumn<ProgressCertificate>[] = [
    {
      key: 'certificate_no', header: 'IPC No.', sortable: true, mobileMain: true, width: 120,
      render: c => (
        <Link href={`/subcontractors/certificates/${c.id}`} style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-brand)', fontWeight: 600 }}>
          {c.certificate_no}
        </Link>
      ),
    },
    {
      key: 'subcontractor_name', header: 'Subcontractor / Contract', minWidth: 200,
      render: c => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.subcontractor_name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{c.contract_no}</div>
        </div>
      ),
    },
    {
      key: 'project_name', header: 'Project', minWidth: 140, mobileHide: true,
      render: c => c.project_name
        ? <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{c.project_name}</span>
        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      key: 'certificate_date', header: 'Date', sortable: true, width: 110,
      render: c => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{c.certificate_date}</span>,
    },
    {
      key: 'gross_approved_amount', header: 'Gross Approved', align: 'right', sortable: true, width: 150,
      render: c => <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>AED {Number(c.gross_approved_amount).toLocaleString()}</span>,
      aggregate: (data) => <span style={{ fontFamily: 'monospace' }}>AED {data.reduce((s, c) => s + Number(c.gross_approved_amount), 0).toLocaleString()}</span>,
    },
    {
      key: 'retention_amount', header: 'Retention', align: 'right', width: 130, mobileHide: true,
      render: c => <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>AED {Number(c.retention_amount).toLocaleString()}</span>,
    },
    {
      key: 'net_payable_amount', header: 'Net Payable', align: 'right', sortable: true, width: 140,
      render: c => <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 700 }}>AED {Number(c.net_payable_amount).toLocaleString()}</span>,
      aggregate: (data) => <span style={{ fontFamily: 'monospace' }}>AED {data.reduce((s, c) => s + Number(c.net_payable_amount), 0).toLocaleString()}</span>,
    },
    {
      key: 'status', header: 'Status', width: 120,
      render: c => <Badge variant={CERTIFICATE_STATUS[c.status] ?? 'default'}>{STATUS_LABEL[c.status] || c.status}</Badge>,
    },
    {
      key: 'actions', header: '', hideable: false, width: 240,
      render: c => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
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

  const paidCount     = rows.filter(c => c.status === 'paid').length;
  const approvedCount = rows.filter(c => c.status === 'approved' || c.status === 'gm_approved').length;
  const pendingCount  = rows.filter(c => ['draft', 'submitted', 'under_review', 'reviewed'].includes(c.status)).length;
  const totalNet      = rows.reduce((s, c) => s + Number(c.net_payable_amount), 0);

  const kpiCards = [
    { label: 'Total IPCs', value: totalCount },
    { label: 'Pending Review', value: pendingCount, variant: 'warning' as const },
    { label: 'Approved', value: approvedCount, variant: 'success' as const },
    { label: 'Page Net Payable', value: `AED ${(totalNet / 1000).toFixed(0)}K`, variant: 'default' as const },
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
    <>
      <EnterpriseListPage
        title="Progress Certificates (IPC)"
        breadcrumbs={[{ label: 'Subcontractors', href: '/subcontractors' }, { label: 'Certificates' }]}
        primaryAction={
          <Link href="/subcontractors/certificates/new">
            <Button variant="primary">+ New Certificate</Button>
          </Link>
        }
        kpiCards={kpiCards}
        listState={listState}
        filterFields={filterFields}
        filterSaveKey="subcon-certificates"
        searchPlaceholder="Search by IPC number, subcontractor, contract..."
        columns={columns}
        data={rows}
        totalCount={totalCount}
        isLoading={isLoading}
        error={error}
        onRefetch={refetch}
        paginatedData={data}
        selectable
        bulkActions={bulkActions}
        emptyMessage="No certificates found."
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

export default function CertificatesPage() {
  return <Suspense><CertificatesContent /></Suspense>;
}
