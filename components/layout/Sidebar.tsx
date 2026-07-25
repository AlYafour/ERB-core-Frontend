'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/lib/store/ui-store';
import { useAuth } from '@/lib/hooks/use-auth';
import { useAuthStore } from '@/lib/store/auth-store';
import { useT } from '@/lib/i18n/useT';
import CollapsibleMenu from './CollapsibleMenu';
import { usePendingCounts } from '@/lib/hooks/use-pending-counts';
import { useTasksBadge } from '@/lib/hooks/use-tasks-badge';
import { useTenantInfo } from '@/lib/hooks/use-tenant';
import { useMyEmployeeRecord } from '@/lib/hooks/use-my-employee-record';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import {
  DashboardIcon, FileTextIcon, BuildingIcon, PackageIcon,
  BriefcaseIcon, DollarIcon, UsersIcon, ShoppingCartIcon, AlertIcon,
  TasksIcon, UserIcon, ClockIcon, CalendarIcon, CurrencyIcon,
  MapPinIcon, SettingsIcon, ShieldCheckIcon,
} from '@/components/icons';

const T = '140ms cubic-bezier(0.16, 1, 0.3, 1)';

const NS = {
  itemRadius: 10,
  itemPad: '9px 12px',
  itemPadCollapsed: '10px 0',
  itemGap: 10,
  iconSize: 18,
  navPad: '10px 10px 0',
} as const;

// ─── Logo / collapse trigger (desktop only) ───────────────────────────────────

function LogoArea({
  tenantName, logoUrl, collapsed, onToggle, t,
}: {
  tenantName: string;
  logoUrl?: string;
  collapsed: boolean;
  onToggle: () => void;
  t: (ns: string, key: string) => string;
}) {
  return (
    <button
      onClick={onToggle}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="hidden lg:flex"
      style={{
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        padding: collapsed ? '18px 0' : '24px 16px 20px',
        gap: 12,
        flexShrink: 0,
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--sidebar-border)',
        cursor: 'pointer',
        transition: `padding ${T}, opacity ${T}, transform ${T}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '0.72';
        e.currentTarget.style.transform = 'scale(0.97)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '1';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <div style={{
        width: collapsed ? 36 : 52,
        height: collapsed ? 36 : 52,
        borderRadius: collapsed ? 10 : 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, overflow: 'hidden',
        background: logoUrl ? 'transparent' : 'var(--sidebar-active-bg)',
        border: logoUrl ? 'none' : '1px solid var(--sidebar-border)',
        transition: `width ${T}, height ${T}, border-radius ${T}`,
        fontSize: collapsed ? 13 : 18,
        fontWeight: 700,
        color: 'var(--sidebar-active-text)',
        letterSpacing: '-0.02em',
      }}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={tenantName || 'Logo'}
            style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: collapsed ? 10 : 14 }}
          />
        ) : (
          tenantName
            ? tenantName.trim().split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('')
            : 'E'
        )}
      </div>
      {!collapsed && (
        <div style={{ textAlign: 'center', minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
            letterSpacing: '-0.015em', lineHeight: 1.25,
          }}>
            {tenantName || 'Your Company'}
          </div>
          <div style={{
            fontSize: 11, color: 'var(--text-tertiary)',
            marginTop: 3, letterSpacing: '0.01em',
          }}>
            {t('nav', 'operationsProcurement')}
          </div>
        </div>
      )}
    </button>
  );
}

// ─── Mobile-only logo + close button ─────────────────────────────────────────

function MobileLogoHeader({
  tenantName, logoUrl, onClose, t,
}: {
  tenantName: string;
  logoUrl?: string;
  onClose: () => void;
  t: (ns: string, key: string) => string;
}) {
  return (
    <div
      className="flex lg:hidden"
      style={{
        alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 14px',
        borderBottom: '1px solid var(--sidebar-border)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: logoUrl ? 'transparent' : 'var(--sidebar-active-bg)',
          border: logoUrl ? 'none' : '1px solid var(--sidebar-border)',
          fontSize: 12, fontWeight: 700,
          color: 'var(--sidebar-active-text)',
          letterSpacing: '-0.02em',
        }}>
          {logoUrl ? (
            <img src={logoUrl} alt={tenantName || 'Logo'} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            tenantName
              ? tenantName.trim().split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('')
              : 'E'
          )}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {tenantName || 'Your Company'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            {t('nav', 'operationsProcurement')}
          </div>
        </div>
      </div>
      <button
        onClick={onClose}
        aria-label="Close sidebar"
        style={{
          padding: 6, borderRadius: 7, border: 'none',
          background: 'transparent', color: 'var(--sidebar-text)',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          transition: `background ${T}`,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sidebar-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Thin divider between nav sections ───────────────────────────────────────

function SectionDivider({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return <div style={{ height: 1, margin: '5px 10px', background: 'var(--sidebar-border)' }} />;
  }
  return <div style={{ height: 8 }} />;
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, toggleSidebarCollapsed } = useUIStore();
  const { user, logout } = useAuth();
  const { enabledModules, isPlatformAdmin } = useAuthStore();
  const t = useT();
  const pending = usePendingCounts();
  const tasksBadge = useTasksBadge();
  const { data: myPendingApprovals = [] } = useQuery({
    queryKey: ['my-pending-approvals'],
    queryFn: async () => {
      const { default: apiClient } = await import('@/lib/api/client');
      const res = await apiClient.get('/hr/approvals/instances/pending-for-me/');
      return res.data?.results ?? res.data ?? [];
    },
    refetchInterval: 60_000,
    enabled: !!user?.id,
  });
  const myApprovalsBadge = (myPendingApprovals as any[]).length || undefined;
  const { data: tenantData } = useTenantInfo();
  const { emp: myEmp } = useMyEmployeeRecord();
  const { hasPermission, isTenantAdmin } = useMyPermissions();

  const isAdmin = isTenantAdmin || isPlatformAdmin;

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const hasModules = enabledModules && enabledModules.length > 0;
  const showModule = (key: string) => !hasModules || enabledModules.includes(key);

  const tenantName = tenantData?.name ?? '';
  const logoUrl    = (tenantData as any)?.branding?.logo_url || undefined;

  const purchaseItems = [
    { name: t('nav', 'prList'),         href: '/purchase-requests',   icon: <FileTextIcon className="w-4 h-4" />,      badge: pending.pr        },
    { name: t('nav', 'qrList'),         href: '/quotation-requests',  icon: <BriefcaseIcon className="w-4 h-4" />,    badge: pending.qr        },
    { name: t('nav', 'quotationsList'), href: '/purchase-quotations', icon: <DollarIcon className="w-4 h-4" />,       badge: pending.quotation  },
    { name: t('nav', 'poList'),         href: '/purchase-orders',     icon: <ShoppingCartIcon className="w-4 h-4" />, badge: pending.po        },
    { name: t('nav', 'grnList'),        href: '/goods-receiving',     icon: <PackageIcon className="w-4 h-4" />,      badge: pending.grn       },
    { name: t('nav', 'invoiceList'),    href: '/purchase-invoices',   icon: <DollarIcon className="w-4 h-4" />,       badge: pending.invoice   },
  ];

  // HR nav, organized into collapsible sub-groups ("a list inside a list").
  // Each leaf is permission-gated; empty groups are dropped so a user only sees
  // the areas they can access.
  const hrGroupDefs = [
    { name: t('nav', 'hrGrpPeople'), icon: <UserIcon className="w-4 h-4" />, children: [
      { name: 'Employees',          href: '/hr/employees',          perm: 'hr.hr_employee.view', icon: <UserIcon className="w-4 h-4" /> },
      { name: 'Employee Categories', href: '/hr/groups',            perm: 'hr.hr_employee.view', icon: <UsersIcon className="w-4 h-4" /> },
      { name: 'Positions',          href: '/hr/positions',          perm: 'hr.hr_employee.view', icon: <UserIcon className="w-4 h-4" /> },
    ] },
    { name: t('nav', 'hrGrpOrg'), icon: <BuildingIcon className="w-4 h-4" />, children: [
      { name: t('nav', 'hrDepartments'), href: '/hr/departments',   perm: 'hr.hr_employee.view', icon: <BuildingIcon className="w-4 h-4" /> },
      { name: 'Work Teams',         href: '/hr/teams',              perm: 'hr.hr_employee.view', icon: <UsersIcon className="w-4 h-4" /> },
      { name: 'Team Types',         href: '/settings/team-types',   perm: 'hr.hr_employee.view', icon: <UsersIcon className="w-4 h-4" /> },
      { name: 'Cost Categories',    href: '/settings/cost-categories', perm: 'hr.hr_employee.view', icon: <DollarIcon className="w-4 h-4" /> },
      { name: 'Operation Labels',   href: '/settings/labels',       perm: 'hr.hr_settings.view', icon: <SettingsIcon className="w-4 h-4" /> },
    ] },
    { name: t('nav', 'hrGrpTime'), icon: <ClockIcon className="w-4 h-4" />, children: [
      { name: 'Work Shifts',        href: '/hr/shifts',             perm: 'hr.hr_employee.view',   icon: <ClockIcon className="w-4 h-4" /> },
      { name: t('nav', 'hrAttendance'), href: '/hr/attendance',     perm: 'hr.hr_attendance.view', icon: <CalendarIcon className="w-4 h-4" /> },
      { name: 'Work Logs',          href: '/hr/work-logs',          perm: 'hr.hr_attendance.view', icon: <ClockIcon className="w-4 h-4" /> },
      { name: 'Employee Locations', href: '/hr/employee-locations', perm: 'hr.hr_attendance.view', icon: <MapPinIcon className="w-4 h-4" /> },
      { name: 'Geolocations',       href: '/hr/settings/locations', perm: 'hr.hr_settings.view',   icon: <MapPinIcon className="w-4 h-4" /> },
    ] },
    { name: t('nav', 'hrGrpRequests'), icon: <FileTextIcon className="w-4 h-4" />, children: [
      { name: t('nav', 'hrRequests'), href: '/hr/requests',         perm: 'hr.hr_request.view',  icon: <FileTextIcon className="w-4 h-4" /> },
      { name: 'Profile Changes',    href: '/hr/profile-changes',    perm: 'hr.hr_employee.view', icon: <UserIcon className="w-4 h-4" /> },
      { name: 'Approval Chains',    href: '/hr/approvals/chains',   perm: 'hr.hr_approval.view', icon: <ShieldCheckIcon className="w-4 h-4" /> },
      { name: 'Penalty Rules',      href: '/hr/penalties',          perm: 'hr.hr_penalty.view',  icon: <AlertIcon className="w-4 h-4" /> },
    ] },
    { name: t('nav', 'hrGrpPayroll'), icon: <DollarIcon className="w-4 h-4" />, children: [
      { name: t('nav', 'hrPayroll'), href: '/hr/payroll',           perm: 'hr.hr_payroll.view', icon: <DollarIcon className="w-4 h-4" /> },
      { name: 'Payroll Runs',       href: '/hr/payroll/runs',       perm: 'hr.hr_payroll.view', icon: <DollarIcon className="w-4 h-4" /> },
      { name: 'End of Service',     href: '/hr/eos',                perm: 'hr.hr_payroll.view', icon: <FileTextIcon className="w-4 h-4" /> },
      { name: 'Salary History',     href: '/hr/employees/salary-history', perm: 'hr.hr_payroll.view', icon: <DollarIcon className="w-4 h-4" /> },
      { name: 'Loans & Advances',   href: '/hr/loans',              perm: 'hr.hr_loan.view',    icon: <CurrencyIcon className="w-4 h-4" /> },
    ] },
    { name: t('nav', 'hrGrpLeave'), icon: <CalendarIcon className="w-4 h-4" />, children: [
      { name: 'Leave Policies',     href: '/hr/leave-policies',     perm: 'hr.hr_leave.view',     icon: <CalendarIcon className="w-4 h-4" /> },
      { name: 'Leave Encashments',  href: '/hr/leave-encashments',  perm: 'hr.hr_leave.view',     icon: <DollarIcon className="w-4 h-4" /> },
      { name: 'Benefits & Welfare', href: '/hr/benefits',           perm: 'hr.hr_benefits.view',  icon: <ShieldCheckIcon className="w-4 h-4" /> },
    ] },
    { name: t('nav', 'hrGrpTalent'), icon: <BriefcaseIcon className="w-4 h-4" />, children: [
      { name: 'Onboarding',         href: '/hr/onboarding',         perm: 'hr.hr_lifecycle.view',   icon: <UserIcon className="w-4 h-4" /> },
      { name: 'Offboarding',        href: '/hr/offboarding',        perm: 'hr.hr_lifecycle.view',   icon: <FileTextIcon className="w-4 h-4" /> },
      { name: 'Performance',        href: '/hr/performance',        perm: 'hr.hr_performance.view', icon: <CalendarIcon className="w-4 h-4" /> },
      { name: 'Skills & Training',  href: '/hr/skills',             perm: 'hr.hr_performance.view', icon: <BriefcaseIcon className="w-4 h-4" /> },
      { name: 'Recruitment',        href: '/hr/recruitment',        perm: 'hr.hr_recruitment.view', icon: <BriefcaseIcon className="w-4 h-4" /> },
    ] },
    { name: t('nav', 'hrGrpConfig'), icon: <SettingsIcon className="w-4 h-4" />, children: [
      { name: 'HR Settings',        href: '/hr/settings',           perm: 'hr.hr_settings.view',  icon: <SettingsIcon className="w-4 h-4" /> },
      { name: 'HR Analytics',       href: '/hr/analytics',          perm: 'hr.hr_analytics.view', icon: <DashboardIcon className="w-4 h-4" /> },
    ] },
  ];

  const hrGroups = hrGroupDefs
    .map(g => ({ ...g, children: g.children.filter(i => isAdmin || hasPermission(i.perm)) }))
    .filter(g => g.children.length > 0);

  const otherItems = [
    ...(isAdmin || hasPermission('procurement.supplier.view') ? [
      { name: t('nav', 'suppliers'),     href: '/suppliers',  icon: BuildingIcon, subItems: [{ name: t('nav', 'supplierList'), href: '/suppliers' }] },
    ] : []),
    ...(isAdmin || hasPermission('inventory.product.view') ? [
      { name: t('nav', 'itemsProducts'), href: '/products',   icon: PackageIcon,  subItems: [{ name: t('nav', 'itemsList'),    href: '/products'  }] },
    ] : []),
    ...(showModule('projects') && (isAdmin || hasPermission('projects.project.view')) ? [
      { name: t('nav', 'projects'),      href: '/projects',   icon: BuildingIcon, subItems: [{ name: t('nav', 'projectsList'), href: '/projects'  }] },
    ] : []),
    { name: t('nav', 'settings'), href: '/settings/roles', icon: UsersIcon, adminOnly: true, subItems: [
      { name: 'Roles & Permissions',   href: '/settings/roles'          },
      { name: 'Approval Chains',       href: '/settings/approval-chains', icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      )},
      { name: 'Company & Branding',    href: '/settings/company'        },
    ]},
  ];

  const isPurchaseActive  = pathname.startsWith('/purchase-') || pathname.startsWith('/quotation-') || pathname.startsWith('/goods-receiving') || pathname.startsWith('/purchase-invoices');
  const isHRActive        = pathname.startsWith('/hr/');
  const isTasksActive     = pathname.startsWith('/tasks');
  const isCustomerActive  = pathname.startsWith('/customers');
  const isSubActive       = pathname.startsWith('/subcontractors');

  const showOperations = true || showModule('crm') || showModule('subcontractors'); // tasks always visible
  const collapsibleProps = { isAdmin, collapsed: sidebarCollapsed };

  function navLink(href: string, label: string, icon: React.ReactNode, badge?: number) {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setSidebarOpen(false)}
        title={sidebarCollapsed ? label : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          gap: sidebarCollapsed ? 0 : NS.itemGap,
          borderRadius: NS.itemRadius,
          padding: sidebarCollapsed ? NS.itemPadCollapsed : NS.itemPad,
          fontSize: 13,
          fontWeight: active ? 600 : 500,
          textDecoration: 'none',
          transition: `background ${T}, color ${T}`,
          background: active ? 'var(--sidebar-active-bg)' : 'transparent',
          color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.background = 'var(--sidebar-hover)';
            e.currentTarget.style.color = 'var(--sidebar-text-hover)';
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--sidebar-text)';
          }
        }}
      >
        <span style={{ flexShrink: 0, width: NS.iconSize, height: NS.iconSize, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </span>
        {!sidebarCollapsed && (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {label}
          </span>
        )}
        {!!badge && badge > 0 && !sidebarCollapsed && (
          <span style={{
            flexShrink: 0, minWidth: 16, height: 16, borderRadius: 8,
            background: 'var(--status-info-bg)', color: 'var(--status-info)',
            fontSize: 10, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          }}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Link>
    );
  }

  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : (user?.username || '');
  const initials = displayName.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() || '').join('');
  const roleLabel = (user as any)?.permission_set?.name || user?.role?.replace(/_/g, ' ') || '';

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`app-sidebar ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* Desktop: logo area = collapse trigger */}
          <LogoArea
            tenantName={tenantName}
            logoUrl={logoUrl}
            collapsed={sidebarCollapsed}
            onToggle={toggleSidebarCollapsed}
            t={t as (ns: string, key: string) => string}
          />

          {/* Mobile: logo + close button */}
          <MobileLogoHeader
            tenantName={tenantName}
            logoUrl={logoUrl}
            onClose={() => setSidebarOpen(false)}
            t={t as (ns: string, key: string) => string}
          />

          {/* ── Navigation ── */}
          <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: NS.navPad }}>

            {/* Workspace */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {isAdmin &&
                navLink('/dashboard', t('nav', 'dashboard'), <DashboardIcon className="w-4 h-4" />)
              }
              {showModule('violations') && isAdmin &&
                navLink('/violations', t('nav', 'violations'), <AlertIcon className="w-4 h-4" />)
              }
              {user?.id && navLink(
                myEmp?.id ? `/hr/employees/${myEmp.id}` : `/users/${user.id}`,
                t('nav', 'myProfile'),
                <UsersIcon className="w-4 h-4" />
              )}
              {user?.id && navLink('/security', 'Account Security', <ShieldCheckIcon className="w-4 h-4" />)}
              {user?.id && navLink('/my-approvals', 'My Approvals', <ShieldCheckIcon className="w-4 h-4" />, myApprovalsBadge)}
            </div>

            {/* Procurement */}
            {showModule('procurement') && (isAdmin || hasPermission('procurement.purchase_request.view')) && (
              <>
                <SectionDivider collapsed={sidebarCollapsed} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <CollapsibleMenu
                    title={t('nav', 'purchaseManagement')}
                    icon={<ShoppingCartIcon className="w-4 h-4" />}
                    items={purchaseItems}
                    defaultOpen={isPurchaseActive}
                    {...collapsibleProps}
                  />
                </div>
              </>
            )}

            {/* HR */}
            {showModule('hr') && hrGroups.length > 0 && (
              <>
                <SectionDivider collapsed={sidebarCollapsed} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <CollapsibleMenu
                    title={t('nav', 'hrModule')}
                    icon={<UsersIcon className="w-4 h-4" />}
                    items={hrGroups}
                    defaultOpen={isHRActive}
                    {...collapsibleProps}
                  />
                </div>
              </>
            )}

            {/* Operations */}
            {showOperations && (
              <>
                <SectionDivider collapsed={sidebarCollapsed} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <CollapsibleMenu
                    title={t('nav', 'tasksModule')}
                    icon={<TasksIcon className="w-4 h-4" />}
                    items={[
                      { name: t('nav', 'tasksList'),  href: '/tasks',       badge: tasksBadge.total || undefined, icon: <TasksIcon className="w-4 h-4" /> },
                      { name: t('nav', 'tasksTeams'), href: '/tasks/teams', icon: <UsersIcon className="w-4 h-4" /> },
                    ]}
                    defaultOpen={isTasksActive}
                    {...collapsibleProps}
                  />
                  {showModule('crm') && (isAdmin || hasPermission('customer.view')) && (
                    <CollapsibleMenu
                      title={t('nav', 'customers')}
                      icon={<UsersIcon className="w-4 h-4" />}
                      items={[
                        { name: t('nav', 'customersList'), href: '/customers'     },
                        { name: t('nav', 'addCustomer'),   href: '/customers/new' },
                      ]}
                      defaultOpen={isCustomerActive}
                      {...collapsibleProps}
                    />
                  )}
                  {(() => {
                    // Each accounting sub-page shows only for the SPECIFIC
                    // permission it needs — a role granted only "Petty Cash &
                    // Expenses" must not also see Banking / Chart of Accounts
                    // / Settings just because the section itself is visible.
                    const canJournal  = isAdmin || hasPermission('accounting.journal_entry.view');
                    const canExpense  = isAdmin || hasPermission('accounting.expense.view');
                    const canSettings = isAdmin || hasPermission('accounting.accounting_settings.view');
                    const canPayments = isAdmin || hasPermission('accounting.acc_payment.view');
                    const canBanking  = isAdmin || hasPermission('accounting.banking.view');
                    const canReports  = isAdmin || hasPermission('accounting.financial_report.view');
                    const canCoA      = isAdmin || hasPermission('accounting.chart_of_accounts.view');
                    const canFiscal   = isAdmin || hasPermission('accounting.fiscal_period.view');
                    const canAssets   = isAdmin || hasPermission('accounting.fixed_asset.view');
                    // Dashboard aggregates figures across the whole module — only
                    // meaningful (and only shown) to someone with broader access,
                    // not to a role scoped to petty cash alone.
                    const broaderAccess = canJournal || canSettings || canPayments
                      || canBanking || canReports || canCoA || canFiscal || canAssets;
                    const anyAccess = canExpense || broaderAccess;
                    if (!anyAccess || !(isAdmin || showModule('accounting'))) return null;
                    return (
                      <CollapsibleMenu
                        title={t('nav', 'accounting')}
                        icon={<CurrencyIcon className="w-4 h-4" />}
                        items={[
                          ...(broaderAccess ? [{ name: t('nav', 'accountingDashboard'), href: '/accounting' }] : []),
                          ...(canJournal  ? [{ name: t('nav', 'accountingJournal'), href: '/accounting/journal' }] : []),
                          ...(canExpense  ? [{ name: 'Petty Cash & Expenses', href: '/expenses' }] : []),
                          // Configuring cost types/offices is admin-level setup,
                          // not part of everyday voucher entry — never exposed
                          // just because someone can submit/view expenses.
                          ...(isAdmin ? [{ name: 'Expense Setup', href: '/expenses/setup' }] : []),
                          ...(canSettings ? [{ name: 'Cost Codes', href: '/accounting/cost-codes' }] : []),
                          ...(canPayments ? [{ name: t('nav', 'accountingPayments'), href: '/accounting/payments' }] : []),
                          ...(canBanking  ? [{ name: t('nav', 'accountingBanking'), href: '/accounting/banking' }] : []),
                          ...(canReports  ? [{ name: t('nav', 'accountingReports'), href: '/accounting/reports' }] : []),
                          ...(canCoA      ? [{ name: t('nav', 'accountingCoA'), href: '/accounting/accounts' }] : []),
                          ...(canSettings ? [{ name: t('nav', 'accountingSettings'), href: '/accounting/settings' }] : []),
                        ]}
                        defaultOpen={pathname.startsWith('/accounting')}
                        {...collapsibleProps}
                      />
                    );
                  })()}
                  {(isAdmin || hasPermission('subcontractors.subcontractor.view')) && (isAdmin || showModule('subcontractors')) && (
                    <CollapsibleMenu
                      title={t('nav', 'subcontractors')}
                      icon={<BuildingIcon className="w-4 h-4" />}
                      items={[
                        { name: t('nav', 'subcontractorsList'), href: '/subcontractors'              },
                        { name: t('nav', 'subconContracts'),    href: '/subcontractors/contracts'    },
                        { name: t('nav', 'subconCertificates'), href: '/subcontractors/certificates' },
                        { name: t('nav', 'subconPayments'),     href: '/subcontractors/payments'     },
                        { name: 'BOQ Library',                  href: '/subcontractors/boq-library'  },
                      ]}
                      defaultOpen={isSubActive}
                      {...collapsibleProps}
                    />
                  )}
                </div>
              </>
            )}

            {/* Manage */}
            <SectionDivider collapsed={sidebarCollapsed} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingBottom: 8 }}>
              {otherItems
                .filter((item) => {
                  if ((item as any).superAdminOnly) return isAdmin;
                  if ((item as any).adminOnly)      return isAdmin;
                  return true;
                })
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <CollapsibleMenu
                      key={item.href}
                      title={item.name}
                      icon={<Icon className="w-4 h-4" />}
                      items={(item.subItems ?? []).map((s) => ({
                        name: s.name,
                        href: s.href,
                        icon:           (s as any).icon,
                        adminOnly:      (item as any).adminOnly,
                        superAdminOnly: (item as any).superAdminOnly,
                      }))}
                      defaultOpen={isActive(item.href)}
                      {...collapsibleProps}
                    />
                  );
                })}
            </div>

            {/* Platform Admin */}
            {isPlatformAdmin && (
              <>
                <SectionDivider collapsed={sidebarCollapsed} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingBottom: 8 }}>
                  {navLink('/super-admin', 'Platform Dashboard', <DashboardIcon className="w-4 h-4" />)}
                  {navLink('/super-admin/companies', 'Companies', <BuildingIcon className="w-4 h-4" />)}
                  {navLink('/super-admin/plans', 'Plans', <FileTextIcon className="w-4 h-4" />)}
                  {navLink('/super-admin/modules', 'Module Management', <PackageIcon className="w-4 h-4" />)}
                  {navLink('/super-admin/audit-logs', 'Audit Logs', <AlertIcon className="w-4 h-4" />)}
                </div>
              </>
            )}

          </nav>

          {/* ── User footer ── */}
          {user && (
            <div style={{
              padding: sidebarCollapsed ? '10px 0' : '10px 12px',
              borderTop: '1px solid var(--sidebar-border)',
              display: 'flex', alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: sidebarCollapsed ? 0 : 8, flexShrink: 0,
            }}>
              {!sidebarCollapsed && (
                <div
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--brand-muted)', border: '1px solid var(--border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, overflow: 'hidden',
                    fontSize: 10, fontWeight: 700, color: 'var(--brand)',
                  }}
                >
                  {(user as any).avatar_url ? (
                    <img src={(user as any).avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (initials || '?')}
                </div>
              )}
              {!sidebarCollapsed && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {displayName}
                  </div>
                  {roleLabel && (
                    <div style={{ fontSize: 10, color: 'var(--sidebar-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'capitalize' }}>
                      {roleLabel}
                      {isPlatformAdmin && (
                        <span style={{ color: 'var(--status-warning)', marginLeft: 4, fontWeight: 600 }}>· Admin</span>
                      )}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={logout}
                title="Sign Out"
                style={{
                  flexShrink: 0, width: 28, height: 28, borderRadius: 7,
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-tertiary)', transition: 'background 120ms, color 120ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--status-error-bg)'; e.currentTarget.style.color = 'var(--status-error)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          )}

        </div>
      </aside>
    </>
  );
}
