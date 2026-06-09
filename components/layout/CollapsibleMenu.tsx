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
  collapsed?: boolean;
}

const T = '140ms cubic-bezier(0.16, 1, 0.3, 1)';

const NS = {
  itemRadius: 10,
  itemPad: '9px 12px',
  itemPadCollapsed: '10px 0',
  itemGap: 10,
  iconSize: 18,
} as const;

export default function CollapsibleMenu({
  title,
  icon,
  items,
  defaultOpen = false,
  user,
  collapsed = false,
}: CollapsibleMenuProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const pathname = usePathname();

  const visibleItems = items.filter((item) => {
    if (item.superAdminOnly && !(user?.role === 'admin' || user?.is_superuser)) return false;
    if (item.adminOnly && !(user?.role === 'admin' || user?.is_superuser)) return false;
    if (item.roles && !item.roles.includes(user?.role || '')) return false;
    return true;
  });

  if (visibleItems.length === 0) return null;

  const isActive = visibleItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  );

  const totalBadge = visibleItems.reduce((sum, item) => sum + (item.badge || 0), 0);

  // ── Collapsed rail mode: icon-only ──
  if (collapsed) {
    const firstHref = visibleItems[0].href;
    return (
      <Link
        href={firstHref}
        title={title}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', borderRadius: NS.itemRadius,
          padding: NS.itemPadCollapsed, textDecoration: 'none',
          transition: `background ${T}, color ${T}`,
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
        <span style={{ width: NS.iconSize, height: NS.iconSize, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </span>
        {totalBadge > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            minWidth: 14, height: 14, borderRadius: 7,
            background: 'var(--status-info-bg)', color: 'var(--status-info)',
            fontSize: 9, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
          }}>
            {totalBadge > 99 ? '99+' : totalBadge}
          </span>
        )}
      </Link>
    );
  }

  // ── Expanded mode ──
  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={isActive ? 'snav-item snav-active' : 'snav-item'}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 6,
          borderRadius: NS.itemRadius,
          padding: NS.itemPad, fontSize: 13, fontWeight: isActive ? 600 : 500,
          cursor: 'pointer', border: 'none',
          transition: `background ${T}, color ${T}`,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: NS.itemGap, minWidth: 0, flex: 1 }}>
          <span style={{ flexShrink: 0, width: NS.iconSize, height: NS.iconSize, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {!isOpen && totalBadge > 0 && (
            <span style={{
              minWidth: 16, height: 16, borderRadius: 8,
              background: 'var(--status-info-bg)', color: 'var(--status-info)',
              fontSize: 10, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px',
            }}>
              {totalBadge > 99 ? '99+' : totalBadge}
            </span>
          )}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{
              transition: `transform ${T}`,
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              opacity: 0.45, flexShrink: 0,
            }}
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* CSS Grid expand animation */}
      <div style={{
        display: 'grid',
        gridTemplateRows: isOpen ? '1fr' : '0fr',
        transition: `grid-template-rows ${T}`,
      }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{
            marginTop: 2, marginBottom: 2,
            marginInlineStart: 14, paddingInlineStart: 10,
            borderInlineStart: '1px solid var(--sidebar-border)',
          }}>
            {visibleItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    borderRadius: 7,
                    padding: '6px 9px', marginBottom: 1,
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    transition: `background ${T}, color ${T}`,
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
                    <span style={{ flexShrink: 0, width: 13, height: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.icon}
                    </span>
                  )}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </span>
                  {!!item.badge && item.badge > 0 && (
                    <span style={{
                      flexShrink: 0, minWidth: 16, height: 16, borderRadius: 8,
                      background: 'var(--status-info-bg)', color: 'var(--status-info)',
                      fontSize: 10, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
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
