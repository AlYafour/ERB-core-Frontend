'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hrRequestsApi, hrApprovalsApi } from '@/lib/api/hr';
import { toast } from '@/lib/hooks/use-toast';
import type { UserTabProps } from './types';
import type { HRRequest } from '@/types';

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  pending:   { bg: '#fef3c7', text: '#92400e' },
  approved:  { bg: '#d1fae5', text: '#065f46' },
  rejected:  { bg: '#fee2e2', text: '#991b1b' },
  cancelled: { bg: 'var(--surface-subtle)', text: 'var(--text-secondary)' },
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled',
};

const DATE_RANGE_TYPES = new Set([
  'annual_leave', 'sick_leave', 'emergency_leave',
  'unpaid_leave', 'work_from_home', 'overtime',
]);

const TYPE_LABELS: Record<string, string> = {
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

const STRATEGY_LABEL: Record<string, string> = {
  DIRECT_MANAGER:   'Direct Manager',
  INDIRECT_MANAGER: 'Indirect Manager',
  ROLE:             'Role',
  SPECIFIC_USER:    'Designated Approver',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtShort(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function calcDays(start: string, end: string) {
  if (!start || !end) return 0;
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
}

function resolveTypeLabel(code: string, types?: { code: string; name: string }[]) {
  return types?.find(t => t.code === code)?.name || TYPE_LABELS[code] || code;
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.cancelled;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', background: c.bg, color: c.text, whiteSpace: 'nowrap' }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

// ── Approvals Inbox ────────────────────────────────────────────────────────────

function ApprovalsInbox({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId]   = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [expandedId, setExpandedId]     = useState<number | null>(null);

  const { data: inbox = [], isLoading } = useQuery({
    queryKey: ['pending-my-approval'],
    queryFn:  () => hrRequestsApi.getPendingMyApproval(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pending-my-approval'] });
    queryClient.invalidateQueries({ queryKey: ['my-requests', userId] });
  };

  const approveMutation = useMutation({
    mutationFn: (id: number) => hrRequestsApi.approve(id),
    onSuccess:  () => { invalidate(); toast('Request approved', 'success'); },
    onError:    (err: any) => toast(err?.response?.data?.detail || 'Failed to approve', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => hrRequestsApi.reject(id, reason),
    onSuccess:  () => {
      invalidate();
      setRejectingId(null);
      setRejectReason('');
      toast('Request rejected', 'success');
    },
    onError: (err: any) => toast(err?.response?.data?.detail || 'Failed to reject', 'error'),
  });

  const handleReject = (id: number) => {
    if (!rejectReason.trim()) { toast('Reason is required', 'error'); return; }
    rejectMutation.mutate({ id, reason: rejectReason });
  };

  if (isLoading) return (
    <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--text-sm)' }}>Loading…</p>
    </div>
  );

  if (inbox.length === 0) return (
    <div style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
      <p style={{ fontSize: 'var(--text-2xl)', margin: '0 0 var(--space-3)' }}>✓</p>
      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: '0 0 var(--space-1)' }}>All clear</p>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>No requests awaiting your approval.</p>
    </div>
  );

  return (
    <div>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 70px 1fr 160px', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}>
        {['Employee', 'Type', 'Days', 'Dates / Reason', 'Actions'].map(h => (
          <span key={h} style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
        ))}
      </div>

      {inbox.map((req, idx) => {
        const isRejectOpen = rejectingId === req.id;
        const isExpanded   = expandedId  === req.id;
        const isDateType   = DATE_RANGE_TYPES.has(req.request_type);
        const step         = req.current_approval_step;

        return (
          <div key={req.id} style={{ borderBottom: idx < inbox.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
            {/* Main row */}
            <div
              onClick={() => !isRejectOpen && setExpandedId(isExpanded ? null : req.id)}
              style={{ display: 'grid', gridTemplateColumns: '1fr 130px 70px 1fr 160px', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-5)', alignItems: 'center', cursor: 'pointer' }}>

              <div>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: 0 }}>{req.employee_name}</p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '2px 0 0' }}>{req.employee_id_code}</p>
              </div>

              <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>{TYPE_LABELS[req.request_type] || req.request_type}</p>

              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                {req.days ? `${parseFloat(req.days)}d` : '—'}
              </p>

              <div>
                {isDateType && req.start_date && (
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', margin: '0 0 2px' }}>
                    {fmtShort(req.start_date)}{req.end_date && req.end_date !== req.start_date ? ` – ${fmtShort(req.end_date)}` : ''}
                  </p>
                )}
                {req.reason && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                    {req.reason}
                  </p>
                )}
              </div>

              <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <button
                  onClick={() => approveMutation.mutate(req.id)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  style={{ padding: '4px 12px', borderRadius: 'var(--radius-md)', border: 'none', background: '#d1fae5', color: '#065f46', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)' }}>
                  Approve
                </button>
                <button
                  onClick={() => {
                    if (isRejectOpen) { setRejectingId(null); setRejectReason(''); }
                    else { setRejectingId(req.id); setExpandedId(null); }
                  }}
                  disabled={approveMutation.isPending}
                  style={{ padding: '4px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: isRejectOpen ? '#fee2e2' : 'none', color: isRejectOpen ? '#991b1b' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)' }}>
                  Reject
                </button>
              </div>
            </div>

            {/* Reject reason inline */}
            {isRejectOpen && (
              <div onClick={e => e.stopPropagation()} style={{ padding: 'var(--space-3) var(--space-5) var(--space-4)', borderTop: '1px solid #fee2e2', background: '#fff5f5', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: '#991b1b', margin: '0 0 var(--space-2)' }}>Reason for rejection *</p>
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    rows={2}
                    autoFocus
                    placeholder="Provide a clear reason…"
                    className="form-textarea"
                    style={{ width: '100%', fontSize: 'var(--text-sm)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingTop: 20 }}>
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={rejectMutation.isPending || !rejectReason.trim()}
                    style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: '#991b1b', color: '#fff', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', opacity: rejectMutation.isPending ? 0.7 : 1 }}>
                    {rejectMutation.isPending ? 'Rejecting…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => { setRejectingId(null); setRejectReason(''); }}
                    style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--text-xs)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Expanded detail */}
            {isExpanded && !isRejectOpen && (
              <div style={{ padding: 'var(--space-3) var(--space-5) var(--space-4)', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {step && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                    <span style={{ fontWeight: 'var(--weight-semibold)' }}>Step {step.step_order}</span>
                    {' · '}{STRATEGY_LABEL[step.strategy] || step.strategy}
                    {' · Submitted '}{fmtDate(req.created_at)}
                  </p>
                )}
                {req.reason && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                    <span style={{ fontWeight: 'var(--weight-semibold)' }}>Reason: </span>{req.reason}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── My Requests list ───────────────────────────────────────────────────────────

function MyRequestsList({ userId, isSelf, isAdmin, empId }: { userId: number; isSelf: boolean; isAdmin: boolean; empId?: number }) {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [expandedId, setExpandedId]     = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({
    request_type: 'annual_leave',
    start_date: '', end_date: '', days: '', reason: '',
  });

  const { data: requestsData, isLoading } = useQuery({
    queryKey: ['my-requests', userId, statusFilter],
    queryFn:  () => hrRequestsApi.getAll({ ...(statusFilter ? { status: statusFilter } : {}) }),
    enabled:  !!userId,
  });

  const { data: requestTypes } = useQuery({
    queryKey: ['hr-request-types'],
    queryFn:  () => hrApprovalsApi.getRequestTypes(),
    staleTime: 10 * 60 * 1000,
  });

  const requests: HRRequest[] = requestsData?.results ?? [];

  const createMutation = useMutation({
    mutationFn: (data: Partial<HRRequest>) => hrRequestsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-requests', userId] });
      toast('Request submitted successfully', 'success');
      setDrawerOpen(false);
      resetForm();
    },
    onError: () => toast('Failed to submit request', 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => hrRequestsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-requests', userId] });
      toast('Request cancelled', 'success');
    },
    onError: () => toast('Failed to cancel request', 'error'),
  });

  const resetForm = () =>
    setForm({ request_type: 'annual_leave', start_date: '', end_date: '', days: '', reason: '' });

  const isDateType = DATE_RANGE_TYPES.has(form.request_type);

  const updateForm = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const val = e.target.value;
      setForm(prev => {
        const next = { ...prev, [k]: val };
        if ((k === 'start_date' || k === 'end_date') && next.start_date && next.end_date)
          next.days = String(calcDays(next.start_date, next.end_date));
        if (k === 'request_type' && !DATE_RANGE_TYPES.has(val))
          next.start_date = next.end_date = next.days = '';
        return next;
      });
    };

  const handleSubmit = () => {
    if (!form.request_type) { toast('Select a request type', 'error'); return; }
    if (isDateType && (!form.start_date || !form.end_date)) { toast('Start and end dates are required', 'error'); return; }
    if (isDateType && form.end_date < form.start_date) { toast('End date must be after start date', 'error'); return; }
    if (!form.reason.trim()) { toast('Please provide a reason', 'error'); return; }

    createMutation.mutate({
      ...(empId && { employee: empId }),
      request_type: form.request_type as HRRequest['request_type'],
      reason: form.reason,
      ...(isDateType && {
        start_date: form.start_date,
        end_date:   form.end_date,
        days:       form.days || String(calcDays(form.start_date, form.end_date)),
      }),
    });
  };

  return (
    <>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ fontSize: 'var(--text-xs)', padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {(isSelf || isAdmin) && (
          <button onClick={() => { resetForm(); setDrawerOpen(true); }}
            style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)', border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>
            + New Request
          </button>
        )}
      </div>

      {/* Column headers */}
      {!isLoading && requests.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 150px 55px 75px 85px', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}>
          {['Status', 'Type', 'Dates', 'Days', 'Submitted', ''].map(h => (
            <span key={h} style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>
      )}

      {/* Rows */}
      {isLoading ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--text-sm)' }}>Loading…</p>
        </div>
      ) : requests.length === 0 ? (
        <div style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--text-2xl)', margin: '0 0 var(--space-3)' }}>📋</p>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: '0 0 var(--space-1)' }}>
            {statusFilter ? 'No requests with this status.' : 'No requests yet.'}
          </p>
          {!statusFilter && (isSelf || isAdmin) && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>Use "+ New Request" to submit your first one.</p>
          )}
        </div>
      ) : (
        requests.map((req, idx) => {
          const isExpanded = expandedId === req.id;
          const isLeave    = DATE_RANGE_TYPES.has(req.request_type);

          return (
            <div key={req.id} style={{ borderBottom: idx < requests.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div
                onClick={() => setExpandedId(isExpanded ? null : req.id)}
                style={{ display: 'grid', gridTemplateColumns: '110px 1fr 150px 55px 75px 85px', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-5)', alignItems: 'center', cursor: 'pointer' }}>
                <StatusBadge status={req.status} />
                <div>
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: 0 }}>
                    {resolveTypeLabel(req.request_type, requestTypes)}
                  </p>
                  {req.reason && (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                      {req.reason}
                    </p>
                  )}
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                  {isLeave && req.start_date
                    ? req.start_date === req.end_date
                      ? fmtShort(req.start_date)
                      : `${fmtShort(req.start_date)} – ${fmtShort(req.end_date)}`
                    : '—'}
                </p>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                  {req.days ? `${parseFloat(req.days)}d` : '—'}
                </p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                  {fmtShort(req.created_at)}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {req.status === 'pending' && (isSelf || isAdmin) && (
                    <button
                      onClick={e => { e.stopPropagation(); cancelMutation.mutate(req.id); }}
                      disabled={cancelMutation.isPending}
                      style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: 'var(--space-3) var(--space-5) var(--space-4)', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {req.approval_instance_id && req.status === 'pending' && req.current_approval_step && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: 99, fontWeight: 'var(--weight-medium)' }}>
                        Step {req.current_approval_step.step_order}
                      </span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        Awaiting {STRATEGY_LABEL[req.current_approval_step.strategy] || req.current_approval_step.strategy} approval
                      </span>
                    </div>
                  )}
                  {req.status === 'approved' && (
                    <p style={{ fontSize: 'var(--text-xs)', color: '#065f46', margin: 0 }}>
                      Approved{req.approver_name ? ` by ${req.approver_name}` : ''}{req.approved_at ? ` on ${fmtDate(req.approved_at)}` : ''}
                    </p>
                  )}
                  {req.status === 'rejected' && req.reject_reason && (
                    <p style={{ fontSize: 'var(--text-xs)', color: '#991b1b', margin: 0 }}>
                      <span style={{ fontWeight: 'var(--weight-semibold)' }}>Rejection reason: </span>{req.reject_reason}
                    </p>
                  )}
                  {req.reason && (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                      <span style={{ fontWeight: 'var(--weight-semibold)' }}>Reason: </span>{req.reason}
                    </p>
                  )}
                  {req.notes && (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                      <span style={{ fontWeight: 'var(--weight-semibold)' }}>Notes: </span>{req.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* New Request Drawer */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setDrawerOpen(false)}>
          <div style={{ marginLeft: 'auto', width: '100%', maxWidth: 520, height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--card-bg)', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-base)', margin: 0 }}>New Request</h2>
              <button onClick={() => setDrawerOpen(false)} style={{ fontSize: 'var(--text-lg)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-field">
                <label className="form-label">Request Type *</label>
                <select className="form-select" value={form.request_type} onChange={updateForm('request_type')}>
                  {(requestTypes?.filter(t => t.is_active) ??
                    Object.entries(TYPE_LABELS).map(([code, name]) => ({ code, name, id: 0, name_ar: '', description: '', is_active: true }))
                  ).map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
                </select>
              </div>

              {isDateType && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className="form-field">
                    <label className="form-label">Start Date *</label>
                    <input className="form-input" type="date" value={form.start_date} onChange={updateForm('start_date')} />
                  </div>
                  <div className="form-field">
                    <label className="form-label">End Date *</label>
                    <input className="form-input" type="date" value={form.end_date} min={form.start_date || undefined} onChange={updateForm('end_date')} />
                  </div>
                </div>
              )}

              {isDateType && (
                <div className="form-field">
                  <label className="form-label">
                    Days
                    {form.start_date && form.end_date && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginLeft: 'var(--space-2)', fontWeight: 'var(--weight-normal)' }}>(auto-calculated)</span>
                    )}
                  </label>
                  <input className="form-input" type="number" min="0.5" step="0.5" value={form.days} onChange={updateForm('days')} placeholder="e.g. 3" />
                </div>
              )}

              <div className="form-field">
                <label className="form-label">Reason *</label>
                <textarea className="form-textarea" rows={3}
                  value={form.reason}
                  onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                  placeholder="Details of your request…"
                />
              </div>

              {!isDateType && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, background: 'var(--surface-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                  This request type doesn't require specific dates and will be routed for approval after submission.
                </p>
              )}
            </div>

            <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button onClick={() => setDrawerOpen(false)}
                style={{ padding: 'var(--space-2) var(--space-5)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={createMutation.isPending}
                style={{ padding: 'var(--space-2) var(--space-5)', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)', cursor: createMutation.isPending ? 'not-allowed' : 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', opacity: createMutation.isPending ? 0.7 : 1 }}>
                {createMutation.isPending ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Type Summary Sidebar ───────────────────────────────────────────────────────

function TypeSummary({ userId }: { userId: number }) {
  const { data: requestsData } = useQuery({
    queryKey: ['my-requests', userId, ''],
    queryFn:  () => hrRequestsApi.getAll({}),
    enabled:  !!userId,
    staleTime: 30 * 1000,
  });

  const requests: HRRequest[] = requestsData?.results ?? [];

  const counts: Record<string, { total: number; pending: number }> = {};
  for (const r of requests) {
    if (!counts[r.request_type]) counts[r.request_type] = { total: 0, pending: 0 };
    counts[r.request_type].total++;
    if (r.status === 'pending') counts[r.request_type].pending++;
  }
  const types = Object.entries(counts).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: '0 0 var(--space-1)' }}>My Summary</h3>

      {requests.length === 0 ? (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>No requests yet.</p>
      ) : (
        <>
          {types.map(([code, { total, pending }]) => (
            <div key={code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {TYPE_LABELS[code] || code}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexShrink: 0 }}>
                {pending > 0 && (
                  <span style={{ fontSize: 'var(--text-xs)', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 99, fontWeight: 'var(--weight-semibold)' }}>
                    {pending}
                  </span>
                )}
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', background: 'var(--surface-subtle)', padding: '1px 6px', borderRadius: 99 }}>
                  {total}
                </span>
              </div>
            </div>
          ))}

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>Total</p>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', background: 'var(--surface-subtle)', padding: '1px 6px', borderRadius: 99 }}>
                {requests.length}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────

export default function RequestsTab({ user, emp, isSelf, isAdmin, userId }: UserTabProps) {
  const empId: number | undefined = emp?.id;
  const [activeTab, setActiveTab] = useState<'approvals' | 'mine'>('approvals');

  // Pre-fetch counts for the tab labels
  const { data: inbox = [] } = useQuery({
    queryKey: ['pending-my-approval'],
    queryFn:  () => hrRequestsApi.getPendingMyApproval(),
  });

  const { data: myData } = useQuery({
    queryKey: ['my-requests', userId, ''],
    queryFn:  () => hrRequestsApi.getAll({}),
    enabled:  !!userId,
    staleTime: 30 * 1000,
  });

  const myCount = myData?.results?.length ?? 0;

  const tabBtn = (id: 'approvals' | 'mine', label: string, count: number) => {
    const active = activeTab === id;
    const isApproval = id === 'approvals';
    return (
      <button
        key={id}
        onClick={() => setActiveTab(id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)',
          border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)',
          fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-normal)',
          background: active ? 'var(--card-bg)' : 'transparent',
          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
          boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          transition: 'all 150ms ease',
        }}>
        {label}
        {count > 0 && (
          <span style={{
            fontSize: 'var(--text-xs)', padding: '1px 7px', borderRadius: 99,
            fontWeight: 'var(--weight-semibold)',
            background: active && isApproval && count > 0 ? '#fef3c7' : 'var(--surface-subtle)',
            color:      active && isApproval && count > 0 ? '#92400e'  : 'var(--text-secondary)',
          }}>
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', padding: 'var(--space-1)', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-lg)', width: 'fit-content' }}>
        {tabBtn('approvals', 'Approvals', inbox.length)}
        {tabBtn('mine',      'My Requests', myCount)}
      </div>

      {/* 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 'var(--space-5)', alignItems: 'start' }}>

        {/* Main panel */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {activeTab === 'approvals'
            ? <ApprovalsInbox userId={userId} />
            : <MyRequestsList userId={userId} isSelf={isSelf} isAdmin={isAdmin} empId={empId} />
          }
        </div>

        {/* Summary sidebar */}
        <TypeSummary userId={userId} />
      </div>
    </div>
  );
}
