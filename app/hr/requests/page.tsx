'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrRequestsApi } from '@/lib/api/hr';
import { HRRequest } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { type FilterField } from '@/components/ui/FilterPanel';
import RejectionReasonDialog from '@/components/features/RejectionReasonDialog';
import { Button, Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';
import { HR_REQUEST_STATUS } from '@/lib/utils/status-colors';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled',
};

const REQUEST_TYPE_LABEL: Record<string, string> = {
  annual_leave: 'Annual Leave', sick_leave: 'Sick Leave', emergency_leave: 'Emergency Leave',
  unpaid_leave: 'Unpaid Leave', work_from_home: 'Work From Home', overtime: 'Overtime',
  advance_salary: 'Advance Salary', document_request: 'Document Request', other: 'Other',
};

const filterFields: FilterField[] = [
  { name: 'status', label: 'Status', type: 'select', group: 'Filters',
    options: Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l })) },
  { name: 'request_type', label: 'Request Type', type: 'select', group: 'Filters',
    options: Object.entries(REQUEST_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l })) },
  { name: 'start_date_after',  label: 'Start Date From', type: 'date', group: 'Dates' },
  { name: 'start_date_before', label: 'Start Date To',   type: 'date', group: 'Dates' },
];

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export default function HRRequestsPage() {
  const tableState = useTableState();
  const { page, search, filters } = tableState;

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId]           = useState<number | null>(null);

  const queryClient = useQueryClient();
  const { user }    = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const t           = useT();
  const isAdmin     = isTenantAdmin || isPlatformAdmin || ['hr_manager', 'hr_secretary', 'company_director'].includes(user?.role ?? '');

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-requests', page, search, filters],
    queryFn:  () => hrRequestsApi.getAll({ page, search, ...filters }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => hrRequestsApi.approve(id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['hr-requests'] }); toast('Request approved', 'success'); },
    onError:    () => toast('Failed to approve request', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => hrRequestsApi.reject(id, reason),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['hr-requests'] });
      toast('Request rejected', 'info');
      setRejectDialogOpen(false);
      setRejectingId(null);
    },
    onError: (e: unknown) => toast(getApiError(e, 'Failed to reject request'), 'error'),
  });

  const handleApprove = async (id: number) => { if (await confirm('Approve this request?')) approveMutation.mutate(id); };
  const handleReject  = (id: number) => { setRejectingId(id); setRejectDialogOpen(true); };

  const requests   = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const columns: Column<HRRequest>[] = [
    {
      key: 'employee', header: 'Employee',
      render: r => (
        <div>
          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.employee_name}</div>
          <div className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{r.employee_id_code}</div>
        </div>
      ),
    },
    { key: 'type',   header: 'Type',       render: r => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{REQUEST_TYPE_LABEL[r.request_type] || r.request_type}</span> },
    { key: 'status', header: t('col', 'status'), render: r => <Badge variant={HR_REQUEST_STATUS[r.status] ?? 'default'}>{STATUS_LABEL[r.status] || r.status}</Badge> },
    { key: 'start',  header: 'Start Date', render: r => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{fmtDate(r.start_date)}</span> },
    { key: 'end',    header: 'End Date',   render: r => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{fmtDate(r.end_date)}</span> },
    { key: 'days',   header: 'Days',       render: r => <span className="font-medium" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{r.days != null ? r.days : '—'}</span> },
    { key: 'reason', header: 'Reason',     render: r => <span className="block max-w-[200px] truncate" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }} title={r.reason}>{r.reason || '—'}</span> },
    { key: 'created', header: 'Created',   render: r => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{fmtDate(r.created_at)}</span> },
    {
      key: 'actions', header: t('col', 'actions'),
      render: r => isAdmin ? (
        <div className="flex items-center gap-2">
          {r.status === 'pending' ? (
            <>
              <Button variant="success" size="sm" onClick={() => handleApprove(r.id)} isLoading={approveMutation.isPending}>{t('btn', 'approve')}</Button>
              <Button variant="delete"  size="sm" onClick={() => handleReject(r.id)}  isLoading={rejectMutation.isPending}>{t('btn', 'reject')}</Button>
            </>
          ) : (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{r.approver_name ? `By: ${r.approver_name}` : '—'}</span>
          )}
        </div>
      ) : null,
    },
  ];

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={t('page', 'hrRequests')}
          count={totalCount}
          breadcrumbs={[{ label: 'HR' }, { label: 'Requests' }]}
        />
        <TableShell
          tableState={tableState}
          filterFields={filterFields}
          filterSaveKey="hr-requests"
          searchPlaceholder="Search requests..."
          columns={columns}
          data={requests}
          isLoading={isLoading}
          error={error}
          emptyMessage={t('empty', 'noHRRequests')}
          totalCount={totalCount}
          pageSize={50}
          paginatedData={data}
        />

        <RejectionReasonDialog
          isOpen={rejectDialogOpen}
          onClose={() => { setRejectDialogOpen(false); setRejectingId(null); }}
          onConfirm={(reason) => { if (rejectingId) rejectMutation.mutate({ id: rejectingId, reason }); }}
          title="Reject HR Request"
          message="Please provide a reason for rejecting this request. This reason will be visible to the employee."
        />
      </PageShell>
    </MainLayout>
  );
}
