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
const GRID3: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' };

// One consistent section header for every group in the settings card.
function SectionHead({ title, desc, first }: { title: string; desc?: React.ReactNode; first?: boolean }) {
  return (
    <div style={{
      marginTop: first ? 0 : 'var(--space-6)', paddingTop: first ? 0 : 'var(--space-4)',
      borderTop: first ? undefined : '1px solid var(--border-subtle)', marginBottom: 'var(--space-3)',
    }}>
      <p style={{ margin: 0, fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{title}</p>
      {desc && <p style={{ margin: '3px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</p>}
    </div>
  );
}

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
      <SectionHead first title="Company & Locale" desc="Timezone and default currency." />
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
      <SectionHead title="Attendance" desc="Working week, check-in cutoff, and geofence enforcement." />
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label style={LBL_CS}>Working Days</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DAYS_MAP.map((d, i) => (
            <button key={i} onClick={() => toggleDay(i)} style={{
              padding: '4px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', fontWeight: 600,
              cursor: 'pointer', border: '1px solid',
              background: wd.includes(i) ? 'var(--brand)' : 'var(--surface-subtle)',
              color:      wd.includes(i) ? 'var(--primary-foreground)' : 'var(--text-secondary)',
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
        <div>
          <label style={LBL_CS}>GPS Tolerance (m) · سماحية دقة الـGPS</label>
          <input style={INPUT_CS} type="number" min={0} max={500} step="10"
            value={form.geofence_accuracy_slack_m ?? data?.geofence_accuracy_slack_m ?? 50}
            onChange={e => set('geofence_accuracy_slack_m', Number(e.target.value))} />
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
            يُقبل لو (المسافة − دقة الجهاز) ≤ نصف القطر، بحد أقصى للسماحية هذا الرقم.
            0 = نصف القطر فقط (الأصرم). النطاق الفعلي = نصف القطر + هذا الرقم.
          </p>
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
      <SectionHead title="Leave Defaults" desc="Default annual and sick balances for new employees." />
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

      {/* ── Work Hours & Overtime ── */}
      <SectionHead
        title="Work Hours & Overtime"
        desc={<>How daily work hours are counted for everyone. The shift start/end times &amp; break length are set per <Link href="/hr/shifts" style={{ color: 'var(--brand)' }}>Shift</Link>.</>}
      />
      <div>
        <div style={GRID3}>
          <div>
            <label style={LBL_CS}>Break deduction</label>
            <select style={INPUT_CS} value={form.break_deduction_mode ?? data?.break_deduction_mode ?? 'as_taken'} onChange={e => set('break_deduction_mode', e.target.value)}>
              <option value="as_taken">As taken — punched break, else standard</option>
              <option value="minimum">Minimum — larger of standard &amp; punched</option>
              <option value="fixed">Fixed — always the standard break</option>
            </select>
          </div>
          <div>
            <label style={LBL_CS}>Required Hours / Day</label>
            <input style={INPUT_CS} type="number" min={0} step="0.5" value={form.working_hours_per_day ?? data?.working_hours_per_day ?? 8} onChange={e => set('working_hours_per_day', Number(e.target.value))} />
          </div>
          <div>
            <label style={LBL_CS}>Overtime Multiplier</label>
            <input style={INPUT_CS} type="number" min={1} step="0.05" value={form.overtime_multiplier ?? data?.overtime_multiplier ?? '1.25'} onChange={e => set('overtime_multiplier', e.target.value)} />
          </div>
          <div>
            <label style={LBL_CS}>Payroll Cut-off Day · يوم قطع الرواتب</label>
            <input style={INPUT_CS} type="number" min={0} max={28} step="1"
              value={form.payroll_cutoff_day ?? data?.payroll_cutoff_day ?? 0}
              onChange={e => set('payroll_cutoff_day', Number(e.target.value))} />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
              مثلاً 25 → الدورة من 26 الشهر السابق حتى 25 الحالي. 0 = الشهر الميلادي الكامل.
            </p>
          </div>
          <div>
            <label style={LBL_CS}>Absence Deduction Base · أساس خصم الغياب</label>
            <select style={INPUT_CS}
              value={form.payroll_deduction_base ?? data?.payroll_deduction_base ?? 'basic'}
              onChange={e => set('payroll_deduction_base', e.target.value)}>
              <option value="basic">Basic Salary only · الأساسي فقط</option>
              <option value="total">Total Package · الحزمة الكاملة (أساسي + بدلات)</option>
            </select>
          </div>
          <div>
            <label style={LBL_CS}>Daily-Rate Divisor · المقسوم عليه لليومي</label>
            <select style={INPUT_CS}
              value={form.payroll_deduction_divisor ?? data?.payroll_deduction_divisor ?? 30}
              onChange={e => set('payroll_deduction_divisor', Number(e.target.value))}>
              <option value={30}>30 · أيام الشهر (المعتمد بالإمارات)</option>
              <option value={26}>26 · أيام العمل</option>
              <option value={0}>0 · أيام العمل الفعلية في الفترة</option>
            </select>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
              اليومي = الأساس ÷ هذا الرقم. مثال: 5750 ÷ 30 = 191.67/يوم.
            </p>
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SwitchRow
            label="Ignore time before shift start"
            hint="Arriving early is not counted — work starts at the shift start · الحضور قبل موعد الدوام لا يُحتسب."
            checked={form.clip_checkin_to_shift_start ?? data?.clip_checkin_to_shift_start ?? false}
            onChange={v => set('clip_checkin_to_shift_start', v)}
          />
          <SwitchRow
            label="Ignore time after shift end"
            hint="Staying late is not counted — work stops at the shift end · البقاء بعد موعد الدوام لا يُحتسب."
            checked={form.clip_checkout_to_shift_end ?? data?.clip_checkout_to_shift_end ?? false}
            onChange={v => set('clip_checkout_to_shift_end', v)}
          />
          <SwitchRow
            label="Pay overtime past scheduled hours"
            hint="When off, extra time beyond scheduled hours is never paid as overtime · عند الإيقاف لا يُحتسب أي أوفر تايم."
            checked={form.overtime_enabled ?? data?.overtime_enabled ?? true}
            onChange={v => set('overtime_enabled', v)}
          />
          <div style={{ marginTop: 'var(--space-4)' }}>
            <label style={LBL_CS}>Arrival grace (min) · سماحية الحضور</label>
            <input style={INPUT_CS} type="number" min={0} max={60} step="1"
              value={form.work_hours_arrival_grace_min ?? data?.work_hours_arrival_grace_min ?? 5}
              onChange={e => set('work_hours_arrival_grace_min', Number(e.target.value))} />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
              حضور متأخر خلال هذه الدقائق يُحتسب من بداية الدوام — لا نقصان في الساعات (يتطلب "Ignore time before shift start").
            </p>
          </div>
          <div style={{ marginTop: 'var(--space-4)' }}>
            <label style={LBL_CS}>Break grace (min) · سماحية الاستراحة</label>
            <input style={INPUT_CS} type="number" min={0} max={60} step="1"
              value={form.work_hours_break_grace_min ?? data?.work_hours_break_grace_min ?? 5}
              onChange={e => set('work_hours_break_grace_min', Number(e.target.value))} />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
              بريك حتى (المعياري + هذا الرقم) يُخصم منه المعياري فقط — لا عقاب على تجاوز بسيط.
            </p>
          </div>
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
