'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { violationsApi } from '@/lib/api/violations';
import { projectsApi } from '@/lib/api/projects';
import { MunicipalViolation } from '@/types';
import { useAuth } from '@/lib/hooks/use-auth';
import { useT } from '@/lib/i18n/useT';
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

/* ─── Stat card ──────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, color, border, active, onClick }: {
  label: string; value: number; sub?: string;
  color: string; border: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} style={{ textAlign: 'left', width: '100%', background: 'none', border: 'none', padding: 0, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{
        background: active ? `${color}10` : '#fff',
        border: active ? `2px solid ${color}` : `1.5px solid ${border}`,
        borderRadius: 12, padding: '14px 16px',
        boxShadow: active ? `0 0 0 3px ${color}15` : '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'all 0.15s',
      }}>
        <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
      </div>
    </button>
  );
}

/* ─── Status badge ───────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.new;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 700, border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
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

  const deadlineColor = violation.deadline_days == null ? '#64748B'
    : violation.deadline_days <= 1 ? '#DC2626'
    : violation.deadline_days <= 3 ? '#D97706'
    : '#16A34A';

  return (
    <div style={{
      width: 440, flexShrink: 0,
      background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 16,
      overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
      position: 'sticky', top: 0, maxHeight: 'calc(100vh - 130px)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1.5px solid #F1F5F9', background: '#FAFAFA', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: '#0F172A' }}>
              Ref: {violation.reference_number || `#${violation.id}`}
            </span>
            <StatusBadge status={violation.status} />
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
            {violation.sender} · {fmtDate(violation.received_at)}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: '#94A3B8', fontSize: 18, lineHeight: 1, borderRadius: 6 }}>✕</button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Key facts row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <InfoBox label="Area" value={violation.area || '—'} />
          <InfoBox label="Sector" value={violation.sector || '—'} />
          <InfoBox label="Plot No." value={violation.plot || '—'} />
          {violation.fine_amount && (
            <InfoBox label="Fine" value={`${Number(violation.fine_amount).toLocaleString()} AED`} valueColor="#DC2626" bold />
          )}
          {violation.deadline_days != null && (
            <InfoBox label="Deadline" value={`${violation.deadline_days} days`} valueColor={deadlineColor} bold />
          )}
          {violation.violation_date && (
            <InfoBox label="Date" value={violation.violation_date} />
          )}
        </div>

        {/* Violation description */}
        {violation.violation_description && (
          <div style={{ padding: '10px 14px', background: '#FFFBEB', borderRadius: 10, border: '1px solid #FDE68A', fontSize: 12, color: '#92400E', direction: 'rtl', textAlign: 'right', lineHeight: 1.8, fontFamily: 'system-ui, Tahoma, Arial, sans-serif' }}>
            {violation.violation_description}
          </div>
        )}

        {/* Raw SMS */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Original SMS</div>
          <div style={{
            background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10,
            padding: '12px 14px', direction: 'rtl', textAlign: 'right',
            fontSize: 12, lineHeight: 2, color: '#334155',
            fontFamily: 'system-ui, Tahoma, Arial, sans-serif',
            whiteSpace: 'pre-wrap', maxHeight: 180, overflowY: 'auto',
          }}>
            {body || violation.raw_message}
          </div>
          {urls.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" style={{
                  padding: '3px 10px', borderRadius: 7, background: '#EFF6FF',
                  color: '#1D4ED8', border: '1px solid #BFDBFE', fontSize: 11, fontWeight: 600, textDecoration: 'none',
                }}>
                  Open ADM Link ↗
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Project & Engineer */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Project & Engineer</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 12, background: '#fff', color: '#0F172A' }}
            >
              <option value="">— No Project —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={() => onLinkProject(violation.id, selectedProject ? Number(selectedProject) : null)}
              disabled={linking || selectedProject === (violation.project?.toString() ?? '')}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: '#2563EB', color: '#fff', fontSize: 12, fontWeight: 600,
                cursor: linking ? 'wait' : 'pointer', opacity: (linking || selectedProject === (violation.project?.toString() ?? '')) ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {linking ? '...' : 'Link'}
            </button>
          </div>
          {violation.engineer_name ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#16A34A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {violation.engineer_name[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{violation.engineer_name}</div>
                <div style={{ fontSize: 10, color: '#16A34A' }}>Responsible Engineer</div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '8px 12px', background: '#FEF9C3', borderRadius: 8, fontSize: 11, color: '#92400E', border: '1px solid #FDE68A' }}>
              No engineer assigned — link a project to auto-assign
            </div>
          )}
        </div>
      </div>

      {/* Action footer */}
      <div style={{ padding: '12px 18px', borderTop: '1.5px solid #F1F5F9', display: 'flex', gap: 8, flexShrink: 0, background: '#FAFAFA' }}>
        {violation.status !== 'resolved' && (
          <button
            onClick={() => onResolve(violation.id)} disabled={resolving}
            style={{
              flex: 1, padding: '10px', borderRadius: 9, border: 'none',
              background: '#22C55E', color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: resolving ? 'wait' : 'pointer', opacity: resolving ? 0.7 : 1,
            }}
          >
            ✓ Mark Resolved
          </button>
        )}
        <button
          onClick={copyLink}
          style={{
            padding: '10px 14px', borderRadius: 9,
            border: `1.5px solid ${copiedLink ? '#86EFAC' : '#CBD5E1'}`,
            background: copiedLink ? '#DCFCE7' : '#fff',
            color: copiedLink ? '#15803D' : '#475569',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {copiedLink ? '✓ Copied' : '🔗 Engineer Link'}
        </button>
      </div>
    </div>
  );
}

function InfoBox({ label, value, valueColor, bold }: { label: string; value: string; valueColor?: string; bold?: boolean }) {
  return (
    <div style={{ padding: '7px 10px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #F1F5F9' }}>
      <div style={{ fontSize: 9, color: '#94A3B8', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: bold ? 700 : 600, color: valueColor ?? '#0F172A' }}>{value}</div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function ViolationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const t = useT();

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

  const isAdmin = user?.role === 'super_admin' || user?.is_superuser || user?.role === 'procurement_manager';

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
      <div className="flex items-center justify-center h-64">
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

        {/* Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
            <StatCard label="Total" value={stats.total} sub="All violations"
              color="#2563EB" border="#C7D2FE" active={statusFilter === ''} onClick={() => { setStatusFilter(''); setPage(1); }} />
            <StatCard label="New" value={stats.new} sub="Needs action"
              color={STATUS_CFG.new.color} border={STATUS_CFG.new.border} active={statusFilter === 'new'} onClick={() => { setStatusFilter('new'); setPage(1); }} />
            <StatCard label="Notified" value={stats.notified} sub="Engineer informed"
              color={STATUS_CFG.notified.color} border={STATUS_CFG.notified.border} active={statusFilter === 'notified'} onClick={() => { setStatusFilter('notified'); setPage(1); }} />
            <StatCard label="Resolved" value={stats.resolved} sub="Closed"
              color={STATUS_CFG.resolved.color} border={STATUS_CFG.resolved.border} active={statusFilter === 'resolved'} onClick={() => { setStatusFilter('resolved'); setPage(1); }} />
            <StatCard label="Fined" value={stats.fined} sub="Fine issued"
              color={STATUS_CFG.fined.color} border={STATUS_CFG.fined.border} active={statusFilter === 'fined'} onClick={() => { setStatusFilter('fined'); setPage(1); }} />
            {stats.no_project > 0 && (
              <StatCard label="No Project" value={stats.no_project} sub="Needs linking"
                color="#D97706" border="#FDE68A" />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: '#EFF6FF', border: '1.5px solid #93C5FD' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#1E40AF' }}>
                {selectAllPages ? `All ${totalCount} violations selected` : `${selectedIds.size} selected`}
              </span>
              <button onClick={() => bulkMutation.mutate(Array.from(selectedIds))} disabled={bulkMutation.isPending || selectAllPages}
                style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: selectAllPages ? 0.4 : 1 }}>
                Mark Resolved
              </button>
              <button onClick={() => setConfirmDelete(true)} disabled={bulkDeleteMutation.isPending}
                style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                Delete
              </button>
              <button onClick={() => { setSelectedIds(new Set()); setSelectAllPages(false); }}
                style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#E5E7EB', cursor: 'pointer', fontSize: 12, color: '#6B7280' }}>
                Cancel
              </button>
            </div>

            {/* Select-all-pages banner */}
            {allSelected && totalCount > violations.length && !selectAllPages && (
              <div style={{ padding: '9px 16px', borderRadius: 9, background: '#FEF9C3', border: '1.5px solid #FDE68A', fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>All {violations.length} violations on this page are selected.</span>
                <button onClick={() => setSelectAllPages(true)}
                  style={{ padding: '4px 12px', borderRadius: 7, border: 'none', background: '#D97706', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Select all {totalCount} violations
                </button>
              </div>
            )}
            {selectAllPages && (
              <div style={{ padding: '9px 16px', borderRadius: 9, background: '#FEE2E2', border: '1.5px solid #FCA5A5', fontSize: 12, color: '#7F1D1D', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>All {totalCount} violations across all pages are selected.</span>
                <button onClick={() => setSelectAllPages(false)}
                  style={{ padding: '4px 12px', borderRadius: 7, border: 'none', background: '#E5E7EB', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                  Clear selection
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
                <input type="text" placeholder="Search by reference, area or plot..." value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  style={{ flex: 1, minWidth: 200, padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border-primary)', fontSize: 12, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }} />
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                  style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border-primary)', fontSize: 12, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <option value="">All Statuses</option>
                  <option value="new">New</option>
                  <option value="notified">Notified</option>
                  <option value="resolved">Resolved</option>
                  <option value="fined">Fined</option>
                </select>
              </>
            }
          >
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                <div className="w-7 h-7 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
              </div>
            ) : violations.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8 }}>
                <div style={{ fontSize: 36 }}>✓</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>No violations found</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
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
