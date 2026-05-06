'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/lib/store/ui-store';
import { useAuth } from '@/lib/hooks/use-auth';
import { useT } from '@/lib/i18n/useT';
import CollapsibleMenu from './CollapsibleMenu';
import { usePendingCounts } from '@/lib/hooks/use-pending-counts';
import {
  DashboardIcon, FileTextIcon, BuildingIcon, PackageIcon,
  BriefcaseIcon, DollarIcon, UsersIcon, XIcon, ShoppingCartIcon, AlertIcon,
  UserIcon, ClockIcon, CalendarIcon, CurrencyIcon,
} from '@/components/icons';

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const { user } = useAuth();
  const t = useT();
  const pending = usePendingCounts();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const purchaseItems = [
    { name: t('nav', 'prList'),         href: '/purchase-requests',  icon: <FileTextIcon className="w-4 h-4" />,    badge: pending.pr        },
    { name: t('nav', 'qrList'),         href: '/quotation-requests', icon: <BriefcaseIcon className="w-4 h-4" />,  badge: pending.qr        },
    { name: t('nav', 'quotationsList'), href: '/purchase-quotations',icon: <DollarIcon className="w-4 h-4" />,     badge: pending.quotation  },
    { name: t('nav', 'poList'),         href: '/purchase-orders',    icon: <ShoppingCartIcon className="w-4 h-4" />,badge: pending.po        },
    { name: t('nav', 'grnList'),        href: '/goods-receiving',    icon: <PackageIcon className="w-4 h-4" />,    badge: pending.grn       },
    { name: t('nav', 'invoiceList'),    href: '/purchase-invoices',  icon: <DollarIcon className="w-4 h-4" />,     badge: pending.invoice   },
  ];

  const otherItems = [
    { name: t('nav', 'suppliers'),    href: '/suppliers',           icon: BuildingIcon, subItems: [{ name: t('nav', 'supplierList'), href: '/suppliers' }] },
    { name: t('nav', 'itemsProducts'),href: '/products',            icon: PackageIcon,  subItems: [{ name: t('nav', 'itemsList'),    href: '/products'   }] },
    { name: t('nav', 'projects'),     href: '/projects',            icon: BuildingIcon, subItems: [{ name: t('nav', 'projectsList'), href: '/projects'   }] },
    { name: t('nav', 'settings'),     href: '/settings/permissions',icon: UsersIcon, adminOnly: true, superAdminOnly: true, subItems: [
      { name: t('nav', 'users'),       href: '/users'                },
      { name: t('nav', 'permissions'), href: '/settings/permissions' },
    ]},
  ];

  const isPurchaseActive =
    pathname.startsWith('/purchase-') ||
    pathname.startsWith('/quotation-') ||
    pathname.startsWith('/goods-receiving') ||
    pathname.startsWith('/purchase-invoices') ||
    pathname.startsWith('/payments');

  const isHRActive =
    pathname.startsWith('/hr/');

  function navLink(href: string, label: string, icon: React.ReactNode) {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setSidebarOpen(false)}
        className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-all duration-150"
        style={{
          backgroundColor: active ? 'var(--sidebar-active-bg)' : 'transparent',
          color:           active ? 'var(--sidebar-active-text)' : 'var(--text-secondary)',
          fontWeight:      active ? '600' : '500',
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
            e.currentTarget.style.color           = 'var(--text-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color           = 'var(--text-secondary)';
          }
        }}
      >
        <span className="flex-shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </Link>
    );
  }

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

      {/* Sidebar */}
      <aside
        className={`app-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}
      >
        <div className="flex h-full flex-col">

          {/* ── Brand header ── */}
          <div
            className="relative flex flex-col items-center px-4 pt-5 pb-4"
            style={{
              borderBottom: '1px solid var(--sidebar-border)',
              background: 'linear-gradient(180deg, var(--sidebar-bg) 0%, rgba(249,115,22,0.03) 100%)',
              flexShrink: 0,
            }}
          >
            {/* Close button — mobile only */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden absolute top-3 p-1.5 rounded-md transition-colors duration-150"
              style={{
                insetInlineEnd: '0.75rem',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              aria-label="Close sidebar"
            >
              <XIcon className="w-4 h-4" />
            </button>

            {/* Logo */}
            <div
              className="mb-3 p-2 rounded-lg"
              style={{ backgroundColor: 'var(--sidebar-active-bg)', boxShadow: 'var(--shadow-sm)' }}
            >
              <img
                src="/logo.png"
                alt="Logo"
                width={44}
                height={44}
                className="object-contain block"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
                onError={(e) => { e.currentTarget.src = '/logo.svg'; }}
              />
            </div>

            <span
              className="text-sm font-bold text-center leading-tight"
              style={{ color: 'var(--text-primary)', letterSpacing: '0.02em' }}
            >
              AL YAFOUR CONSTRUCTION
            </span>
            <span
              className="text-[11px] text-center mt-0.5 font-medium"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('nav', 'operationsProcurement')}
            </span>
          </div>

          {/* ── Navigation ── */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">

            {/* Dashboard — super admin only */}
            {(user?.role === 'super_admin' || user?.is_superuser) &&
              navLink('/dashboard', t('nav', 'dashboard'), <DashboardIcon className="w-4 h-4" />)
            }

            {/* Municipal Violations — admin only */}
            {(user?.role === 'super_admin' || user?.is_superuser || user?.role === 'procurement_manager') &&
              navLink('/violations', t('nav', 'violations'), <AlertIcon className="w-4 h-4" />)
            }

            {/* My Profile */}
            {navLink('/profile', t('nav', 'myProfile'), <UsersIcon className="w-4 h-4" />)}

            <div className="my-2 mx-1 h-px" style={{ backgroundColor: 'var(--sidebar-border)' }} />

            {/* Purchase Management */}
            <CollapsibleMenu
              title={t('nav', 'purchaseManagement')}
              icon={<ShoppingCartIcon className="w-4 h-4" />}
              items={purchaseItems}
              defaultOpen={isPurchaseActive}
              user={user}
            />

            <div className="my-2 mx-1 h-px" style={{ backgroundColor: 'var(--sidebar-border)' }} />

            <div className="my-2 mx-1 h-px" style={{ backgroundColor: 'var(--sidebar-border)' }} />

            {/* HR Management */}
            <CollapsibleMenu
              title={t('nav', 'hrModule')}
              icon={<UsersIcon className="w-4 h-4" />}
              items={[
                { name: t('nav', 'hrEmployees'),   href: '/hr/employees'   },
                { name: t('nav', 'hrDepartments'), href: '/hr/departments' },
                { name: t('nav', 'hrAttendance'),  href: '/hr/attendance'  },
                { name: t('nav', 'hrRequests'),    href: '/hr/requests'    },
                { name: t('nav', 'hrPayroll'),     href: '/hr/payroll'     },
              ]}
              defaultOpen={isHRActive}
              user={user}
            />

            <div className="my-2 mx-1 h-px" style={{ backgroundColor: 'var(--sidebar-border)' }} />

            {/* Other sections */}
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
          </nav>

        </div>
      </aside>
    </>
  );
}
