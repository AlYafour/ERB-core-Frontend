'use client';

import { useQuery } from '@tanstack/react-query';
import { tenantApi } from '@/lib/api/tenants';
import Link from 'next/link';

function StatCard({
  value, label, color,
}: { value: number | string; label: string; color: string }) {
  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}

export default function PlatformDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['super', 'stats'],
    queryFn: tenantApi.getStats,
    staleTime: 60_000,
  });

  return (
    <div style={{ maxWidth: 900 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Platform Dashboard
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6, marginBottom: 0 }}>
            Overview of all tenants, subscriptions and platform activity.
          </p>
        </div>

        {isLoading ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading stats…</div>
        ) : stats ? (
          <>
            {/* Row 1: Tenants */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
                Companies
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                <StatCard value={stats.total_tenants}    label="Total Companies"    color="var(--color-info)"    />
                <StatCard value={stats.active_tenants}   label="Active"             color="var(--color-success)" />
                <StatCard value={stats.trial_tenants}    label="Trial"              color="var(--color-warning)" />
                <StatCard value={stats.suspended_tenants} label="Suspended"         color="var(--color-error)"   />
              </div>
            </div>

            {/* Row 2: Platform */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
                Platform
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                <StatCard value={stats.total_users}     label="Total Users"         color="var(--text-primary)"  />
                <StatCard value={stats.platform_admins} label="Platform Admins"     color="var(--wine-500)"      />
                <StatCard value={stats.total_plans}     label="Plans"               color="var(--color-info)"    />
                <StatCard value={stats.audit_logs_today} label="Audit Logs Today"   color="var(--text-secondary)"/>
              </div>
            </div>
          </>
        ) : null}

        {/* Quick links */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
            Quick Actions
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { href: '/super-admin/companies',  label: 'Manage Companies' },
              { href: '/super-admin/plans',      label: 'View Plans'       },
              { href: '/super-admin/modules',    label: 'Module Management'},
              { href: '/super-admin/audit-logs', label: 'Audit Logs'       },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-card)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'border-color 150ms, background 150ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.background = 'var(--surface-raised)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.background = 'var(--surface-card)';
                }}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

      </div>
  );
}
