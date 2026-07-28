'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrRequestsApi, hrApprovalsApi } from '@/lib/api/hr';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { useMyEmployeeRecord } from '@/lib/hooks/use-my-employee-record';
import { useLocale } from '@/lib/hooks/use-locale';
import { resolveRequestTypeLabel } from '@/lib/hr/request-type-label';
import { ProcField } from '@/components/procurement/shared/ProcField';
import { ApprovalStatusWidget } from '@/components/ui/ApprovalStatusWidget';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { Button, Badge, Loader, PageHeader, PageShell, Avatar } from '@/components/ui';

const PUNCH_KIND_LABEL: Record<string, string> = {
  clock_in: 'Clocking-In', clock_out: 'Clocking-Out', break_out: 'Break-Out', break_in: 'Break-In',
};
import { useState } from 'react';

const STATUS_VARIANT: Record<string, string> = {
  pending: 'warning', approved: 'success', rejected: 'error', cancelled: 'default',
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const fmtShort = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) : '—';
const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const t24 = (t?: string | null) => (t ? t.slice(0, 5) : '');
const t12 = (t?: string | null) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  let hh = parseInt(h, 10);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  return `${hh}:${m} ${ampm}`;
};
const isImageName = (n?: string) => !!n && /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(n);

export default function HRRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { hasPermission } = useMyPermissions();
  const { emp: myEmp } = useMyEmployeeRecord();
  const { isArabic } = useLocale();
  const canApprove = hasPermission('hr.hr_request.approve');
  const canReject  = hasPermission('hr.hr_request.reject');
  const canCancel  = hasPermission('hr.hr_request.cancel');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const { data: req, isLoading, error } = useQuery({
    queryKey: ['hr-request', id],
    queryFn: () => hrRequestsApi.getById(Number(id)),
  });

  const { data: requestTypes } = useQuery({
    queryKey: ['hr-request-types'],
    queryFn: hrApprovalsApi.getRequestTypes,
    staleTime: 10 * 60 * 1000,
  });

  const approveMutation = useMutation({
    mutationFn: () => hrRequestsApi.approve(Number(id)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-request', id] }); toast('Request approved', 'success'); },
    onError: () => toast('Failed to approve', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => hrRequestsApi.reject(Number(id), reason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-request', id] }); toast('Request rejected', 'success'); setShowRejectInput(false); },
    onError: () => toast('Failed to reject', 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => hrRequestsApi.cancel(Number(id)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-request', id] }); toast('Request cancelled', 'info'); },
    onError: () => toast('Failed to cancel', 'error'),
  });

  const handleApprove = async () => {
    if (await confirm('Approve this request?')) approveMutation.mutate();
  };
  const handleCancel = async () => {
    if (await confirm('Cancel this request? The employee will be notified.')) cancelMutation.mutate();
  };

  if (isLoading) return <MainLayout><div className="card empty-state"><Loader /></div></MainLayout>;
  if (error || !req) return <MainLayout><div className="card empty-state"><p style={{ color: 'var(--color-error)', margin: 0 }}>Request not found.</p></div></MainLayout>;

  const typeLabel = resolveRequestTypeLabel(req.request_type, requestTypes, isArabic);
  const statusVariant = (STATUS_VARIANT[req.status] as import('@/components/ui/Badge').BadgeProps['variant']) || 'default';

  const hoursNum = req.hours != null ? Number(req.hours) : 0;
  const daysNum  = req.days  != null ? Number(req.days)  : 0;
  const isHourly = hoursNum > 0 && !!req.start_time && !!req.end_time;
  const isMissingPunch = req.request_type === 'missing_punch';

  // Headline KPI tiles adapt to how the request measures time (hours vs days).
  type Tile = { value: string; label: string; sub?: string; accent?: boolean };
  const tiles: Tile[] = [];
  if (isHourly) {
    tiles.push({ value: `${hoursNum}`, label: hoursNum === 1 ? 'Hour' : 'Hours', sub: `${t24(req.start_time)}–${t24(req.end_time)}`, accent: true });
    tiles.push({ value: fmtShort(req.start_date), label: 'Date' });
  } else if (isMissingPunch && req.start_date) {
    tiles.push({ value: fmtShort(req.start_date), label: 'Day', accent: true });
  } else if (req.start_date) {
    if (daysNum > 0) tiles.push({ value: `${daysNum}`, label: daysNum === 1 ? 'Day' : 'Days', sub: `${fmtShort(req.start_date)} – ${fmtShort(req.end_date)}`, accent: true });
    else tiles.push({ value: fmtShort(req.start_date), label: 'Date' });
  }
  tiles.push({ value: fmtShort(req.created_at), label: 'Submitted' });

  // Request Details fields (precise values; tiles are the at-a-glance summary).
  // The employee is shown in its own photo card above, so it's omitted here.
  const details: { label: string; value: string }[] = [
    { label: 'Type', value: typeLabel },
    { label: isMissingPunch ? 'Serial No.' : 'Request No.', value: isMissingPunch ? `MP-${String(req.id).padStart(6, '0')}` : `#${req.id}` },
  ];
  if (isHourly) {
    details.push({ label: 'Date', value: fmtDate(req.start_date) });
    details.push({ label: 'Time', value: `${t12(req.start_time)} – ${t12(req.end_time)}` });
    details.push({ label: 'Hours', value: `${hoursNum}` });
  } else if (isMissingPunch) {
    details.push({ label: 'Attendance Date', value: fmtDate(req.start_date) });
    if (req.punch_kind) {
      details.push({
        label: 'Requested punch',
        value: `${PUNCH_KIND_LABEL[req.punch_kind] || req.punch_kind}${req.start_time ? ` · ${t12(req.start_time)}` : ''}`,
      });
    }
  } else if (req.start_date) {
    details.push({ label: 'Start Date', value: fmtDate(req.start_date) });
    details.push({ label: 'End Date', value: fmtDate(req.end_date) });
    if (daysNum > 0) details.push({ label: 'Days', value: `${daysNum}` });
  }

  const attachments = req.attachments ?? [];
  const isOwner = req.employee === myEmp?.id;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={typeLabel}
          description={`${req.employee_name} · ${req.employee_id_code}`}
          breadcrumbs={[{ label: 'HR' }, { label: 'Requests', href: '/hr/requests' }, { label: `#${req.id}` }]}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Badge variant={statusVariant}>{req.status.toUpperCase()}</Badge>
              {req.status === 'pending' && (
                <>
                  {canApprove && <Button variant="success" size="sm" onClick={handleApprove} isLoading={approveMutation.isPending}>Approve</Button>}
                  {canReject  && <Button variant="destructive" size="sm" onClick={() => setShowRejectInput(!showRejectInput)}>Reject</Button>}
                  {(canCancel || isOwner) && (
                    <Button variant="secondary" size="sm" onClick={handleCancel} isLoading={cancelMutation.isPending}>Cancel</Button>
                  )}
                </>
              )}
            </div>
          }
        />

        {/* Headline facts */}
        <div className="proc-kpi-bar">
          {tiles.map(t => (
            <div key={t.label} className={`proc-kpi-card${t.accent ? ' proc-kpi-card--info' : ''}`}>
              <div className="proc-kpi-value">{t.value}</div>
              <div className="proc-kpi-label">{t.label}</div>
              {t.sub && <div className="proc-kpi-sub">{t.sub}</div>}
            </div>
          ))}
        </div>

        {/* Body: details + reason (main)  ·  approval + attachments (side) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
          {/* MAIN */}
          <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Employee card */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <Avatar src={req.employee_avatar} name={req.employee_name} size={64} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  {req.employee_name}
                </div>
                {req.employee_name_ar && (
                  <div dir="rtl" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>{req.employee_name_ar}</div>
                )}
                {(req.employee_position || req.employee_department) && (
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>
                    {[req.employee_position, req.employee_department].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Employment number:{' '}
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{req.employee_id_code}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="proc-section-head"><h3 className="proc-section-title">Request Details</h3></div>
              <div className="proc-info-grid">
                {details.map(d => <ProcField key={d.label} label={d.label} value={d.value} />)}
              </div>
            </div>

            {req.reason && (
              <div className="card">
                <div className="proc-section-head"><h3 className="proc-section-title">Reason</h3></div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{req.reason}</p>
              </div>
            )}

            {req.notes && (
              <div className="card">
                <div className="proc-section-head"><h3 className="proc-section-title">Notes</h3></div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{req.notes}</p>
              </div>
            )}

            {req.reject_reason && (
              <div className="card" style={{ borderInlineStart: '3px solid var(--status-error)', background: 'var(--status-error-bg)' }}>
                <div className="proc-section-head" style={{ borderInlineStart: 'none', paddingInlineStart: 0 }}><h3 className="proc-section-title" style={{ color: 'var(--status-error)' }}>Rejection Reason</h3></div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{req.reject_reason}</p>
              </div>
            )}
          </div>

          {/* SIDE */}
          <div style={{ flex: '1 1 300px', minWidth: 0, maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="card">
              <div className="proc-section-head"><h3 className="proc-section-title">Approval</h3></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="proc-info-label" style={{ marginBottom: 0 }}>Status</span>
                  <Badge variant={statusVariant}>{req.status.toUpperCase()}</Badge>
                </div>
                {req.status === 'pending' && req.current_approval_step && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    Awaiting approval — step {req.current_approval_step.step_order}
                  </div>
                )}
                <ProcField label="Submitted" value={fmtDateTime(req.created_at)} />
                <ProcField label="Approver" value={req.approver_name || '—'} />
                {req.approved_at && <ProcField label="Approved At" value={<span style={{ color: 'var(--status-success)' }}>{fmtDateTime(req.approved_at)}</span>} />}
                {req.rejected_at && <ProcField label="Rejected At" value={<span style={{ color: 'var(--status-error)' }}>{fmtDateTime(req.rejected_at)}</span>} />}
              </div>
            </div>

            {req.approval_status && (
              <div className="card">
                <div className="proc-section-head"><h3 className="proc-section-title">Approval Cycle</h3></div>
                <ApprovalStatusWidget approvalStatus={req.approval_status} />
              </div>
            )}

            {attachments.length > 0 && (
              <div className="card">
                <div className="proc-section-head"><h3 className="proc-section-title">Attachments</h3></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {attachments.map(att => (
                    isImageName(att.name) && att.url ? (
                      <div key={att.id}>
                        <img
                          src={att.url}
                          alt={att.name}
                          onClick={() => window.open(att.url!, '_blank')}
                          style={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-inset)', cursor: 'pointer', display: 'block' }}
                        />
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 'var(--space-1) 0 0' }}>{att.name}</p>
                      </div>
                    ) : (
                      <a key={att.id} href={att.url ?? '#'} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-inset)', textDecoration: 'none', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                        <span aria-hidden>📄</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{att.name}</span>
                        {att.size > 0 && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{Math.round(att.size / 1024)} KB</span>}
                      </a>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {showRejectInput && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>Rejection Reason</p>
            <textarea
              className="form-textarea"
              rows={3} placeholder="Rejection reason (required)..."
              value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button variant="destructive" size="sm"
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                isLoading={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate(rejectReason)}>
                Confirm Rejection
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setShowRejectInput(false); setRejectReason(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
}
