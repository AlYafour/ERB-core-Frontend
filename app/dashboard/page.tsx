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

const StatusPieCard        = dynamic(() => import('./charts').then(m => ({ default: m.StatusPieCard })),        { ssr: false });
const MonthlyVolumeChart   = dynamic(() => import('./charts').then(m => ({ default: m.MonthlyVolumeChart })),   { ssr: false });
const ProjectSpendingChart = dynamic(() => import('./charts').then(m => ({ default: m.ProjectSpendingChart })), { ssr: false });

/* ─────────────────────────────────────────────────────────────────
   DESIGN TOKENS  —  TWO accent colors only, no exceptions
   gold  = positive / interactive / attention
   red   = negative / danger / absent / overdue / rejected
   ───────────────────────────────────────────────────────────────── */
const D = {
  ground:  '#07101F',
  surf:    '#0F1D30',
  surf2:   '#152640',
  border:  '#1A2C42',
  border2: '#243650',
  text:    '#E2EAF4',   // primary text — all numbers by default
  text2:   '#9AB0C8',   // secondary text
  text3:   '#4A6280',   // labels / captions
  gold:    '#C9943A',   // THE accent — links, cta, key metrics needing attention
  danger:  '#E05C5C',   // THE only other color — absent / overdue / rejected
};

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  if (authLoading || !user) return <AuthLoadingScreen />;
  if (!isTenantAdmin && !isPlatformAdmin) return <MyWorkspace />;
  return <DashboardContent />;
}

function DashboardContent() {
  const { isAuthenticated, logout } = useAuth();
  const t = useT();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'combined'],
    queryFn: dashboardApi.getCombined,
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });

  const stats            = data?.stats;
  const chartData        = data?.chartData;
  const recentActivity   = data?.recentActivity;
  const userActivity     = data?.userActivity;
  const cycleMetrics     = data?.cycleMetrics;
  const projectAnalytics = data?.projectAnalytics;
  const hrStats          = data?.hrStats;

  const { data: taskStats } = useQuery({
    queryKey: ['task-stats-dashboard'],
    queryFn: () => import('@/lib/api/tasks').then(m => m.tasksApi.stats()),
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });

  const { data: myTasksRaw } = useQuery({
    queryKey: ['my-tasks-dashboard'],
    queryFn: () => import('@/lib/api/tasks').then(m =>
      m.tasksApi.getAll({ scope: 'mine', page_size: 5, status: 'in_progress' } as any)
    ),
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });
  const myTaskList = Array.isArray(myTasksRaw) ? myTasksRaw : (myTasksRaw as any)?.results ?? [];

  useEffect(() => { if (!isAuthenticated) logout(); }, [isAuthenticated, logout]);
  if (!isAuthenticated) return null;

  const isRejected = (a: string) => a === 'rejected';

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
    background: D.surf,
    border: `1px solid ${D.border}`,
    borderRadius: 10,
    ...extra,
  });

  const sectionTitle: CSSProperties = { fontSize: 13, fontWeight: 700, color: D.text };
  const viewAllLink: CSSProperties  = { fontSize: 11, color: D.gold, textDecoration: 'none' };

  return (
    <MainLayout>
      <div style={{ background: D.ground, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* ── Header ── */}
        <div style={{ background: D.surf, borderBottom: `1px solid ${D.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 800, color: D.text, margin: 0 }}>Executive Dashboard</h1>
            <p style={{ fontSize: 11, color: D.text3, margin: '2px 0 0' }}>Real-time procurement & operations overview</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {!!stats?.purchaseRequests.pending && (
              <Link href="/purchase-requests?status=pending"
                style={{ background: 'rgba(201,148,58,.1)', border: '1px solid rgba(201,148,58,.22)', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: D.gold, textDecoration: 'none' }}>
                {stats.purchaseRequests.pending} PRs pending
              </Link>
            )}
            {!!hrStats?.pendingRequests && (
              <Link href="/hr/requests?status=pending"
                style={{ background: 'rgba(224,92,92,.08)', border: '1px solid rgba(224,92,92,.18)', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: D.danger, textDecoration: 'none' }}>
                {hrStats.pendingRequests} HR requests
              </Link>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>

          {/* ── KPI strip — no individual boxes ── */}
          <div style={card({ display: 'flex', alignItems: 'stretch', overflow: 'hidden' })}>
            {isLoading
              ? [0,1,2,3,4,5].map(i => (
                  <div key={i} style={{ flex: 1, padding: '20px 24px', borderRight: i < 5 ? `1px solid ${D.border}` : 'none' }}>
                    <div style={{ height: 9, width: '55%', background: D.surf2, borderRadius: 4, marginBottom: 14 }} />
                    <div style={{ height: 28, width: '35%', background: D.surf2, borderRadius: 4 }} />
                  </div>
                ))
              : stats && hrStats && [
                  { label: 'Purchase Requests', value: stats.purchaseRequests.total,  sub: `${stats.purchaseRequests.pending} pending`,  href: '/purchase-requests' },
                  { label: 'Purchase Orders',   value: stats.purchaseOrders.total,    sub: `${stats.purchaseOrders.pending} pending`,    href: '/purchase-orders' },
                  { label: 'Invoices Paid',     value: stats.invoices.paid,           sub: `${stats.invoices.pending} pending`,          href: '/purchase-invoices' },
                  { label: 'Active Projects',   value: projectAnalytics?.length ?? 0, sub: 'view all',                                  href: '/projects' },
                  { label: 'Employees',         value: hrStats.employees,             sub: `${hrStats.presentToday} present today`,      href: '/hr/employees' },
                  { label: 'Suppliers',         value: stats.suppliers.total,         sub: `${stats.products.total} products`,           href: '/suppliers' },
                ].map(({ label, value, sub, href }, i, arr) => (
                  <Link key={href} href={href} style={{
                    flex: 1, padding: '20px 24px',
                    borderRight: i < arr.length - 1 ? `1px solid ${D.border}` : 'none',
                    textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 5,
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = D.surf2; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: D.text3 }}>{label}</div>
                    <div style={{ fontSize: 30, fontWeight: 800, color: D.text, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                    <div style={{ fontSize: 11, color: D.text3 }}>{sub}</div>
                  </Link>
                ))
            }
          </div>

          {/* ── Charts row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>

            <div style={card({ padding: '18px 20px' })}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={sectionTitle}>Procurement Volume</div>
                  <div style={{ fontSize: 11, color: D.text3, marginTop: 2 }}>Monthly request count</div>
                </div>
              </div>
              {(chartData?.monthlyProcurement?.length ?? 0) > 0 && chartData ? (
                <MonthlyVolumeChart data={chartData.monthlyProcurement} label={t('dash', 'requests')} />
              ) : (
                <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.text3, fontSize: 12 }}>No monthly data yet</div>
              )}
            </div>

            <div style={card({ padding: '18px 20px' })}>
              <div style={sectionTitle}>PR Status Split</div>
              <div style={{ fontSize: 11, color: D.text3, marginBottom: 14, marginTop: 3 }}>All-time distribution</div>
              {chartData ? (
                <>
                  <StatusPieCard title="PR Status" href="/purchase-requests" data={[
                    { name: t('dash', 'pending'),  value: chartData.statusDistribution.purchaseRequests.pending },
                    { name: t('dash', 'approved'), value: chartData.statusDistribution.purchaseRequests.approved },
                    { name: t('dash', 'rejected'), value: chartData.statusDistribution.purchaseRequests.rejected },
                  ]} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                    {[
                      { label: t('dash', 'approved'), value: chartData.statusDistribution.purchaseRequests.approved, color: D.gold },
                      { label: t('dash', 'pending'),  value: chartData.statusDistribution.purchaseRequests.pending,  color: D.text2 },
                      { label: t('dash', 'rejected'), value: chartData.statusDistribution.purchaseRequests.rejected, color: D.danger },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: D.text2 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                          {label}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: D.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.text3, fontSize: 12 }}>No data yet</div>
              )}
            </div>
          </div>

          {/* ── 3-column grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

            {/* Active Projects */}
            <div style={card({ padding: '18px 20px', display: 'flex', flexDirection: 'column' })}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={sectionTitle}>Active Projects</div>
                <Link href="/projects" style={viewAllLink}>View all →</Link>
              </div>
              {projectAnalytics && projectAnalytics.length > 0 ? (
                projectAnalytics.slice(0, 5).map((project, idx) => (
                  <div key={project.id} style={{ padding: '10px 0', borderBottom: idx < 4 ? `1px solid ${D.border}` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Link href={`/projects/view/${project.id}`}
                          style={{ fontSize: 12, fontWeight: 600, color: D.text, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = D.gold; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = D.text; }}
                        >{project.name}</Link>
                        <div style={{ fontSize: 10, color: D.text3, marginTop: 2 }}>{project.code}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: D.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0, paddingLeft: 8 }}>{project.progress}%</div>
                    </div>
                    <div style={{ height: 3, background: D.border2, borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, width: `${project.progress}%`, background: project.progress < 25 ? D.danger : D.gold }} />
                    </div>
                    <div style={{ fontSize: 10, color: D.text3, marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>
                      {formatPrice(project.totalSpending)} · {project.poCount} POs
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: D.text3, padding: '24px 0' }}>No projects yet</div>
              )}
            </div>

            {/* Middle column: Cycle + HR */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {cycleMetrics && (
                <div style={card({ padding: '18px 20px' })}>
                  <div style={{ ...sectionTitle, marginBottom: 14 }}>Procurement Cycle</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'PR → PO Avg',      value: cycleMetrics.avgPRToPO },
                      { label: 'PO → GRN Avg',      value: cycleMetrics.avgPOToGRN },
                      { label: 'GRN → Invoice Avg', value: cycleMetrics.avgGRNToInvoice },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ background: D.surf2, borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 10, color: D.text3, marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: D.gold, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                          {value} <span style={{ fontSize: 11, fontWeight: 400, color: D.text3 }}>days</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {cycleMetrics.bottlenecks?.length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${D.border}` }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: D.text2, marginBottom: 8 }}>Bottlenecks</div>
                      {cycleMetrics.bottlenecks.map((b, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < cycleMetrics.bottlenecks.length - 1 ? `1px solid ${D.border}` : 'none' }}>
                          <span style={{ fontSize: 11, color: D.text2 }}>{b.stage}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: b.avgDays > 7 ? D.danger : b.avgDays > 3 ? D.gold : D.text3, fontVariantNumeric: 'tabular-nums' }}>{b.avgDays}d</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {hrStats && (
                <div style={card({ padding: '18px 20px' })}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={sectionTitle}>HR Overview</div>
                    <Link href="/hr/employees" style={viewAllLink}>View all →</Link>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { label: 'Employees',   value: hrStats.employees,       color: D.text },
                      { label: 'Present',     value: hrStats.presentToday,    color: D.text },
                      { label: 'Absent',      value: hrStats.absentToday,     color: D.danger },
                      { label: 'Open Tasks',  value: hrStats.openTasks,       color: D.gold },
                      { label: 'HR Pending',  value: hrStats.pendingRequests, color: hrStats.pendingRequests > 0 ? D.gold : D.text },
                      { label: 'Payrolls',    value: hrStats.draftPayrolls,   color: D.text },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: D.surf2, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
                        <div style={{ fontSize: 9, color: D.text3, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right column: Activity + Tasks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {recentActivity && recentActivity.length > 0 && (
                <div style={card({ padding: '18px 20px', flex: 1 })}>
                  <div style={{ ...sectionTitle, marginBottom: 14 }}>Live Activity</div>
                  {recentActivity.slice(0, 6).map((a, i) => {
                    const dotColor = isRejected(a.action) ? D.danger : D.text3;
                    return (
                      <Link key={`${a.type}-${a.id}`} href={a.link}
                        style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < 5 ? `1px solid ${D.border}` : 'none', textDecoration: 'none' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: 6 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: D.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 600 }}>{typeLabel[a.type] ?? a.type}</span>
                            {' — '}{a.title}
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                            <span style={{ fontSize: 10, color: D.text3 }}>{a.user}</span>
                            <span style={{ fontSize: 10, color: D.text3 }}>{new Date(a.timestamp).toLocaleDateString('en-GB')}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {taskStats && (
                <div style={card({ padding: '18px 20px' })}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={sectionTitle}>My Tasks</div>
                    <Link href="/tasks?scope=mine" style={viewAllLink}>View all →</Link>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                    {[
                      { label: 'Assigned', value: taskStats.my_tasks,      color: D.text },
                      { label: 'Overdue',  value: taskStats.overdue,        color: taskStats.overdue > 0 ? D.danger : D.text },
                      { label: 'Review',   value: taskStats.pending_review, color: D.text },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: D.surf2, borderRadius: 8, padding: '10px 12px' }}>
                        <p style={{ fontSize: 22, fontWeight: 800, color, margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                        <p style={{ fontSize: 9, color: D.text3, margin: '4px 0 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                      </div>
                    ))}
                  </div>
                  {myTaskList.slice(0, 4).map((task: any) => {
                    const overdue = task.due_date && !['approved','closed'].includes(task.status) && new Date(task.due_date) < new Date();
                    return (
                      <Link key={task.id} href={`/tasks/${task.id}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: D.surf2, border: `1px solid ${D.border}`, textDecoration: 'none', marginBottom: 6 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border2; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; }}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: overdue ? D.danger : D.text3, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: D.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{task.title}</span>
                        {overdue && <span style={{ fontSize: 10, color: D.danger, fontWeight: 600, flexShrink: 0 }}>Overdue</span>}
                      </Link>
                    );
                  })}
                  <div style={{ marginTop: 10, display: 'flex', gap: 12 }}>
                    <Link href="/tasks/reports"  style={{ fontSize: 11, color: D.text3, textDecoration: 'none' }}>Reports →</Link>
                    <Link href="/tasks/calendar" style={{ fontSize: 11, color: D.text3, textDecoration: 'none' }}>Calendar →</Link>
                  </div>
                </div>
              )}

              {hrStats && hrStats.recentActivity.length > 0 && (
                <div style={card({ padding: '18px 20px' })}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={sectionTitle}>HR & Tasks Activity</div>
                    <Link href="/hr/requests" style={viewAllLink}>View all →</Link>
                  </div>
                  {hrStats.recentActivity.slice(0, 5).map((a, i) => (
                    <Link key={`hr-${a.type}-${a.id}`} href={a.link}
                      style={{ display: 'block', textDecoration: 'none', padding: '8px 0', borderBottom: i < 4 ? `1px solid ${D.border}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: a.action === 'rejected' ? D.danger : D.text3, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: D.text2 }}>{a.type === 'task' ? 'Task' : 'HR Request'}</span>
                        <span style={{ fontSize: 10, color: D.text3, marginLeft: 'auto' }}>{new Date(a.timestamp).toLocaleDateString('en-GB')}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 11 }}>
                        <span style={{ fontSize: 11, color: D.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{a.title}</span>
                        <span style={{ fontSize: 10, color: D.text3, flexShrink: 0 }}>{a.user}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Top active users ── */}
          {userActivity && userActivity.length > 0 && (
            <div style={card({ padding: '18px 20px' })}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={sectionTitle}>Top Active Users</div>
                <Link href="/hr/employees" style={viewAllLink}>View all →</Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(userActivity.length, 5)}, 1fr)`, gap: 10 }}>
                {userActivity.slice(0, 5).map((u) => {
                  const total = u.createdPR + u.approvedRequests + u.createdPO + u.createdInvoices;
                  return (
                    <Link key={u.id} href="/hr/employees"
                      style={{ background: D.surf2, border: `1px solid ${D.border}`, borderRadius: 8, padding: '14px', textDecoration: 'none', transition: 'border-color .15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border2; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg,${D.gold},#7A5520)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 10 }}>
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: D.text, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: D.gold, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{total}</div>
                      <div style={{ fontSize: 9, color: D.text3, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>actions</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginTop: 10, fontSize: 10, color: D.text3 }}>
                        <span>PR {u.createdPR}</span><span>OK {u.approvedRequests}</span>
                        <span>PO {u.createdPO}</span><span>INV {u.createdInvoices}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Project spending chart ── */}
          {(chartData?.projectSpending?.length ?? 0) > 0 && chartData && (
            <div style={card({ padding: '18px 20px' })}>
              <div style={sectionTitle}>Project Spending</div>
              <div style={{ fontSize: 11, color: D.text3, marginBottom: 16, marginTop: 3 }}>Total AED per project</div>
              <ProjectSpendingChart data={chartData.projectSpending} label={t('dash', 'spendingAed')} />
            </div>
          )}

        </div>
      </div>
    </MainLayout>
  );
}
