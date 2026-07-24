'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, PageHeader, Button } from '@/components/ui';
import { hrCompanySettingsApi } from '@/lib/api/hr';
import { toast } from '@/lib/hooks/use-toast';
import type { HRCompanySettings } from '@/types';

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
    title:       'Employee Categories',
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
    description: 'Define multi-stage approval policies per category and request type with role-based routing.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    href:        '/hr/penalties',
    title:       'Penalty Rules',
    description: 'Configure tiered lateness, early-leave, and absence penalties per employee category.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    href:        '/hr/leave-policies',
    title:       'Leave Policies',
    description: 'Define leave entitlements, accrual rules, encashment rates, and caps per employee category.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
];

const DAYS_MAP = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ENFORCEMENT_OPTS = [
  { value: 'enforce', label: 'Enforce — reject out-of-range check-ins' },
  { value: 'warn',    label: 'Warn — allow but flag for review' },
  { value: 'off',     label: 'Off — no geofence check' },
];
const INPUT_CS: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
  color: 'var(--text-primary)', fontSize: 'var(--text-sm)', outline: 'none', boxSizing: 'border-box',
};
const LBL_CS: React.CSSProperties = {
  display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600,
  color: 'var(--text-secondary)', marginBottom: 4,
};

function CompanySettingsPanel() {
  const qc = useQueryClient();
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState<Partial<HRCompanySettings>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['hr-company-settings'],
    queryFn:  hrCompanySettingsApi.get,
    staleTime: 300_000,
  });

  useEffect(() => {
    if (data && !dirty) setForm(data);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const mut = useMutation({
    mutationFn: () => hrCompanySettingsApi.update(form),
    onSuccess: (updated) => {
      qc.setQueryData(['hr-company-settings'], updated);
      setForm(updated);
      setDirty(false);
      toast('Settings saved', 'success');
    },
    onError: () => toast('Failed to save settings', 'error'),
  });

  const set = (k: keyof HRCompanySettings, v: unknown) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };
  const toggleDay = (d: number) => {
    const days = Array.isArray(form.working_days) ? form.working_days : (data?.working_days ?? []);
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort();
    set('working_days', next);
  };

  if (isLoading) return null;

  const wd = Array.isArray(form.working_days) ? form.working_days : (data?.working_days ?? []);

  return (
    <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>General HR Settings</p>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Timezone, working week, attendance rules, and geofence enforcement.</p>
        </div>
        {dirty && <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? 'Saving…' : 'Save Changes'}</Button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
        <div>
          <label style={LBL_CS}>Timezone</label>
          <input style={INPUT_CS} value={form.timezone ?? data?.timezone ?? ''} onChange={e => set('timezone', e.target.value)} placeholder="e.g. Asia/Dubai" />
        </div>
        <div>
          <label style={LBL_CS}>Work Start Time</label>
          <input style={INPUT_CS} type="time" value={form.work_start_time ?? data?.work_start_time ?? ''} onChange={e => set('work_start_time', e.target.value)} />
        </div>
        <div>
          <label style={LBL_CS}>Work End Time</label>
          <input style={INPUT_CS} type="time" value={form.work_end_time ?? data?.work_end_time ?? ''} onChange={e => set('work_end_time', e.target.value)} />
        </div>
        <div>
          <label style={LBL_CS}>Late Threshold (minutes)</label>
          <input style={INPUT_CS} type="number" min={0} value={form.late_threshold_mins ?? data?.late_threshold_mins ?? 0} onChange={e => set('late_threshold_mins', Number(e.target.value))} />
        </div>
        <div>
          <label style={LBL_CS}>Currency</label>
          <input style={INPUT_CS} value={form.currency ?? data?.currency ?? ''} onChange={e => set('currency', e.target.value)} placeholder="AED" />
        </div>
        <div>
          <label style={LBL_CS}>Geofence Enforcement</label>
          <select style={INPUT_CS} value={form.geofence_enforcement ?? data?.geofence_enforcement ?? 'warn'} onChange={e => set('geofence_enforcement', e.target.value)}>
            {ENFORCEMENT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={LBL_CS}>Default Annual Leave Days</label>
          <input style={INPUT_CS} type="number" min={0} value={form.annual_leave_days ?? data?.annual_leave_days ?? 30} onChange={e => set('annual_leave_days', Number(e.target.value))} />
        </div>
        <div>
          <label style={LBL_CS}>Default Sick Leave Days</label>
          <input style={INPUT_CS} type="number" min={0} value={form.sick_leave_days ?? data?.sick_leave_days ?? 15} onChange={e => set('sick_leave_days', Number(e.target.value))} />
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-4)' }}>
        <label style={LBL_CS}>Working Days</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {DAYS_MAP.map((d, i) => (
            <button key={i} onClick={() => toggleDay(i)} style={{
              padding: '4px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', fontWeight: 600,
              cursor: 'pointer', border: '1px solid',
              background: wd.includes(i) ? 'var(--brand)' : 'var(--surface-subtle)',
              color:      wd.includes(i) ? '#fff'         : 'var(--text-secondary)',
              borderColor: wd.includes(i) ? 'var(--brand)' : 'var(--border-subtle)',
              transition: 'all 0.15s',
            }}>{d}</button>
          ))}
        </div>
      </div>

      {/* ── Attendance policy & notifications (all settings-driven) ── */}
      <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
        <p style={{ margin: '0 0 2px', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>Attendance Policy & Notifications</p>
        <p style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Overtime handling and who is notified about late arrivals or short days — nothing is fixed, set it per your company.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
          <div>
            <label style={LBL_CS}>Required Hours / Day</label>
            <input style={INPUT_CS} type="number" min={0} step="0.5" value={form.working_hours_per_day ?? data?.working_hours_per_day ?? 8} onChange={e => set('working_hours_per_day', Number(e.target.value))} />
          </div>
          <div>
            <label style={LBL_CS}>Overtime Multiplier</label>
            <input style={INPUT_CS} type="number" min={1} step="0.05" value={form.overtime_multiplier ?? data?.overtime_multiplier ?? '1.25'} onChange={e => set('overtime_multiplier', e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SwitchRow label="Count overtime" hint="When off, time worked past the shift end is not paid (hours capped at scheduled)." checked={form.overtime_enabled ?? data?.overtime_enabled ?? true} onChange={v => set('overtime_enabled', v)} />
          <SwitchRow label="Enable attendance notifications" hint="Master switch — turn all attendance notices on or off." checked={form.notifications_enabled ?? data?.notifications_enabled ?? true} onChange={v => set('notifications_enabled', v)} />
          <SwitchRow label="Notify on late check-in" hint="An informational notice (not a warning) when someone checks in after the late threshold." indent checked={form.notify_late_arrival ?? data?.notify_late_arrival ?? true} onChange={v => set('notify_late_arrival', v)} />
          <SwitchRow label="Notify on incomplete hours" hint="When someone checks out before completing the day's required hours." indent checked={form.notify_incomplete_hours ?? data?.notify_incomplete_hours ?? true} onChange={v => set('notify_incomplete_hours', v)} />
        </div>

        <div style={{ marginTop: 'var(--space-4)' }}>
          <label style={LBL_CS}>Send Notifications To</label>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
            {([['employee', 'The employee'], ['direct_manager', 'Direct manager'], ['hr', 'HR managers']] as const).map(([key, lbl]) => {
              const rec = (form.notify_recipients ?? data?.notify_recipients ?? {}) as Record<string, boolean>;
              return (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!rec[key]} onChange={e => set('notify_recipients', { ...rec, [key]: e.target.checked })} />
                  {lbl}
                </label>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-4)' }}>
          <label style={LBL_CS}>CC Emails (comma-separated)</label>
          <input style={INPUT_CS} placeholder="hr@company.com, manager@company.com"
            value={(form.notify_cc_emails ?? data?.notify_cc_emails ?? []).join(', ')}
            onChange={e => set('notify_cc_emails', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
        </div>
      </div>
    </div>
  );
}

function SwitchRow({ label, hint, checked, onChange, indent }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; indent?: boolean;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', paddingLeft: indent ? 20 : 0 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ marginTop: 2 }} />
      <span>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{label}</span>
        {hint && <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{hint}</span>}
      </span>
    </label>
  );
}

export default function HRSettingsPage() {
  return (
    <MainLayout>
      <PageShell compact>
        <PageHeader
          title="HR Settings"
          description="Configure the HR module — locations, shifts, departments, categories, policies, and rules."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'HR' }, { label: 'Settings' }]}
        />

        <CompanySettingsPanel />

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 'var(--space-4)',
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
