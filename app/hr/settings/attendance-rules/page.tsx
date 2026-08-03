'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, PageHeader, Button, Loader } from '@/components/ui';
import HRSettingsNav from '@/components/hr/HRSettingsNav';
import { hrAttendancePoliciesApi } from '@/lib/api/hr';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import type { AttendancePolicy } from '@/types';

const CARD: React.CSSProperties = {
  background: 'var(--surface-primary)', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)',
};
const SECTION: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase',
  letterSpacing: '0.07em', color: 'var(--text-tertiary)', margin: '0 0 var(--space-4)',
};
const LBL: React.CSSProperties = {
  display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-secondary)', marginBottom: 4,
};
const INPUT: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
  color: 'var(--text-primary)', fontSize: 'var(--text-sm)', boxSizing: 'border-box',
};
const GRID: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)',
};

type Draft = Partial<AttendancePolicy>;

const DEFAULTS: Draft = {
  name: 'Attendance Policy', enforce_punch_windows: false,
  checkin_opens_before_min: 30, checkin_closes_after_min: 240, checkin_minor_late_min: 30,
  break_opens_before_min: 60, break_closes_after_min: 30, break_max_min: 60, break_grace_min: 5,
  checkout_opens_after_min: 0, checkout_closes_after_min: 60,
  emergency_enabled: true, emergency_monthly_limit: 2, emergency_validity_min: 15,
  emergency_min_reason_chars: 100, emergency_followup_days: 3,
  missing_punch_detection_enabled: true, missing_punch_lookback_days: 7,
  missing_checkout_assume_shift_end: true,
  verify_wifi: false, verify_beacon: false, verify_device: false,
  verification_mode: 'any', device_trust_on_first_use: true,
  escalation_enabled: false, escalate_manager_after: 3, escalate_hr_after: 5,
  grade_b_threshold: 2, grade_c_threshold: 5,
};

function NumField({ label, hint, value, onChange }: {
  label: string; hint?: string; value: number | undefined; onChange: (v: number) => void;
}) {
  return (
    <div>
      <label style={LBL}>{label}</label>
      <input style={INPUT} type="number" min={0} step={5} value={value ?? 0}
        onChange={e => onChange(Number(e.target.value))} />
      {hint && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>{hint}</p>}
    </div>
  );
}

export default function AttendanceRulesPage() {
  const qc = useQueryClient();
  const { data: policies, isLoading } = useQuery({
    queryKey: ['attendance-policies'],
    queryFn: () => hrAttendancePoliciesApi.getAll(),
  });

  // We manage the tenant-wide catch-all policy (employee_group = null).
  const catchAll = (policies ?? []).find(p => p.employee_group == null);
  const [form, setForm] = useState<Draft>(DEFAULTS);

  useEffect(() => {
    if (catchAll) setForm(catchAll);
  }, [catchAll]);

  const set = (k: keyof Draft) => (v: number | boolean | string) => setForm(f => ({ ...f, [k]: v }));

  const saveMut = useMutation({
    mutationFn: (data: Draft) =>
      catchAll ? hrAttendancePoliciesApi.update(catchAll.id, data)
               : hrAttendancePoliciesApi.create({ ...data, employee_group: null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance-policies'] }); toast('Attendance rules saved', 'success'); },
    onError: (e) => toast(getApiError(e, 'Save failed'), 'error'),
  });

  if (isLoading) return <MainLayout><div className="card empty-state"><Loader /></div></MainLayout>;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Attendance Rules"
          description="Every time and threshold is set here. Windows are relative to each employee's shift, so different days adjust automatically."
          breadcrumbs={[{ label: 'HR' }, { label: 'Settings', href: '/hr/settings' }, { label: 'Attendance Rules' }]}
          actions={
            <Button variant="primary" size="sm" isLoading={saveMut.isPending} onClick={() => saveMut.mutate(form)}>
              Save
            </Button>
          }
        />

        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
          <HRSettingsNav />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '52rem' }}>
          {/* Master toggle */}
          <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>Enforce punch windows</p>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                When on, each button is only accepted inside its window. Off: punching is allowed any time.
              </p>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.enforce_punch_windows}
                onChange={e => set('enforce_punch_windows')(e.target.checked)} />
              <span style={{ fontSize: 'var(--text-sm)' }}>{form.enforce_punch_windows ? 'On' : 'Off'}</span>
            </label>
          </div>

          {/* Check-in */}
          <div style={CARD}>
            <p style={SECTION}>Check-in</p>
            <div style={GRID}>
              <NumField label="Opens before shift start (min)" hint="30 → opens 08:00 for an 08:30 shift"
                value={form.checkin_opens_before_min} onChange={set('checkin_opens_before_min') as (v: number) => void} />
              <NumField label="Closes after shift start (min)" hint="After this = absent. 240 → 12:30"
                value={form.checkin_closes_after_min} onChange={set('checkin_closes_after_min') as (v: number) => void} />
              <NumField label="Minor-late threshold (min)" hint="Up to this = minor, beyond = severe"
                value={form.checkin_minor_late_min} onChange={set('checkin_minor_late_min') as (v: number) => void} />
            </div>
          </div>

          {/* Break */}
          <div style={CARD}>
            <p style={SECTION}>Break</p>
            <div style={GRID}>
              <NumField label="Opens before break time (min)" value={form.break_opens_before_min}
                onChange={set('break_opens_before_min') as (v: number) => void} />
              <NumField label="Closes after break time (min)" value={form.break_closes_after_min}
                onChange={set('break_closes_after_min') as (v: number) => void} />
              <NumField label="Max break length (min)" value={form.break_max_min}
                onChange={set('break_max_min') as (v: number) => void} />
              <NumField label="Grace after max (min)" hint="Deadline = start + max + grace"
                value={form.break_grace_min} onChange={set('break_grace_min') as (v: number) => void} />
            </div>
          </div>

          {/* Check-out */}
          <div style={CARD}>
            <p style={SECTION}>Check-out</p>
            <div style={GRID}>
              <NumField label="Opens after shift end (min)" hint="0 = exactly at shift end"
                value={form.checkout_opens_after_min} onChange={set('checkout_opens_after_min') as (v: number) => void} />
              <NumField label="Closes after shift end (min)" hint="60 → closes 18:30 for a 17:30 shift"
                value={form.checkout_closes_after_min} onChange={set('checkout_closes_after_min') as (v: number) => void} />
            </div>
          </div>

          {/* Emergency exit */}
          <div style={CARD}>
            <p style={SECTION}>Emergency Exit</p>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 'var(--space-4)' }}>
              <input type="checkbox" checked={!!form.emergency_enabled}
                onChange={e => set('emergency_enabled')(e.target.checked)} />
              <span style={{ fontSize: 'var(--text-sm)' }}>Enable emergency-exit button</span>
            </label>
            <div style={GRID}>
              <NumField label="Monthly limit (requests)" value={form.emergency_monthly_limit}
                onChange={set('emergency_monthly_limit') as (v: number) => void} />
              <NumField label="Request validity (min)" value={form.emergency_validity_min}
                onChange={set('emergency_validity_min') as (v: number) => void} />
              <NumField label="Minimum reason length (chars)" value={form.emergency_min_reason_chars}
                onChange={set('emergency_min_reason_chars') as (v: number) => void} />
              <NumField label="Document follow-up (days)" value={form.emergency_followup_days}
                onChange={set('emergency_followup_days') as (v: number) => void} />
            </div>
          </div>

          {/* Smart missing-punch */}
          <div style={CARD}>
            <p style={SECTION}>Missing-punch</p>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 'var(--space-3)' }}>
              <input type="checkbox" checked={!!form.missing_punch_detection_enabled}
                onChange={e => set('missing_punch_detection_enabled')(e.target.checked)} />
              <span style={{ fontSize: 'var(--text-sm)' }}>Detect incomplete days and suggest a correction</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={!!form.missing_checkout_assume_shift_end} style={{ marginTop: 3 }}
                onChange={e => set('missing_checkout_assume_shift_end')(e.target.checked)} />
              <span>Suggest the forgotten check-out time = shift end (employee can edit)</span>
            </label>
            <div style={GRID}>
              <NumField label="Look-back window (days)" hint="How many recent days to scan for gaps"
                value={form.missing_punch_lookback_days} onChange={set('missing_punch_lookback_days') as (v: number) => void} />
            </div>
          </div>

          {/* Verification layers */}
          <div style={CARD}>
            <p style={SECTION}>Verification layers</p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-4)', lineHeight: 1.6 }}>
              Extra layers on top of GPS. The mobile app supplies the Wi-Fi / beacon signal; the web sends a device ID only.
              All layers are off by default and only apply once enabled.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              {[
                ['verify_wifi', 'Office Wi-Fi (known BSSID) — from mobile'],
                ['verify_beacon', 'Office beacon (BLE) — from mobile'],
                ['verify_device', 'Trusted device — blocks punching from someone else’s phone'],
              ].map(([k, label]) => (
                <label key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                  <input type="checkbox" checked={!!form[k as keyof Draft]}
                    onChange={e => set(k as keyof Draft)(e.target.checked)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div style={GRID}>
              <div>
                <label style={LBL}>Combine mode</label>
                <select style={INPUT} value={form.verification_mode ?? 'any'}
                  onChange={e => set('verification_mode')(e.target.value)}>
                  <option value="any">Any enabled layer is enough</option>
                  <option value="all">All enabled layers must pass</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-end', gap: 8, cursor: 'pointer', fontSize: 'var(--text-sm)', paddingBottom: 8 }}>
                <input type="checkbox" checked={!!form.device_trust_on_first_use}
                  onChange={e => set('device_trust_on_first_use')(e.target.checked)} />
                <span>Trust the first device automatically (else an admin approves it)</span>
              </label>
            </div>
            <a href="/hr/settings/verification" style={{ display: 'inline-block', marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 'var(--weight-semibold)' }}>
              Manage trusted devices and office signals →
            </a>
          </div>

          {/* Escalation + grading */}
          <div style={CARD}>
            <p style={SECTION}>Escalation & A/B/C</p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-4)', lineHeight: 1.6 }}>
              An issue = a late arrival, absence, missing check-out, or out-of-range punch. Counted per month for escalation, and over the report range for grading.
            </p>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 'var(--space-4)' }}>
              <input type="checkbox" checked={!!form.escalation_enabled}
                onChange={e => set('escalation_enabled')(e.target.checked)} />
              <span style={{ fontSize: 'var(--text-sm)' }}>Enable automatic escalation to manager / HR</span>
            </label>
            <div style={GRID}>
              <NumField label="Notify manager after (issues/month)" value={form.escalate_manager_after}
                onChange={set('escalate_manager_after') as (v: number) => void} />
              <NumField label="Notify HR after (issues/month)" value={form.escalate_hr_after}
                onChange={set('escalate_hr_after') as (v: number) => void} />
              <NumField label="Grade B threshold (issues)" hint="At or above = B" value={form.grade_b_threshold}
                onChange={set('grade_b_threshold') as (v: number) => void} />
              <NumField label="Grade C threshold (issues)" hint="At or above = C" value={form.grade_c_threshold}
                onChange={set('grade_c_threshold') as (v: number) => void} />
            </div>
            <a href="/hr/attendance/grades" style={{ display: 'inline-block', marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 'var(--weight-semibold)' }}>
              View A/B/C report →
            </a>
          </div>
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
}
