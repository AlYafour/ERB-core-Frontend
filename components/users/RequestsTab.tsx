'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hrRequestsApi, hrApprovalsApi } from '@/lib/api/hr';
import { toast } from '@/lib/hooks/use-toast';
import type { UserTabProps } from './OverviewTab';
import type { HRRequest } from '@/types';

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending:   'Pending',
  approved:  'Approved',
  rejected:  'Rejected',
  cancelled: 'Cancelled',
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  pending:   { bg: '#fef3c7', text: '#92400e' },
  approved:  { bg: '#d1fae5', text: '#065f46' },
  rejected:  { bg: '#fee2e2', text: '#991b1b' },
  cancelled: { bg: 'var(--surface-subtle)', text: 'var(--text-secondary)' },
};

// Request types that need start/end dates and a days count
const DATE_RANGE_TYPES = new Set([
  'annual_leave', 'sick_leave', 'emergency_leave',
  'unpaid_leave', 'work_from_home', 'overtime',
]);

// Fallback labels if API request-types are loading/unavailable
const FALLBACK_LABELS: Record<string, string> = {
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
  SPECIFIC_USER:    'Designated Approver',
  ANY_ADMIN:        'Any Admin',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateShort(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function RequestsTab({ user, emp, isSelf, isAdmin, userId }: UserTabProps) {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [expandedId, setExpandedId]     = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [form, setForm] = useState({
    request_type: 'annual_leave',
    start_date:   '',
    end_date:     '',
    days:         '',
    reason:       '',
  });

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: requestsData, isLoading } = useQuery({
    queryKey: ['my-requests', userId, statusFilter],
    queryFn:  () => hrRequestsApi.getAll({
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    enabled: !!userId,
  });

  const { data: requestTypes } = useQuery({
    queryKey: ['hr-request-types'],
    queryFn:  () => hrApprovalsApi.getRequestTypes(),
    staleTime: 10 * 60 * 1000,
  });

  const requests: HRRequest[] = requestsData?.results ?? [];

  // ── Mutations ────────────────────────────────────────────────────────────────
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

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const resetForm = () => setForm({ request_type: 'annual_leave', start_date: '', end_date: '', days: '', reason: '' });

  const isDateType = DATE_RANGE_TYPES.has(form.request_type);

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    setForm(prev => {
      const next = { ...prev, [k]: val };
      // Auto-calc days when dates change
      if ((k === 'start_date' || k === 'end_date') && next.start_date && next.end_date) {
        next.days = String(calcDays(next.start_date, next.end_date));
      }
      // Reset dates when switching to a non-date type
      if (k === 'request_type' && !DATE_RANGE_TYPES.has(val)) {
        next.start_date = '';
        next.end_date   = '';
        next.days       = '';
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (!form.request_type) { toast('Select a request type', 'error'); return; }
    if (isDateType && (!form.start_date || !form.end_date)) { toast('Start and end dates are required', 'error'); return; }
    if (isDateType && form.end_date < form.start_date) { toast('End date must be after start date', 'error'); return; }
    if (!form.reason.trim()) { toast('Please provide a reason', 'error'); return; }

    const payload: Partial<HRRequest> = {
      request_type: form.request_type as HRRequest['request_type'],
      reason:       form.reason,
      ...(isDateType && {
        start_date: form.start_date,
        end_date:   form.end_date,
        days:       form.days || String(calcDays(form.start_date, form.end_date)),
      }),
    };
    createMutation.mutate(payload);
  };

  const typeLabel = (code: string) => {
    const rt = requestTypes?.find(t => t.code === code);
    return rt?.name || FALLBACK_LABELS[code] || code;
  };

  // ── Inline CSS shorthands ────────────────────────────────────────────────────
  const inp   = 'form-input';
  const sel   = 'form-select';
  const fld   = 'form-field';
  const lbl   = 'form-label';

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

        {/* Header row */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4) var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>My Requests</h2>
            {requests.length > 0 && (
              <span style={{ fontSize: 'var(--text-xs)', background: 'var(--surface-subtle)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 99, fontWeight: 'var(--weight-medium)' }}>
                {requests.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {/* Status filter */}
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ fontSize: 'var(--text-xs)', padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer' }}>
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
        </div>

        {/* Requests list */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                {!statusFilter && (isSelf || isAdmin) && 'Use "+ New Request" to submit your first one.'}
              </p>
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 160px 60px 80px 90px', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}>
                {['Status', 'Type', 'Dates', 'Days', 'Submitted', ''].map(h => (
                  <span key={h} style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                ))}
              </div>

              {/* Rows */}
              {requests.map((req, idx) => {
                const colors     = STATUS_COLOR[req.status] || STATUS_COLOR.cancelled;
                const isExpanded = expandedId === req.id;
                const isLeave    = DATE_RANGE_TYPES.has(req.request_type);

                return (
                  <div key={req.id} style={{ borderBottom: idx < requests.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    {/* Main row */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : req.id)}
                      style={{ display: 'grid', gridTemplateColumns: '120px 1fr 160px 60px 80px 90px', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-5)', alignItems: 'center', cursor: 'pointer' }}>

                      {/* Status badge */}
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '3px 10px', borderRadius: 99, fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', background: colors.bg, color: colors.text, whiteSpace: 'nowrap' }}>
                        {STATUS_LABEL[req.status] || req.status}
                      </span>

                      {/* Type */}
                      <div>
                        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: 0 }}>{typeLabel(req.request_type)}</p>
                        {req.reason && (
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                            {req.reason}
                          </p>
                        )}
                      </div>

                      {/* Dates */}
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                        {isLeave && req.start_date
                          ? req.start_date === req.end_date
                            ? fmtDateShort(req.start_date)
                            : `${fmtDateShort(req.start_date)} – ${fmtDateShort(req.end_date)}`
                          : '—'}
                      </p>

                      {/* Days */}
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                        {req.days ? `${parseFloat(req.days)}d` : '—'}
                      </p>

                      {/* Submitted */}
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                        {fmtDateShort(req.created_at)}
                      </p>

                      {/* Cancel button (pending only, self only) */}
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

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <div style={{ padding: 'var(--space-3) var(--space-5) var(--space-4)', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>

                        {/* Approval chain step */}
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

                        {/* Approved info */}
                        {req.status === 'approved' && (
                          <p style={{ fontSize: 'var(--text-xs)', color: '#065f46', margin: 0 }}>
                            Approved{req.approver_name ? ` by ${req.approver_name}` : ''}{req.approved_at ? ` on ${fmtDate(req.approved_at)}` : ''}
                          </p>
                        )}

                        {/* Reject reason */}
                        {req.status === 'rejected' && req.reject_reason && (
                          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 'var(--text-xs)', color: '#991b1b', fontWeight: 'var(--weight-semibold)', flexShrink: 0 }}>Reason:</span>
                            <span style={{ fontSize: 'var(--text-xs)', color: '#991b1b' }}>{req.reject_reason}</span>
                          </div>
                        )}

                        {/* Notes */}
                        {req.notes && (
                          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 'var(--weight-semibold)', flexShrink: 0 }}>Notes:</span>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{req.notes}</span>
                          </div>
                        )}

                        {/* Full reason (if truncated above) */}
                        {req.reason && (
                          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 'var(--weight-semibold)', flexShrink: 0 }}>Reason:</span>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{req.reason}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── New Request Drawer ─────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setDrawerOpen(false)}>
          <div style={{ marginLeft: 'auto', width: '100%', maxWidth: 520, height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--card-bg)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>

            {/* Drawer header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-base)', margin: 0 }}>New Request</h2>
              <button onClick={() => setDrawerOpen(false)}
                style={{ fontSize: 'var(--text-lg)', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

              {/* Request type */}
              <div className={fld}>
                <label className={lbl}>Request Type *</label>
                <select className={sel} value={form.request_type} onChange={f('request_type')}>
                  {(requestTypes && requestTypes.length > 0
                    ? requestTypes.filter(t => t.is_active)
                    : Object.entries(FALLBACK_LABELS).map(([code, name]) => ({ code, name, id: 0, name_ar: '', description: '', is_active: true }))
                  ).map(t => (
                    <option key={t.code} value={t.code}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Date fields — only for date-range types */}
              {isDateType && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className={fld}>
                    <label className={lbl}>Start Date *</label>
                    <input className={inp} type="date" value={form.start_date} onChange={f('start_date')} />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>End Date *</label>
                    <input className={inp} type="date" value={form.end_date} min={form.start_date || undefined} onChange={f('end_date')} />
                  </div>
                </div>
              )}

              {/* Days — auto-calc, editable */}
              {isDateType && (
                <div className={fld}>
                  <label className={lbl}>
                    Number of Days
                    {form.start_date && form.end_date && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginLeft: 'var(--space-2)', fontWeight: 'var(--weight-normal)' }}>
                        (auto-calculated — edit if different)
                      </span>
                    )}
                  </label>
                  <input className={inp} type="number" min="0.5" step="0.5" value={form.days} onChange={f('days')} placeholder="e.g. 3" />
                </div>
              )}

              {/* Reason */}
              <div className={fld}>
                <label className={lbl}>Reason *</label>
                <textarea className="form-textarea" rows={3}
                  value={form.reason}
                  onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                  placeholder={
                    isDateType
                      ? 'Brief reason for the request…'
                      : form.request_type === 'advance_salary'
                        ? 'Amount needed and reason…'
                        : form.request_type === 'document_request'
                          ? 'Which document and purpose…'
                          : 'Details of your request…'
                  }
                />
              </div>

              {/* Helper text for non-date types */}
              {!isDateType && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, background: 'var(--surface-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                  This request type doesn't require specific dates. Your request will be routed for approval after submission.
                </p>
              )}
            </div>

            {/* Drawer footer */}
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
