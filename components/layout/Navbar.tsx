'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useUIStore } from '@/lib/store/ui-store';
import { MenuIcon } from '@/components/icons';
import GlobalSearch from '@/components/ui/GlobalSearch';
import NotificationsDropdown from '@/components/layout/NotificationsDropdown';
import DarkModeToggle from '@/components/ui/DarkModeToggle';
import LocaleToggle from '@/components/ui/LocaleToggle';
import Avatar from '@/components/ui/Avatar';
import Link from 'next/link';
import { useT } from '@/lib/i18n/useT';

const T = '140ms ease';

function UserMenu({ user, logout, t }: { user: any; logout: () => void; t: (ns: string, key: string) => string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : (user?.username || '');
  const roleLabel = user?.role?.replace(/_/g, ' ') || '';
  const initials = displayName.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() || '').join('');

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 8px 5px 4px', borderRadius: 9, border: 'none',
          background: 'transparent', cursor: 'pointer',
          transition: `background ${T}`,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-subtle)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        aria-label="User menu"
      >
        <Avatar
          src={user?.avatar_url}
          alt={displayName || 'User'}
          size={30}
          username={user?.username}
        />
        <div className="hidden sm:block" style={{ textAlign: 'start', lineHeight: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            {displayName || 'User'}
          </div>
          {roleLabel && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, textTransform: 'capitalize' }}>
              {roleLabel}
            </div>
          )}
        </div>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          style={{
            opacity: 0.4, flexShrink: 0,
            transition: `transform ${T}`,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            color: 'var(--text-secondary)',
          }}
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          minWidth: 210, borderRadius: 10,
          background: 'var(--dropdown-bg)',
          border: '1px solid var(--dropdown-border)',
          boxShadow: 'var(--dropdown-shadow)',
          zIndex: 200, overflow: 'hidden',
          animation: 'slideUp 140ms cubic-bezier(0.16,1,0.3,1) both',
        }}>
          {/* Header */}
          <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {displayName || 'User'}
            </div>
            {roleLabel && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, textTransform: 'capitalize' }}>
                {roleLabel}
              </div>
            )}
          </div>

          {/* Items */}
          <div style={{ padding: '4px' }}>
            <Link
              href={user?.id ? `/users/${user.id}` : '/users'}
              onClick={() => setOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '7px 10px', borderRadius: 7, textDecoration: 'none',
                color: 'var(--text-primary)', fontSize: 13, fontWeight: 500,
                transition: `background ${T}`,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--dropdown-item-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {t('nav', 'myProfile')}
            </Link>

            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

            <button
              onClick={() => { setOpen(false); logout(); }}
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
              {t('nav', 'logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { toggleSidebar, sidebarCollapsed } = useUIStore();
  const t = useT();

  return (
    <nav className={`app-navbar${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <div
        className="flex h-full items-center justify-between"
        style={{ padding: '0 1rem' }}
      >
        {/* Start: hamburger (mobile) + search */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-1.5 rounded-md"
            style={{ color: 'var(--text-secondary)', transition: `background ${T}, color ${T}` }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--surface-subtle)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Toggle sidebar"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
          <GlobalSearch />
        </div>

        {/* End: tools + user menu */}
        <div className="flex items-center gap-1.5">
          <DarkModeToggle />
          <LocaleToggle />
          <NotificationsDropdown />

          {/* Thin separator before user menu */}
          <div style={{ width: 1, height: 22, background: 'var(--border-subtle)', margin: '0 4px' }} />

          {user && <UserMenu user={user} logout={logout} t={t} />}
        </div>
      </div>
    </nav>
  );
}
