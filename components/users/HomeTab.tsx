'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { hrRequestsApi, hrEmployeesApi } from '@/lib/api/hr';
import { tasksApi } from '@/lib/api/tasks';
import { useTenantInfo } from '@/lib/hooks/use-tenant';
import ClockingCard from '@/components/users/ClockingCard';
import type { UserTabProps } from './OverviewTab';

// ── Constants ──────────────────────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();

const LEAVE_LABELS: Record<string, string> = {
  annual_leave:    'Annual',
  sick_leave:      'Sick',
  emergency_leave: 'Emergency',
  unpaid_leave:    'Unpaid',
};
const LEAVE_ORDER = ['annual_leave', 'sick_leave', 'emergency_leave', 'unpaid_leave'];

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual_leave:    'Annual Leave',
  sick_leave:      'Sick Leave',
  emergency_leave: 'Emergency Leave',
  unpaid_leave:    'Unpaid Leave',
  work_from_home:  'Work From Home',
};

const PRIORITY_DOT: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#6b7280',
};

const STATUS_LABELS: Record<string, string> = {
  assigned:    'Assigned',
  accepted:    'Accepted',
  in_progress: 'In Progress',
  submitted:   'Submitted',
  review:      'In Review',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtShortDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function HomeTab({ user, emp, isSelf }: UserTabProps) {
  const router = useRouter();
  const { data: tenant } = useTenantInfo();

  // ── Queries ───────────────────────────────────────────────────────────────────
  const { data: leaveBalances } = useQuery({
    queryKey: ['leave-balances', emp?.id],
    queryFn:  () => hrRequestsApi.getLeaveBalances({ employee: emp!.id, year: CURRENT_YEAR }),
    enabled:  !!emp,
  });

  const { data: rawTasks } = useQuery({
    queryKey: ['my-tasks-home'],
    queryFn:  () => tasksApi.getAll({ scope: 'mine', page_size: 5 } as any),
  });

  const { data: whosOff } = useQuery({
    queryKey: ['whos-off-today'],
    queryFn:  () => hrRequestsApi.getWhosOffToday(),
  });

  const { data: birthdays } = useQuery({
    queryKey: ['upcoming-birthdays'],
    queryFn:  () => hrEmployeesApi.getUpcomingBirthdays(30),
  });

  // ── Derived ───────────────────────────────────────────────────────────────────
  const firstName = user?.first_name || user?.username || 'there';
  const company   = (tenant as any)?.name || '';

  // Normalize tasks (bare array or paginated)
  const allTasks    = Array.isArray(rawTasks) ? rawTasks : (rawTasks as any)?.results ?? [];
  const activeTasks = allTasks
    .filter((t: any) => ['assigned', 'accepted', 'in_progress', 'submitted', 'review'].includes(t.status))
    .slice(0, 5);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* A1 — Welcome header */}
      <div className="card" style={{ background: 'var(--sidebar-active-bg)', border: 'none', padding: 'var(--space-6) var(--space-8)' }}>
        {company && (
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--sidebar-active-text)', opacity: 0.75, margin: '0 0 var(--space-1)' }}>
            {company}
          </p>
        )}
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--sidebar-active-text)', margin: 0 }}>
          Welcome back, {firstName}
        </h2>
      </div>

      {/* Row 2 — Clocking + Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)', alignItems: 'start' }}>

        {/* A3 — Today's Clocking */}
        <ClockingCard emp={emp} isSelf={isSelf} />

        {/* A4 — Quick Actions */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: '0 0 var(--space-1)' }}>Quick Actions</h3>
          {([
            { label: 'Approvals & Requests', sub: 'Leave, overtime & more', icon: '📋', href: '/hr/requests' },
            { label: 'My Schedule',           sub: 'Attendance & shifts',    icon: '📅', href: '/hr/attendance' },
          ] as const).map(({ label, sub, icon, href }) => (
            <button key={href} onClick={() => router.push(href)}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)',
                background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}>
              <span style={{ fontSize: 'var(--text-xl)', flexShrink: 0 }}>{icon}</span>
              <div>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>{label}</p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>{sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* A2 — Time Off Balances */}
      {emp && (
        <div className="card">
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: '0 0 var(--space-4)' }}>Time Off Balances</h3>
          {leaveBalances?.results?.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
              {LEAVE_ORDER.map(type => {
                const bal = leaveBalances.results.find((b: any) => b.leave_type === type);
                if (!bal) return null;
                const total     = parseFloat(bal.total_days)   || 0;
                const used      = parseFloat(bal.used_days)    || 0;
                const pending   = parseFloat(bal.pending_days) || 0;
                const remaining = Math.max(0, total - used - pending);
                const pct       = total > 0 ? Math.min(100, (remaining / total) * 100) : 0;
                const color     = remaining > 5 ? 'var(--sidebar-active-text)' : remaining > 0 ? '#f59e0b' : '#ef4444';
                return (
                  <div key={type} style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', background: 'var(--surface-subtle)', textAlign: 'center' }}>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 'var(--weight-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 var(--space-2)' }}>
                      {LEAVE_LABELS[type]}
                    </p>
                    <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', margin: '0 0 var(--space-1)' }}>{remaining.toFixed(1)}</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-3)' }}>of {total} days</p>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--border-default)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 400ms ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
              No leave balances recorded for {CURRENT_YEAR}.
            </p>
          )}
        </div>
      )}

      {/* Row 3 — My Tasks + Who's Off */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)', alignItems: 'start' }}>

        {/* A5 — My Tasks */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>My Tasks</h3>
            <button onClick={() => router.push('/tasks')}
              style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--sidebar-active-text)', background: 'none', border: 'none', cursor: 'pointer' }}>
              View all →
            </button>
          </div>
          {activeTasks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {activeTasks.map((task: any) => (
                <div key={task.id} onClick={() => router.push(`/tasks/${task.id}`)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
                    padding: 'var(--space-2-5) var(--space-3)', borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-subtle)', cursor: 'pointer',
                  }}>
                  <div style={{ width: 3, minHeight: 36, borderRadius: 2, flexShrink: 0, background: PRIORITY_DOT[task.priority] || '#6b7280', marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.title}
                    </p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                      {STATUS_LABELS[task.status] || task.status}
                      {task.due_date ? ` · Due ${fmtShortDate(task.due_date)}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)' }}>
              <p style={{ fontSize: 'var(--text-3xl)', margin: '0 0 var(--space-2)' }}>✓</p>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: '0 0 var(--space-1)' }}>All clear</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>No active tasks assigned to you.</p>
            </div>
          )}
        </div>

        {/* A6 — Who's Off Today */}
        <div className="card">
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: '0 0 var(--space-4)' }}>Who's Off Today</h3>
          {whosOff && whosOff.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {whosOff.map((entry, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2-5) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--surface-subtle)' }}>
                  <div>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: 0 }}>{entry.employee_name}</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                      {LEAVE_TYPE_LABELS[entry.leave_type] || entry.leave_type}
                    </p>
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, flexShrink: 0, paddingLeft: 'var(--space-2)' }}>
                    {fmtShortDate(entry.start_date)}
                    {entry.start_date !== entry.end_date ? ` – ${fmtShortDate(entry.end_date)}` : ''}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)' }}>
              <p style={{ fontSize: 'var(--text-3xl)', margin: '0 0 var(--space-2)' }}>🏢</p>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: '0 0 var(--space-1)' }}>Full team in</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>Everyone is present today.</p>
            </div>
          )}
        </div>
      </div>

      {/* A7 — Upcoming Birthdays */}
      <div className="card">
        <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: '0 0 var(--space-4)' }}>
          Upcoming Birthdays
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 'var(--weight-normal)', marginLeft: 'var(--space-2)' }}>next 30 days</span>
        </h3>
        {birthdays && birthdays.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
            {birthdays.map(b => (
              <div key={b.employee_id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--surface-subtle)' }}>
                <span style={{ fontSize: 'var(--text-2xl)', flexShrink: 0 }}>🎂</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.full_name}
                  </p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                    {b.days_until === 0 ? 'Today! 🎉' : `In ${b.days_until} day${b.days_until === 1 ? '' : 's'}`}
                    {' · '}{fmtShortDate(b.birthday_date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            No birthdays in the next 30 days.
          </p>
        )}
      </div>

    </div>
  );
}
