'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrAttendanceApi, hrWorkTeamsApi } from '@/lib/api/hr';
import { projectsApi } from '@/lib/api/projects';
import {
  getAttendanceWorklogs,
  createWorklog,
  submitWorklog,
  approveWorklog,
  rejectWorklog,
  type CreateWorkLogPayload,
} from '@/lib/api/worklogs';
import { Badge, BaseModal, Loader, PageHeader, PageShell } from '@/components/ui';
import { WorkLog } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';

const STATUS_VARIANT: Record<string, string> = {
  present: 'success', absent: 'error', late: 'warning',
  half_day: 'info', holiday: 'default', on_leave: 'default',
};

const WORKLOG_STATUS_LABEL: Record<WorkLog['status'], string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

const WORKLOG_STATUS_COLOR: Record<WorkLog['status'], string> = {
  draft: 'var(--text-secondary)',
  pending_review: '#B45309',
  approved: '#16A34A',
  rejected: '#DC2626',
};

const WORKLOG_STATUS_BG: Record<WorkLog['status'], string> = {
  draft: 'var(--surface-subtle)',
  pending_review: '#FEF3C7',
  approved: '#DCFCE7',
  rejected: '#FEE2E2',
};

const fmtTime = (dt: string | null) =>
  dt ? new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1-5)',
};

// ── Reject Reason Modal ───────────────────────────────────────────────────────
function RejectReasonModal({
  onClose,
  onReject,
  isLoading,
}: {
  onClose: () => void;
  onReject: (reason: string) => void;
  isLoading: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <BaseModal isOpen onClose={onClose} title="Reject WorkLog" size="sm">
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4)' }}>
        Provide a reason for rejecting this worklog entry.
      </p>
      <div style={fieldStyle}>
        <label style={labelStyle}>Rejection Reason</label>
        <textarea
          className="form-input"
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          style={{ resize: 'vertical', minHeight: 80, fontFamily: 'inherit' }}
          placeholder="Explain why this worklog is being rejected…"
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
        <button
          type="button" onClick={onClose} disabled={isLoading}
          style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => { if (reason.trim()) onReject(reason.trim()); }}
          disabled={isLoading || !reason.trim()}
          style={{ padding: '7px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: '#DC2626', color: '#fff', cursor: isLoading || !reason.trim() ? 'default' : 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', opacity: isLoading || !reason.trim() ? 0.7 : 1 }}
        >
          {isLoading ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
    </BaseModal>
  );
}

// ── Add WorkLog Modal ─────────────────────────────────────────────────────────
function AddWorkLogModal({
  attendanceId,
  employeeId,
  date,
  onClose,
  onSave,
  isLoading,
}: {
  attendanceId: number;
  employeeId: number;
  date: string;
  onClose: () => void;
  onSave: (payload: CreateWorkLogPayload) => void;
  isLoading: boolean;
}) {
  const [projectId, setProjectId] = useState<string>('');
  const [workTeamId, setWorkTeamId] = useState<string>('');
  const [hours, setHours] = useState<string>('');
  const [overtimeHours, setOvertimeHours] = useState<string>('0');
  const [notes, setNotes] = useState('');

  const { data: projectsData } = useQuery({
    queryKey: ['projects-dropdown'],
    queryFn: () => projectsApi.getAll({ page_size: 200, is_active: true }),
    staleTime: 60_000,
  });

  const { data: teamsData } = useQuery({
    queryKey: ['work-teams-dropdown'],
    queryFn: () => hrWorkTeamsApi.getAll({ is_active: true }),
    staleTime: 60_000,
  });

  const projects = projectsData?.results ?? [];
  const teams = teamsData?.results ?? [];

  const handleSave = () => {
    const h = parseFloat(hours);
    if (!hours || isNaN(h) || h <= 0) {
      toast('Hours must be a positive number', 'error');
      return;
    }
    onSave({
      employee: employeeId,
      attendance: attendanceId,
      date,
      project: projectId ? Number(projectId) : null,
      work_team: workTeamId ? Number(workTeamId) : null,
      hours: h,
      overtime_hours: parseFloat(overtimeHours) || 0,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <BaseModal isOpen onClose={onClose} title="Add Work Allocation" size="sm">
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '-4px 0 var(--space-4)' }}>
        {date} — Log hours worked on a project or team
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Project <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span></label>
          <select className="form-input" value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">— None —</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Work Team <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span></label>
          <select className="form-input" value={workTeamId} onChange={e => setWorkTeamId(e.target.value)}>
            <option value="">— None —</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Hours <span style={{ color: '#DC2626' }}>*</span></label>
            <input
              type="number" className="form-input" value={hours} step="0.5" min="0.5" max="24"
              onChange={e => setHours(e.target.value)}
              placeholder="e.g. 8"
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Overtime Hours</label>
            <input
              type="number" className="form-input" value={overtimeHours} step="0.5" min="0" max="24"
              onChange={e => setOvertimeHours(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Notes <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span></label>
          <textarea
            className="form-input" value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} style={{ resize: 'vertical', minHeight: 60, fontFamily: 'inherit' }}
            placeholder="Work description or remarks…"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
          <button
            type="button" onClick={onClose} disabled={isLoading}
            style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}
          >
            Cancel
          </button>
          <button
            type="button" onClick={handleSave} disabled={isLoading}
            style={{ padding: '7px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--brand)', color: 'var(--primary-foreground)', cursor: isLoading ? 'default' : 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', opacity: isLoading ? 0.7 : 1 }}
          >
            {isLoading ? 'Saving…' : 'Add WorkLog'}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

// ── WorkLog Status Pill ───────────────────────────────────────────────────────
function WorkLogStatusPill({ status }: { status: WorkLog['status'] }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 999,
      fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
      color: WORKLOG_STATUS_COLOR[status],
      background: WORKLOG_STATUS_BG[status],
    }}>
      {WORKLOG_STATUS_LABEL[status]}
    </span>
  );
}

// ── Work Allocation Section ───────────────────────────────────────────────────
function WorkAllocationSection({
  attendanceId,
  employeeId,
  date,
  totalWorkHours,
}: {
  attendanceId: number;
  employeeId: number;
  date: string;
  totalWorkHours: number | null;
}) {
  const qc = useQueryClient();
  const { hasPermission } = useMyPermissions();
  const canApprove = hasPermission('hr.hr_attendance.update');

  const [expanded, setExpanded] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);

  const { data: worklogs = [], isLoading, error } = useQuery({
    queryKey: ['attendance-worklogs', attendanceId],
    queryFn: () => getAttendanceWorklogs(attendanceId),
    enabled: expanded,
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['attendance-worklogs', attendanceId] });

  const createMutation = useMutation({
    mutationFn: (payload: CreateWorkLogPayload) => createWorklog(payload),
    onSuccess: () => { invalidate(); setShowAddModal(false); toast('WorkLog added', 'success'); },
    onError: () => toast('Failed to add worklog', 'error'),
  });

  const submitMutation = useMutation({
    mutationFn: (id: number) => submitWorklog(id),
    onSuccess: () => { invalidate(); toast('WorkLog submitted for review', 'success'); },
    onError: () => toast('Failed to submit worklog', 'error'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => approveWorklog(id),
    onSuccess: () => { invalidate(); toast('WorkLog approved', 'success'); },
    onError: () => toast('Failed to approve worklog', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => rejectWorklog(id, reason),
    onSuccess: () => { invalidate(); setRejectTarget(null); toast('WorkLog rejected', 'success'); },
    onError: () => toast('Failed to reject worklog', 'error'),
  });

  const totalAllocated = useMemo(
    () => +worklogs.reduce((sum, w) => sum + (parseFloat(w.hours) || 0), 0).toFixed(2),
    [worklogs],
  );

  const approvedCost = useMemo(
    () => +worklogs
      .filter(w => w.status === 'approved')
      .reduce((sum, w) => sum + (parseFloat(w.cost_amount) || 0), 0)
      .toFixed(2),
    [worklogs],
  );

  const remaining = totalWorkHours != null ? +(totalWorkHours - totalAllocated).toFixed(2) : null;
  const isOverAllocated = totalWorkHours != null && totalAllocated > totalWorkHours;

  const smallBtnBase: React.CSSProperties = {
    fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
    padding: '3px 10px', borderRadius: 'var(--radius-sm)',
    border: '1px solid transparent', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 4,
    transition: 'opacity 0.12s',
  };

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
      {/* Section header — toggle */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand)' }}>
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
            Work Allocation
          </span>
          {expanded && worklogs.length > 0 && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              {totalAllocated}h allocated{totalWorkHours != null ? ` / ${totalWorkHours}h total` : ''}
            </span>
          )}
          {approvedCost > 0 && expanded && (
            <span style={{ fontSize: 'var(--text-xs)', color: '#16A34A', fontWeight: 'var(--weight-semibold)' }}>
              · AED {approvedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} approved cost
            </span>
          )}
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--text-secondary)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

          {/* Hours allocation summary */}
          {totalWorkHours != null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--surface-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                  <div>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 2px 0' }}>Allocated</p>
                    <p style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', fontFamily: 'monospace', margin: 0 }}>{totalAllocated}h</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 2px 0' }}>Total Work Hours</p>
                    <p style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', fontFamily: 'monospace', margin: 0 }}>{totalWorkHours}h</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 2px 0' }}>Remaining</p>
                    <p style={{
                      fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', fontFamily: 'monospace', margin: 0,
                      color: isOverAllocated ? '#DC2626' : remaining === 0 ? '#16A34A' : 'var(--text-primary)',
                    }}>
                      {remaining !== null ? (isOverAllocated ? `+${Math.abs(remaining)}h over` : `${remaining}h`) : '—'}
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: 'var(--text-xs)', color: isOverAllocated ? '#DC2626' : 'var(--text-secondary)', fontWeight: 'var(--weight-medium)' }}>
                  {totalWorkHours > 0 ? Math.round((totalAllocated / totalWorkHours) * 100) : 0}%
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ width: '100%', height: 8, borderRadius: 999, background: 'var(--border-subtle)', overflow: 'visible', position: 'relative' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  background: isOverAllocated ? '#DC2626' : totalAllocated >= totalWorkHours ? '#16A34A' : 'var(--brand)',
                  width: `${Math.min((totalAllocated / totalWorkHours) * 100, 100)}%`,
                  transition: 'width 0.3s ease',
                }} />
              </div>

              {isOverAllocated && (
                <p style={{ fontSize: 'var(--text-xs)', color: '#DC2626', fontWeight: 'var(--weight-medium)', margin: 0 }}>
                  Warning: Allocated hours exceed total work hours by {Math.abs(remaining!)}h
                </p>
              )}
            </div>
          )}

          {/* Add WorkLog button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              style={{ ...smallBtnBase, background: 'var(--brand)', color: 'var(--primary-foreground)', border: 'none', padding: '6px 14px', fontSize: 'var(--text-xs)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add WorkLog
            </button>
          </div>

          {/* Worklog list */}
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-6)' }}>
              <Loader />
            </div>
          ) : error ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-error)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
              Failed to load worklogs.
            </p>
          ) : worklogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6) 0', color: 'var(--text-tertiary)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto var(--space-2)', display: 'block' }}>
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>No work allocations yet</p>
              <p style={{ fontSize: 'var(--text-xs)', margin: '4px 0 0' }}>Click "Add WorkLog" to log hours for this day.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {/* Header row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 70px 70px 120px auto',
                gap: 'var(--space-2)',
                padding: '6px var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-subtle)',
              }}>
                {['Project', 'Team', 'Hours', 'OT Hrs', 'Status', ''].map((h, i) => (
                  <span key={i} style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
                ))}
              </div>

              {/* Worklog rows */}
              {worklogs.map(wl => (
                <div
                  key={wl.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 70px 70px 120px auto',
                    gap: 'var(--space-2)',
                    padding: '8px var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-primary)',
                    alignItems: 'center',
                  }}
                >
                  {/* Project */}
                  <div style={{ minWidth: 0 }}>
                    {wl.project_name ? (
                      <>
                        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wl.project_name}</p>
                        {wl.project_code && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '1px 0 0', fontFamily: 'monospace' }}>{wl.project_code}</p>}
                      </>
                    ) : (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </div>

                  {/* Team */}
                  <div style={{ minWidth: 0 }}>
                    {wl.work_team_name ? (
                      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wl.work_team_name}</p>
                    ) : (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </div>

                  {/* Hours */}
                  <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>{parseFloat(wl.hours).toFixed(1)}h</span>

                  {/* OT Hours */}
                  <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: parseFloat(wl.overtime_hours) > 0 ? 'var(--brand)' : 'var(--text-tertiary)' }}>
                    {parseFloat(wl.overtime_hours) > 0 ? `${parseFloat(wl.overtime_hours).toFixed(1)}h` : '—'}
                  </span>

                  {/* Status pill */}
                  <WorkLogStatusPill status={wl.status} />

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexShrink: 0 }}>
                    {wl.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => submitMutation.mutate(wl.id)}
                        disabled={submitMutation.isPending}
                        style={{ ...smallBtnBase, background: 'var(--brand)', color: 'var(--primary-foreground)', borderColor: 'var(--brand)', opacity: submitMutation.isPending ? 0.7 : 1 }}
                      >
                        Submit
                      </button>
                    )}
                    {wl.status === 'pending_review' && canApprove && (
                      <>
                        <button
                          type="button"
                          onClick={() => approveMutation.mutate(wl.id)}
                          disabled={approveMutation.isPending}
                          style={{ ...smallBtnBase, background: '#16A34A', color: '#fff', borderColor: '#16A34A', opacity: approveMutation.isPending ? 0.7 : 1 }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectTarget(wl.id)}
                          disabled={rejectMutation.isPending}
                          style={{ ...smallBtnBase, background: 'none', color: '#DC2626', borderColor: '#DC2626', opacity: rejectMutation.isPending ? 0.7 : 1 }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {wl.status === 'rejected' && wl.rejection_reason && (
                      <span style={{ fontSize: 'var(--text-xs)', color: '#DC2626', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={wl.rejection_reason}>
                        {wl.rejection_reason}
                      </span>
                    )}
                    {wl.status === 'approved' && parseFloat(wl.cost_amount) > 0 && (
                      <span style={{ fontSize: 'var(--text-xs)', color: '#16A34A', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        AED {parseFloat(wl.cost_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddWorkLogModal
          attendanceId={attendanceId}
          employeeId={employeeId}
          date={date}
          onClose={() => setShowAddModal(false)}
          onSave={payload => createMutation.mutate(payload)}
          isLoading={createMutation.isPending}
        />
      )}
      {rejectTarget !== null && (
        <RejectReasonModal
          onClose={() => setRejectTarget(null)}
          onReject={reason => rejectMutation.mutate({ id: rejectTarget, reason })}
          isLoading={rejectMutation.isPending}
        />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AttendanceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: record, isLoading, error } = useQuery({
    queryKey: ['hr-attendance', id],
    queryFn: () => hrAttendanceApi.getById(Number(id)),
  });

  if (isLoading) return <MainLayout><div className="card empty-state"><Loader /></div></MainLayout>;
  if (error || !record) return (
    <MainLayout>
      <div className="card empty-state">
        <p style={{ color: 'var(--color-error)', margin: 0 }}>Record not found.</p>
      </div>
    </MainLayout>
  );

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Attendance Record"
          description={`${record.employee_name} — ${new Date(record.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
          breadcrumbs={[{ label: 'HR' }, { label: 'Attendance', href: '/hr/attendance' }, { label: record.employee_name }]}
          actions={<Badge variant={(STATUS_VARIANT[record.status] as import('@/components/ui/Badge').BadgeProps['variant']) || 'default'}>{record.status.replace('_', ' ').toUpperCase()}</Badge>}
        />

        <div className="card" style={{ maxWidth: '42rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{record.employee_id_code}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
            <div style={{ textAlign: 'center', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-subtle)' }}>
              <p style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)', margin: '0 0 var(--space-2) 0' }}>Check In</p>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>{fmtTime(record.check_in)}</p>
              {record.check_in_address && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)', marginBottom: 0 }}>{record.check_in_address}</p>}
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-subtle)' }}>
              <p style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: '0 0 var(--space-2) 0' }}>Check Out</p>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>{fmtTime(record.check_out)}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', textAlign: 'center' }}>
            <div>
              <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>{record.work_hours?.toFixed(1) ?? '—'}</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)', marginBottom: 0 }}>Work Hours</p>
            </div>
            <div>
              <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>{record.overtime_hours?.toFixed(1) ?? '—'}</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)', marginBottom: 0 }}>Overtime Hours</p>
            </div>
            <div>
              <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>{record.duration_hours?.toFixed(1) ?? '—'}</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)', marginBottom: 0 }}>Duration</p>
            </div>
          </div>

          {(record.break_start || record.break_end) && (
            <div style={{ fontSize: 'var(--text-sm)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-6)' }}>
              <div><p style={{ color: 'var(--text-secondary)', margin: '0 0 var(--space-1) 0' }}>Break Start</p><p style={{ fontWeight: 'var(--weight-medium)', margin: 0 }}>{fmtTime(record.break_start)}</p></div>
              <div><p style={{ color: 'var(--text-secondary)', margin: '0 0 var(--space-1) 0' }}>Break End</p><p style={{ fontWeight: 'var(--weight-medium)', margin: 0 }}>{fmtTime(record.break_end)}</p></div>
            </div>
          )}

          {record.notes && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
              <p style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: '0 0 var(--space-1) 0' }}>Notes</p>
              <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>{record.notes}</p>
            </div>
          )}

          {/* Work Allocation */}
          <WorkAllocationSection
            attendanceId={record.id}
            employeeId={record.employee}
            date={record.date}
            totalWorkHours={record.work_hours}
          />
        </div>
      </PageShell>
    </MainLayout>
  );
}
