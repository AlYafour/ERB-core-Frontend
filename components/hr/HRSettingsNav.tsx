'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Geolocations', href: '/hr/settings/locations' },
  // { label: 'Document Types',  href: '/hr/settings/document-types' },
  // { label: 'Approval Setup',  href: '/hr/settings/approvals'      },
  // { label: 'Holidays',        href: '/hr/settings/holidays'       },
];

export default function HRSettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        width: 184,
        flexShrink: 0,
        borderRight: '1px solid var(--border-subtle)',
        paddingRight: 'var(--space-5)',
      }}
    >
      <p
        style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          margin: '0 0 var(--space-3)',
        }}
      >
        Configuration
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(item => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'block',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--sidebar-active-text)' : 'var(--text-primary)',
                background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                textDecoration: 'none',
                transition: 'background 120ms, color 120ms',
              }}
              onMouseEnter={e => {
                if (!active) e.currentTarget.style.background = 'var(--surface-subtle)';
              }}
              onMouseLeave={e => {
                if (!active) e.currentTarget.style.background = 'transparent';
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
