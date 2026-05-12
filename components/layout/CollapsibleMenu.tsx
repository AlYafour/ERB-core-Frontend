'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface MenuItem {
  name: string;
  href: string;
  icon?: ReactNode;
  badge?: number;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  roles?: string[];
}

interface CollapsibleMenuProps {
  title: string;
  icon: ReactNode;
  items: MenuItem[];
  defaultOpen?: boolean;
  user?: any;
}

export default function CollapsibleMenu({
  title,
  icon,
  items,
  defaultOpen = false,
  user,
}: CollapsibleMenuProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const pathname = usePathname();

  // Filter items based on permissions
  const visibleItems = items.filter((item) => {
    if (item.superAdminOnly && !(user?.role === 'super_admin' || user?.is_superuser)) {
      return false;
    }
    if (item.adminOnly && !(user?.role === 'super_admin' || user?.is_staff || user?.is_superuser)) {
      return false;
    }
    if (item.roles && !item.roles.includes(user?.role || '')) {
      return false;
    }
    return true;
  });

  if (visibleItems.length === 0) {
    return null;
  }

  const isActive = visibleItems.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'));

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2.5 rounded-md px-2.5 py-2 text-sm transition-all duration-200"
        style={{
          backgroundColor: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
          color: isActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
          fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
            e.currentTarget.style.color = 'var(--sidebar-text-hover)';
            e.currentTarget.style.fontWeight = 'var(--font-weight-semibold)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--sidebar-text)';
            e.currentTarget.style.fontWeight = 'var(--font-weight-medium)';
          }
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-4 h-4 flex-shrink-0" style={{ minWidth: '16px' }}>{icon}</span>
          <span className="truncate font-semibold">{title}</span>
        </div>
        <svg
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ minWidth: '14px' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div 
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{
          maxHeight: isOpen ? '1000px' : '0',
        }}
      >
        <div className="ms-3 mt-0.5 space-y-0.5 border-s ps-3" style={{ borderColor: 'var(--sidebar-border)' }}>
          {visibleItems.map((item) => {
            const itemIsActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all duration-200"
                style={{
                  backgroundColor: itemIsActive ? 'var(--sidebar-active-bg)' : 'transparent',
                  color: itemIsActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                  fontWeight: itemIsActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
                }}
                onMouseEnter={(e) => {
                  if (!itemIsActive) {
                    e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
                    e.currentTarget.style.color = 'var(--sidebar-text-hover)';
                    e.currentTarget.style.fontWeight = 'var(--font-weight-semibold)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!itemIsActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--sidebar-text)';
                    e.currentTarget.style.fontWeight = 'var(--font-weight-medium)';
                  }
                }}
              >
                {item.icon && (
                  <span className="w-3.5 h-3.5 flex-shrink-0" style={{ minWidth: '14px' }}>
                    {item.icon}
                  </span>
                )}
                <span className="truncate font-semibold flex-1">{item.name}</span>
                {!!item.badge && item.badge > 0 && (
                  <span style={{
                    flexShrink: 0,
                    minWidth: 18, height: 18,
                    borderRadius: 9,
                    background: 'rgba(247, 232, 234, 0.20)',
                    color: 'var(--sidebar-active-text)',
                    fontSize: 10,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 5px',
                    lineHeight: 1,
                  }}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
