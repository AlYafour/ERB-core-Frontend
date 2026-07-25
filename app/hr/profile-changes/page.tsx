'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrProfileChangesApi, type ProfileChangeRequest } from '@/lib/api/hr';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { useTableState } from '@/lib/hooks/use-table-state';
import { AppListPage } from '@/components/app/AppListPage';
import { Badge, Button, type Column } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import { BaseModal } from '@/components/ui/base/BaseModal';
import { type FilterField } from '@/components/ui/FilterPanel';

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
  pending: 'warning', approved: 'success', rejected: 'error', cancelled: 'default',
};

const filterFields: FilterField[] = [
  { name: 'status', label: 'Status', type: 'select', group: 'Filters', options: [
    { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' }, { value: 'cancelled', label: 'Cancelled' },
  ] },
];

const fmt = (v: unknown) => v === null || v === undefined || v === '' ? '—' : String(v);
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export default function ProfileChangesPage() {
  const tableState = useTableState();
  const { page, search, filters } = tableState;
  const qc = useQueryClient();
  const { hasPermission } = useMyPermissions();
  const canReview = hasPermission('hr.hr_employee.update');

  const [rejecting, setRejecting] = useState<ProfileChangeRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-profile-changes', page, search, filters],
    queryFn: () => hrProfileChangesApi.getAll({ page, ...(filters as Record<string, string>) }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['hr-profile-changes'] });

  const approveMut = useMutation({
    mutationFn: (id: number) => hrProfileChangesApi.approve(id),
    onSuccess: () => { invalidate(); toast('Change approved and applied', 'success'); },
    onError: (e) => toast(getApiError(e, 'Failed to approve'), 'error'),
  });
  const rejectMut = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) => hrProfileChangesApi.reject(id, note),
    onSuccess: () => { invalidate(); toast('Change rejected', 'info'); setRejecting(null); setRejectNote(''); },
    onError: (e) => toast(getApiError(e, 'Failed to reject'), 'error'),
  });

  const rows = data?.results ?? [];

  const renderChanges = (r: ProfileChangeRequest) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Object.entries(r.requested_changes).map(([field, newVal]) => (
        <div key={field} style={{ fontSize: 'var(--text-xs)' }}>
          <span style={{ fontWeight: 'var(--weight-semibold)' }}>{field.replace(/_/g, ' ')}</span>
          {': '}
          <span style={{ color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>{fmt(r.old_values?.[field])}</span>
          {' → '}
          <span style={{ color: 'var(--brand)', fontWeight: 'var(--weight-medium)' }}>{fmt(newVal)}</span>
        </div>
      ))}
    </div>
  );

  const columns: Column<ProfileChangeRequest>[] = [
    { key: 'employee', header: 'Employee', render: r => (
      <div>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>{r.employee_name}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{r.employee_id_code}</div>
      </div>
    ) },
    { key: 'changes', header: 'Requested changes', render: renderChanges },
    { key: 'reason', header: 'Reason', render: r => (
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }} title={r.reason}>{r.reason || '—'}</span>
    ) },
    { key: 'status', header: 'Status', render: r => <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>{r.status.toUpperCase()}</Badge> },
    { key: 'requested_by', header: 'By', render: r => <span style={{ fontSize: 'var(--text-xs)' }}>{r.requested_by_name || '—'}</span> },
    { key: 'created', header: 'Submitted', render: r => <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{fmtDate(r.created_at)}</span> },
    { key: 'actions', header: '', render: r => (
      <RowActions actions={[
        { label: 'Approve', hidden: !canReview || r.status !== 'pending', onClick: async () => { if (await confirm('Approve and apply this change?')) approveMut.mutate(r.id); } },
        { label: 'Reject', variant: 'danger', hidden: !canReview || r.status !== 'pending', onClick: () => { setRejecting(r); setRejectNote(''); } },
      ]} />
    ) },
  ];

  return (
    <>
      <AppListPage
        title="Profile Change Requests"
        description="Employee-submitted changes to profile fields that require approval."
        breadcrumbs={[{ label: 'HR' }, { label: 'Profile Changes' }]}
        totalCount={data?.count ?? 0}
        columns={columns}
        data={rows}
        isLoading={isLoading}
        error={error}
        emptyTitle="No profile change requests."
        tableState={tableState}
        filterFields={filterFields}
        searchPlaceholder="Search…"
        paginatedData={data}
      />
      {rejecting && (
        <BaseModal isOpen title={`Reject change for ${rejecting.employee_name}`} onClose={() => setRejecting(null)} size="sm"
          footer={<>
            <Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectNote.trim() || rejectMut.isPending}
              onClick={() => rejectMut.mutate({ id: rejecting.id, note: rejectNote })}>
              {rejectMut.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </>}>
          <label className="form-label">Reason for rejection *</label>
          <textarea className="form-textarea" rows={3} value={rejectNote} onChange={e => setRejectNote(e.target.value)}
            placeholder="Explain why this change is rejected…" />
        </BaseModal>
      )}
    </>
  );
}
