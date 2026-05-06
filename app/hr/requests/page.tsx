'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrRequestsApi } from '@/lib/api/hr';
import { HRRequest } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import FilterPanel, { FilterField } from '@/components/ui/FilterPanel';
import FilterTags from '@/components/ui/FilterTags';
import RejectionReasonDialog from '@/components/ui/RejectionReasonDialog';
import { Button, TextField, Badge, Loader } from '@/components/ui';
import { useT } from '@/lib/i18n/useT';

const statusColors: Record<string, string> = {
  pending:   'badge-warning',
  approved:  'badge-success',
  rejected:  'badge-error',
  cancelled: 'badge-default',
};

const statusLabels: Record<string, string> = {
  pending:   'Pending',
  approved:  'Approved',
  rejected:  'Rejected',
  cancelled: 'Cancelled',
};

const requestTypeLabels: Record<string, string> = {
  annual_leave:     'Annual Leave',
  sick_leave:       'Sick Leave',
  emergency_leave:  'Emergency Leave',
  unpaid_leave:     'Unpaid Leave',
  work_from_home:   'Work From Home',
  overtime:         'Overtime',
  advance_salary:   'Advance Salary',
  document_request: 'Document Request',
  other:            'Other',
};

export default function HRRequestsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const t = useT();
  const isAdmin = user?.role === 'super_admin' || user?.is_staff || user?.is_superuser;

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-requests', page, search, filters],
    queryFn: () => hrRequestsApi.getAll({ page, search, ...filters }),
  });

  const filterFields: FilterField[] = [
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      group: 'Filters',
      options: [
        { value: 'pending',   label: 'Pending' },
        { value: 'approved',  label: 'Approved' },
        { value: 'rejected',  label: 'Rejected' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
    },
    {
      name: 'request_type',
      label: 'Request Type',
      type: 'select',
      group: 'Filters',
      options: [
        { value: 'annual_leave',     label: 'Annual Leave' },
        { value: 'sick_leave',       label: 'Sick Leave' },
        { value: 'emergency_leave',  label: 'Emergency Leave' },
        { value: 'unpaid_leave',     label: 'Unpaid Leave' },
        { value: 'work_from_home',   label: 'Work From Home' },
        { value: 'overtime',         label: 'Overtime' },
        { value: 'advance_salary',   label: 'Advance Salary' },
        { value: 'document_request', label: 'Document Request' },
        { value: 'other',            label: 'Other' },
      ],
    },
    { name: 'start_date_after',  label: 'Start Date From', type: 'date', group: 'Dates' },
    { name: 'start_date_before', label: 'Start Date To',   type: 'date', group: 'Dates' },
  ];

  const approveMutation = useMutation({
    mutationFn: (id: number) => hrRequestsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-requests'] });
      toast('Request approved successfully', 'success');
    },
    onError: () => toast('Failed to approve request', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      hrRequestsApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-requests'] });
      toast('Request rejected', 'info');
      setRejectDialogOpen(false);
      setRejectingId(null);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to reject request';
      toast(message, 'error');
    },
  });

  const handleApprove = async (id: number) => {
    const confirmed = await confirm('Are you sure you want to approve this request?');
    if (confirmed) approveMutation.mutate(id);
  };

  const handleReject = (id: number) => {
    setRejectingId(id);
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = (reason: string) => {
    if (rejectingId) {
      rejectMutation.mutate({ id: rejectingId, reason });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t('page', 'hrRequests')}</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage employee requests and leave applications</p>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="card flex items-center gap-4">
          <TextField
            type="text"
            placeholder="Search requests..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 max-w-md"
          />
          <FilterPanel
            fields={filterFields}
            filters={filters}
            onFilterChange={(f) => { setFilters(f); setPage(1); }}
            onReset={() => { setFilters({}); setPage(1); }}
            saveKey="hr-requests"
          />
        </div>

        {Object.keys(filters).length > 0 && (
          <FilterTags
            filters={filters}
            fields={filterFields}
            onRemoveFilter={(k) => {
              const f = { ...filters };
              delete f[k];
              setFilters(f);
              setPage(1);
            }}
            onClearAll={() => { setFilters({}); setPage(1); }}
          />
        )}

        {/* Content */}
        {isLoading ? (
          <div className="card text-center py-12">
            <Loader className="mx-auto mb-4" />
            <p className="text-muted-foreground">{t('btn', 'loading')}</p>
          </div>
        ) : error ? (
          <div className="card border-destructive bg-destructive/10">
            <p className="text-destructive text-sm">Error loading requests.</p>
          </div>
        ) : !data?.results?.length ? (
          <div className="card text-center py-12">
            <p className="text-muted-foreground">{t('empty', 'noHRRequests')}</p>
          </div>
        ) : (
          <>
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Days</th>
                      <th>Reason</th>
                      <th>Created</th>
                      {isAdmin && <th>{t('col', 'actions')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((req: HRRequest) => (
                      <tr key={req.id}>
                        <td>
                          <div>
                            <div className="font-medium text-foreground">{req.employee_name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{req.employee_id_code}</div>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm text-foreground">
                            {requestTypeLabels[req.request_type] || req.request_type}
                          </span>
                        </td>
                        <td>
                          <Badge className={statusColors[req.status] || 'badge-default'}>
                            {statusLabels[req.status] || req.status}
                          </Badge>
                        </td>
                        <td>
                          <span className="text-sm text-muted-foreground">
                            {req.start_date
                              ? new Date(req.start_date).toLocaleDateString('en-US', {
                                  year: 'numeric', month: 'short', day: 'numeric',
                                })
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm text-muted-foreground">
                            {req.end_date
                              ? new Date(req.end_date).toLocaleDateString('en-US', {
                                  year: 'numeric', month: 'short', day: 'numeric',
                                })
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm font-medium text-foreground">
                            {req.days != null ? req.days : '—'}
                          </span>
                        </td>
                        <td>
                          <span
                            className="text-sm text-muted-foreground max-w-[200px] truncate block"
                            title={req.reason}
                          >
                            {req.reason || '—'}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm text-muted-foreground">
                            {new Date(req.created_at).toLocaleDateString('en-US', {
                              year: 'numeric', month: 'short', day: 'numeric',
                            })}
                          </span>
                        </td>
                        {isAdmin && (
                          <td>
                            <div className="flex items-center gap-2">
                              {req.status === 'pending' && (
                                <>
                                  <Button
                                    variant="success"
                                    size="sm"
                                    onClick={() => handleApprove(req.id)}
                                    disabled={approveMutation.isPending}
                                  >
                                    {t('btn', 'approve')}
                                  </Button>
                                  <Button
                                    variant="delete"
                                    size="sm"
                                    onClick={() => handleReject(req.id)}
                                    disabled={rejectMutation.isPending}
                                  >
                                    {t('btn', 'reject')}
                                  </Button>
                                </>
                              )}
                              {req.status !== 'pending' && (
                                <span className="text-xs text-muted-foreground">
                                  {req.approver_name ? `By: ${req.approver_name}` : '—'}
                                </span>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {data.count > 50 && (
              <div className="flex items-center justify-between card">
                <p className="text-sm text-muted-foreground">
                  {t('misc', 'showing')} {((page - 1) * 50) + 1} {t('misc', 'pageTo')} {Math.min(page * 50, data.count)} {t('misc', 'pageOf')} {data.count}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={!data.previous}
                  >
                    {t('btn', 'previous')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setPage(p => p + 1)}
                    disabled={!data.next}
                  >
                    {t('btn', 'next')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <RejectionReasonDialog
        isOpen={rejectDialogOpen}
        onClose={() => {
          setRejectDialogOpen(false);
          setRejectingId(null);
        }}
        onConfirm={handleRejectConfirm}
        title="Reject HR Request"
        message="Please provide a reason for rejecting this request. This reason will be visible to the employee."
      />
    </MainLayout>
  );
}
