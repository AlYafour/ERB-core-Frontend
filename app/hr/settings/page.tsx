'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, PageHeader, Button } from '@/components/ui';
import HRSettingsNav from '@/components/hr/HRSettingsNav';
import { hrCompanySettingsApi } from '@/lib/api/hr';
import { toast } from '@/lib/hooks/use-toast';
import type { HRCompanySettings } from '@/types';

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
// Sub-group header inside the settings card. `first` variant drops the top rule.
const GROUP_HEAD: React.CSSProperties = {
  margin: 'var(--space-5) 0 var(--space-3)', paddingTop: 'var(--space-4)',
  borderTop: '1px solid var(--border-subtle)',
  fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)',
};
const GROUP_HEAD_FIRST: React.CSSProperties = {
  margin: '0 0 var(--space-3)',
  fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)',
};
const GRID3: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' };

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
          <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Timezone, currency, working week, and attendance rules.</p>
        </div>
        {dirty && <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? 'Saving…' : 'Save Changes'}</Button>}
      </div>

      {/* ── Company & Locale ── */}
      <p style={GROUP_HEAD_FIRST}>Company &amp; Locale</p>
      <div style={GRID3}>
        <div>
          <label style={LBL_CS}>Timezone</label>
          <input style={INPUT_CS} value={form.timezone ?? data?.timezone ?? ''} onChange={e => set('timezone', e.target.value)} placeholder="e.g. Asia/Dubai" />
        </div>
        <div>
          <label style={LBL_CS}>Currency</label>
          <input style={INPUT_CS} value={form.currency ?? data?.currency ?? ''} onChange={e => set('currency', e.target.value)} placeholder="AED" />
        </div>
      </div>

      {/* ── Attendance ── */}
      <p style={GROUP_HEAD}>Attendance</p>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label style={LBL_CS}>Working Days</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
      <div style={GRID3}>
        <div>
          <label style={LBL_CS}>Check-in Cutoff Time</label>
          <input
            style={INPUT_CS}
            type="time"
            value={form.checkin_cutoff_time ?? data?.checkin_cutoff_time ?? ''}
            onChange={e => set('checkin_cutoff_time', e.target.value || null)}
          />
          <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>
            After this time employees can’t check in. Leave empty for no limit.
          </span>
        </div>
        <div>
          <label style={LBL_CS}>Geofence Enforcement</label>
          <select style={INPUT_CS} value={form.geofence_enforcement ?? data?.geofence_enforcement ?? 'warn'} onChange={e => set('geofence_enforcement', e.target.value)}>
            {ENFORCEMENT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* One source of truth — no duplicated work-hours / late-threshold inputs here. */}
      <div style={{
        marginTop: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-md)', background: 'var(--surface-subtle)',
        border: '1px solid var(--border-subtle)', fontSize: 'var(--text-xs)',
        color: 'var(--text-secondary)', lineHeight: 1.7,
      }}>
        <strong style={{ color: 'var(--text-primary)' }}>Where these are set:</strong>{' '}
        work hours &amp; start/end times live per <Link href="/hr/shifts" style={{ color: 'var(--brand)' }}>Shift</Link>;
        the late-arrival threshold, recipients &amp; email live on{' '}
        <Link href="/hr/settings/notifications" style={{ color: 'var(--brand)' }}>Notifications</Link>.
      </div>

      {/* ── Leave Defaults ── */}
      <p style={GROUP_HEAD}>Leave Defaults</p>
      <div style={GRID3}>
        <div>
          <label style={LBL_CS}>Default Annual Leave Days</label>
          <input style={INPUT_CS} type="number" min={0} value={form.annual_leave_days ?? data?.annual_leave_days ?? 30} onChange={e => set('annual_leave_days', Number(e.target.value))} />
        </div>
        <div>
          <label style={LBL_CS}>Default Sick Leave Days</label>
          <input style={INPUT_CS} type="number" min={0} value={form.sick_leave_days ?? data?.sick_leave_days ?? 15} onChange={e => set('sick_leave_days', Number(e.target.value))} />
        </div>
      </div>

      {/* ── Attendance policy (overtime) ── */}
      <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
        <p style={{ margin: '0 0 2px', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>Overtime &amp; Hours</p>
        <p style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Overtime handling and the required-hours fallback (used when an employee has no shift).</p>

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
        </div>

        <Link href="/hr/settings/notifications" style={{ textDecoration: 'none' }}>
          <div style={{
            marginTop: 'var(--space-4)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer',
          }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--brand-subtle)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>Attendance Notifications</p>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Choose recipients, personalise the late-arrival message, and send a test.</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </div>
        </Link>
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
          description="Company, attendance, requests, and approvals — pick a section from the left."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'HR' }, { label: 'Settings' }]}
        />
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
          <HRSettingsNav />
          <div style={{ flex: 1, minWidth: 0 }}>
            <CompanySettingsPanel />
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
}
