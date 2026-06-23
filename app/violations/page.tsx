'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { violationsApi } from '@/lib/api/violations';
import { projectsApi } from '@/lib/api/projects';
import { MunicipalViolation } from '@/types';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { PageHeader, PageShell, WorkspaceSurface } from '@/components/ui';

const FRONTEND_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://purchase-self.vercel.app';

/* ─── Status config ──────────────────────────────────────────────────────── */
const STATUS_CFG = {
  new:      { bg: '#FEF9C3', color: '#854D0E', dot: '#EAB308', border: '#FDE047', label: 'New' },
  notified: { bg: '#DBEAFE', color: '#1E3A8A', dot: '#3B82F6', border: '#93C5FD', label: 'Notified' },
  resolved: { bg: '#DCFCE7', color: '#14532D', dot: '#22C55E', border: '#86EFAC', label: 'Resolved' },
  fined:    { bg: '#FEE2E2', color: '#7F1D1D', dot: '#EF4444', border: '#FCA5A5', label: 'Fined' },
} as const;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function parseMessage(text: string) {
  const urlRx = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRx) ?? [];
  const body = text.replace(urlRx, '').replace(/\n{3,}/g, '\n\n').trim();
  return { body, urls };
}

/* StatCard removed — replaced by inline stat strip */

/* ─── Status badge ───────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.new;
  return (
    <span className="status-pill" style={{
      '--pill-color': cfg.color,
      '--pill-bg': cfg.bg,
      '--pill-border': cfg.border,
    } as React.CSSProperties}>
      <span className="status-pill-dot" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

/* ─── Info box ───────────────────────────────────────────────────────────── */
function InfoBox({ label, value, valueColor, bold }: { label: string; value: string; valueColor?: string; bold?: boolean }) {
  return (
    <div className="info-box">
      <div className="info-box-label">{label}</div>
      <div className="info-box-value" style={{ fontWeight: bold ? 700 : undefined, color: valueColor ?? undefined }}>{value}</div>
    </div>
  );
}

/* ─── Detail Panel ───────────────────────────────────────────────────────── */
function ViolationDetailPanel({
  violation, onClose, onResolve, onLinkProject, resolving, linking, projects,
}: {
  violation: MunicipalViolation;
  onClose: () => void;
  onResolve: (id: number) => void;
  onLinkProject: (id: number, projectId: number | null) => void;
  resolving: boolean;
  linking: boolean;
  projects: Array<{ id: number; name: string }>;
}) {
  const { body, urls } = parseMessage(violation.raw_message ?? '');
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>(violation.project?.toString() ?? '');

  useEffect(() => {
    setSelectedProject(violation.project?.toString() ?? '');
  }, [violation.id, violation.project]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${FRONTEND_URL}/resolve/${violation.resolve_token}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const deadlineColor = violation.deadline_days == null ? 'var(--text-tertiary)'
    : violation.deadline_days <= 1 ? 'var(--red-600, #DC2626)'
    : violation.deadline_days <= 3 ? 'var(--orange-600, #D97706)'
    : 'var(--green-700, #15803D)';

  return (
    <div className="detail-panel">
      {/* Header */}
      <div className="detail-panel-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-1)' }}>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
              Ref: {violation.reference_number || `#${violation.id}`}
            </span>
            <StatusBadge status={violation.status} />
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            {violation.sender} · {fmtDate(violation.received_at)}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1, borderRadius: 'var(--radius-md)' }}>✕</button>
      </div>

      {/* Scrollable body */}
      <div className="detail-panel-body">

        {/* Key facts grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
          <InfoBox label="Area" value={violation.area || '—'} />
          <InfoBox label="Sector" value={violation.sector || '—'} />
          <InfoBox label="Plot No." value={violation.plot || '—'} />
          {violation.fine_amount && (
            <InfoBox label="Fine" value={`${Number(violation.fine_amount).toLocaleString()} AED`} valueColor="var(--red-600, #DC2626)" bold />
          )}
          {violation.deadline_days != null && (
            <InfoBox label="Deadline" value={`${violation.deadline_days} days`} valueColor={deadlineColor} bold />
          )}
          {violation.violation_date && (
            <InfoBox label="Date" value={violation.violation_date} />
          )}
        </div>

        {/* Violation description (Arabic) */}
        {violation.violation_description && (
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'color-mix(in srgb, var(--yellow-400, #FACC15) 8%, var(--card-bg))',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid color-mix(in srgb, var(--yellow-400, #FACC15) 30%, transparent)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            direction: 'rtl', textAlign: 'right', lineHeight: 1.9,
            fontFamily: 'system-ui, Tahoma, Arial, sans-serif',
          }}>
            {violation.violation_description}
          </div>
        )}

        {/* Raw SMS */}
        <div>
          <div className="info-box-label" style={{ marginBottom: 'var(--space-2)' }}>Original SMS</div>
          <div style={{
            background: 'var(--surface-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-3) var(--space-4)',
            direction: 'rtl', textAlign: 'right',
            fontSize: 'var(--text-xs)', lineHeight: 2,
            color: 'var(--text-secondary)',
            fontFamily: 'system-ui, Tahoma, Arial, sans-serif',
            whiteSpace: 'pre-wrap', maxHeight: 180, overflowY: 'auto',
          }}>
            {body || violation.raw_message}
          </div>
          {urls.length > 0 && (
            <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" style={{
                  padding: '3px 10px', borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-subtle)',
                  color: 'var(--brand)',
                  border: '1px solid var(--border-default)',
                  fontSize: 11, fontWeight: 600, textDecoration: 'none',
                }}>
                  Open ADM Link ↗
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Project & Engineer */}
        <div>
          <div className="info-box-label" style={{ marginBottom: 'var(--space-2)' }}>Project & Engineer</div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              className="form-select"
              style={{ flex: 1 }}
            >
              <option value="">— No Project —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={() => onLinkProject(violation.id, selectedProject ? Number(selectedProject) : null)}
              disabled={linking || selectedProject === (violation.project?.toString() ?? '')}
              className="btn btn-primary"
              style={{ whiteSpace: 'nowrap', opacity: (linking || selectedProject === (violation.project?.toString() ?? '')) ? 0.5 : 1 }}
            >
              {linking ? '...' : 'Link'}
            </button>
          </div>
          {violation.engineer_name ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              background: 'color-mix(in srgb, var(--green-600, #16A34A) 8%, var(--card-bg))',
              borderRadius: 'var(--radius-md)',
              border: '1px solid color-mix(in srgb, var(--green-600, #16A34A) 25%, transparent)',
            }}>
              <div className="av-initials" style={{ width: 28, height: 28, fontSize: 11, background: 'var(--green-600, #16A34A)' }}>
                {violation.engineer_name[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>{violation.engineer_name}</div>
                <div style={{ fontSize: 10, color: 'var(--green-600, #16A34A)' }}>Responsible Engineer</div>
              </div>
            </div>
          ) : (
            <div style={{
              padding: 'var(--space-2) var(--space-3)',
              background: 'color-mix(in srgb, var(--yellow-400, #FACC15) 8%, var(--card-bg))',
              borderRadius: 'var(--radius-md)',
              border: '1px solid color-mix(in srgb, var(--yellow-400, #FACC15) 30%, transparent)',
              fontSize: 'var(--text-xs)', color: 'var(--text-secondary)',
            }}>
              No engineer assigned — link a project to auto-assign
            </div>
          )}
        </div>
      </div>

      {/* Action footer */}
      <div className="detail-panel-footer">
        {violation.status !== 'resolved' && (
          <button
            onClick={() => onResolve(violation.id)} disabled={resolving}
            className="btn btn-primary"
            style={{ flex: 1, background: 'var(--green-600, #16A34A)', opacity: resolving ? 0.7 : 1, cursor: resolving ? 'wait' : 'pointer' }}
          >
            ✓ Mark Resolved
          </button>
        )}
        <button
          onClick={copyLink}
          className="btn"
          style={{
            border: `1px solid ${copiedLink ? 'var(--green-400, #4ADE80)' : 'var(--border-default)'}`,
            background: copiedLink ? 'color-mix(in srgb, var(--green-500, #22C55E) 10%, var(--card-bg))' : 'var(--card-bg)',
            color: copiedLink ? 'var(--green-700, #15803D)' : 'var(--text-secondary)',
          }}
        >
          {copiedLink ? '✓ Copied' : 'Engineer Link'}
        </button>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function ViolationsPage() {
  const { user } = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const queryClient = useQueryClient();
  const [page, setPage]                 = useState(1);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId]     = useState<number | null>(null);
  const [testOpen, setTestOpen]         = useState(false);
  const [testMsg, setTestMsg]           = useState('');
  const [testResult, setTestResult]     = useState<null | { type: 'ok' | 'ignored' | 'error'; detail: string }>(null);
  const [selectedIds, setSelectedIds]   = useState<Set<number>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [confirmDelete, setConfirmDelete]   = useState(false);

  const isAdmin = isTenantAdmin || isPlatformAdmin;

  const { data: stats } = useQuery({
    queryKey: ['violations-stats'],
    queryFn: violationsApi.getStats,
    enabled: isAdmin,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['violations', page, search, statusFilter],
    queryFn: () => violationsApi.getAll({ page, search: search || undefined, status: statusFilter || undefined, page_size: 25 }),
    enabled: isAdmin,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => projectsApi.getAll({ page_size: 200 }),
    enabled: isAdmin,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['violations'] });
    queryClient.invalidateQueries({ queryKey: ['violations-stats'] });
  };

  const resolveMutation = useMutation({ mutationFn: (id: number) => violationsApi.markResolved(id), onSuccess: invalidate });
  const bulkMutation    = useMutation({ mutationFn: (ids: number[]) => violationsApi.bulkAction(ids, 'resolve'), onSuccess: () => { setSelectedIds(new Set()); setSelectAllPages(false); invalidate(); } });
  const bulkDeleteMutation = useMutation({
    mutationFn: () => selectAllPages ? violationsApi.deleteAll() : violationsApi.bulkAction(Array.from(selectedIds), 'delete'),
    onSuccess: () => { setSelectedIds(new Set()); setSelectAllPages(false); setSelectedId(null); setConfirmDelete(false); invalidate(); },
  });
  const linkMutation    = useMutation({ mutationFn: ({ id, projectId }: { id: number; projectId: number | null }) => violationsApi.linkProject(id, projectId), onSuccess: invalidate });

  const simulateMutation = useMutation({
    mutationFn: (msg: string) => violationsApi.simulate(msg),
    onSuccess: (res) => {
      if (res.status === 'ok') {
        setTestResult({ type: 'ok', detail: [res.reference && `Ref: ${res.reference}`, res.project ?? 'No project', res.engineer].filter(Boolean).join(' · ') });
        setTestMsg(''); invalidate();
      } else {
        setTestResult({ type: 'ignored', detail: res.reason ?? 'Not a violation message' });
      }
    },
    onError: () => setTestResult({ type: 'error', detail: 'An error occurred' }),
  });

  if (!isAdmin) return (
    <MainLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
        <p style={{ color: 'var(--text-secondary)' }}>You do not have permission to view this page.</p>
      </div>
    </MainLayout>
  );

  const violations: MunicipalViolation[] = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / 25);
  const allIds = violations.map(v => v.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
  const projects = (projectsData?.results ?? []).map((p: any) => ({ id: p.id, name: p.name || p.project_name || `Project ${p.id}` }));
  const selectedViolation = selectedId != null ? violations.find(v => v.id === selectedId) ?? null : null;

  const toggleAll = () => {
    if (allSelected) { setSelectedIds(p => { const s = new Set(p); allIds.forEach(id => s.delete(id)); return s; }); setSelectAllPages(false); }
    else             setSelectedIds(p => { const s = new Set(p); allIds.forEach(id => s.add(id)); return s; });
  };

  return (
    <MainLayout>
      <PageShell>

        <PageHeader
          title="Abu Dhabi Municipality Violations"
          description="Incoming ADM SMS notifications · automated tracking & assignment"
          count={stats?.total ?? null}
          breadcrumbs={[{ label: 'Violations' }]}
          actions={
            <button
              onClick={() => { setTestOpen(o => !o); setTestResult(null); }}
              style={{
                padding: '8px 16px', borderRadius: 9, border: '1.5px solid var(--border-default)',
                background: testOpen ? 'var(--surface-subtle)' : 'var(--surface-base)', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
              }}
            >
              🧪 Test SMS
            </button>
          }
        />

        {/* Inline stat strip — no cards, just clickable numbers */}
        {stats && (
          <div className="stat-strip">
            {([
              { id: '',         label: 'Total',    value: stats.total,    color: 'var(--text-primary)' },
              { id: 'new',      label: 'New',      value: stats.new,      color: STATUS_CFG.new.color },
              { id: 'notified', label: 'Notified', value: stats.notified, color: STATUS_CFG.notified.color },
              { id: 'resolved', label: 'Resolved', value: stats.resolved, color: STATUS_CFG.resolved.color },
              { id: 'fined',    label: 'Fined',    value: stats.fined,    color: STATUS_CFG.fined.color },
            ]).map((s, i) => (
              <React.Fragment key={s.id}>
                {i > 0 && <span className="stat-strip-divider" />}
                <button
                  onClick={() => { setStatusFilter(s.id); setPage(1); }}
                  className={`stat-strip-item${statusFilter === s.id ? ' active' : ''}`}
                >
                  <span className="stat-strip-value" style={{ color: s.color }}>{s.value}</span>
                  <span className="stat-strip-label">{s.label}</span>
                </button>
              </React.Fragment>
            ))}
            {stats.no_project > 0 && (
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--radius-md)', background: 'var(--status-warning-bg)', border: '1px solid var(--status-warning-border)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--status-warning)', whiteSpace: 'nowrap' }}>
                ⚠ {stats.no_project} unlinked
              </span>
            )}
          </div>
        )}

        {/* Test panel */}
        {testOpen && (
          <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#92400E' }}>Test SMS Message</p>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#B45309' }}>Paste an ADM SMS text to test parsing and the full notification pipeline</p>
            </div>
            <textarea value={testMsg} onChange={e => { setTestMsg(e.target.value); setTestResult(null); }}
              placeholder="Paste message text here..." rows={4}
              style={{ padding: 12, borderRadius: 8, border: '1.5px solid #FDE68A', resize: 'vertical', direction: 'rtl', fontSize: 13, fontFamily: 'system-ui, Tahoma, Arial, sans-serif', background: '#fff', width: '100%', boxSizing: 'border-box' }} />
            {testResult && (
              <div style={{
                padding: '9px 13px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                background: testResult.type === 'ok' ? '#DCFCE7' : testResult.type === 'ignored' ? '#FEF9C3' : '#FEE2E2',
                color:      testResult.type === 'ok' ? '#14532D' : testResult.type === 'ignored' ? '#854D0E' : '#7F1D1D',
              }}>
                {testResult.type === 'ok' ? '✓ ' : testResult.type === 'ignored' ? '⊘ ' : '✗ '}{testResult.detail}
              </div>
            )}
            <button onClick={() => simulateMutation.mutate(testMsg)} disabled={!testMsg.trim() || simulateMutation.isPending}
              style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: '#D97706', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start', opacity: simulateMutation.isPending ? 0.7 : 1 }}>
              {simulateMutation.isPending ? 'Processing...' : 'Analyze Message'}
            </button>
          </div>
        )}


        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div className="bulk-bar">
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {selectAllPages ? `All ${totalCount} selected` : `${selectedIds.size} selected`}
              </span>
              <div style={{ width: 1, height: 16, background: 'var(--border-default)', flexShrink: 0 }} />
              <button onClick={() => bulkMutation.mutate(Array.from(selectedIds))} disabled={bulkMutation.isPending || selectAllPages}
                style={{ padding: '4px 12px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--status-success)', color: '#fff', fontWeight: 600, fontSize: 'var(--text-xs)', cursor: 'pointer', opacity: selectAllPages ? 0.4 : 1 }}>
                Mark Resolved
              </button>
              <button onClick={() => setConfirmDelete(true)} disabled={bulkDeleteMutation.isPending}
                style={{ padding: '4px 12px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--status-error)', color: '#fff', fontWeight: 600, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
                Delete
              </button>
              <button onClick={() => { setSelectedIds(new Set()); setSelectAllPages(false); }}
                style={{ padding: '4px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'transparent', cursor: 'pointer', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
            </div>
            {allSelected && totalCount > violations.length && !selectAllPages && (
              <div style={{ padding: '6px 16px', background: 'var(--status-warning-bg)', borderBottom: '1px solid var(--status-warning-border)', fontSize: 'var(--text-xs)', color: 'var(--status-warning)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>{violations.length} on this page selected.</span>
                <button onClick={() => setSelectAllPages(true)}
                  style={{ padding: '2px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--status-warning)', color: '#fff', fontWeight: 600, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
                  Select all {totalCount}
                </button>
              </div>
            )}
            {selectAllPages && (
              <div style={{ padding: '6px 16px', background: 'var(--status-error-bg)', borderBottom: '1px solid var(--status-error-border)', fontSize: 'var(--text-xs)', color: 'var(--status-error)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>All {totalCount} violations selected.</span>
                <button onClick={() => setSelectAllPages(false)}
                  style={{ padding: '2px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--surface-subtle)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
                  Clear
                </button>
              </div>
            )}
          </div>
        )}

        {/* Delete confirmation dialog */}
        {confirmDelete && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🗑️</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#0F172A' }}>Confirm Delete</h3>
              <p style={{ margin: '0 0 24px', fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
                You are about to permanently delete{' '}
                <strong style={{ color: '#DC2626' }}>
                  {selectAllPages ? `all ${totalCount} violations` : `${selectedIds.size} violation${selectedIds.size !== 1 ? 's' : ''}`}
                </strong>.
                This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => bulkDeleteMutation.mutate()} disabled={bulkDeleteMutation.isPending}
                  style={{ flex: 1, padding: '11px', borderRadius: 9, border: 'none', background: '#EF4444', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: bulkDeleteMutation.isPending ? 0.7 : 1 }}>
                  {bulkDeleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button onClick={() => setConfirmDelete(false)} disabled={bulkDeleteMutation.isPending}
                  style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main content: table + detail panel */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

          <div style={{ flex: 1, minWidth: 0 }}>
          <WorkspaceSurface
            toolbar={
              <>
                <input
                  type="text"
                  placeholder="Search reference, area, plot…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  style={{ width: 240, padding: '5px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: 'var(--text-xs)', background: 'var(--surface-app)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
                />
                <div style={{ flex: 1 }} />
                {/* Compact tab pills */}
                {([
                  { id: '',         label: 'All' },
                  { id: 'new',      label: 'New' },
                  { id: 'notified', label: 'Notified' },
                  { id: 'resolved', label: 'Resolved' },
                  { id: 'fined',    label: 'Fined' },
                ]).map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setStatusFilter(s.id); setPage(1); }}
                    style={{
                      padding: '4px 10px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
                      fontSize: 'var(--text-xs)', fontWeight: statusFilter === s.id ? 600 : 400,
                      background: statusFilter === s.id ? 'var(--surface-subtle)' : 'transparent',
                      color: statusFilter === s.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      transition: 'all var(--transition-fast)',
                    }}
                  >{s.label}</button>
                ))}
              </>
            }
          >
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}>
                <div className="animate-spin" style={{ width: 24, height: 24, border: '2px solid var(--border-default)', borderTopColor: 'var(--brand)', borderRadius: '50%' }} />
              </div>
            ) : violations.length === 0 ? (
              <div className="empty-state">
                <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p className="empty-state-title">{search || statusFilter ? 'No violations match this filter' : 'No violations'}</p>
                <p className="empty-state-desc">{search || statusFilter ? 'Try adjusting your search or status filter' : 'All ADM violations will appear here automatically'}</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={thS(36)}>
                        <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ width: 15, height: 15, cursor: 'pointer' }} />
                      </th>
                      <th style={thS(130)}>Reference</th>
                      <th style={thS()}>Violation Description</th>
                      <th style={thS(130)}>Area / Plot</th>
                      <th style={thS()}>Project</th>
                      <th style={{ ...thS(80), textAlign: 'center' }}>Deadline</th>
                      <th style={{ ...thS(100), textAlign: 'center' }}>Fine</th>
                      <th style={{ ...thS(105), textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {violations.map((v, i) => {
                      const isSel    = selectedIds.has(v.id);
                      const isActive = selectedId === v.id;
                      const noProj   = !v.project;
                      const isEven   = i % 2 === 0;

                      return (
                        <tr
                          key={v.id}
                          onClick={() => setSelectedId(isActive ? null : v.id)}
                          style={{
                            background: isActive ? '#EFF6FF' : isSel ? '#F0F9FF' : noProj ? '#FFFBEB' : isEven ? '#fff' : '#FAFAFA',
                            borderBottom: '1px solid #F1F5F9',
                            cursor: 'pointer',
                            borderLeft: isActive ? '3px solid #2563EB' : '3px solid transparent',
                            transition: 'background 0.1s',
                          }}
                        >
                          <td style={tdS()} onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={isSel}
                              onChange={() => setSelectedIds(p => { const s = new Set(p); s.has(v.id) ? s.delete(v.id) : s.add(v.id); return s; })}
                              style={{ width: 15, height: 15, cursor: 'pointer' }} />
                          </td>

                          {/* Reference */}
                          <td style={tdS()}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              {noProj && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', display: 'inline-block', flexShrink: 0 }} title="No project linked" />}
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#0F172A' }}>
                                {v.reference_number || `#${v.id}`}
                              </span>
                            </div>
                            <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{fmtDate(v.received_at)}</div>
                          </td>

                          {/* Violation description */}
                          <td style={{ ...tdS(), maxWidth: 260 }}>
                            {v.violation_description
                              ? <span style={{ fontSize: 12, color: '#334155', direction: 'rtl', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                                  {v.violation_description}
                                </span>
                              : <span style={{ fontSize: 11, color: '#CBD5E1', fontStyle: 'italic' }}>Click to view SMS</span>
                            }
                          </td>

                          {/* Area / Plot */}
                          <td style={tdS()}>
                            {v.sector || v.plot || v.area
                              ? <div>
                                  {v.area && <div style={{ fontWeight: 600, fontSize: 12, color: '#0F172A' }}>{v.area}</div>}
                                  {(v.sector || v.plot) && (
                                    <div style={{ fontSize: 11, color: '#64748B' }}>
                                      {[v.sector && `Sector ${v.sector}`, v.plot && `Plot ${v.plot}`].filter(Boolean).join(' · ')}
                                    </div>
                                  )}
                                </div>
                              : <span style={{ color: '#CBD5E1' }}>—</span>
                            }
                          </td>

                          {/* Project */}
                          <td style={tdS()}>
                            {v.project_name
                              ? <span style={{ fontWeight: 500, fontSize: 12, color: '#0F172A' }}>{v.project_name}</span>
                              : <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 20, background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 600 }}>
                                  No Project
                                </span>
                            }
                          </td>

                          {/* Deadline */}
                          <td style={{ ...tdS(), textAlign: 'center' }}>
                            {v.deadline_days != null
                              ? <span style={{
                                  display: 'inline-block', padding: '2px 8px', borderRadius: 8, fontWeight: 700, fontSize: 12,
                                  background: v.deadline_days <= 1 ? '#FEE2E2' : v.deadline_days <= 3 ? '#FEF3C7' : '#F0FDF4',
                                  color:      v.deadline_days <= 1 ? '#DC2626' : v.deadline_days <= 3 ? '#D97706' : '#16A34A',
                                }}>
                                  {v.deadline_days}d
                                </span>
                              : <span style={{ color: '#CBD5E1' }}>—</span>
                            }
                          </td>

                          {/* Fine */}
                          <td style={{ ...tdS(), textAlign: 'center' }}>
                            {v.fine_amount
                              ? <div>
                                  <div style={{ fontWeight: 800, color: '#DC2626', fontSize: 13 }}>{Number(v.fine_amount).toLocaleString()}</div>
                                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>AED</div>
                                </div>
                              : <span style={{ color: '#CBD5E1' }}>—</span>
                            }
                          </td>

                          {/* Status */}
                          <td style={{ ...tdS(), textAlign: 'center' }}>
                            <StatusBadge status={v.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination inside card */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>
                  Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, totalCount)} of {totalCount}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 12, fontWeight: 600, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
                    ← Prev
                  </button>
                  <span style={{ padding: '6px 12px', fontSize: 12, color: '#64748B', fontWeight: 600 }}>{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 12, fontWeight: 600, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>
                    Next →
                  </button>
                </div>
              </div>
            )}
          </WorkspaceSurface>
          </div>

          {/* Detail panel */}
          {selectedViolation && (
            <ViolationDetailPanel
              violation={selectedViolation}
              onClose={() => setSelectedId(null)}
              onResolve={(id) => resolveMutation.mutate(id)}
              onLinkProject={(id, projectId) => linkMutation.mutate({ id, projectId })}
              resolving={resolveMutation.isPending}
              linking={linkMutation.isPending}
              projects={projects}
            />
          )}
        </div>

      </PageShell>
    </MainLayout>
  );
}

function thS(w?: number): React.CSSProperties {
  return { padding: '11px 14px', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap', width: w, textAlign: 'left' };
}
function tdS(): React.CSSProperties {
  return { padding: '11px 14px', verticalAlign: 'middle' };
}
