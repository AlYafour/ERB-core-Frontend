'use client';

import Link from 'next/link';
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
import { Badge, Loader } from '@/components/ui';
import Avatar from '@/components/ui/Avatar';
import { useMyEmployeeRecord } from '@/lib/hooks/use-my-employee-record';

/* ── helpers ─────────────────────────────────────────────────────── */
function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
const countOf = (d: unknown): number =>
  Array.isArray(d) ? d.length : ((d as { count?: number })?.count ?? (d as { results?: unknown[] })?.results?.length ?? 0);
const listOf = <T,>(d: unknown): T[] =>
  Array.isArray(d) ? (d as T[]) : ((d as { results?: T[] })?.results ?? []);

/* Shared React-Query definitions — the stat tiles and the activity widgets
   reuse the SAME query keys, so they share one fetch (no duplicate requests). */
const Q = {
  tasks:     { queryKey: ['workspace-my-tasks'],        queryFn: () => tasksApi.getAll({ scope: 'mine', page_size: 6 }) },
  hr:        { queryKey: ['workspace-my-hr-requests'],  queryFn: () => hrRequestsApi.getAll({ status: 'pending', page_size: 5 }) },
  approvals: { queryKey: ['workspace-my-approvals'],    queryFn: () => hrRequestsApi.getPendingMyApproval() },
  prs: (userId: number) => ({ queryKey: ['workspace-my-prs', userId], queryFn: () => purchaseRequestsApi.getAll({ status: 'pending', created_by: userId, page_size: 5 }) }),
} as const;

/* ── Card wrapper ────────────────────────────────────────────────── */
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="card" style={{ padding: 'var(--space-5)', ...style }}>{children}</div>;
}

/* ── Stat tile ───────────────────────────────────────────────────── */
function StatTile({ label, value, href, accent }: { label: string; value: number; href: string; accent?: boolean }) {
  return (
    <Link href={href} style={{
      textDecoration: 'none', display: 'block', padding: 'var(--space-4) var(--space-5)',
      borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)',
      background: 'var(--surface-primary)', transition: 'border-color .15s, box-shadow .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,.06))'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none'; }}>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: accent && value > 0 ? 'var(--brand)' : 'var(--text-primary)', marginTop: 'var(--space-1)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </Link>
  );
}
function StatFromQuery({ label, href, q, accent }: { label: string; href: string; q: { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }; accent?: boolean }) {
  const { data } = useQuery({ queryKey: q.queryKey as unknown[], queryFn: q.queryFn, staleTime: 60_000 });
  return <StatTile label={label} value={countOf(data)} href={href} accent={accent} />;
}

/* ── Widget header ───────────────────────────────────────────────── */
function WidgetHead({ title, count, href }: { title: string; count?: number; href?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>{title}</span>
        {count !== undefined && count > 0 && (
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', minWidth: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--brand-muted)', color: 'var(--brand)', padding: '0 6px' }}>{count}</span>
        )}
      </div>
      {href && (
        <Link href={href} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textDecoration: 'none' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
          View all →
        </Link>
      )}
    </div>
  );
}

function Empty({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding: 'var(--space-5) 0', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', margin: action ? '0 0 var(--space-3)' : 0 }}>{message}</p>
      {action}
    </div>
  );
}

function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--surface-subtle)' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--border-subtle)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-subtle)'; }}>
      {children}
    </Link>
  );
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'var(--status-error)', high: 'var(--status-warning)',
  medium: 'var(--text-tertiary)', low: 'var(--border-default)',
};

/* ── Widgets ─────────────────────────────────────────────────────── */
interface Task { id: number; title: string; priority: string }
function MyTasksWidget() {
  const { data, isLoading, isError } = useQuery({ ...Q.tasks, staleTime: 60_000 });
  const items = listOf<Task>(data);
  return (
    <Card>
      <WidgetHead title="My Tasks" count={countOf(data)} href="/tasks" />
      {isLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-5)' }}><Loader /></div>
        : isError ? <Empty message="Could not load tasks." />
        : items.length === 0 ? <Empty message="No tasks assigned to you." />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {items.slice(0, 6).map(t => (
              <RowLink key={t.id} href={`/tasks/${t.id}`}>
                <span style={{ width: 6, height: 6, borderRadius: 3, flexShrink: 0, background: PRIORITY_COLOR[t.priority] ?? 'var(--text-tertiary)' }} />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                {(t.priority === 'urgent' || t.priority === 'high') && <Badge variant="error" style={{ fontSize: 'var(--text-xs)', flexShrink: 0 }}>{t.priority}</Badge>}
              </RowLink>
            ))}
          </div>
        )}
    </Card>
  );
}

interface Req { id: number; request_type: string; days?: string; start_date?: string }
function MyHRWidget() {
  const { data, isLoading, isError } = useQuery({ ...Q.hr, staleTime: 60_000 });
  const items = listOf<Req>(data);
  return (
    <Card>
      <WidgetHead title="My HR Requests" count={countOf(data)} href="/hr/requests" />
      {isLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-5)' }}><Loader /></div>
        : isError ? <Empty message="Could not load HR requests." />
        : items.length === 0 ? (
          <Empty message="No pending requests." action={
            <Link href="/hr/requests" style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--brand)', textDecoration: 'none', padding: 'var(--space-1-5) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--brand-muted)' }}>+ New Request</Link>
          } />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {items.slice(0, 5).map(r => (
              <RowLink key={r.id} href={`/hr/requests/${r.id}`}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)', flex: 1 }}>{resolveRequestTypeLabel(r.request_type)}</span>
                <Badge variant="warning" style={{ fontSize: 'var(--text-xs)', flexShrink: 0 }}>pending</Badge>
              </RowLink>
            ))}
          </div>
        )}
    </Card>
  );
}

interface Approval { id: number; request_type: string; employee_name?: string }
function MyApprovalsWidget() {
  const { data, isLoading, isError } = useQuery({ ...Q.approvals, staleTime: 60_000 });
  const items = listOf<Approval>(data);
  return (
    <Card>
      <WidgetHead title="Awaiting My Approval" count={countOf(data)} href="/hr/requests" />
      {isLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-5)' }}><Loader /></div>
        : isError ? <Empty message="Could not load approvals." />
        : items.length === 0 ? <Empty message="Nothing waiting for your approval." />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {items.slice(0, 6).map(a => (
              <RowLink key={a.id} href={`/hr/requests/${a.id}`}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {resolveRequestTypeLabel(a.request_type)}{a.employee_name ? ` · ${a.employee_name}` : ''}
                </span>
                <Badge variant="warning" style={{ fontSize: 'var(--text-xs)', flexShrink: 0 }}>review</Badge>
              </RowLink>
            ))}
          </div>
        )}
    </Card>
  );
}

interface PR { id: number; code: string; title: string }
function MyProcurementWidget({ userId }: { userId: number }) {
  const { data, isLoading, isError } = useQuery({ ...Q.prs(userId), staleTime: 60_000 });
  const items = listOf<PR>(data);
  return (
    <Card>
      <WidgetHead title="My Purchase Requests" count={countOf(data)} href="/purchase-requests" />
      {isLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-5)' }}><Loader /></div>
        : isError ? <Empty message="Could not load purchase requests." />
        : items.length === 0 ? <Empty message="No pending purchase requests." />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {items.slice(0, 5).map(pr => (
              <RowLink key={pr.id} href={`/purchase-requests/${pr.id}`}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', fontFamily: 'monospace', flexShrink: 0 }}>{pr.code}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.title}</span>
                <Badge variant="warning" style={{ fontSize: 'var(--text-xs)', flexShrink: 0 }}>pending</Badge>
              </RowLink>
            ))}
          </div>
        )}
    </Card>
  );
}

/* ── Root ────────────────────────────────────────────────────────── */
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

  if (!user) return <MainLayout><div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}><Loader /></div></MainLayout>;

  const profileHref = myEmp?.id ? `/hr/employees/${myEmp.id}` : `/users/${user.id}`;
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || '';
  const roleLabel   = (user as unknown as { permission_set?: { name?: string } })?.permission_set?.name || (user.role?.replace(/_/g, ' ') ?? '');

  return (
    <MainLayout>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'var(--space-7) var(--space-5)' }}>

        {/* Header — greeting + profile chip */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              {timeGreeting()}, {user.first_name || displayName}
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0' }}>
              {tenantData?.name ?? 'Your workspace'}{roleLabel ? ` · ${roleLabel}` : ''}
            </p>
          </div>
          <Link href={profileHref} className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-4)', textDecoration: 'none' }}>
            <Avatar src={(user as unknown as { avatar_url?: string; avatar?: string }).avatar_url || (user as unknown as { avatar?: string }).avatar} alt={displayName} size={36} username={user.username} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: 0 }}>{displayName}</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>View my profile →</p>
            </div>
          </Link>
        </div>

        {/* Stat tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <StatFromQuery label="My Tasks" href="/tasks" q={Q.tasks} />
          {showHR && <StatFromQuery label="My Requests" href="/hr/requests" q={Q.hr} />}
          {canApprove && <StatFromQuery label="Awaiting My Approval" href="/hr/requests" q={Q.approvals} accent />}
          {showProc && <StatFromQuery label="Purchase Requests" href="/purchase-requests" q={Q.prs(user.id)} />}
        </div>

        {/* Activity grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-4)', alignItems: 'start' }}>
          {canApprove && <MyApprovalsWidget />}
          {showHR && <MyHRWidget />}
          <MyTasksWidget />
          {showProc && <MyProcurementWidget userId={user.id} />}
        </div>
      </div>
    </MainLayout>
  );
}
