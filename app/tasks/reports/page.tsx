'use client';

import { useQuery } from '@tanstack/react-query';
import { tasksApi } from '@/lib/api/tasks';
import type { TaskStats } from '@/types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/components/tasks/shared/constants';
import Link from 'next/link';

function StatCard({ label, value, color, sub }: { label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 20px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 8px' }}>{label}</p>
      <p style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>{sub}</p>}
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 100, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: 'var(--surface-inset)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, width: 28, textAlign: 'right', flexShrink: 0 }}>{value}</span>
    </div>
  );
}

export default function TaskReportsPage() {
  const { data: stats, isLoading } = useQuery<TaskStats>({
    queryKey: ['task-stats'],
    queryFn: () => tasksApi.stats(),
  });

  const totalTasks = Object.values(stats?.by_status ?? {}).reduce((a, b) => a + b, 0);
  const closedDone = (stats?.by_status?.approved ?? 0) + (stats?.by_status?.closed ?? 0);
  const completionRate = totalTasks > 0 ? Math.round((closedDone / totalTasks) * 100) : 0;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Link href="/tasks" style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}>← Tasks</Link>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Task Reports</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Overview of task activity and completion</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: 100, background: 'var(--surface-subtle)', borderRadius: 12, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            <StatCard label="Total Tasks" value={totalTasks} color="var(--text-primary)" />
            <StatCard label="My Tasks" value={stats?.my_tasks ?? 0} color="var(--brand)" />
            <StatCard label="Pending Review" value={stats?.pending_review ?? 0} color="#F59E0B" sub="Waiting for approval" />
            <StatCard label="Overdue" value={stats?.overdue ?? 0} color="#EF4444" sub="Past due date" />
            <StatCard label="Completed This Month" value={stats?.completed_this_month ?? 0} color="#16A34A" />
            <StatCard label="Completion Rate" value={`${completionRate}%`} color={completionRate >= 70 ? '#16A34A' : '#F59E0B'} sub={`${closedDone} of ${totalTasks} closed/approved`} />
          </div>

          {/* Two column charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
            {/* By status */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 24px' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 18px' }}>By Status</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                  <BarRow
                    key={status}
                    label={cfg.label}
                    value={stats?.by_status?.[status as keyof typeof stats.by_status] ?? 0}
                    max={totalTasks}
                    color={cfg.color}
                  />
                ))}
              </div>
            </div>

            {/* By priority */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 24px' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 18px' }}>By Priority</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(['critical', 'high', 'medium', 'low'] as const).map(p => {
                  const cfg = PRIORITY_CONFIG[p];
                  return (
                    <BarRow
                      key={p}
                      label={cfg.label}
                      value={stats?.by_priority?.[p] ?? 0}
                      max={totalTasks}
                      color={cfg.color}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Status breakdown table */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Status Breakdown</p>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-subtle)' }}>
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Count</th>
                  <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(STATUS_CONFIG).map(([s, cfg]) => {
                  const count = stats?.by_status?.[s as keyof typeof stats.by_status] ?? 0;
                  const pct = totalTasks > 0 ? ((count / totalTasks) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={s} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 6, background: cfg.bg, color: cfg.color, fontSize: 12, fontWeight: 600 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{count}</td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
