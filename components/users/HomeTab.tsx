'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { hrRequestsApi, hrEmployeesApi } from '@/lib/api/hr';
import { tasksApi } from '@/lib/api/tasks';
import { useTenantInfo } from '@/lib/hooks/use-tenant';
import ClockingCard from '@/components/users/ClockingCard';
import type { UserTabProps } from './types';

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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function userInitials(user: any): string {
  const f = (user?.first_name || '').charAt(0).toUpperCase();
  const l = (user?.last_name  || '').charAt(0).toUpperCase();
  return (f + l) || (user?.username || '?').charAt(0).toUpperCase();
}

// ── SVG arc leave indicator ────────────────────────────────────────────────────
const ARC_LEN = 81.7; // π × r, r=26 on a 64×36 viewBox

function LeaveArc({ remaining, total, warn }: { remaining: number; total: number; warn: boolean }) {
  const pct   = total > 0 ? Math.min(1, remaining / total) : 0;
  const color = warn ? '#B45309' : 'var(--sidebar-active-bg, #7B1D2E)';
  return (
    <svg width="64" height="36" viewBox="0 0 64 36" style={{ overflow: 'visible' }}>
      <path d="M6 34 A 26 26 0 0 1 58 34" fill="none" stroke="#EDE9E5"  strokeWidth="5" strokeLinecap="round" />
      {pct > 0 && (
        <path d="M6 34 A 26 26 0 0 1 58 34" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={ARC_LEN} strokeDashoffset={ARC_LEN * (1 - pct)} />
      )}
    </svg>
  );
}

// ── Shared card style ─────────────────────────────────────────────────────────
const CARD: React.CSSProperties = {
  background:   '#fff',
  borderRadius: 24,
  boxShadow:    '0 2px 8px rgba(28,25,23,.07), 0 8px 32px rgba(28,25,23,.08)',
  overflow:     'hidden',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function HomeTab({ user, emp, isSelf }: UserTabProps) {
  const router = useRouter();
  const { data: tenant } = useTenantInfo();

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

  const firstName = user?.first_name || user?.username || 'there';
  const company   = (tenant as any)?.name || '';
  const initials  = userInitials(user);

  const allTasks    = Array.isArray(rawTasks) ? rawTasks : (rawTasks as any)?.results ?? [];
  const activeTasks = allTasks
    .filter((t: any) => ['assigned', 'accepted', 'in_progress', 'submitted', 'review'].includes(t.status))
    .slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Welcome banner */}
      <div style={{ background: 'var(--sidebar-active-bg, #7B1D2E)', borderRadius: 24, padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          {company && (
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', margin: '0 0 4px' }}>
              {company}
            </p>
          )}
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.015em', color: '#fff', margin: '0 0 4px' }}>
            Good {getGreeting()}, {firstName}
          </h2>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', margin: 0 }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0, border: '2px solid rgba(255,255,255,.25)', letterSpacing: '0.02em' }}>
          {initials}
        </div>
      </div>

      {/* Row 2: Clocking + Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, alignItems: 'start' }}>

        <ClockingCard emp={emp} isSelf={isSelf} />

        {/* Quick Actions */}
        <div style={{ ...CARD, padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', margin: '0 0 4px' }}>Quick Actions</p>
          {([
            { label: 'Requests & Approvals', sub: 'Leave, overtime & more', icon: '📋', href: '/hr/requests'    },
            { label: 'My Schedule',           sub: 'Attendance & shifts',    icon: '📅', href: '/hr/attendance' },
          ] as const).map(({ label, sub, icon, href }) => (
            <button key={href} onClick={() => router.push(href)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 14, background: '#F4F2EF', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#EDE9E5')}
              onMouseLeave={e => (e.currentTarget.style.background = '#F4F2EF')}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0, boxShadow: '0 1px 3px rgba(28,25,23,.07), 0 2px 6px rgba(28,25,23,.06)' }}>
                {icon}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#1C1917' }}>{label}</p>
                <p style={{ fontSize: 11, color: '#6B6560', margin: '1px 0 0' }}>{sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Leave Balances */}
      {emp && (
        <div style={{ ...CARD, padding: '22px 24px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', margin: '0 0 16px' }}>
            Time Off Balances
            <span style={{ fontSize: 11, fontWeight: 400, color: '#A8A29E', marginLeft: 6 }}>{CURRENT_YEAR}</span>
          </p>
          {leaveBalances?.results?.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {LEAVE_ORDER.map(type => {
                const bal = leaveBalances.results.find((b: any) => b.leave_type === type);
                if (!bal) return null;
                const total     = parseFloat(bal.total_days)   || 0;
                const used      = parseFloat(bal.used_days)    || 0;
                const pending   = parseFloat(bal.pending_days) || 0;
                const remaining = Math.max(0, total - used - pending);
                const warn      = remaining <= 2 && total > 0;
                return (
                  <div key={type} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '16px 10px', borderRadius: 14, background: '#F4F2EF' }}>
                    <LeaveArc remaining={remaining} total={total} warn={warn} />
                    <p style={{ fontSize: 22, fontWeight: 700, margin: 0, fontVariantNumeric: 'tabular-nums', color: warn ? '#B45309' : '#1C1917', lineHeight: 1 }}>
                      {total === 0 ? '—' : remaining % 1 === 0 ? String(remaining) : remaining.toFixed(1)}
                    </p>
                    <p style={{ fontSize: 10, color: '#A8A29E', margin: 0 }}>of {total} days</p>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B6560', textAlign: 'center', margin: '2px 0 0' }}>
                      {LEAVE_LABELS[type]}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: '#6B6560', margin: 0 }}>No leave balances recorded for {CURRENT_YEAR}.</p>
          )}
        </div>
      )}

      {/* Row 3: Tasks + Who's Off */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* My Tasks */}
        <div style={{ ...CARD, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', margin: 0 }}>My Tasks</p>
            <button onClick={() => router.push('/tasks')}
              style={{ fontSize: 11, fontWeight: 600, color: 'var(--sidebar-active-bg, #7B1D2E)', background: 'none', border: 'none', cursor: 'pointer' }}>
              View all →
            </button>
          </div>
          {activeTasks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeTasks.map((task: any) => (
                <div key={task.id} onClick={() => router.push(`/tasks/${task.id}`)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 12, background: '#F4F2EF', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#EDE9E5')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#F4F2EF')}
                >
                  <div style={{ width: 3, minHeight: 32, borderRadius: 2, flexShrink: 0, background: PRIORITY_DOT[task.priority] || '#6b7280', marginTop: 3 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1C1917' }}>
                      {task.title}
                    </p>
                    <p style={{ fontSize: 11, color: '#6B6560', margin: '2px 0 0' }}>
                      {STATUS_LABELS[task.status] || task.status}{task.due_date ? ` · Due ${fmtShortDate(task.due_date)}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <p style={{ fontSize: 28, margin: '0 0 8px' }}>✓</p>
              <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px', color: '#1C1917' }}>All clear</p>
              <p style={{ fontSize: 12, color: '#6B6560', margin: 0 }}>No active tasks assigned to you.</p>
            </div>
          )}
        </div>

        {/* Who's Off Today */}
        <div style={{ ...CARD, padding: '22px 24px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', margin: '0 0 14px' }}>Who&apos;s Off Today</p>
          {whosOff && whosOff.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {whosOff.map((entry, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < whosOff.length - 1 ? '1px solid #F0EDEA' : 'none' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: '#1C1917' }}>{entry.employee_name}</p>
                    <p style={{ fontSize: 11, color: '#6B6560', margin: 0 }}>{LEAVE_TYPE_LABELS[entry.leave_type] || entry.leave_type}</p>
                  </div>
                  <p style={{ fontSize: 11, color: '#A8A29E', margin: 0, flexShrink: 0, paddingLeft: 10 }}>
                    {fmtShortDate(entry.start_date)}{entry.start_date !== entry.end_date ? ` – ${fmtShortDate(entry.end_date)}` : ''}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <p style={{ fontSize: 28, margin: '0 0 8px' }}>🏢</p>
              <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px', color: '#1C1917' }}>Full team in</p>
              <p style={{ fontSize: 12, color: '#6B6560', margin: 0 }}>Everyone is present today.</p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Birthdays */}
      {birthdays && birthdays.length > 0 && (
        <div style={{ ...CARD, padding: '22px 24px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', margin: '0 0 14px' }}>
            Upcoming Birthdays
            <span style={{ fontSize: 11, fontWeight: 400, color: '#A8A29E', marginLeft: 6 }}>next 30 days</span>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {birthdays.map(b => (
              <div key={b.employee_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: '#F4F2EF' }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>🎂</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1C1917' }}>
                    {b.full_name}
                  </p>
                  <p style={{ fontSize: 11, color: '#6B6560', margin: 0 }}>
                    {b.days_until === 0 ? 'Today! 🎉' : `In ${b.days_until} day${b.days_until === 1 ? '' : 's'}`}
                    {' · '}{fmtShortDate(b.birthday_date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
