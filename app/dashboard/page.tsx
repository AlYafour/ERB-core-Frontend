'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api/dashboard';
import {
  FileTextIcon,
  BuildingIcon,
  PackageIcon,
  DollarIcon,
  ShoppingCartIcon,
  BriefcaseIcon,
} from '@/components/icons';
import Link from 'next/link';
import { Badge, PageShell, PageHeader } from '@/components/ui';
import { formatPrice } from '@/lib/utils/format';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import RouteGuard from '@/components/auth/RouteGuard';
import { useT } from '@/lib/i18n/useT';
import { useEffect } from 'react';

/* ─── Palette (CSS semantic tokens) ─────────────────────────────── */
const C = {
  blue:   'var(--color-info)',
  green:  'var(--color-success)',
  amber:  'var(--color-warning)',
  red:    'var(--color-error)',
  purple: '#8B5CF6',
  pink:   '#EC4899',
  indigo: '#6366F1',
  teal:   '#0D9488',
};

const PIE_STATUS_COLORS = [C.amber, C.green, C.red, C.teal];

/* ─── Reusable: Section header with optional "View All" link ─────── */
function SectionHeader({ title, viewAllLabel, href, size = 'lg' }: { title: string; viewAllLabel?: string; href?: string; size?: 'base' | 'lg' }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2
        style={{
          fontSize: size === 'lg' ? 'var(--font-lg)' : 'var(--font-base)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--text-primary)',
          margin: 0,
        }}
      >
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="text-xs transition-colors"
          style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          {viewAllLabel ?? 'View All →'}
        </Link>
      )}
    </div>
  );
}

/* ─── Reusable: MetricGroup card (grouped stat columns) ─────────── */
interface MetricItem { label: string; value: number | string; color: string; href: string; }
function MetricGroup({ title, href, metrics }: { title: string; href: string; metrics: MetricItem[] }) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</span>
        <Link href={href} style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
          View all →
        </Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${metrics.length}, 1fr)`, gap: 0 }}>
        {metrics.map((m, i) => (
          <Link key={i} href={m.href} style={{ textDecoration: 'none', padding: '0 16px 0 0', borderRight: i < metrics.length - 1 ? '1px solid var(--border-primary)' : 'none', marginRight: i < metrics.length - 1 ? 16 : 0 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: m.color, lineHeight: 1, letterSpacing: '-0.02em' }}>{m.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 5, lineHeight: 1.3 }}>{m.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─── Reusable: Metric block (cycle time, etc.) ─────────────────── */
function MetricBlock({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

/* ─── Reusable: Pie chart card ───────────────────────────────────── */
function StatusPieCard({ title, viewAllLabel, href, data }: {
  title: string;
  viewAllLabel?: string;
  href: string;
  data: { name: string; value: number }[];
}) {
  return (
    <div className="card">
      <SectionHeader title={title} viewAllLabel={viewAllLabel} href={href} size="base" />
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_STATUS_COLORS[i % PIE_STATUS_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border-primary)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 12,
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Reusable: Skeleton loader ─────────────────────────────────── */
function CardSkeleton({ height = 120 }: { height?: number }) {
  return (
    <div className="card animate-pulse" style={{ height, backgroundColor: 'var(--bg-secondary)' }} />
  );
}

/* ─── Page guards / redirect ────────────────────────────────────── */
export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role !== 'super_admin' && !user.is_superuser) {
      router.push('/purchase-requests');
    }
  }, [user, router]);

  if (user && user.role !== 'super_admin' && !user.is_superuser) {
    return null;
  }

  return (
    <RouteGuard
      requiredPermission={{ category: 'purchase_request', action: 'view' }}
      redirectTo="/purchase-requests"
    >
      <DashboardContent />
    </RouteGuard>
  );
}

/* ─── Main content ───────────────────────────────────────────────── */
function DashboardContent() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const t = useT();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.getStats,
    enabled: isAuthenticated,
  });

  const { data: projectAnalytics, isLoading: projectsLoading } = useQuery({
    queryKey: ['dashboard', 'project-analytics'],
    queryFn: dashboardApi.getProjectAnalytics,
    enabled: isAuthenticated,
  });

  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['dashboard', 'recent-activity'],
    queryFn: dashboardApi.getRecentActivity,
    enabled: isAuthenticated,
  });

  const { data: userActivity } = useQuery({
    queryKey: ['dashboard', 'user-activity'],
    queryFn: dashboardApi.getUserActivity,
    enabled: isAuthenticated,
  });

  const { data: cycleMetrics } = useQuery({
    queryKey: ['dashboard', 'cycle-metrics'],
    queryFn: dashboardApi.getProcurementCycleMetrics,
    enabled: isAuthenticated,
  });

  const { data: chartData, isLoading: chartsLoading } = useQuery({
    queryKey: ['dashboard', 'chart-data'],
    queryFn: dashboardApi.getChartData,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  const actionBadge = (action: string) =>
    action === 'approved' || action === 'paid' ? 'success'
    : action === 'rejected' ? 'error'
    : 'info';

  const typeLabel: Record<string, string> = {
    purchase_request: t('dash', 'purchaseRequest'),
    quotation:        t('dash', 'quotation'),
    purchase_order:   t('dash', 'purchaseOrder'),
    grn:              t('dash', 'grn'),
    invoice:          t('dash', 'invoice'),
  };

  return (
    <MainLayout>
      <PageShell>

        {/* ── Page header ─────────────────────────────────────────── */}
        <PageHeader
          title={t('dash', 'execDashboard')}
          description={t('dash', 'overviewSubtitle')}
          breadcrumbs={[{ label: 'Dashboard' }]}
        />

        {/* ── MetricGroup KPI row ─────────────────────────────────── */}
        {statsLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[130, 130, 130].map((h, i) => <CardSkeleton key={i} height={h} />)}
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricGroup title="Purchase Requests" href="/purchase-requests" metrics={[
              { label: t('dash', 'prTotal'),    value: stats.purchaseRequests.total,   color: C.blue,  href: '/purchase-requests' },
              { label: t('dash', 'prPending'),  value: stats.purchaseRequests.pending, color: C.amber, href: '/purchase-requests?status=pending' },
              { label: t('dash', 'prApproved'), value: stats.purchaseRequests.approved, color: C.green, href: '/purchase-requests?status=approved' },
              { label: t('dash', 'prRejected'), value: stats.purchaseRequests.rejected, color: C.red,   href: '/purchase-requests?status=rejected' },
            ]} />
            <MetricGroup title="Purchase Orders" href="/purchase-orders" metrics={[
              { label: t('dash', 'poTotal'),     value: stats.purchaseOrders.total,     color: C.blue,  href: '/purchase-orders' },
              { label: t('dash', 'poPending'),   value: stats.purchaseOrders.pending,   color: C.amber, href: '/purchase-orders?status=pending' },
              { label: t('dash', 'poApproved'),  value: stats.purchaseOrders.approved,  color: C.green, href: '/purchase-orders?status=approved' },
              { label: t('dash', 'poCompleted'), value: stats.purchaseOrders.completed, color: C.teal,  href: '/purchase-orders?status=completed' },
            ]} />
            <MetricGroup title="Invoices & Catalog" href="/purchase-invoices" metrics={[
              { label: t('dash', 'invPaid'),    value: stats.invoices.paid,    color: C.green,  href: '/purchase-invoices?status=paid' },
              { label: t('dash', 'invPending'), value: stats.invoices.pending, color: C.amber,  href: '/purchase-invoices?status=pending' },
              { label: t('dash', 'suppliers'),  value: stats.suppliers.total,  color: C.indigo, href: '/suppliers' },
              { label: t('dash', 'products'),   value: stats.products.total,   color: C.purple, href: '/products' },
            ]} />
          </div>
        )}

        {/* ── Status pie charts ───────────────────────────────────── */}
        {chartsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CardSkeleton height={240} />
            <CardSkeleton height={240} />
            <CardSkeleton height={240} />
          </div>
        ) : chartData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatusPieCard
              title={t('dash', 'prByStatus')}
              viewAllLabel={t('dash', 'viewAll')}
              href="/purchase-requests"
              data={[
                { name: t('dash', 'pending'),  value: chartData.statusDistribution.purchaseRequests.pending },
                { name: t('dash', 'approved'), value: chartData.statusDistribution.purchaseRequests.approved },
                { name: t('dash', 'rejected'), value: chartData.statusDistribution.purchaseRequests.rejected },
              ]}
            />
            <StatusPieCard
              title={t('dash', 'poByStatus')}
              viewAllLabel={t('dash', 'viewAll')}
              href="/purchase-orders"
              data={[
                { name: t('dash', 'pending'),   value: chartData.statusDistribution.purchaseOrders.pending },
                { name: t('dash', 'approved'),  value: chartData.statusDistribution.purchaseOrders.approved },
                { name: t('dash', 'rejected'),  value: chartData.statusDistribution.purchaseOrders.rejected },
                { name: t('dash', 'completed'), value: chartData.statusDistribution.purchaseOrders.completed },
              ]}
            />
            <StatusPieCard
              title={t('dash', 'invByStatus')}
              viewAllLabel={t('dash', 'viewAll')}
              href="/purchase-invoices"
              data={[
                { name: t('dash', 'pending'),  value: chartData.statusDistribution.invoices.pending },
                { name: t('dash', 'approved'), value: chartData.statusDistribution.invoices.approved },
                { name: t('dash', 'paid'),     value: chartData.statusDistribution.invoices.paid },
              ]}
            />
          </div>
        )}

        {/* ── Main content: 2/3 left + 1/3 right ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Top spending projects */}
            {projectsLoading ? (
              <CardSkeleton height={220} />
            ) : projectAnalytics && projectAnalytics.length > 0 && (
              <div className="card">
                <SectionHeader title={t('dash', 'topProjects')} viewAllLabel={t('dash', 'viewAll')} href="/projects" />
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('dash', 'project')}</th>
                        <th>{t('dash', 'code')}</th>
                        <th>{t('dash', 'spending')}</th>
                        <th>{t('dash', 'pos')}</th>
                        <th>{t('dash', 'progress')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectAnalytics.slice(0, 5).map((project) => (
                        <tr key={project.id}>
                          <td>
                            <Link
                              href={`/projects/view/${project.id}`}
                              className="font-medium"
                              style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary)'; e.currentTarget.style.textDecoration = 'underline'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.textDecoration = 'none'; }}
                            >
                              {project.name}
                            </Link>
                          </td>
                          <td><span style={{ color: 'var(--text-secondary)' }}>{project.code}</span></td>
                          <td><span className="font-semibold">{formatPrice(project.totalSpending)}</span></td>
                          <td><Badge variant="info">{project.poCount}</Badge></td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)', minWidth: 60 }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${project.progress}%`,
                                    backgroundColor: project.progress > 75 ? C.green : project.progress > 50 ? C.amber : C.blue,
                                  }}
                                />
                              </div>
                              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{project.progress}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Monthly procurement volume chart */}
            {(chartData?.monthlyProcurement?.length ?? 0) > 0 && chartData && (
              <div className="card">
                <SectionHeader title={t('dash', 'monthlyVolume')} />
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData.monthlyProcurement}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                    <XAxis dataKey="month" stroke="var(--text-secondary)" style={{ fontSize: 11 }} />
                    <YAxis stroke="var(--text-secondary)" style={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card-bg)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 8,
                        color: 'var(--text-primary)',
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="count" stroke={C.blue} strokeWidth={2} dot={false} name={t('dash', 'requests')} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Project spending bar chart */}
            {(chartData?.projectSpending?.length ?? 0) > 0 && chartData && (
              <div className="card">
                <SectionHeader title={t('dash', 'projectSpending')} />
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData.projectSpending} margin={{ bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                    <XAxis
                      dataKey="project"
                      stroke="var(--text-secondary)"
                      style={{ fontSize: 11 }}
                      angle={-40}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis stroke="var(--text-secondary)" style={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card-bg)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 8,
                        color: 'var(--text-primary)',
                        fontSize: 12,
                      }}
                      formatter={(v: number) => formatPrice(v)}
                    />
                    <Bar dataKey="spending" fill={C.green} name={t('dash', 'spendingAed')} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">

            {/* Procurement cycle metrics */}
            {cycleMetrics && (
              <div className="card">
                <SectionHeader title={t('dash', 'procCycle')} />
                <div className="space-y-3">
                  <MetricBlock label={t('dash', 'prToPoAvg')}   value={`${cycleMetrics.avgPRToPO} ${t('dash', 'days')}`}        color={C.blue} />
                  <MetricBlock label={t('dash', 'poToGrnAvg')}  value={`${cycleMetrics.avgPOToGRN} ${t('dash', 'days')}`}       color={C.green} />
                  <MetricBlock label={t('dash', 'grnToInvAvg')} value={`${cycleMetrics.avgGRNToInvoice} ${t('dash', 'days')}`}  color={C.purple} />
                </div>
                {cycleMetrics.bottlenecks?.length > 0 && (
                  <div style={{ marginTop: 'var(--spacing-4)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--border-primary)' }}>
                    <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('dash', 'bottlenecks')}</div>
                    <div className="space-y-2">
                      {cycleMetrics.bottlenecks.map((b, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{b.stage}</span>
                          <span className="text-sm font-bold" style={{ color: b.avgDays > 7 ? C.red : b.avgDays > 3 ? C.amber : C.green }}>
                            {b.avgDays}d
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Top active users */}
            {userActivity && userActivity.length > 0 && (
              <div className="card">
                <SectionHeader title={t('dash', 'topUsers')} viewAllLabel={t('dash', 'viewAll')} href="/users" />
                <div className="space-y-2">
                  {userActivity.slice(0, 5).map((u) => {
                    const total = u.createdPR + u.approvedRequests + u.createdPO + u.createdInvoices;
                    return (
                      <Link
                        key={u.id}
                        href={`/users/view/${u.id}`}
                        className="block p-3 rounded-lg transition-colors"
                        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', textDecoration: 'none' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{u.username}</span>
                          <Badge variant="info">{total}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span>PR: {u.createdPR}</span>
                          <span>Approved: {u.approvedRequests}</span>
                          <span>PO: {u.createdPO}</span>
                          <span>Invoices: {u.createdInvoices}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent activity feed */}
            {activityLoading ? (
              <CardSkeleton height={300} />
            ) : recentActivity && recentActivity.length > 0 && (
              <div className="card">
                <SectionHeader title={t('dash', 'recentActivity')} />
                <div>
                  {recentActivity.slice(0, 8).map((a, i) => (
                    <Link
                      key={`${a.type}-${a.id}`}
                      href={a.link}
                      style={{ display: 'block', textDecoration: 'none', padding: '9px 0', borderBottom: i < 7 ? '1px solid var(--border-primary)' : 'none' }}
                      onMouseEnter={e => {
                        e.currentTarget.style.paddingLeft = '8px';
                        e.currentTarget.style.borderLeft = `2px solid ${actionBadge(a.action) === 'success' ? C.green : actionBadge(a.action) === 'error' ? C.red : C.blue}`;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.paddingLeft = '0';
                        e.currentTarget.style.borderLeft = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: actionBadge(a.action) === 'success' ? C.green : actionBadge(a.action) === 'error' ? C.red : C.blue, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{typeLabel[a.type] ?? a.type}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{new Date(a.timestamp).toLocaleDateString('en-GB')}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 12 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{a.title}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{a.user}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
}
