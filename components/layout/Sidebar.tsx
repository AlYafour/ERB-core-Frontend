'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/lib/store/ui-store';
import { useAuth } from '@/lib/hooks/use-auth';
import { useT } from '@/lib/i18n/useT';
import CollapsibleMenu from './CollapsibleMenu';
import { usePendingCounts } from '@/lib/hooks/use-pending-counts';
import { useTasksBadge } from '@/lib/hooks/use-tasks-badge';
import {
  DashboardIcon, FileTextIcon, BuildingIcon, PackageIcon,
  BriefcaseIcon, DollarIcon, UsersIcon, XIcon, ShoppingCartIcon, AlertIcon,
  UserIcon, ClockIcon, CalendarIcon, CurrencyIcon, TasksIcon,
} from '@/components/icons';

const TRANSITION = '100ms cubic-bezier(0.16, 1, 0.3, 1)';

/* Small section divider with label */
function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      color: 'var(--sidebar-section-label)',
      padding: '14px 12px 4px',
      userSelect: 'none',
    }}>
      {label}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const { user } = useAuth();
  const t = useT();
  const pending = usePendingCounts();
  const tasksBadge = useTasksBadge();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const purchaseItems = [
    { name: t('nav', 'prList'),         href: '/purchase-requests',   icon: <FileTextIcon className="w-4 h-4" />,     badge: pending.pr       },
    { name: t('nav', 'qrList'),         href: '/quotation-requests',  icon: <BriefcaseIcon className="w-4 h-4" />,   badge: pending.qr       },
    { name: t('nav', 'quotationsList'), href: '/purchase-quotations', icon: <DollarIcon className="w-4 h-4" />,      badge: pending.quotation },
    { name: t('nav', 'poList'),         href: '/purchase-orders',     icon: <ShoppingCartIcon className="w-4 h-4" />,badge: pending.po       },
    { name: t('nav', 'grnList'),        href: '/goods-receiving',     icon: <PackageIcon className="w-4 h-4" />,     badge: pending.grn      },
    { name: t('nav', 'invoiceList'),    href: '/purchase-invoices',   icon: <DollarIcon className="w-4 h-4" />,      badge: pending.invoice  },
  ];

  const otherItems = [
    { name: t('nav', 'suppliers'),      href: '/suppliers',            icon: BuildingIcon, subItems: [{ name: t('nav', 'supplierList'), href: '/suppliers' }] },
    { name: t('nav', 'itemsProducts'),  href: '/products',             icon: PackageIcon,  subItems: [{ name: t('nav', 'itemsList'),    href: '/products'  }] },
    { name: t('nav', 'projects'),       href: '/projects',             icon: BuildingIcon, subItems: [{ name: t('nav', 'projectsList'), href: '/projects'  }] },
    { name: t('nav', 'settings'),       href: '/settings/permissions', icon: UsersIcon, adminOnly: true, superAdminOnly: true, subItems: [
      { name: t('nav', 'users'),        href: '/users'                },
      { name: t('nav', 'permissions'),  href: '/settings/permissions' },
    ]},
  ];

  const isPurchaseActive =
    pathname.startsWith('/purchase-') ||
    pathname.startsWith('/quotation-') ||
    pathname.startsWith('/goods-receiving') ||
    pathname.startsWith('/purchase-invoices') ||
    pathname.startsWith('/payments');

  const isHRActive           = pathname.startsWith('/hr/');
  const isTasksActive        = pathname.startsWith('/tasks');
  const isCustomerActive     = pathname.startsWith('/customers');
  const isSubcontractorActive = pathname.startsWith('/subcontractors');

  /* Top-level nav link (non-collapsible) */
  function navLink(href: string, label: string, icon: React.ReactNode) {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setSidebarOpen(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderRadius: 6,
          padding: '7px 10px',
          fontSize: 13,
          fontWeight: active ? 600 : 500,
          textDecoration: 'none',
          transition: `background ${TRANSITION}, color ${TRANSITION}`,
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
        <span style={{
          flexShrink: 0, width: 15, height: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </Link>
    );
  }

  /* User initials */
  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : (user?.username || '');
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() || '')
    .join('');
  const roleLabel = user?.role?.replace(/_/g, ' ') || '';

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`app-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* ── Brand header ── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 12px',
            borderBottom: '1px solid var(--sidebar-border)',
            flexShrink: 0,
          }}>
            {/* Logo */}
            <div style={{
              width: 32, height: 32,
              borderRadius: 8,
              background: 'rgba(124,45,58,0.42)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
            }}>
              <img
                src="/logo.png"
                alt="Logo"
                width={22}
                height={22}
                style={{ objectFit: 'contain', display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}
                onError={(e) => { e.currentTarget.src = '/logo.svg'; }}
              />
            </div>

            {/* Name stack */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'rgba(247,232,234,0.94)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                AL YAFOUR
              </div>
              <div style={{
                fontSize: 10,
                color: 'var(--sidebar-text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {t('nav', 'operationsProcurement')}
              </div>
            </div>

            {/* Close — mobile only */}
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
              style={{
                flexShrink: 0,
                padding: 5,
                borderRadius: 5,
                border: 'none',
                background: 'transparent',
                color: 'var(--sidebar-text)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: `background ${TRANSITION}, color ${TRANSITION}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--sidebar-hover)';
                e.currentTarget.style.color = 'var(--sidebar-text-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--sidebar-text)';
              }}
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* ── Navigation ── */}
          <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 8px 0' }}>

            {/* Workspace items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {(user?.role === 'super_admin' || user?.is_superuser) &&
                navLink('/dashboard', t('nav', 'dashboard'), <DashboardIcon className="w-4 h-4" />)
              }
              {(user?.role === 'super_admin' || user?.is_superuser || user?.role === 'procurement_manager') &&
                navLink('/violations', t('nav', 'violations'), <AlertIcon className="w-4 h-4" />)
              }
              {user?.id && navLink(`/users/${user.id}`, t('nav', 'myProfile'), <UsersIcon className="w-4 h-4" />)}
            </div>

            {/* Procurement */}
            <SectionLabel label={t('nav', 'purchaseManagement')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <CollapsibleMenu
                title={t('nav', 'purchaseManagement')}
                icon={<ShoppingCartIcon className="w-4 h-4" />}
                items={purchaseItems}
                defaultOpen={isPurchaseActive}
                user={user}
              />
            </div>

            {/* People */}
            <SectionLabel label={t('nav', 'hrModule')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <CollapsibleMenu
                title={t('nav', 'hrModule')}
                icon={<UsersIcon className="w-4 h-4" />}
                items={[
                  { name: t('nav', 'hrDepartments'), href: '/hr/departments' },
                  { name: t('nav', 'hrLocations'),   href: '/hr/locations'   },
                  { name: t('nav', 'hrAttendance'),  href: '/hr/attendance'  },
                  { name: t('nav', 'hrRequests'),    href: '/hr/requests'    },
                  { name: t('nav', 'hrPayroll'),     href: '/hr/payroll'     },
                ]}
                defaultOpen={isHRActive}
                user={user}
              />
            </div>

            {/* Operations */}
            <SectionLabel label={t('nav', 'tasksModule')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <CollapsibleMenu
                title={t('nav', 'tasksModule')}
                icon={<TasksIcon className="w-4 h-4" />}
                items={[
                  {
                    name: t('nav', 'tasksList'),
                    href: '/tasks',
                    badge: tasksBadge.total || undefined,
                  },
                  { name: t('nav', 'tasksTeams'), href: '/tasks/teams' },
                ]}
                defaultOpen={isTasksActive}
                user={user}
              />
              <CollapsibleMenu
                title={t('nav', 'customers')}
                icon={<UsersIcon className="w-4 h-4" />}
                items={[
                  { name: t('nav', 'customersList'), href: '/customers'     },
                  { name: t('nav', 'addCustomer'),   href: '/customers/new' },
                ]}
                defaultOpen={isCustomerActive}
                user={user}
              />
              <CollapsibleMenu
                title={t('nav', 'subcontractors')}
                icon={<BuildingIcon className="w-4 h-4" />}
                items={[
                  { name: t('nav', 'subcontractorsList'),  href: '/subcontractors'                    },
                  { name: t('nav', 'subconContracts'),     href: '/subcontractors/contracts'          },
                  { name: t('nav', 'subconCertificates'),  href: '/subcontractors/certificates'       },
                  { name: t('nav', 'subconPayments'),      href: '/subcontractors/payments'           },
                  { name: 'BOQ Library',                   href: '/subcontractors/boq-library'        },
                ]}
                defaultOpen={isSubcontractorActive}
                user={user}
              />
            </div>

            {/* Manage */}
            <SectionLabel label="Manage" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingBottom: 8 }}>
              {otherItems
                .filter((item) => {
                  if (item.superAdminOnly) return user?.role === 'super_admin' || user?.is_superuser;
                  if (item.adminOnly)      return user?.role === 'super_admin' || user?.is_staff || user?.is_superuser;
                  return true;
                })
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <CollapsibleMenu
                      key={item.href}
                      title={item.name}
                      icon={<Icon className="w-4 h-4" />}
                      items={item.subItems.map((s) => ({
                        name: s.name,
                        href: s.href,
                        adminOnly:      item.adminOnly,
                        superAdminOnly: item.superAdminOnly,
                      }))}
                      defaultOpen={isActive(item.href)}
                      user={user}
                    />
                  );
                })}
            </div>
          </nav>

          {/* ── User footer ── */}
          {user && (
            <div style={{
              padding: '10px 12px',
              borderTop: '1px solid var(--sidebar-border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}>
              {/* Avatar */}
              <div style={{
                width: 28, height: 28,
                borderRadius: '50%',
                background: 'rgba(124,45,58,0.40)',
                border: '1px solid rgba(247,168,180,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
                fontSize: 10,
                fontWeight: 700,
                color: 'rgba(247,168,180,0.90)',
                letterSpacing: '0.02em',
              }}>
                {(user as any).avatar_url ? (
                  <img src={(user as any).avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (initials || '?')}
              </div>
              {/* Name + role */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'rgba(247,232,234,0.88)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {displayName}
                </div>
                {roleLabel && (
                  <div style={{
                    fontSize: 10,
                    color: 'var(--sidebar-text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textTransform: 'capitalize',
                  }}>
                    {roleLabel}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </aside>
    </>
  );
}
