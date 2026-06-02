'use client';

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

export default function Navbar() {
  const { user, logout } = useAuth();
  const { toggleSidebar } = useUIStore();
  const t = useT();

  return (
    <nav className="app-navbar">
      <div
        className="flex h-full items-center justify-between"
        style={{ padding: '0 1rem' }}
      >
        {/* â”€â”€ Start: hamburger + search â”€â”€ */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-1.5 rounded-md transition-colors duration-150"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
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

        {/* â”€â”€ End: tools + user â”€â”€ */}
        <div className="flex items-center gap-2">
          <LocaleToggle />
          <div className="h-5 w-px" style={{ backgroundColor: 'var(--border-primary)' }} />
          <DarkModeToggle />
          <div className="h-5 w-px" style={{ backgroundColor: 'var(--border-primary)' }} />
          <NotificationsDropdown />
          <div className="h-5 w-px" style={{ backgroundColor: 'var(--border-primary)' }} />

          {/* User */}
          <Link
            href={user?.id ? `/users/${user.id}` : '/users'}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors duration-150"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <Avatar src={user?.avatar_url} alt={user?.username || 'User'} size={30} username={user?.username} />
            <span className="text-sm font-semibold hidden sm:inline" style={{ color: 'var(--text-primary)' }}>
              {user?.username || 'User'}
            </span>
          </Link>

          <button
            onClick={logout}
            className="px-3 py-1.5 text-sm font-semibold rounded-md transition-colors duration-150"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {t('nav', 'logout')}
          </button>
        </div>
      </div>
    </nav>
  );
}
