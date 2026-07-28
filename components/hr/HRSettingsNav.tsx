'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// One canonical navigation for the whole HR settings area — grouped, complete,
// and consistent. Every settings screen renders this same rail, so the sections
// (and the way back) are always visible. Labels are the single source of truth
// (e.g. "Office Locations", not "Geolocations").
const NAV_GROUPS: { title: string; items: { label: string; href: string }[] }[] = [
  { title: 'General', items: [
    { label: 'HR Settings', href: '/hr/settings' },
    { label: 'Companies', href: '/hr/settings/companies' },
  ]},
  { title: 'Organization', items: [
    { label: 'Departments', href: '/hr/departments' },
    { label: 'Positions', href: '/hr/positions' },
    { label: 'Employee Categories', href: '/hr/groups' },
    { label: 'Work Teams', href: '/hr/teams' },
  ]},
  { title: 'Time & Attendance', items: [
    { label: 'Work Shifts', href: '/hr/shifts' },
    { label: 'Office Locations', href: '/hr/settings/locations' },
    { label: 'Penalty Rules', href: '/hr/penalties' },
    { label: 'Notifications', href: '/hr/settings/notifications' },
  ]},
  { title: 'Requests & Documents', items: [
    { label: 'Request Types', href: '/hr/settings/request-types' },
    { label: 'Approval Chains', href: '/hr/approvals/chains' },
    { label: 'Leave Policies', href: '/hr/leave-policies' },
    { label: 'Policy Rules', href: '/hr/policy' },
    { label: 'Document Templates', href: '/hr/documents' },
  ]},
  { title: 'Classification', items: [
    { label: 'Team Types', href: '/settings/team-types' },
    { label: 'Cost Categories', href: '/settings/cost-categories' },
    { label: 'Operation Labels', href: '/settings/labels' },
  ]},
];

const GROUP_LABEL: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-tertiary)', textTransform: 'uppercase',
  letterSpacing: '0.06em', margin: '0 0 var(--space-2)', paddingInlineStart: 'var(--space-3)',
};

export default function HRSettingsNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    // The hub matches exactly (its sub-pages have their own entries); everything
    // else also lights up on nested routes.
    href === '/hr/settings'
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/');

  return (
    <nav style={{ width: 208, flexShrink: 0, borderInlineEnd: '1px solid var(--border-subtle)', paddingInlineEnd: 'var(--space-4)' }}>
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.title} style={{ marginTop: gi === 0 ? 0 : 'var(--space-4)' }}>
          <p style={GROUP_LABEL}>{group.title}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {group.items.map(item => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'block', padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)',
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--sidebar-active-text)' : 'var(--text-primary)',
                    background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                    textDecoration: 'none', transition: 'background 120ms, color 120ms',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-subtle)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
