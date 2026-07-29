'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hrRequestsApi, hrApprovalsApi, hrCompanySettingsApi } from '@/lib/api/hr';
import { toast, confirm } from '@/lib/hooks/use-toast';
import type { UserTabProps } from './types';
import type { HRRequest } from '@/types';
import { REQUEST_TYPE_LABELS } from '@/lib/hr/request-type-label';

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  pending:   { bg: 'var(--status-warning-bg)', text: 'var(--status-warning)' },
  approved:  { bg: 'var(--status-success-bg)', text: 'var(--status-success)' },
  rejected:  { bg: 'var(--status-error-bg)', text: 'var(--status-error)' },
  cancelled: { bg: 'var(--surface-subtle)', text: 'var(--text-secondary)' },
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled',
};

const DATE_RANGE_TYPES = new Set([
  'annual_leave', 'sick_leave', 'emergency_leave',
  'unpaid_leave', 'work_from_home', 'overtime',
  'maternity_leave', 'paternity_leave',
]);

// Single-day types that use one date (not a range).
const SINGLE_DATE_TYPES = new Set(['missing_punch']);

// Fallback duration mode by code (mirrors the backend) for types with no
// configured RequestType row. The tenant's RequestType.duration_mode wins.
const DEFAULT_DURATION_MODE: Record<string, 'days' | 'hours' | 'both' | 'none'> = {
  annual_leave: 'days', unpaid_leave: 'days', work_from_home: 'days',
  maternity_leave: 'days', paternity_leave: 'days',
  sick_leave: 'both', emergency_leave: 'both',
  personal_leave: 'hours', business_leave: 'hours', overtime: 'hours',
  missing_punch: 'none', advance_salary: 'none', document_request: 'none', other: 'none',
};

// Single source of truth for labels lives in lib/hr/request-type-label.
const TYPE_LABELS = REQUEST_TYPE_LABELS;

// Types an employee can actually raise from the New Request form. Internal codes
// (advance, salary_certificate, expense, generic) are excluded — used only as the
// fallback when the request-types API hasn't resolved.
const RAISABLE_TYPES = [
  'annual_leave', 'sick_leave', 'emergency_leave', 'unpaid_leave', 'work_from_home',
  'maternity_leave', 'paternity_leave',
  'personal_leave', 'business_leave', 'missing_punch', 'overtime', 'advance_salary',
  'document_request', 'other',
] as const;

/** yyyy-mm-dd for N days ago, in local time. */
function ymdDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

// Count the days in an inclusive range. When workingDays (weekday numbers,
// Python Mon=0..Sun=6 — the company's working_days) is given, only those days
// count, so the weekly off (e.g. Saturday) is excluded. JS getDay() is
// Sun=0..Sat=6, converted with (getDay()+6)%7.
function calcDays(start: string, end: string, workingDays?: number[]) {
  if (!start || !end) return 0;
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  if (!workingDays || workingDays.length === 0) {
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
  }
  const work = new Set(workingDays);
  let count = 0;
  for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    if (work.has((d.getDay() + 6) % 7)) count++;
  }
  return count;
}

/** "HH:MM" → minutes since midnight. */
function toMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId]   = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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
        const isDateType   = DATE_RANGE_TYPES.has(req.request_type);

        return (
          <div key={req.id} style={{ borderBottom: idx < inbox.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
            {/* Main row — opens the full request detail */}
            <div
              onClick={() => !isRejectOpen && router.push('/hr/requests/' + req.id)}
              style={{ display: 'grid', gridTemplateColumns: '1fr 130px 70px 1fr 160px', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-5)', alignItems: 'center', cursor: 'pointer' }}>

              <div>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: 0 }}>{req.employee_name}</p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '2px 0 0' }}>{req.employee_id_code}</p>
              </div>

              <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>{TYPE_LABELS[req.request_type] || req.request_type}</p>

              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                {req.hours && parseFloat(req.hours) > 0
                  ? `${parseFloat(req.hours)}h`
                  : req.days && parseFloat(req.days) > 0 ? `${parseFloat(req.days)}d` : '—'}
              </p>

              <div>
                {req.hours && parseFloat(req.hours) > 0 && req.start_date ? (
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', margin: '0 0 2px' }}>
                    {fmtShort(req.start_date)}
                    {req.start_time && req.end_time ? ` · ${req.start_time.slice(0, 5)}–${req.end_time.slice(0, 5)}` : ''}
                  </p>
                ) : (isDateType && req.start_date && (
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', margin: '0 0 2px' }}>
                    {fmtShort(req.start_date)}{req.end_date && req.end_date !== req.start_date ? ` – ${fmtShort(req.end_date)}` : ''}
                  </p>
                ))}
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
                  style={{ padding: '4px 12px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--status-success-bg)', color: 'var(--status-success)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)' }}>
                  Approve
                </button>
                <button
                  onClick={() => {
                    if (isRejectOpen) { setRejectingId(null); setRejectReason(''); }
                    else { setRejectingId(req.id); }
                  }}
                  disabled={approveMutation.isPending}
                  style={{ padding: '4px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: isRejectOpen ? 'var(--status-error-bg)' : 'none', color: isRejectOpen ? 'var(--status-error)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)' }}>
                  Reject
                </button>
              </div>
            </div>

            {/* Reject reason inline */}
            {isRejectOpen && (
              <div onClick={e => e.stopPropagation()} style={{ padding: 'var(--space-3) var(--space-5) var(--space-4)', borderTop: '1px solid var(--status-error-border)', background: 'var(--status-error-bg)', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--status-error)', margin: '0 0 var(--space-2)' }}>Reason for rejection *</p>
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
                    style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--status-error)', color: 'var(--text-inverse)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', opacity: rejectMutation.isPending ? 0.7 : 1 }}>
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
    start_time: '', end_time: '', punch_kind: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [bothHourly, setBothHourly] = useState(false); // 'both' types: day vs hourly toggle

  // Always scope to THIS profile's employee — never rely on the endpoint's
  // admin-sees-all behaviour, or an admin's "My Requests" would list everyone's.
  const { data: requestsData, isLoading } = useQuery({
    queryKey: ['my-requests', userId, empId, statusFilter],
    queryFn:  () => hrRequestsApi.getAll({
      ...(empId ? { employee: empId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    enabled:  !!userId && !!empId,
  });

  const { data: requestTypes } = useQuery({
    queryKey: ['hr-request-types'],
    queryFn:  () => hrApprovalsApi.getRequestTypes(),
    staleTime: 10 * 60 * 1000,
  });

  // Company working week — so day-count excludes the weekly off (e.g. Saturday).
  const { data: companySettings } = useQuery({
    queryKey: ['hr-company-settings'],
    queryFn:  hrCompanySettingsApi.get,
    staleTime: 5 * 60 * 1000,
  });
  const workingDays: number[] = Array.isArray(companySettings?.working_days) ? companySettings!.working_days : [];

  const requests: HRRequest[] = requestsData?.results ?? [];

  const createMutation = useMutation({
    mutationFn: async (data: Partial<HRRequest>) => {
      const created = await hrRequestsApi.create(data);
      // Sick leave carries a medical certificate — upload it onto the new
      // request right after creation (attachments are a post-create step).
      if (file) {
        try { await hrRequestsApi.uploadAttachment(created.id, file); }
        catch { toast('Request saved, but the attachment failed to upload', 'warning'); }
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-requests', userId] });
      toast('Request submitted successfully', 'success');
      setDrawerOpen(false);
      resetForm();
    },
    onError: () => toast('Failed to submit request', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrRequestsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-requests', userId] });
      toast('Request deleted', 'success');
    },
    onError: () => toast('Failed to delete request', 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => hrRequestsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-requests', userId] });
      toast('Request cancelled', 'success');
    },
    onError: () => toast('Failed to cancel request', 'error'),
  });

  const resetForm = () => {
    setForm({ request_type: 'annual_leave', start_date: '', end_date: '', days: '', reason: '', start_time: '', end_time: '', punch_kind: 'both' });
    setFile(null);
    setBothHourly(false);
  };

  // Effective duration mode for the selected type (from its RequestType row,
  // else the built-in default). Drives which fields the form shows.
  const modeFor = (code: string): 'days' | 'hours' | 'both' | 'none' =>
    requestTypes?.find(t => t.code === code)?.duration_mode
    ?? DEFAULT_DURATION_MODE[code] ?? 'days';

  const mode         = modeFor(form.request_type);
  const isSingleDate = SINGLE_DATE_TYPES.has(form.request_type);   // missing_punch
  const asHourly     = mode === 'hours' || (mode === 'both' && bothHourly);
  const asDays       = !isSingleDate && (mode === 'days' || (mode === 'both' && !bothHourly));
  const hourlyHours  = (form.start_time && form.end_time && form.end_time > form.start_time)
    ? Math.round((toMin(form.end_time) - toMin(form.start_time)) / 6) / 10 : 0;
  // How many days back a Missing Punch may be filed — configured per tenant on
  // the RequestType (falls back to 1 = today or yesterday).
  const backdateLimit = requestTypes?.find(t => t.code === form.request_type)?.backdate_limit_days ?? 1;
  const backdateHint = backdateLimit === 0 ? 'Today only.'
    : backdateLimit === 1 ? 'Today or yesterday only.'
    : `Within the last ${backdateLimit} days.`;

  const updateForm = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const val = e.target.value;
      setForm(prev => {
        const next = { ...prev, [k]: val };
        if ((k === 'start_date' || k === 'end_date') && next.start_date && next.end_date)
          next.days = String(calcDays(next.start_date, next.end_date, workingDays));
        if (k === 'request_type')
          Object.assign(next, { start_date: '', end_date: '', days: '', start_time: '', end_time: '', punch_kind: 'both' });
        return next;
      });
      if (k === 'request_type') setBothHourly(false);
    };

  const handleSubmit = () => {
    if (!form.request_type) { toast('Select a request type', 'error'); return; }
    if (asDays && (!form.start_date || !form.end_date)) { toast('Start and end dates are required', 'error'); return; }
    if (asDays && form.end_date < form.start_date) { toast('End date must be after start date', 'error'); return; }
    if (asHourly && !form.start_date) { toast('Select the day of the request', 'error'); return; }
    if (asHourly && (!form.start_time || !form.end_time)) { toast('From and to times are required', 'error'); return; }
    if (asHourly && form.end_time <= form.start_time) { toast('The end time must be after the start time', 'error'); return; }
    if (isSingleDate && !form.start_date) { toast('Select the day the punch was missed', 'error'); return; }
    if (isSingleDate && form.start_date < ymdDaysAgo(backdateLimit)) {
      toast(`A missing punch can only be reported for the allowed window (${backdateHint.toLowerCase()})`, 'error'); return;
    }
    if (isSingleDate) {
      if (!['clock_in', 'clock_out', 'break_out', 'break_in'].includes(form.punch_kind)) {
        toast('Choose which punch was missed', 'error'); return;
      }
      if (!form.start_time) { toast('Enter the time of the missed punch', 'error'); return; }
    }
    if (!form.reason.trim()) { toast('Please provide a reason', 'error'); return; }
    if (form.request_type === 'sick_leave' && !file) {
      toast('Sick leave requires a medical certificate — attach a file', 'error'); return;
    }

    createMutation.mutate({
      ...(empId && { employee: empId }),
      request_type: form.request_type as HRRequest['request_type'],
      reason: form.reason,
      ...(asDays && {
        start_date: form.start_date,
        end_date:   form.end_date,
        days:       form.days || String(calcDays(form.start_date, form.end_date, workingDays)),
      }),
      ...(asHourly && {
        start_date: form.start_date, end_date: form.start_date,
        start_time: form.start_time, end_time: form.end_time,
      }),
      ...(isSingleDate && {
        start_date: form.start_date, end_date: form.start_date,
        punch_kind: form.punch_kind as HRRequest['punch_kind'],
        start_time: form.start_time,
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
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>Use &quot;+ New Request&quot; to submit your first one.</p>
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
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                  {req.status === 'pending' && (isSelf || isAdmin) && (
                    <button
                      onClick={e => { e.stopPropagation(); cancelMutation.mutate(req.id); }}
                      disabled={cancelMutation.isPending}
                      style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      Cancel
                    </button>
                  )}
                  {/* Admin-only delete — for clearing test data without touching the DB. */}
                  {isAdmin && (
                    <button
                      onClick={async e => {
                        e.stopPropagation();
                        if (await confirm('Delete this request permanently? This cannot be undone.'))
                          deleteMutation.mutate(req.id);
                      }}
                      disabled={deleteMutation.isPending}
                      style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--status-error, #b91c1c)', background: 'none', cursor: 'pointer', color: 'var(--status-error, #b91c1c)' }}>
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: 'var(--space-3) var(--space-5) var(--space-4)', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {req.approval_instance_id && req.status === 'pending' && req.current_approval_step && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--status-warning)', background: 'var(--status-warning-bg)', padding: '2px 8px', borderRadius: 99, fontWeight: 'var(--weight-medium)' }}>
                        Step {req.current_approval_step.step_order}
                      </span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        Awaiting {STRATEGY_LABEL[req.current_approval_step.strategy] || req.current_approval_step.strategy} approval
                      </span>
                    </div>
                  )}
                  {req.status === 'approved' && (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--status-success)', margin: 0 }}>
                      Approved{req.approver_name ? ` by ${req.approver_name}` : ''}{req.approved_at ? ` on ${fmtDate(req.approved_at)}` : ''}
                    </p>
                  )}
                  {req.status === 'rejected' && req.reject_reason && (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', margin: 0 }}>
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
                    RAISABLE_TYPES.map(code => ({ code, name: TYPE_LABELS[code], id: 0, name_ar: '', description: '', is_active: true }))
                  ).map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
                </select>
              </div>

              {/* 'both' types: let the employee pick full-day vs hourly. */}
              {mode === 'both' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['Full day', false], ['Hourly', true]].map(([label, hourly]) => (
                    <button key={String(label)} type="button" onClick={() => setBothHourly(hourly as boolean)}
                      style={{ flex: 1, padding: '7px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${bothHourly === hourly ? 'var(--brand)' : 'var(--border-subtle)'}`,
                        background: bothHourly === hourly ? 'var(--brand)' : 'transparent',
                        color: bothHourly === hourly ? '#fff' : 'var(--text-secondary)' }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {asDays && (
                <>
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
                  <div className="form-field">
                    <label className="form-label">
                      Days
                      {form.start_date && form.end_date && (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginLeft: 'var(--space-2)', fontWeight: 'var(--weight-normal)' }}>(auto-calculated)</span>
                      )}
                    </label>
                    <input className="form-input" type="number" min="0.5" step="0.5" value={form.days} onChange={updateForm('days')} placeholder="e.g. 3" />
                  </div>
                </>
              )}

              {/* Hourly permission — one day + a time window. */}
              {asHourly && (
                <>
                  <div className="form-field">
                    <label className="form-label">Date *</label>
                    <input className="form-input" type="date" value={form.start_date} onChange={updateForm('start_date')} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className="form-field">
                      <label className="form-label">From *</label>
                      <input className="form-input" type="time" value={form.start_time} onChange={updateForm('start_time')} />
                    </div>
                    <div className="form-field">
                      <label className="form-label">To *</label>
                      <input className="form-input" type="time" value={form.end_time} onChange={updateForm('end_time')} />
                    </div>
                  </div>
                  {hourlyHours > 0 && (
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                      Duration: <b style={{ color: 'var(--text-primary)' }}>{hourlyHours} hour{hourlyHours !== 1 ? 's' : ''}</b>
                    </p>
                  )}
                </>
              )}

              {/* Missing punch — a single recent day + which punch + time(s). */}
              {isSingleDate && (
                <>
                  <div className="form-field">
                    <label className="form-label">Day of the missing punch *</label>
                    <input className="form-input" type="date"
                      value={form.start_date}
                      min={ymdDaysAgo(backdateLimit)} max={ymdDaysAgo(0)}
                      onChange={updateForm('start_date')} />
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                      {backdateHint} Older days must be corrected by HR.
                    </p>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Which punch was missed? *</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {([['clock_in', 'Clocking-In'], ['clock_out', 'Clocking-Out'], ['break_out', 'Break-Out'], ['break_in', 'Break-In']] as const).map(([val, label]) => (
                        <button key={val} type="button" onClick={() => setForm(p => ({ ...p, punch_kind: val }))}
                          style={{ padding: '9px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
                            border: `1px solid ${form.punch_kind === val ? 'var(--brand)' : 'var(--border-subtle)'}`,
                            background: form.punch_kind === val ? 'var(--brand)' : 'transparent',
                            color: form.punch_kind === val ? '#fff' : 'var(--text-secondary)' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Time *</label>
                    <input className="form-input" type="time" value={form.start_time} onChange={updateForm('start_time')} />
                  </div>
                </>
              )}

              <div className="form-field">
                <label className="form-label">Reason *</label>
                <textarea className="form-textarea" rows={3}
                  value={form.reason}
                  onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                  placeholder={form.request_type === 'missing_punch'
                    ? 'e.g. Forgot to clock out — left at 6:00 PM' : 'Details of your request…'}
                />
              </div>

              {mode === 'none' && !isSingleDate && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, background: 'var(--surface-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                  This request type doesn&apos;t require specific dates and will be routed for approval after submission.
                </p>
              )}

              {/* Attachment — a styled uploader (the raw file input looked unfinished);
                  required for sick leave (medical certificate). */}
              <div className="form-field">
                <label className="form-label">
                  {form.request_type === 'sick_leave'
                    ? 'Medical Certificate *' : 'Attachment (optional)'}
                </label>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-4)', border: '1.5px dashed var(--border-default)',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'var(--surface-subtle)',
                }}>
                  <span style={{
                    fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
                    padding: '4px 12px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--card-bg)', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)', whiteSpace: 'nowrap',
                  }}>Choose file</span>
                  <span style={{ fontSize: 'var(--text-sm)', color: file ? 'var(--text-primary)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file ? file.name : 'PDF or image, up to 20 MB'}
                  </span>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={e => {
                      const f = e.target.files?.[0] ?? null;
                      if (f) {
                        if (!/\.(pdf|png|jpe?g|webp)$/i.test(f.name)) {
                          toast('Only PDF or image files (PDF, PNG, JPG, WEBP) are allowed', 'error');
                          e.target.value = ''; return;
                        }
                        if (f.size > 20 * 1024 * 1024) {
                          toast('File is too large — maximum 20 MB', 'error');
                          e.target.value = ''; return;
                        }
                      }
                      setFile(f);
                    }}
                    style={{ display: 'none' }} />
                </label>
                {form.request_type === 'sick_leave' && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                    Sick leave must include a medical certificate.
                  </p>
                )}
                {file && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '4px 0 0' }}>{file.name}</p>}
              </div>
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

function TypeSummary({ userId, empId }: { userId: number; empId?: number }) {
  const { data: requestsData } = useQuery({
    queryKey: ['my-requests', userId, empId, ''],
    queryFn:  () => hrRequestsApi.getAll({ ...(empId ? { employee: empId } : {}) }),
    enabled:  !!userId && !!empId,
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
                  <span style={{ fontSize: 'var(--text-xs)', background: 'var(--status-warning-bg)', color: 'var(--status-warning)', padding: '1px 6px', borderRadius: 99, fontWeight: 'var(--weight-semibold)' }}>
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

  // Tab-badge count — scope to this profile's employee too (same as the list &
  // summary), otherwise an admin's badge shows everyone's count.
  const { data: myData } = useQuery({
    queryKey: ['my-requests', userId, empId, ''],
    queryFn:  () => hrRequestsApi.getAll({ ...(empId ? { employee: empId } : {}) }),
    enabled:  !!userId && !!empId,
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
            background: active && isApproval && count > 0 ? 'var(--status-warning-bg)' : 'var(--surface-subtle)',
            color:      active && isApproval && count > 0 ? 'var(--status-warning)'  : 'var(--text-secondary)',
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
        <TypeSummary userId={userId} empId={empId} />
      </div>
    </div>
  );
}
