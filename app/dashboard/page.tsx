'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api/dashboard';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils/format';
import dynamic from 'next/dynamic';
import { useEffect, type CSSProperties } from 'react';
import AuthLoadingScreen from '@/components/auth/AuthLoadingScreen';
import { useT } from '@/lib/i18n/useT';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import MyWorkspace from '@/components/dashboard/MyWorkspace';
import { violationsApi } from '@/lib/api/violations';

const StatusPieCard           = dynamic(() => import('./charts').then(m => ({ default: m.StatusPieCard })),           { ssr: false });
const MonthlyVolumeChart      = dynamic(() => import('./charts').then(m => ({ default: m.MonthlyVolumeChart })),      { ssr: false });
const ProjectSpendingPieChart = dynamic(() => import('./charts').then(m => ({ default: m.ProjectSpendingPieChart })), { ssr: false });

/* ── Design tokens ──────────────────────────────────────────────────────────── */
const V = {
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

function kpiAED(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${Math.round(v / 1_000)}K`;
  return v > 0 ? String(Math.round(v)) : '0';
}

/* ── Entry ──────────────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  if (authLoading || !user) return <AuthLoadingScreen />;
  if (!isTenantAdmin && !isPlatformAdmin) return <MyWorkspace />;
  return <DashboardContent />;
}

/* ── Main content (admin only) ──────────────────────────────────────────────── */
function DashboardContent() {
  const { isAuthenticated, logout } = useAuth();
  const t = useT();

  /* existing queries */
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'combined'],
    queryFn:  dashboardApi.getCombined,
    enabled:  isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });

  const { data: taskStats } = useQuery({
    queryKey: ['task-stats-dashboard'],
    queryFn:  () => import('@/lib/api/tasks').then(m => m.tasksApi.stats()),
    enabled:  isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });

  const { data: myTasksRaw } = useQuery({
    queryKey: ['my-tasks-dashboard'],
    queryFn:  () => import('@/lib/api/tasks').then(m =>
      m.tasksApi.getAll({ scope: 'mine', page_size: 8 } as any)
    ),
    enabled:  isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });

  /* NEW: violations stats */
  const { data: violStats } = useQuery({
    queryKey: ['violations-stats'],
    queryFn:  violationsApi.getStats,
    enabled:  isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });

  /* derived data */
  const stats            = data?.stats;
  const chartData        = data?.chartData;
  const recentActivity   = data?.recentActivity;
  const userActivity     = data?.userActivity;
  const cycleMetrics     = data?.cycleMetrics;
  const projectAnalytics = data?.projectAnalytics;
  const hrStats          = data?.hrStats;

  const allTasks = Array.isArray(myTasksRaw) ? myTasksRaw : (myTasksRaw as any)?.results ?? [];

  const myTaskList = allTasks
    .filter((task: any) => !['approved', 'closed', 'rejected'].includes(task.status))
    .slice(0, 4);

  /* NEW: upcoming deadlines — tasks due within 7 days */
  const upcomingDeadlines = allTasks
    .filter((task: any) => {
      if (!task.due_date || ['approved', 'closed', 'rejected'].includes(task.status)) return false;
      const diff = (new Date(task.due_date).getTime() - Date.now()) / 86_400_000;
      return diff <= 7;
    })
    .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 5);

  /* NEW: monthly volume trend */
  const monthlyData  = chartData?.monthlyProcurement ?? [];
  const currMo       = monthlyData[monthlyData.length - 1]?.volume ?? 0;
  const prevMo       = monthlyData[monthlyData.length - 2]?.volume ?? 0;
  const volTrendPct  = prevMo > 0 ? Math.round(((currMo - prevMo) / prevMo) * 100) : null;

  /* NEW: total project spend */
  const totalSpend   = (projectAnalytics ?? []).reduce((s: number, p: any) => s + (Number(p.totalSpending) || 0), 0);

  /* NEW: counts for badges */
  const totalPending    = (stats?.purchaseRequests.pending ?? 0) + (hrStats?.pendingRequests ?? 0) + (stats?.invoices.pending ?? 0);
  const activeViolCount = (violStats?.new ?? 0) + (violStats?.notified ?? 0);

  useEffect(() => { if (!isAuthenticated) logout(); }, [isAuthenticated, logout]);
  if (!isAuthenticated) return null;

  const typeLabel: Record<string, string> = {
    purchase_request: t('dash', 'purchaseRequest'),
    quotation:        t('dash', 'quotation'),
    purchase_order:   t('dash', 'purchaseOrder'),
    grn:              t('dash', 'grn'),
    invoice:          t('dash', 'invoice'),
    hr_request:       'HR Request',
    task:             'Task',
  };

  const card = (extra?: CSSProperties): CSSProperties => ({
    background: V.surf, border: `1px solid ${V.border}`, borderRadius: 'var(--radius-xl)', ...extra,
  });

  const sectionTitle: CSSProperties = {
    fontSize: 12, fontWeight: 700, color: V.text,
    paddingLeft: 9, borderLeft: `2px solid ${V.gold}`, letterSpacing: '0.01em',
  };
  const viewAllLink: CSSProperties = {
    fontSize: 11, color: V.gold, textDecoration: 'none', letterSpacing: '0.02em', opacity: 0.9,
  };

  /* quick actions */
  const QUICK_ACTIONS = [
    { label: 'Purchase Request', href: '/purchase-requests/new', icon: '📋' },
    { label: 'HR Request',       href: '/hr/requests/new',       icon: '👤' },
    { label: 'Task',             href: '/tasks/new',             icon: '✓'  },
    { label: 'Goods Receipt',    href: '/goods-receiving/new',   icon: '📦' },
    { label: 'Purchase Order',   href: '/purchase-orders/new',   icon: '📄' },
  ];

  return (
    <MainLayout>
      <style>{`
        @keyframes pulse-dot {
          0%,100%{opacity:1;transform:scale(1)}
          50%{opacity:.4;transform:scale(1.6)}
        }
      `}</style>
      <div style={{ background: 'var(--surface-app)', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* Brand accent bar */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, var(--brand) 0%, var(--brand-subtle) 55%, transparent 100%)', flexShrink: 0 }} />

        {/* ── Header ── */}
        <div style={{ background: V.surf, borderBottom: `1px solid ${V.border}`, padding: '12px 22px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 14, fontWeight: 800, color: V.text, margin: 0, letterSpacing: '-0.01em' }}>Executive Dashboard</h1>
            <p style={{ fontSize: 11, color: V.text3, margin: '1px 0 0', letterSpacing: '0.02em' }}>AL YAFOUR · Real-time procurement & operations overview</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {!!stats?.purchaseRequests.pending && (
              <Link href="/purchase-requests?status=pending"
                style={{ background: 'var(--brand-subtle)', border: '1px solid var(--brand-muted)', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: V.gold, textDecoration: 'none' }}>
                {stats.purchaseRequests.pending} PRs pending
              </Link>
            )}
            {!!hrStats?.pendingRequests && (
              <Link href="/hr/requests?status=pending"
                style={{ background: 'var(--status-error-bg)', border: '1px solid var(--status-error-border)', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: V.danger, textDecoration: 'none' }}>
                {hrStats.pendingRequests} HR requests
              </Link>
            )}
          </div>
        </div>

        {/* ── Quick Actions Bar ── */}
        <div style={{ background: V.surf, borderBottom: `1px solid ${V.border}`, padding: '7px 22px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 6, flexShrink: 0 }}>Quick Create</span>
          {QUICK_ACTIONS.map(({ label, href, icon }) => (
            <Link key={href} href={href} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 9px', borderRadius: 5,
              border: `1px solid ${V.border}`, background: 'transparent',
              fontSize: 11, fontWeight: 600, color: V.text2, textDecoration: 'none',
              transition: 'all .12s',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = V.border2; el.style.color = V.text; el.style.background = V.surf2; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = V.border; el.style.color = V.text2; el.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 10, opacity: 0.75 }}>{icon}</span>
              {label}
            </Link>
          ))}
          <div style={{ flex: 1 }} />
          {/* Violations shortcut */}
          {activeViolCount > 0 && (
            <Link href="/violations" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '3px 11px', borderRadius: 5,
              background: 'var(--status-error-bg)', border: '1px solid var(--status-error-border)',
              fontSize: 11, fontWeight: 700, color: V.danger, textDecoration: 'none',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: V.danger, display: 'inline-block', animation: 'pulse-dot 1.8s ease-in-out infinite' }} />
              {activeViolCount} open violations
            </Link>
          )}
          {/* Pending approvals shortcut */}
          {totalPending > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 11px', borderRadius: 5,
              background: 'var(--brand-subtle)', border: '1px solid var(--brand-muted)',
              fontSize: 11, fontWeight: 700, color: V.gold,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: V.gold, display: 'inline-block' }} />
              {totalPending} pending approvals
            </span>
          )}
        </div>

        {/* ── Content ── */}
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>

          {/* ── VIOLATIONS PROBLEM PANEL (Dynatrace-style "Problems") ── */}
          {violStats && activeViolCount > 0 && (
            <div style={{
              background: 'var(--status-error-bg, #FEF2F2)',
              border: '1px solid var(--status-error-border, #FECACA)',
              borderLeft: `4px solid ${V.danger}`,
              borderRadius: 10, padding: '12px 18px',
              display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                  background: V.danger, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 20, color: '#fff',
                }}>⚠</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: V.danger, lineHeight: 1.3 }}>
                    {violStats.new > 0 ? `${violStats.new} New` : ''}
                    {violStats.new > 0 && violStats.notified > 0 ? ' · ' : ''}
                    {violStats.notified > 0 ? `${violStats.notified} Notified` : ''} — Municipal Violations Require Action
                  </div>
                  <div style={{ fontSize: 11, color: V.danger, opacity: 0.7, marginTop: 3 }}>
                    {violStats.no_project > 0 ? `${violStats.no_project} not linked to a project` : 'All violations linked'}
                    {violStats.fined > 0 ? ` · ${violStats.fined} already fined` : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 22, marginLeft: 'auto', alignItems: 'center' }}>
                {([
                  { l: 'New',      v: violStats.new,      c: V.danger },
                  { l: 'Notified', v: violStats.notified, c: V.warn },
                  { l: 'Fined',    v: violStats.fined,    c: V.danger },
                  { l: 'Resolved', v: violStats.resolved, c: V.ok },
                ] as const).filter(x => x.v > 0).map(({ l, v, c }) => (
                  <div key={l} style={{ textAlign: 'center', minWidth: 32 }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: c, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                    <div style={{ fontSize: 9, color: c, opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{l}</div>
                  </div>
                ))}
                <Link href="/violations" style={{
                  padding: '7px 16px', borderRadius: 7,
                  border: `1.5px solid ${V.danger}`, background: 'transparent',
                  color: V.danger, fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
                }}>Manage →</Link>
              </div>
            </div>
          )}

          {/* ── KPI strip ── */}
          <div style={card({ display: 'flex', alignItems: 'stretch', overflow: 'hidden' })}>
            {isLoading
              ? [0,1,2,3,4,5,6].map(i => (
                  <div key={i} style={{ flex: 1, padding: '14px 18px', borderRight: i < 6 ? `1px solid ${V.border}` : 'none' }}>
                    <div className="skeleton" style={{ height: 9, width: '55%', borderRadius: 4, marginBottom: 14 }} />
                    <div className="skeleton" style={{ height: 26, width: '40%', borderRadius: 4 }} />
                  </div>
                ))
              : stats && hrStats && ([
                  { label: 'Purchase Requests', value: stats.purchaseRequests.total,  sub: `${stats.purchaseRequests.pending} pending`,  href: '/purchase-requests', trendPct: null,        trendUp: null },
                  { label: 'Purchase Orders',   value: stats.purchaseOrders.total,    sub: `${stats.purchaseOrders.pending} pending`,    href: '/purchase-orders',   trendPct: null,        trendUp: null },
                  { label: 'Invoices Paid',     value: stats.invoices.paid,           sub: `${stats.invoices.pending} pending`,          href: '/purchase-invoices', trendPct: null,        trendUp: null },
                  { label: 'Active Projects',   value: projectAnalytics?.length ?? 0, sub: 'view all',                                  href: '/projects',          trendPct: null,        trendUp: null },
                  { label: 'Employees',         value: hrStats.employees,             sub: `${hrStats.presentToday} present today`,      href: '/hr/employees',      trendPct: null,        trendUp: null },
                  { label: 'Suppliers',         value: stats.suppliers.total,         sub: `${stats.products.total} products`,           href: '/suppliers',         trendPct: null,        trendUp: null },
                  { label: 'Total Spend',       value: kpiAED(totalSpend),            sub: volTrendPct != null ? `${volTrendPct > 0 ? '↑' : '↓'} ${Math.abs(volTrendPct)}% vol vs last mo` : 'AED · all projects', href: '/projects', trendPct: volTrendPct, trendUp: volTrendPct != null ? volTrendPct > 0 : null },
                ] as const).map(({ label, value, sub, href, trendPct, trendUp }, i, arr) => (
                  <Link key={href + label} href={href} style={{
                    flex: 1, padding: '14px 16px',
                    borderRight: i < arr.length - 1 ? `1px solid ${V.border}` : 'none',
                    textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 4,
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = V.surf2; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: V.text3 }}>{label}</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: V.text, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                    <div style={{ fontSize: 11, color: trendUp === true ? V.ok : trendUp === false ? V.danger : V.text3 }}>{sub}</div>
                  </Link>
                ))
            }
          </div>

          {/* ── Charts row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>

            {/* Monthly Volume */}
            <div style={card({ padding: '14px 16px' })}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={sectionTitle}>Procurement Volume</div>
                  <div style={{ fontSize: 11, color: V.text3, marginTop: 2 }}>Monthly request count</div>
                </div>
              </div>
              {(chartData?.monthlyProcurement?.length ?? 0) > 0 && chartData ? (
                <MonthlyVolumeChart data={chartData.monthlyProcurement} label={t('dash', 'requests')} />
              ) : (
                <div style={{ height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: V.text3 }}>
                  <svg width="40" height="32" viewBox="0 0 40 32" fill="none" style={{ opacity: 0.25, color: V.gold }}>
                    <rect x="0" y="20" width="6" height="12" rx="1" fill="currentColor"/>
                    <rect x="9" y="12" width="6" height="20" rx="1" fill="currentColor"/>
                    <rect x="18" y="16" width="6" height="16" rx="1" fill="currentColor"/>
                    <rect x="27" y="8" width="6" height="24" rx="1" fill="currentColor"/>
                    <rect x="36" y="4" width="4" height="28" rx="1" fill="currentColor"/>
                  </svg>
                  <span style={{ fontSize: 12 }}>No procurement data yet</span>
                </div>
              )}
            </div>

            {/* PR Status Pie */}
            <div style={card({ padding: '14px 16px' })}>
              <div style={sectionTitle}>PR Status Split</div>
              <div style={{ fontSize: 11, color: V.text3, marginBottom: 14, marginTop: 3 }}>All-time distribution</div>
              {chartData ? (
                <>
                  <StatusPieCard title="PR Status" href="/purchase-requests" data={[
                    { name: t('dash', 'pending'),  value: chartData.statusDistribution.purchaseRequests.pending },
                    { name: t('dash', 'approved'), value: chartData.statusDistribution.purchaseRequests.approved },
                    { name: t('dash', 'rejected'), value: chartData.statusDistribution.purchaseRequests.rejected },
                  ]} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                    {([
                      { label: t('dash', 'approved'), value: chartData.statusDistribution.purchaseRequests.approved, color: V.gold },
                      { label: t('dash', 'pending'),  value: chartData.statusDistribution.purchaseRequests.pending,  color: V.text2 },
                      { label: t('dash', 'rejected'), value: chartData.statusDistribution.purchaseRequests.rejected, color: V.danger },
                    ] as const).map(({ label, value, color }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: V.text2 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                          {label}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: V.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: V.text3 }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25, color: V.gold }}>
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: 12 }}>No distribution data yet</span>
                </div>
              )}
            </div>

            {/* Project Spending Pie */}
            <div style={card({ padding: '14px 16px' })}>
              <div style={sectionTitle}>Project Spending</div>
              <div style={{ fontSize: 11, color: V.text3, marginBottom: 14, marginTop: 3 }}>Top projects by AED</div>
              {(chartData?.projectSpending?.length ?? 0) > 0 && chartData ? (
                <ProjectSpendingPieChart data={chartData.projectSpending} />
              ) : (
                <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: V.text3 }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25, color: V.gold }}>
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: 12 }}>No spending data yet</span>
                </div>
              )}
            </div>
          </div>

          {/* ── 3-column grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'stretch' }}>

            {/* ── Col 1: Active Projects ── */}
            <div style={card({ padding: '14px 16px', display: 'flex', flexDirection: 'column' })}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={sectionTitle}>Active Projects</div>
                <Link href="/projects" style={viewAllLink}>View all →</Link>
              </div>
              {projectAnalytics && projectAnalytics.length > 0 ? (
                projectAnalytics.slice(0, 5).map((project: any, idx: number) => (
                  <div key={project.id} style={{ padding: '10px 0', borderBottom: idx < 4 ? `1px solid ${V.border}` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Link href={`/projects/view/${project.id}`}
                          style={{ fontSize: 12, fontWeight: 600, color: V.text, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = V.gold; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = V.text; }}
                        >{project.name}</Link>
                        <div style={{ fontSize: 10, color: V.text3, marginTop: 2 }}>{project.code}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: V.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0, paddingLeft: 8 }}>{project.progress}%</div>
                    </div>
                    <div style={{ height: 3, background: V.border2, borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, width: `${project.progress}%`, background: project.progress < 25 ? V.danger : V.gold }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: V.text2,
                        fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace',
                        letterSpacing: '-0.01em',
                      }}>
                        {formatPrice(project.totalSpending)}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: V.text3,
                        background: V.surf2, border: `1px solid ${V.border}`,
                        padding: '1px 8px', borderRadius: 99,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {project.poCount} POs
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.2, color: V.gold }}>
                    <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  <span style={{ fontSize: 12, color: V.text3 }}>No projects yet</span>
                </div>
              )}
            </div>

            {/* ── Col 2: Middle ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>

              {cycleMetrics && (
                <div style={card({ padding: '14px 16px' })}>
                  <div style={{ ...sectionTitle, marginBottom: 14 }}>Procurement Cycle</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {([
                      { label: 'PR → PO Avg',       value: cycleMetrics.avgPRToPO },
                      { label: 'PO → GRN Avg',      value: cycleMetrics.avgPOToGRN },
                      { label: 'GRN → Invoice Avg', value: cycleMetrics.avgGRNToInvoice },
                    ] as const).map(({ label, value }) => (
                      <div key={label} style={{ background: V.surf2, borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ fontSize: 10, color: V.text3, marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: V.gold, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                          {value} <span style={{ fontSize: 11, fontWeight: 400, color: V.text3 }}>days</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {cycleMetrics.bottlenecks?.length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${V.border}` }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: V.text2, marginBottom: 8 }}>Bottlenecks</div>
                      {cycleMetrics.bottlenecks.map((b: any, i: number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < cycleMetrics.bottlenecks.length - 1 ? `1px solid ${V.border}` : 'none' }}>
                          <span style={{ fontSize: 11, color: V.text2 }}>{b.stage}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: b.avgDays > 7 ? V.danger : b.avgDays > 3 ? V.gold : V.text3, fontVariantNumeric: 'tabular-nums' }}>{b.avgDays}d</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {hrStats && (
                <div style={card({ padding: '14px 16px' })}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={sectionTitle}>HR Overview</div>
                    <Link href="/hr/employees" style={viewAllLink}>View all →</Link>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {([
                      { label: 'Employees',  value: hrStats.employees,       color: V.text },
                      { label: 'Present',    value: hrStats.presentToday,    color: V.text },
                      { label: 'Absent',     value: hrStats.absentToday,     color: V.danger },
                      { label: 'Open Tasks', value: hrStats.openTasks,       color: V.gold },
                      { label: 'HR Pending', value: hrStats.pendingRequests, color: hrStats.pendingRequests > 0 ? V.gold : V.text },
                      { label: 'Payrolls',   value: hrStats.draftPayrolls,   color: V.text },
                    ] as const).map(({ label, value, color }) => (
                      <div key={label} style={{ background: V.surf2, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
                        <div style={{ fontSize: 9, color: V.text3, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {userActivity && userActivity.length > 0 && (
                <div style={card({ padding: '14px 16px' })}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={sectionTitle}>Top Active Users</div>
                    <Link href="/hr/employees" style={viewAllLink}>View all →</Link>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {userActivity.slice(0, 4).map((u: any) => {
                      const total = u.createdPR + u.approvedRequests + u.createdPO + u.createdInvoices;
                      return (
                        <Link key={u.id} href="/hr/employees"
                          style={{ background: V.surf2, border: `1px solid ${V.border}`, borderRadius: 8, padding: '10px', textDecoration: 'none', transition: 'border-color .15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = V.border2; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = V.border; }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 600, color: V.text, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username}</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: V.gold, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{total}</div>
                          <div style={{ fontSize: 9, color: V.text3, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>actions</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, marginTop: 8, fontSize: 9, color: V.text3 }}>
                            <span>PR {u.createdPR}</span><span>OK {u.approvedRequests}</span>
                            <span>PO {u.createdPO}</span><span>INV {u.createdInvoices}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* HR & Tasks Activity — moved to Col 2 */}
              {hrStats && hrStats.recentActivity.length > 0 && (
                <div style={card({ padding: '14px 16px', flex: 1 })}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={sectionTitle}>HR & Tasks Activity</div>
                    <Link href="/hr/requests" style={viewAllLink}>View all →</Link>
                  </div>
                  {hrStats.recentActivity.slice(0, 5).map((a: any, i: number) => (
                    <Link key={`hr-${a.type}-${a.id}`} href={a.link}
                      style={{ display: 'block', textDecoration: 'none', padding: '8px 0', borderBottom: i < 4 ? `1px solid ${V.border}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: a.action === 'rejected' ? V.danger : V.text3, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: V.text2 }}>{a.type === 'task' ? 'Task' : 'HR Request'}</span>
                        <span style={{ fontSize: 10, color: V.text3, marginLeft: 'auto' }}>{new Date(a.timestamp).toLocaleDateString('en-GB')}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 11 }}>
                        <span style={{ fontSize: 11, color: V.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{a.title}</span>
                        <span style={{ fontSize: 10, color: V.text3, flexShrink: 0 }}>{a.user}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* ── Col 3: Right — Approvals + Deadlines + Activity + Tasks ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>

              {/* ── PENDING APPROVALS (new) ── */}
              <div style={card({ padding: '14px 16px' })}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={sectionTitle}>Pending Approvals</div>
                  {totalPending > 0 && (
                    <span style={{
                      background: 'var(--status-error-bg)', color: V.danger,
                      border: '1px solid var(--status-error-border)',
                      padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                    }}>{totalPending} total</span>
                  )}
                </div>
                {([
                  { label: 'Purchase Requests', count: stats?.purchaseRequests.pending ?? 0, href: '/purchase-requests?status=pending', color: V.gold   },
                  { label: 'HR Requests',       count: hrStats?.pendingRequests      ?? 0, href: '/hr/requests?status=pending',       color: V.danger  },
                  { label: 'Purchase Invoices', count: stats?.invoices.pending        ?? 0, href: '/purchase-invoices?status=pending', color: V.text3   },
                ] as const).map(({ label, count, href, color }) => (
                  <div key={label} style={{
                    display: 'flex', alignItems: 'center',
                    padding: '9px 10px', borderRadius: 7, marginBottom: 6,
                    background: count > 0 ? V.surf2 : 'transparent',
                    border: `1px solid ${count > 0 ? V.border2 : V.border}`,
                    borderLeft: `3px solid ${count > 0 ? color : V.border}`,
                  }}>
                    <span style={{ fontSize: 12, color: V.text2, flex: 1 }}>{label}</span>
                    <span style={{
                      fontSize: 20, fontWeight: 900, color: count > 0 ? color : V.text3,
                      fontVariantNumeric: 'tabular-nums', minWidth: 30, textAlign: 'right', marginRight: 10, lineHeight: 1,
                    }}>{count}</span>
                    {count > 0 ? (
                      <Link href={href} style={{
                        fontSize: 10, color: V.gold, textDecoration: 'none', fontWeight: 600,
                        padding: '3px 9px', borderRadius: 5, border: `1px solid ${V.border2}`,
                        background: V.surf, flexShrink: 0,
                      }}>Review →</Link>
                    ) : (
                      <span style={{ fontSize: 10, color: V.ok, fontWeight: 600, flexShrink: 0 }}>✓ Clear</span>
                    )}
                  </div>
                ))}
              </div>

              {/* ── UPCOMING DEADLINES (new) ── */}
              {upcomingDeadlines.length > 0 && (
                <div style={card({ padding: '14px 16px' })}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={sectionTitle}>Upcoming Deadlines</div>
                    <Link href="/tasks?scope=mine" style={viewAllLink}>7-day view →</Link>
                  </div>
                  {upcomingDeadlines.map((task: any) => {
                    const diffDays = Math.ceil((new Date(task.due_date).getTime() - Date.now()) / 86_400_000);
                    const isOverdue = diffDays < 0;
                    const urgColor  = isOverdue || diffDays <= 1 ? V.danger : diffDays <= 3 ? V.warn : V.gold;
                    const urgBg     = isOverdue || diffDays <= 1 ? 'var(--status-error-bg,   #FEF2F2)' : diffDays <= 3 ? 'var(--status-warning-bg, #FFFBEB)' : V.surf2;
                    const urgBorder = isOverdue || diffDays <= 1 ? 'var(--status-error-border,   #FECACA)' : diffDays <= 3 ? 'var(--status-warning-border, #FDE68A)' : V.border;
                    const label     = isOverdue ? `${Math.abs(diffDays)}d ago` : diffDays === 0 ? 'Today' : `${diffDays}d`;
                    return (
                      <Link key={task.id} href={`/tasks/${task.id}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '7px 9px', borderRadius: 7, marginBottom: 5,
                          background: urgBg, textDecoration: 'none',
                          border: `1px solid ${urgBorder}`,
                          transition: 'opacity .12s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.72'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                      >
                        <div style={{
                          width: 36, textAlign: 'center', flexShrink: 0,
                          fontSize: 10, fontWeight: 900, color: urgColor,
                          fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace', lineHeight: 1,
                        }}>{label}</div>
                        <div style={{ width: 1, height: 18, background: urgColor, opacity: 0.2, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: V.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{task.title}</span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Live Activity */}
              {recentActivity && recentActivity.length > 0 && (
                <div style={card({ padding: '14px 16px', flex: 1 })}>
                  <div style={{ ...sectionTitle, marginBottom: 14 }}>Live Activity</div>
                  {recentActivity.slice(0, 6).map((a: any, i: number) => (
                    <Link key={`${a.type}-${a.id}`} href={a.link}
                      style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < 5 ? `1px solid ${V.border}` : 'none', textDecoration: 'none' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.action === 'rejected' ? V.danger : V.text3, flexShrink: 0, marginTop: 6 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: V.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 600 }}>{typeLabel[a.type] ?? a.type}</span>
                          {' — '}{a.title}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                          <span style={{ fontSize: 10, color: V.text3 }}>{a.user}</span>
                          <span style={{ fontSize: 10, color: V.text3 }}>{new Date(a.timestamp).toLocaleDateString('en-GB')}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* My Tasks */}
              {taskStats && (
                <div style={card({ padding: '14px 16px' })}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={sectionTitle}>My Tasks</div>
                    <Link href="/tasks?scope=mine" style={viewAllLink}>View all →</Link>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                    {([
                      { label: 'Assigned', value: taskStats.my_tasks,      color: V.text },
                      { label: 'Overdue',  value: taskStats.overdue,        color: taskStats.overdue > 0 ? V.danger : V.text },
                      { label: 'Review',   value: taskStats.pending_review, color: V.text },
                    ] as const).map(({ label, value, color }) => (
                      <div key={label} style={{ background: V.surf2, borderRadius: 8, padding: '8px 10px' }}>
                        <p style={{ fontSize: 22, fontWeight: 800, color, margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                        <p style={{ fontSize: 9, color: V.text3, margin: '4px 0 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                      </div>
                    ))}
                  </div>
                  {myTaskList.length === 0 ? (
                    <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.2, color: V.gold }}>
                        <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontSize: 11, color: V.text3 }}>No active tasks</span>
                    </div>
                  ) : myTaskList.map((task: any) => {
                    const overdue = task.due_date && !['approved','closed'].includes(task.status) && new Date(task.due_date) < new Date();
                    return (
                      <Link key={task.id} href={`/tasks/${task.id}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: V.surf2, border: `1px solid ${V.border}`, textDecoration: 'none', marginBottom: 6 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = V.border2; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = V.border; }}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: overdue ? V.danger : V.text3, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: V.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{task.title}</span>
                        {overdue && <span style={{ fontSize: 10, color: V.danger, fontWeight: 600, flexShrink: 0 }}>Overdue</span>}
                      </Link>
                    );
                  })}
                  <div style={{ marginTop: 10, display: 'flex', gap: 12 }}>
                    <Link href="/tasks/reports"  style={{ fontSize: 11, color: V.text3, textDecoration: 'none' }}>Reports →</Link>
                    <Link href="/tasks/calendar" style={{ fontSize: 11, color: V.text3, textDecoration: 'none' }}>Calendar →</Link>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </MainLayout>
  );
}
