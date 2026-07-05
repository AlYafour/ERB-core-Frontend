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

/* ── Card wrapper ────────────────────────────────────────────────── */
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="card" style={{ padding: 'var(--space-5)', ...style }}>
      {children}
    </div>
  );
}

/* ── Widget header ───────────────────────────────────────────────── */
function WidgetHead({ title, count, href }: { title: string; count?: number; href?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
        {count !== undefined && count > 0 && (
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
function Empty({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding: '18px 0', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: action ? '0 0 10px' : 0 }}>{message}</p>
      {action}
    </div>
  );
}

/* ── Row link ────────────────────────────────────────────────────── */
function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-subtle)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border-subtle)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'; }}>
      {children}
    </Link>
  );
}

/* ── Priority dot colors ─────────────────────────────────────────── */
const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'var(--status-error)',
  high:   'var(--status-warning)',
  medium: 'var(--text-tertiary)',
  low:    'var(--border-default)',
};

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
    <Card>
      <WidgetHead title="My Tasks" count={total} href="/tasks" />
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader /></div>
      ) : isError ? (
        <Empty message="Could not load tasks." />
      ) : items.length === 0 ? (
        <Empty message="No tasks assigned to you." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.slice(0, 6).map((t: any) => (
            <RowLink key={t.id} href={`/tasks/${t.id}`}>
              <div style={{ width: 6, height: 6, borderRadius: 3, flexShrink: 0, background: PRIORITY_COLOR[t.priority] ?? 'var(--text-tertiary)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
              {(t.priority === 'urgent' || t.priority === 'high') && (
                <Badge variant="error" style={{ fontSize: 10, flexShrink: 0 }}>{t.priority}</Badge>
              )}
            </RowLink>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ── My HR Requests widget ───────────────────────────────────────── */
const HR_TYPE_LABEL: Record<string, string> = {
  annual_leave: 'Annual Leave', sick_leave: 'Sick Leave',
  emergency_leave: 'Emergency Leave', unpaid_leave: 'Unpaid Leave',
  work_from_home: 'Work From Home', overtime: 'Overtime',
  advance_salary: 'Advance Salary', document_request: 'Document Request', other: 'Other',
};

function MyHRWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['workspace-my-hr-requests'],
    queryFn: () => hrRequestsApi.getAll({ status: 'pending', page_size: 4 }),
    staleTime: 60_000,
  });

  const items = (data as any)?.results ?? [];
  const total = (data as any)?.count ?? 0;

  return (
    <Card>
      <WidgetHead title="My HR Requests" count={total} href="/hr/requests" />
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader /></div>
      ) : isError ? (
        <Empty message="Could not load HR requests." />
      ) : items.length === 0 ? (
        <Empty
          message="No pending requests."
          action={
            <Link href="/hr/requests" style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand)', textDecoration: 'none', padding: '6px 14px', borderRadius: 8, background: 'var(--brand-muted)' }}>
              + New Request
            </Link>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.slice(0, 4).map((r: any) => (
            <RowLink key={r.id} href="/hr/requests">
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, flex: 1 }}>
                {HR_TYPE_LABEL[r.request_type] ?? r.request_type.replace(/_/g, ' ')}
              </span>
              <Badge variant="warning" style={{ fontSize: 10, flexShrink: 0 }}>pending</Badge>
            </RowLink>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ── My Procurement widget ───────────────────────────────────────── */
function MyProcurementWidget({ userId }: { userId: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['workspace-my-prs', userId],
    queryFn: () => purchaseRequestsApi.getAll({ status: 'pending', created_by: userId, page_size: 5 }),
    staleTime: 60_000,
  });

  const items = (data as any)?.results ?? [];
  const total = (data as any)?.count ?? 0;

  return (
    <Card>
      <WidgetHead title="Purchase Requests" count={total} href="/purchase-requests" />
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader /></div>
      ) : isError ? (
        <Empty message="Could not load purchase requests." />
      ) : items.length === 0 ? (
        <Empty message="No pending purchase requests." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.slice(0, 5).map((pr: any) => (
            <RowLink key={pr.id} href={`/purchase-requests/${pr.id}`}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', flexShrink: 0 }}>{pr.code}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.title}</span>
              <Badge variant="warning" style={{ fontSize: 10, flexShrink: 0 }}>pending</Badge>
            </RowLink>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ── Profile card ────────────────────────────────────────────────── */
function ProfileCard({ user, profileHref }: { user: any; profileHref: string }) {
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || '';
  const roleLabel = (user as any)?.permission_set?.name || (user.role?.replace(/_/g, ' ') ?? '');

  return (
    <Card style={{ padding: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--border-subtle)', flexShrink: 0 }}>
          <Avatar src={user.avatar_url || user.avatar} alt={displayName} size={44} username={user.username} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
          {roleLabel && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0', textTransform: 'capitalize' }}>{roleLabel}</p>}
          {user.email && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>}
        </div>
        <Link href={profileHref} style={{
          flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--brand)',
          textDecoration: 'none', padding: '5px 10px', borderRadius: 7, background: 'var(--brand-muted)',
        }}>
          Profile
        </Link>
      </div>
    </Card>
  );
}

/* ── Quick Navigation card ───────────────────────────────────────── */
type NavGroup = { title: string; links: { label: string; href: string }[] };

function QuickNavCard({
  user, myEmp, hasPermission, isAdmin, enabledModules,
}: {
  user: any; myEmp: any;
  hasPermission: (key: string) => boolean;
  isAdmin: boolean;
  enabledModules: string[];
}) {
  const showMod = (key: string) => !enabledModules?.length || enabledModules.includes(key);
  const profileHref = myEmp?.id ? `/hr/employees/${myEmp.id}` : `/users/${user.id}`;

  const groups: NavGroup[] = [];

  /* Workspace — always */
  groups.push({
    title: 'Workspace',
    links: [
      { label: 'My Profile',  href: profileHref   },
      { label: 'My Tasks',    href: '/tasks'       },
      { label: 'Task Teams',  href: '/tasks/teams' },
    ],
  });

  /* HR */
  if (showMod('hr')) {
    const hrLinks: { label: string; href: string }[] = [
      { label: 'My Requests', href: '/hr/requests' },
    ];
    if (isAdmin || hasPermission('hr.hr_employee.view')) {
      hrLinks.push({ label: 'Employees',   href: '/hr/employees'   });
      hrLinks.push({ label: 'Departments', href: '/hr/departments' });
    }
    if (isAdmin || hasPermission('hr.hr_attendance.view')) {
      hrLinks.push({ label: 'Attendance', href: '/hr/attendance' });
    }
    if (isAdmin || hasPermission('hr.hr_payroll.view')) {
      hrLinks.push({ label: 'Payroll', href: '/hr/payroll' });
    }
    if (isAdmin || hasPermission('hr.hr_loan.view')) {
      hrLinks.push({ label: 'Loans & Advances', href: '/hr/loans' });
    }
    groups.push({ title: 'Human Resources', links: hrLinks });
  }

  /* Procurement */
  if (showMod('procurement') && (isAdmin || hasPermission('procurement.purchase_request.view'))) {
    groups.push({
      title: 'Procurement',
      links: [
        { label: 'Purchase Requests',   href: '/purchase-requests'   },
        { label: 'Quotation Requests',  href: '/quotation-requests'  },
        { label: 'Purchase Quotations', href: '/purchase-quotations' },
        { label: 'Purchase Orders',     href: '/purchase-orders'     },
        { label: 'Goods Receiving',     href: '/goods-receiving'     },
        { label: 'Purchase Invoices',   href: '/purchase-invoices'   },
      ],
    });
  }

  /* Operations */
  const opsLinks: { label: string; href: string }[] = [];
  if (showMod('projects') && (isAdmin || hasPermission('projects.project.view')))
    opsLinks.push({ label: 'Projects', href: '/projects' });
  if (showMod('crm') && (isAdmin || hasPermission('customer.view')))
    opsLinks.push({ label: 'Customers', href: '/customers' });
  if (showMod('subcontractors') && (isAdmin || hasPermission('subcontractors.subcontractor.view'))) {
    opsLinks.push({ label: 'Subcontractors',  href: '/subcontractors'              });
    opsLinks.push({ label: 'Sub Contracts',   href: '/subcontractors/contracts'    });
    opsLinks.push({ label: 'Certificates',    href: '/subcontractors/certificates' });
    opsLinks.push({ label: 'Payments',        href: '/subcontractors/payments'     });
  }
  if (opsLinks.length > 0) groups.push({ title: 'Operations', links: opsLinks });

  /* Administration (admin only) */
  if (isAdmin) {
    const adminLinks: { label: string; href: string }[] = [];
    if (isAdmin || hasPermission('procurement.supplier.view')) adminLinks.push({ label: 'Suppliers', href: '/suppliers' });
    if (isAdmin || hasPermission('inventory.product.view'))    adminLinks.push({ label: 'Products',  href: '/products'  });
    adminLinks.push({ label: 'Roles & Permissions', href: '/settings/roles'    });
    adminLinks.push({ label: 'Company & Branding',  href: '/settings/company'  });
    groups.push({ title: 'Administration', links: adminLinks });
  }

  return (
    <Card style={{ padding: 'var(--space-4) var(--space-5)' }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.01em' }}>Navigation</p>
      {groups.map((group, gi) => (
        <div key={gi}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.07em',
            marginBottom: 3, marginTop: gi === 0 ? 10 : 16,
          }}>
            {group.title}
          </div>
          {group.links.map(l => (
            <Link key={l.href} href={l.href} style={{
              display: 'block', padding: '6px 8px', borderRadius: 7,
              fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500,
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--surface-subtle)'; el.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--text-secondary)'; }}>
              {l.label}
            </Link>
          ))}
        </div>
      ))}
    </Card>
  );
}

/* ── Root export ─────────────────────────────────────────────────── */
export default function MyWorkspace() {
  const { user } = useAuth();
  const { hasPermission, isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const { enabledModules } = useAuthStore();
  const { data: tenantData } = useTenantInfo();
  const { emp: myEmp } = useMyEmployeeRecord();

  const isAdmin    = isTenantAdmin || isPlatformAdmin;
  const showMod    = (key: string) => !enabledModules?.length || (enabledModules as string[]).includes(key);
  const showProc   = showMod('procurement') && (isAdmin || hasPermission('procurement.purchase_request.view'));
  const showHR     = showMod('hr');
  const profileHref = myEmp?.id ? `/hr/employees/${myEmp.id}` : `/users/${user?.id}`;

  if (!user) return (
    <MainLayout>
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader /></div>
    </MainLayout>
  );

  const displayName = user.first_name || user.username || '';
  const roleLabel   = (user as any)?.permission_set?.name || (user.role?.replace(/_/g, ' ') ?? '');

  return (
    <MainLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            {timeGreeting()}, {displayName}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
            {tenantData?.name ?? 'Your workspace'}{roleLabel ? ` · ${roleLabel}` : ''}
          </p>
        </div>

        {/* Two-column layout — wraps on small screens */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* Left: activity widgets */}
          <div style={{ flex: '1 1 440px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <MyTasksWidget />
            {showHR   && <MyHRWidget />}
            {showProc && <MyProcurementWidget userId={user.id} />}
          </div>

          {/* Right: profile + quick navigation */}
          <div style={{ flex: '0 1 300px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ProfileCard user={user} profileHref={profileHref} />
            <QuickNavCard
              user={user}
              myEmp={myEmp}
              hasPermission={hasPermission}
              isAdmin={isAdmin}
              enabledModules={(enabledModules as string[]) ?? []}
            />
          </div>

        </div>
      </div>
    </MainLayout>
  );
}
