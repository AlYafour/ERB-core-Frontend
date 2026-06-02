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

const TRANSITION = '140ms cubic-bezier(0.16, 1, 0.3, 1)';

export default function CollapsibleMenu({
  title,
  icon,
  items,
  defaultOpen = false,
  user,
}: CollapsibleMenuProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const pathname = usePathname();

  const visibleItems = items.filter((item) => {
    if (item.superAdminOnly && !(user?.role === 'super_admin' || user?.is_superuser)) return false;
    if (item.adminOnly && !(user?.role === 'super_admin' || user?.is_staff || user?.is_superuser)) return false;
    if (item.roles && !item.roles.includes(user?.role || '')) return false;
    return true;
  });

  if (visibleItems.length === 0) return null;

  const isActive = visibleItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  );

  const totalBadge = visibleItems.reduce((sum, item) => sum + (item.badge || 0), 0);

  return (
    <div>
      {/* Parent toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          borderRadius: 6,
          padding: '7px 10px',
          fontSize: 13,
          fontWeight: isActive ? 600 : 500,
          cursor: 'pointer',
          border: 'none',
          transition: `background ${TRANSITION}, color ${TRANSITION}`,
          background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
          color: isActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'var(--sidebar-hover)';
            e.currentTarget.style.color = 'var(--sidebar-text-hover)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--sidebar-text)';
          }
        }}
      >
        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <span style={{
            flexShrink: 0, width: 15, height: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </span>
          <span style={{
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </span>
        </div>

        {/* Right side: aggregate badge (when closed) + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {!isOpen && totalBadge > 0 && (
            <span style={{
              minWidth: 16, height: 16,
              borderRadius: 8,
              background: 'rgba(247,168,180,0.18)',
              color: 'rgba(247,168,180,0.88)',
              fontSize: 10, fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              padding: '0 4px',
            }}>
              {totalBadge > 99 ? '99+' : totalBadge}
            </span>
          )}
          <svg
            width="12" height="12"
            viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{
              transition: `transform ${TRANSITION}`,
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              opacity: 0.5,
              flexShrink: 0,
            }}
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* CSS Grid animation — smooth, no max-height hack */}
      <div style={{
        display: 'grid',
        gridTemplateRows: isOpen ? '1fr' : '0fr',
        transition: `grid-template-rows ${TRANSITION}`,
      }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{
            marginTop: 2,
            marginBottom: 2,
            marginInlineStart: 11,
            paddingInlineStart: 11,
            borderInlineStart: '1px solid var(--sidebar-border)',
          }}>
            {visibleItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    borderRadius: 5,
                    padding: '5px 8px',
                    marginBottom: 1,
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    transition: `background ${TRANSITION}, color ${TRANSITION}`,
                    background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                    color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                    textDecoration: 'none',
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
                  {item.icon && (
                    <span style={{
                      flexShrink: 0, width: 13, height: 13,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {item.icon}
                    </span>
                  )}
                  <span style={{
                    flex: 1, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.name}
                  </span>
                  {!!item.badge && item.badge > 0 && (
                    <span style={{
                      flexShrink: 0,
                      minWidth: 16, height: 16,
                      borderRadius: 8,
                      background: 'rgba(247,168,180,0.18)',
                      color: 'rgba(247,168,180,0.88)',
                      fontSize: 10, fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center',
                      padding: '0 4px',
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
    </div>
  );
}
