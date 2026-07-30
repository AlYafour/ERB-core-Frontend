'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { useAuthStore } from '@/lib/store/auth-store';
import { useTenantInfo } from '@/lib/hooks/use-tenant';
import { tasksApi } from '@/lib/api/tasks';
import { purchaseRequestsApi } from '@/lib/api/purchase-requests';
import { hrRequestsApi } from '@/lib/api/hr';
import { resolveRequestTypeLabel } from '@/lib/hr/request-type-label';
import MainLayout from '@/components/layout/MainLayout';
import { Loader } from '@/components/ui';
import { useMyEmployeeRecord } from '@/lib/hooks/use-my-employee-record';

/* ── Palette (mirrors the Executive Dashboard) ───────────────────── */
const V = {
  app:     'var(--surface-app)',
  surf:    'var(--card-bg)',
  surf2:   'var(--surface-subtle)',
  border:  'var(--border-subtle)',
  border2: 'var(--border-default)',
  text:    'var(--text-primary)',
  text2:   'var(--text-secondary)',
  text3:   'var(--text-tertiary)',
  gold:    'var(--brand)',
  danger:  'var(--status-error)',
  warn:    'var(--status-warning)',
  ok:      'var(--status-success)',
};
const card = (extra?: CSSProperties): CSSProperties => ({
  background: V.surf, border: `1px solid ${V.border}`, borderRadius: 'var(--radius-xl)', ...extra,
});
const sectionTitle: CSSProperties = {
  fontSize: 12, fontWeight: 700, color: V.text, paddingLeft: 9,
  borderLeft: `2px solid ${V.gold}`, letterSpacing: '0.01em',
};
const viewAllLink: CSSProperties = { fontSize: 11, color: V.gold, textDecoration: 'none', opacity: 0.9 };

function timeGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
const countOf = (d: unknown): number =>
  Array.isArray(d) ? d.length : ((d as { count?: number })?.count ?? (d as { results?: unknown[] })?.results?.length ?? 0);
const listOf = <T,>(d: unknown): T[] =>
  Array.isArray(d) ? (d as T[]) : ((d as { results?: T[] })?.results ?? []);

const PRIORITY_COLOR: Record<string, string> = {
  urgent: V.danger, high: V.warn, medium: V.text3, low: V.border2,
};

/* ── Small list card ─────────────────────────────────────────────── */
function ListCard({ title, count, href, isLoading, isError, empty, children }: {
  title: string; count: number; href: string; isLoading: boolean; isError: boolean;
  empty: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={card({ padding: '13px 15px', display: 'flex', flexDirection: 'column' })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={sectionTitle}>{title}</span>
          {count > 0 && (
            <span style={{ fontSize: 10, fontWeight: 800, minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--brand-subtle)', color: V.gold, padding: '0 5px' }}>{count}</span>
          )}
        </div>
        <Link href={href} style={viewAllLink}>View all →</Link>
      </div>
      {isLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 18 }}><Loader /></div>
        : isError ? <p style={{ color: V.text3, fontSize: 12, textAlign: 'center', padding: '14px 0', margin: 0 }}>Could not load.</p>
        : children}
    </div>
  );
}
function EmptyLine({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '14px 0', textAlign: 'center', color: V.text3, fontSize: 12 }}>{children}</div>;
}
function Row({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 7, background: V.surf2 }}
      onMouseEnter={e => { e.currentTarget.style.background = V.border; }}
      onMouseLeave={e => { e.currentTarget.style.background = V.surf2; }}>
      {children}
    </Link>
  );
}
function Pill({ text, tone }: { text: string; tone: 'warn' | 'gold' }) {
  const c = tone === 'gold' ? V.gold : V.warn;
  const bg = tone === 'gold' ? 'var(--brand-subtle)' : 'var(--status-warning-bg)';
  return <span style={{ fontSize: 10, fontWeight: 700, color: c, background: bg, padding: '2px 7px', borderRadius: 999, flexShrink: 0 }}>{text}</span>;
}

/* ── Root ────────────────────────────────────────────────────────── */
interface Task { id: number; title: string; priority: string }
interface Req { id: number; request_type: string; employee_name?: string }
interface PR { id: number; code: string; title: string }

export default function MyWorkspace() {
  const { user } = useAuth();
  const { hasPermission, isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const { enabledModules } = useAuthStore();
  const { data: tenantData } = useTenantInfo();
  const { emp: myEmp } = useMyEmployeeRecord();

  const isAdmin  = isTenantAdmin || isPlatformAdmin;
  const showMod  = (key: string) => !enabledModules?.length || (enabledModules as string[]).includes(key);
  const showProc = showMod('procurement') && (isAdmin || hasPermission('procurement.purchase_request.view'));
  const showHR   = showMod('hr');
  const canApprove = isAdmin || hasPermission('hr.hr_request.approve') || hasPermission('hr_request.approve');
  const uid = user?.id ?? 0;

  const tasksQ = useQuery({ queryKey: ['workspace-my-tasks'], queryFn: () => tasksApi.getAll({ scope: 'mine', page_size: 8 }), staleTime: 60_000, enabled: !!user });
  const hrQ    = useQuery({ queryKey: ['workspace-my-hr-requests'], queryFn: () => hrRequestsApi.getAll({ status: 'pending', page_size: 6 }), staleTime: 60_000, enabled: !!user && showHR });
  const apprQ  = useQuery({ queryKey: ['workspace-my-approvals'], queryFn: () => hrRequestsApi.getPendingMyApproval(), staleTime: 60_000, enabled: !!user && canApprove });
  const prQ    = useQuery({ queryKey: ['workspace-my-prs', uid], queryFn: () => purchaseRequestsApi.getAll({ status: 'pending', created_by: uid, page_size: 6 }), staleTime: 60_000, enabled: !!user && showProc });

  if (!user) return <MainLayout><div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader /></div></MainLayout>;

  const profileHref = myEmp?.id ? `/hr/employees/${myEmp.id}` : `/users/${user.id}`;
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || '';
  const roleLabel   = (user as unknown as { permission_set?: { name?: string } })?.permission_set?.name || (user.role?.replace(/_/g, ' ') ?? '');

  const tasks = listOf<Task>(tasksQ.data).filter(t => !['approved', 'closed', 'rejected'].includes((t as unknown as { status?: string }).status ?? ''));
  const hr = listOf<Req>(hrQ.data);
  const appr = listOf<Req>(apprQ.data);
  const prs = listOf<PR>(prQ.data);

  const kpis = [
    { label: 'My Tasks',            value: tasks.length,       href: '/tasks',             show: true,        accent: false },
    { label: 'My Requests',         value: countOf(hrQ.data),  href: '/hr/requests',       show: showHR,      accent: false },
    { label: 'Awaiting My Approval',value: appr.length,        href: '/hr/requests',       show: canApprove,  accent: true  },
    { label: 'Purchase Requests',   value: countOf(prQ.data),  href: '/purchase-requests', show: showProc,    accent: false },
  ].filter(k => k.show);

  const QUICK = [
    { label: 'HR Request', href: '/hr/requests', icon: '👤', show: showHR },
    { label: 'Task', href: '/tasks/new', icon: '✓', show: true },
    { label: 'Purchase Request', href: '/purchase-requests/new', icon: '📋', show: showProc },
  ].filter(q => q.show);

  return (
    <MainLayout>
      <div style={{ background: V.app, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* Brand accent bar */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, var(--brand) 0%, var(--brand-subtle) 55%, transparent 100%)', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ background: V.surf, borderBottom: `1px solid ${V.border}`, padding: '12px 22px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 14, fontWeight: 800, color: V.text, margin: 0, letterSpacing: '-0.01em' }}>{timeGreeting()}, {user.first_name || displayName}</h1>
            <p style={{ fontSize: 11, color: V.text3, margin: '1px 0 0', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tenantData?.name ?? 'Your workspace'}{roleLabel ? ` · ${roleLabel}` : ''}
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {canApprove && appr.length > 0 && (
              <Link href="/hr/requests" style={{ background: 'var(--brand-subtle)', border: '1px solid var(--brand-muted)', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: V.gold, textDecoration: 'none' }}>
                {appr.length} awaiting approval
              </Link>
            )}
            {showHR && countOf(hrQ.data) > 0 && (
              <Link href="/hr/requests" style={{ background: 'var(--status-warning-bg)', border: '1px solid var(--status-warning-border, var(--border-default))', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: V.warn, textDecoration: 'none' }}>
                {countOf(hrQ.data)} my requests
              </Link>
            )}
            <Link href={profileHref} style={{ border: `1px solid ${V.border}`, borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: V.text2, textDecoration: 'none' }}>
              My profile →
            </Link>
          </div>
        </div>

        {/* Quick Create bar */}
        <div style={{ background: V.surf, borderBottom: `1px solid ${V.border}`, padding: '7px 22px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 6, flexShrink: 0 }}>Quick Create</span>
          {QUICK.map(({ label, href, icon }) => (
            <Link key={href} href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5, border: `1px solid ${V.border}`, background: 'transparent', fontSize: 11, fontWeight: 600, color: V.text2, textDecoration: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = V.border2; e.currentTarget.style.color = V.text; e.currentTarget.style.background = V.surf2; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = V.border; e.currentTarget.style.color = V.text2; e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ fontSize: 10, opacity: 0.75 }}>{icon}</span>{label}
            </Link>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>

          {/* KPI strip */}
          <div style={card({ display: 'flex', alignItems: 'stretch', overflow: 'hidden' })}>
            {kpis.map((k, i, arr) => (
              <Link key={k.label} href={k.href} style={{ flex: 1, minWidth: 0, padding: '14px 16px', borderRight: i < arr.length - 1 ? `1px solid ${V.border}` : 'none', textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 4, transition: 'background .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = V.surf2; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: V.text3 }}>{k.label}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: k.accent && k.value > 0 ? V.gold : V.text, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
              </Link>
            ))}
          </div>

          {/* Activity grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, alignItems: 'start' }}>

            {canApprove && (
              <ListCard title="Awaiting My Approval" count={appr.length} href="/hr/requests" isLoading={apprQ.isLoading} isError={apprQ.isError}
                empty={<EmptyLine>Nothing waiting for you.</EmptyLine>}>
                {appr.length === 0 ? <EmptyLine>Nothing waiting for you.</EmptyLine> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {appr.slice(0, 7).map(a => (
                      <Row key={a.id} href={`/hr/requests/${a.id}`}>
                        <span style={{ fontSize: 12.5, color: V.text, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {resolveRequestTypeLabel(a.request_type)}{a.employee_name ? ` · ${a.employee_name}` : ''}
                        </span>
                        <Pill text="review" tone="gold" />
                      </Row>
                    ))}
                  </div>
                )}
              </ListCard>
            )}

            {showHR && (
              <ListCard title="My HR Requests" count={countOf(hrQ.data)} href="/hr/requests" isLoading={hrQ.isLoading} isError={hrQ.isError}
                empty={<EmptyLine>No pending requests.</EmptyLine>}>
                {hr.length === 0 ? (
                  <div style={{ padding: '10px 0', textAlign: 'center' }}>
                    <Link href="/hr/requests" style={{ fontSize: 11, fontWeight: 700, color: V.gold, textDecoration: 'none', padding: '5px 12px', borderRadius: 6, background: 'var(--brand-subtle)' }}>+ New Request</Link>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {hr.slice(0, 6).map(r => (
                      <Row key={r.id} href={`/hr/requests/${r.id}`}>
                        <span style={{ fontSize: 12.5, color: V.text, fontWeight: 500, flex: 1 }}>{resolveRequestTypeLabel(r.request_type)}</span>
                        <Pill text="pending" tone="warn" />
                      </Row>
                    ))}
                  </div>
                )}
              </ListCard>
            )}

            <ListCard title="My Tasks" count={tasks.length} href="/tasks" isLoading={tasksQ.isLoading} isError={tasksQ.isError}
              empty={<EmptyLine>No tasks assigned to you.</EmptyLine>}>
              {tasks.length === 0 ? <EmptyLine>No tasks assigned to you.</EmptyLine> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {tasks.slice(0, 7).map(t => (
                    <Row key={t.id} href={`/tasks/${t.id}`}>
                      <span style={{ width: 6, height: 6, borderRadius: 3, flexShrink: 0, background: PRIORITY_COLOR[t.priority] ?? V.text3 }} />
                      <span style={{ fontSize: 12.5, color: V.text, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    </Row>
                  ))}
                </div>
              )}
            </ListCard>

            {showProc && (
              <ListCard title="My Purchase Requests" count={countOf(prQ.data)} href="/purchase-requests" isLoading={prQ.isLoading} isError={prQ.isError}
                empty={<EmptyLine>No pending purchase requests.</EmptyLine>}>
                {prs.length === 0 ? <EmptyLine>No pending purchase requests.</EmptyLine> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {prs.slice(0, 6).map(pr => (
                      <Row key={pr.id} href={`/purchase-requests/${pr.id}`}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: V.text, fontFamily: 'monospace', flexShrink: 0 }}>{pr.code}</span>
                        <span style={{ fontSize: 11.5, color: V.text2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.title}</span>
                        <Pill text="pending" tone="warn" />
                      </Row>
                    ))}
                  </div>
                )}
              </ListCard>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
