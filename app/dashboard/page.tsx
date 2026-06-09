'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api/dashboard';
import Link from 'next/link';
import { Badge, PageShell, PageHeader } from '@/components/ui';
import { formatPrice } from '@/lib/utils/format';
import dynamic from 'next/dynamic';
import RouteGuard from '@/components/auth/RouteGuard';
import { useT } from '@/lib/i18n/useT';
import { useEffect, useMemo, useState } from 'react';

/* ─── Lazy-load chart components — recharts only downloaded when dashboard renders ─ */
const MonthlyVolumeChart  = dynamic(() => import('./charts').then(m => ({ default: m.MonthlyVolumeChart })),  { ssr: false });
const ProjectSpendingChart = dynamic(() => import('./charts').then(m => ({ default: m.ProjectSpendingChart })), { ssr: false });

/* ─── Palette (CSS semantic tokens) ─────────────────────────────── */
const C = {
  blue:   'var(--color-info)',
  green:  'var(--color-success)',
  amber:  'var(--color-warning)',
  red:    'var(--color-error)',
  purple: '#8B5CF6',
  indigo: '#6366F1',
  teal:   '#0D9488',
};

/* ─── Reusable: Section header with optional "View All" link ─────── */
function SectionHeader({ title, viewAllLabel, href, size = 'lg' }: { title: string; viewAllLabel?: string; href?: string; size?: 'base' | 'lg' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
      <h2
        style={{
          fontSize: size === 'lg' ? 'var(--text-lg)' : 'var(--text-base)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--text-primary)',
          margin: 0,
        }}
      >
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textDecoration: 'none' }}
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
          <Link key={i} href={m.href} style={{ textDecoration: 'none', padding: '0 16px 0 0', borderRight: i < metrics.length - 1 ? '1px solid var(--border-subtle)' : 'none', marginRight: i < metrics.length - 1 ? 16 : 0 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: m.color, lineHeight: 1, letterSpacing: '-0.02em' }}>{m.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 5, lineHeight: 1.3 }}>{m.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─── Reusable: Skeleton loader ─────────────────────────────────── */
function CardSkeleton({ height = 120 }: { height?: number }) {
  return (
    <div className="card animate-pulse" style={{ height, backgroundColor: 'var(--surface-subtle)' }} />
  );
}

/* ─── Page guards / redirect ────────────────────────────────────── */
export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (user && user.role !== 'admin' && !user.is_superuser) {
      router.push('/purchase-requests');
    }
  }, [mounted, user, router]);

  if (!mounted) {
    return null;
  }

  if (user && user.role !== 'admin' && !user.is_superuser) {
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
  const t = useT();

  /* Single combined query — replaces 6 individual requests */
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'combined'],
    queryFn: dashboardApi.getCombined,
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });

  const stats            = data?.stats;
  const chartData        = data?.chartData;
  const projectAnalytics = data?.projectAnalytics;

  if (!isAuthenticated) {
    return null;
  }

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
        {isLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
            {[130, 130, 130].map((h, i) => <CardSkeleton key={i} height={h} />)}
          </div>
        )}

        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
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

        {/* ── Main content: full width ─────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

            {/* Top spending projects */}
            {isLoading ? (
              <CardSkeleton height={220} />
            ) : projectAnalytics && projectAnalytics.length > 0 && (
              <div className="card">
                <SectionHeader title={t('dash', 'topProjects')} viewAllLabel={t('dash', 'viewAll')} href="/projects" />
                <div style={{ overflowX: 'auto' }}>
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
                              style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 'var(--weight-medium)' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary)'; e.currentTarget.style.textDecoration = 'underline'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.textDecoration = 'none'; }}
                            >
                              {project.name}
                            </Link>
                          </td>
                          <td><span style={{ color: 'var(--text-secondary)' }}>{project.code}</span></td>
                          <td><span style={{ fontWeight: 'var(--weight-semibold)' }}>{formatPrice(project.totalSpending)}</span></td>
                          <td><Badge variant="info">{project.poCount}</Badge></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <div style={{ flex: 1, height: 8, borderRadius: 9999, overflow: 'hidden', backgroundColor: 'var(--surface-inset)', minWidth: 60 }}>
                                <div
                                  style={{
                                    height: '100%',
                                    borderRadius: 9999,
                                    width: `${project.progress}%`,
                                    backgroundColor: project.progress > 75 ? C.green : project.progress > 50 ? C.amber : C.blue,
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{project.progress}%</span>
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
                <MonthlyVolumeChart data={chartData.monthlyProcurement} label={t('dash', 'requests')} />
              </div>
            )}

            {/* Project spending bar chart */}
            {(chartData?.projectSpending?.length ?? 0) > 0 && chartData && (
              <div className="card">
                <SectionHeader title={t('dash', 'projectSpending')} />
                <ProjectSpendingChart data={chartData.projectSpending} label={t('dash', 'spendingAed')} />
              </div>
            )}
        </div>
      </PageShell>
    </MainLayout>
  );
}
