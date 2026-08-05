'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth-store';
import { useAuth } from '@/lib/hooks/use-auth';
import DarkModeToggle from '@/components/ui/DarkModeToggle';
import { XERB } from '@/lib/config/brand';
import {
  DashboardIcon, BuildingIcon, UsersIcon, FileTextIcon, XIcon,
} from '@/components/icons';

const C = XERB.colors;

const NAV = [
  { label: 'Dashboard',        href: '/super-admin',              icon: DashboardIcon, exact: true  },
  { label: 'Companies',        href: '/super-admin/companies',    icon: BuildingIcon,  exact: false },
  { label: 'Module Management',href: '/super-admin/modules',      icon: UsersIcon,     exact: false },
  { label: 'Plans',            href: '/super-admin/plans',        icon: FileTextIcon,  exact: false },
  { label: 'Audit Logs',       href: '/super-admin/audit-logs',   icon: FileTextIcon,  exact: false },
];

const T = '100ms cubic-bezier(0.16, 1, 0.3, 1)';

function AdminUserMenu({ displayName, initials, onLogout }: { displayName: string; initials: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 8px 5px 4px', borderRadius: 9, border: 'none',
          background: 'transparent', cursor: 'pointer', transition: `background ${T}`,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-subtle)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          {initials}
        </div>
        <div className="hidden sm:block" style={{ textAlign: 'start', lineHeight: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{displayName}</div>
          <div style={{ fontSize: 11, color: C.accent, marginTop: 2, fontWeight: 500 }}>Platform Admin</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ opacity: 0.4, flexShrink: 0, transition: `transform ${T}`, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--text-secondary)' }}>
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          minWidth: 200, borderRadius: 10,
          background: 'var(--dropdown-bg)', border: '1px solid var(--dropdown-border)',
          boxShadow: 'var(--dropdown-shadow)', zIndex: 200, overflow: 'hidden',
          animation: 'slideUp 140ms cubic-bezier(0.16,1,0.3,1) both',
        }}>
          <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{displayName}</div>
            <div style={{ fontSize: 11, color: C.accent, marginTop: 2, fontWeight: 500 }}>Platform Admin</div>
          </div>
          <div style={{ padding: '4px' }}>
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '7px 10px', borderRadius: 7,
                color: 'var(--status-error)', fontSize: 13, fontWeight: 500,
                background: 'transparent', border: 'none', cursor: 'pointer',
                transition: `background ${T}`, textAlign: 'start',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--status-error-bg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router    = useRouter();
  const pathname  = usePathname();
  const { isPlatformAdmin, user } = useAuthStore();
  const { logout }                = useAuth();
  const [mounted,     setMounted]     = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Wait for Zustand to rehydrate from localStorage before checking the guard —
  // on SSR isPlatformAdmin is always false (localStorage unavailable).
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !isPlatformAdmin) {
      router.replace('/dashboard');
    }
  }, [mounted, isPlatformAdmin, router]);

  if (!mounted || !isPlatformAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--surface-app)' }}>
        <div className="animate-spin" style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--border-default)', borderTopColor: C.primary }} />
      </div>
    );
  }

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : (user?.username || 'Admin');
  const initials = displayName.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() || '').join('');

  function NavLink({ item }: { item: (typeof NAV)[number] }) {
    const active = isActive(item.href, item.exact);
    const Icon   = item.icon;
    return (
      <Link
        href={item.href}
        onClick={() => setSidebarOpen(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          borderRadius: 6, padding: '7px 10px',
          fontSize: 13, fontWeight: active ? 600 : 500,
          textDecoration: 'none',
          transition: `background ${T}, color ${T}`,
          background: active ? 'var(--sidebar-active-bg)' : 'transparent',
          color:      active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
        }}
        onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'var(--sidebar-hover)'; e.currentTarget.style.color = 'var(--sidebar-text-hover)'; } }}
        onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sidebar-text)'; } }}
      >
        <span style={{ flexShrink: 0, width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon className="w-4 h-4" />
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
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

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className={`app-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 12px', borderBottom: '1px solid var(--sidebar-border)', flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 1px 3px ${C.primary}50` }}>
              <img src={XERB.logo} alt={XERB.name} width={22} height={22} style={{ objectFit: 'contain', display: 'block' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{XERB.name} Platform</div>
              <div style={{ fontSize: 10, color: C.accent, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Super Admin</div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, display: 'flex' }}>
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--sidebar-section-label)', padding: '10px 4px 4px' }}>
              Platform
            </div>
            {NAV.map((item) => <NavLink key={item.href} item={item} />)}
          </nav>

          {/* User footer */}
          <div style={{ padding: '10px 12px 14px', borderTop: '1px solid var(--sidebar-border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                <div style={{ fontSize: 10, color: C.accent, fontWeight: 500 }}>Platform Admin</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Navbar ──────────────────────────────────────────────────── */}
      <header className="app-navbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--space-4)', gap: 'var(--space-3)' }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', alignItems: 'center' }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>Super Admin</span>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <DarkModeToggle />
          <div style={{ width: 1, height: 22, background: 'var(--border-subtle)', margin: '0 4px' }} />
          <AdminUserMenu
            displayName={displayName}
            initials={initials}
            onLogout={logout}
          />
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="app-content">
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: 'var(--content-max-width)', margin: '0 auto', padding: 'var(--content-padding)' }}>
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
