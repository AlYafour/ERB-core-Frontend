'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { useTenantInfo } from '@/lib/hooks/use-tenant';
import { tasksApi } from '@/lib/api/tasks';
import { purchaseRequestsApi } from '@/lib/api/purchase-requests';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { hrRequestsApi } from '@/lib/api/hr';
import MainLayout from '@/components/layout/MainLayout';
import { Badge, Loader } from '@/components/ui';
import Avatar from '@/components/ui/Avatar';
import { useMyEmployeeRecord } from '@/lib/hooks/use-my-employee-record';

/* ── helpers ─────────────────────────────────────────────────────── */
const ROLE_LABEL: Record<string, string> = {
  procurement_manager: 'Procurement Manager',
  procurement_officer: 'Procurement Officer',
  site_engineer:       'Site Engineer',
  hr_manager:          'HR Manager',
  hr_secretary:        'HR Secretary',
  company_director:    'Company Director',
  employee:            'Employee',
  admin:               'Admin',
};

function roleLabel(role?: string) {
  return role ? (ROLE_LABEL[role] ?? role.replace(/_/g, ' ')) : '';
}

/* ── Shared card wrapper ─────────────────────────────────────────── */
function WorkCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="card" style={{ padding: '20px 22px', height: '100%', boxSizing: 'border-box', ...style }}>
      {children}
    </div>
  );
}

/* ── Section header ──────────────────────────────────────────────── */
function WsHeader({ title, href, count }: { title: string; href?: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
        {count !== undefined && (
          <span style={{
            fontSize: 11, fontWeight: 700, minWidth: 20, height: 20,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 10, background: 'var(--brand-muted)', color: 'var(--brand)', padding: '0 6px',
          }}>{count}</span>
        )}
      </div>
      {href && (
        <Link href={href} style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}
          onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
          View all →
        </Link>
      )}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────── */
function EmptyRow({ message }: { message: string }) {
  return (
    <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
      {message}
    </div>
  );
}

/* ── My Tasks widget ─────────────────────────────────────────────── */
function MyTasksWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['workspace-my-tasks'],
    queryFn: () => tasksApi.getAll({ scope: 'mine', page_size: 6 }),
    staleTime: 60_000,
  });

  const items = Array.isArray(data) ? data : (data as any)?.results ?? [];
  const total = Array.isArray(data) ? data.length : (data as any)?.count ?? 0;

  return (
    <WorkCard>
      <WsHeader title="My Tasks" href="/tasks" count={total} />
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader /></div>
      ) : isError ? (
        <EmptyRow message="Could not load tasks. Refresh to try again." />
      ) : items.length === 0 ? (
        <EmptyRow message="No tasks assigned to you." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.slice(0, 6).map((t: any) => (
            <Link key={t.id} href={`/tasks/${t.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 8, background: 'var(--surface-subtle)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border-subtle)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'; }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
              {t.priority === 'high' || t.priority === 'urgent'
                ? <Badge variant="error" style={{ fontSize: 10, flexShrink: 0, marginLeft: 8 }}>{t.priority}</Badge>
                : <Badge variant="info" style={{ fontSize: 10, flexShrink: 0, marginLeft: 8 }}>pending</Badge>}
            </Link>
          ))}
        </div>
      )}
    </WorkCard>
  );
}

/* ── My Procurement Actions widget ──────────────────────────────── */
function MyProcurementWidget({ userId }: { userId: number }) {
  const { data: prData, isLoading: prLoading, isError: prError } = useQuery({
    queryKey: ['workspace-my-prs', userId],
    queryFn: () => purchaseRequestsApi.getAll({ status: 'approved', created_by: userId, page_size: 4 }),
    staleTime: 60_000,
  });

  const { data: poData, isLoading: poLoading, isError: poError } = useQuery({
    queryKey: ['workspace-my-pos'],
    queryFn: () => purchaseOrdersApi.getAll({ status: 'pending', page_size: 4 }),
    staleTime: 60_000,
  });

  const prs  = (prData as any)?.results ?? [];
  const pos  = (poData as any)?.results ?? [];
  const prCount = (prData as any)?.count ?? 0;
  const poCount = (poData as any)?.count ?? 0;
  const total   = prCount + poCount;

  return (
    <WorkCard>
      <WsHeader title="Procurement Actions" href="/purchase-requests" count={total} />
      {(prLoading || poLoading) ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader /></div>
      ) : (prError || poError) ? (
        <EmptyRow message="Could not load procurement data. Refresh to try again." />
      ) : total === 0 ? (
        <EmptyRow message="No pending procurement actions." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {prs.slice(0, 3).map((pr: any) => (
            <Link key={`pr-${pr.id}`} href={`/purchase-requests/${pr.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 8, background: 'var(--surface-subtle)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border-subtle)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'; }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{pr.code}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>{pr.title}</span>
              </div>
              <Badge variant="success" style={{ fontSize: 10, flexShrink: 0 }}>approved</Badge>
            </Link>
          ))}
          {pos.slice(0, 3).map((po: any) => (
            <Link key={`po-${po.id}`} href={`/purchase-orders/${po.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 8, background: 'var(--surface-subtle)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border-subtle)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'; }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{po.order_number}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>{po.supplier_name}</span>
              </div>
              <Badge variant="warning" style={{ fontSize: 10, flexShrink: 0 }}>pending</Badge>
            </Link>
          ))}
        </div>
      )}
    </WorkCard>
  );
}

/* ── My HR Requests widget ───────────────────────────────────────── */
function MyHRWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['workspace-my-hr-requests'],
    queryFn: () => hrRequestsApi.getAll({ status: 'pending', page_size: 5 }),
    staleTime: 60_000,
  });

  const items = (data as any)?.results ?? [];
  const total = (data as any)?.count ?? 0;

  return (
    <WorkCard>
      <WsHeader title="HR Requests" href="/hr/requests" count={total} />
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader /></div>
      ) : isError ? (
        <EmptyRow message="Could not load HR requests. Refresh to try again." />
      ) : items.length === 0 ? (
        <EmptyRow message="No pending HR requests." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.slice(0, 5).map((r: any) => (
            <Link key={r.id} href="/hr/requests" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 8, background: 'var(--surface-subtle)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border-subtle)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'; }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, flex: 1, textTransform: 'capitalize' }}>
                {(r.request_type ?? '').replace(/_/g, ' ')}
              </span>
              <Badge variant="warning" style={{ fontSize: 10, flexShrink: 0 }}>pending</Badge>
            </Link>
          ))}
        </div>
      )}
    </WorkCard>
  );
}

/* ── My Profile Card ─────────────────────────────────────────────── */
function ProfileCard({ user, profileHref }: { user: any; profileHref: string }) {
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || '';
  const initials    = displayName.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() || '').join('');

  return (
    <WorkCard style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '28px 22px' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', marginBottom: 14, overflow: 'hidden', border: '2px solid var(--border-subtle)' }}>
        <Avatar src={user.avatar_url || user.avatar} alt={displayName} size={72} username={user.username} />
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{displayName}</p>
      {user.role && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 4px', textTransform: 'capitalize' }}>{roleLabel(user.role)}</p>}
      {user.email && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 18px' }}>{user.email}</p>}
      <Link href={profileHref} style={{
        display: 'inline-block', padding: '7px 18px', borderRadius: 8,
        background: 'var(--brand-muted)', color: 'var(--brand)',
        fontSize: 12, fontWeight: 600, textDecoration: 'none',
      }}>View Profile</Link>
    </WorkCard>
  );
}

/* ── Quick Links ─────────────────────────────────────────────────── */
function QuickLinks({ hasPermission, hasModule }: { hasPermission: (c: string, a: string) => boolean; hasModule: (m: string) => boolean }) {
  const links: { label: string; href: string; show: boolean }[] = [
    { label: 'My Tasks',             href: '/tasks',               show: true },
    { label: 'Purchase Requests',    href: '/purchase-requests',   show: hasModule('procurement') && hasPermission('purchase_request', 'view') },
    { label: 'Purchase Orders',      href: '/purchase-orders',     show: hasModule('procurement') && hasPermission('purchase_order', 'view') },
    { label: 'Quotations',           href: '/purchase-quotations', show: hasModule('procurement') && hasPermission('purchase_quotation', 'view') },
    { label: 'Goods Receiving',      href: '/goods-receiving',     show: hasModule('procurement') && hasPermission('goods_receiving', 'view') },
    { label: 'HR Requests',          href: '/hr/requests',         show: hasModule('hr') },
    { label: 'Subcontractors',       href: '/subcontractors',      show: hasModule('subcontractors') },
    { label: 'Projects',             href: '/projects',            show: hasModule('projects') },
  ].filter(l => l.show);

  return (
    <WorkCard>
      <WsHeader title="Quick Links" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {links.map(l => (
          <Link key={l.href} href={l.href} style={{
            display: 'block', padding: '8px 12px', borderRadius: 8,
            fontSize: 13, color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500,
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            {l.label}
          </Link>
        ))}
        {links.length === 0 && <EmptyRow message="No modules enabled." />}
      </div>
    </WorkCard>
  );
}

/* ── Root export ─────────────────────────────────────────────────── */
export default function MyWorkspace() {
  const { user } = useAuth();
  const { hasPermission, hasModule } = useMyPermissions();
  const { data: tenantData } = useTenantInfo();
  const { emp: myEmp } = useMyEmployeeRecord();

  const showProcurement = hasModule('procurement') && hasPermission('purchase_request', 'view');
  const showHR          = hasModule('hr');

  if (!user) return <MainLayout><div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader /></div></MainLayout>;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const displayName = user.first_name || user.username || '';

  return (
    <MainLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>
            {greeting}, {displayName}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
            {tenantData?.name ?? 'Your workspace'} · {roleLabel(user.role)}
          </p>
        </div>

        {/* Main grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 16,
          alignItems: 'start',
        }}>
          {/* Always visible */}
          <MyTasksWidget />
          <ProfileCard user={user} profileHref={myEmp?.id ? `/hr/employees/${myEmp.id}` : `/hr/employees`} />

          {/* Procurement — only if has permission */}
          {showProcurement && <MyProcurementWidget userId={user.id} />}

          {/* HR — only if has HR module */}
          {showHR && <MyHRWidget />}

          {/* Quick links — always */}
          <QuickLinks hasPermission={hasPermission} hasModule={hasModule} />
        </div>
      </div>
    </MainLayout>
  );
}
