'use client';

import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, PageHeader } from '@/components/ui';

const SETTINGS_SECTIONS = [
  {
    href:        '/hr/settings/locations',
    title:       'Office Locations',
    description: 'Define office geofences for GPS check-in. Set address, coordinates, and radius for each location.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
      </svg>
    ),
  },
  {
    href:        '/hr/shifts',
    title:       'Work Shifts',
    description: 'Configure morning, evening, night, and flexible shifts with hours, breaks, and work days.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    href:        '/hr/departments',
    title:       'Departments',
    description: 'Manage the organisational hierarchy — departments, parent units, and headcount tracking.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
  },
  {
    href:        '/hr/groups',
    title:       'Employee Groups',
    description: 'Workforce categories that carry a default shift, manager fallback, and approval policy.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href:        '/hr/approvals/chains',
    title:       'Approval Chains',
    description: 'Define multi-stage approval policies per group and request type with role-based routing.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    href:        '/hr/penalties',
    title:       'Penalty Rules',
    description: 'Configure tiered lateness, early-leave, and absence penalties per employee group.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    href:        '/hr/leave-policies',
    title:       'Leave Policies',
    description: 'Define leave entitlements, accrual rules, encashment rates, and caps per employee group.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
];

export default function HRSettingsPage() {
  return (
    <MainLayout>
      <PageShell compact>
        <PageHeader
          title="HR Settings"
          description="Configure the HR module — locations, shifts, departments, groups, policies, and rules."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'HR' }, { label: 'Settings' }]}
        />

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 'var(--space-4)',
          marginTop: 'var(--space-5)',
        }}>
          {SETTINGS_SECTIONS.map(s => (
            <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
              <SettingsCard icon={s.icon} title={s.title} description={s.description} />
            </Link>
          ))}
        </div>
      </PageShell>
    </MainLayout>
  );
}

function SettingsCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div
      className="card"
      style={{
        padding: 'var(--space-5)',
        display: 'flex',
        gap: 'var(--space-4)',
        alignItems: 'flex-start',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        border: '1.5px solid var(--border-subtle)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--brand)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 3px var(--brand-subtle)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 'var(--radius-md)',
        background: 'var(--brand-subtle)', color: 'var(--brand)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: '0 0 var(--space-1)' }}>
          {title}
        </p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
          {description}
        </p>
      </div>
      <div style={{ flexShrink: 0, color: 'var(--text-tertiary)', alignSelf: 'center', marginTop: 2 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  );
}
