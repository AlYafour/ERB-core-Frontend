'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, PageHeader, Button, Loader } from '@/components/ui';
import HRSettingsNav from '@/components/hr/HRSettingsNav';
import { hrAttendancePoliciesApi, hrCompanySettingsApi } from '@/lib/api/hr';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import type { AttendancePolicy } from '@/types';

type Geo = { geofence_enforcement: 'off' | 'warn' | 'enforce'; geofence_accuracy_slack_m: number };

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
  break_start_time: null,
  break_opens_before_min: 60, break_closes_after_min: 30, break_max_min: 60, break_grace_min: 5,
  break_alerts_enabled: false, break_notify_before_start_min: 10, break_notify_before_end_min: 5,
  break_soon_msg: '', break_ending_msg: '', break_overrun_msg: '',
  checkout_opens_after_min: 0, checkout_closes_after_min: 60,
  emergency_enabled: true, emergency_monthly_limit: 2, emergency_validity_min: 15,
  emergency_min_reason_chars: 100, emergency_followup_days: 3,
  emergency_intro_text: '', emergency_ack_text: '',
  missing_punch_detection_enabled: true, missing_punch_lookback_days: 7,
  missing_checkout_assume_shift_end: true,
  verify_wifi: false, verify_beacon: false, verify_device: false,
  verification_mode: 'any', device_trust_on_first_use: true,
  escalation_enabled: false, escalate_manager_after: 3, escalate_hr_after: 5,
  grade_b_threshold: 2, grade_c_threshold: 5,
  points_minor_late: 5, points_severe_late: 10, points_absent: 15,
  points_missing_punch: 3, points_out_of_range: 5, points_break_late: 10, points_mock_location: 25,
  zone_yellow_at: 10, zone_orange_at: 20, zone_red_at: 35, block_mock_location: false,
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

  // Company settings hold the location (geofence) controls — shown here too so
  // ALL punch rules live on one page. Saved together with the policy.
  const { data: company } = useQuery({
    queryKey: ['hr-company-settings'],
    queryFn: () => hrCompanySettingsApi.get(),
  });

  // We manage the tenant-wide catch-all policy (employee_group = null).
  const catchAll = (policies ?? []).find(p => p.employee_group == null);
  const [form, setForm] = useState<Draft>(DEFAULTS);
  const [geo, setGeo] = useState<Geo>({ geofence_enforcement: 'enforce', geofence_accuracy_slack_m: 50 });
  // Don't let a background refetch of this (long) form clobber in-progress edits.
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (catchAll && !dirty) setForm(catchAll);
  }, [catchAll, dirty]);
  useEffect(() => {
    if (company && !dirty) setGeo({
      geofence_enforcement: company.geofence_enforcement ?? 'enforce',
      geofence_accuracy_slack_m: company.geofence_accuracy_slack_m ?? 50,
    });
  }, [company, dirty]);

  const set = (k: keyof Draft) => (v: number | boolean | string) => { setDirty(true); setForm(f => ({ ...f, [k]: v })); };

  const saveMut = useMutation({
    mutationFn: async () => {
      await (catchAll
        ? hrAttendancePoliciesApi.update(catchAll.id, form)
        : hrAttendancePoliciesApi.create({ ...form, employee_group: null }));
      await hrCompanySettingsApi.update(geo);
    },
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['attendance-policies'] });
      qc.invalidateQueries({ queryKey: ['hr-company-settings'] });
      toast('Attendance rules saved', 'success');
    },
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
            <Button variant="primary" size="sm" isLoading={saveMut.isPending} onClick={() => saveMut.mutate()}>
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

          {/* Location (GPS geofence) — applies to every punch the same way */}
          <div style={CARD}>
            <p style={SECTION}>Location (GPS)</p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-4)', lineHeight: 1.6 }}>
              One rule for all punches — check-in, check-out and break are treated the same way.
            </p>
            <div style={GRID}>
              <div>
                <label style={LBL}>When outside the allowed area</label>
                <select style={INPUT} value={geo.geofence_enforcement}
                  onChange={e => { setDirty(true); setGeo(g => ({ ...g, geofence_enforcement: e.target.value as Geo['geofence_enforcement'] })); }}>
                  <option value="enforce">Block the punch (strict)</option>
                  <option value="warn">Allow but flag for review</option>
                  <option value="off">Don’t check location</option>
                </select>
              </div>
              <NumField label="GPS tolerance (m)" hint="Absorbs GPS drift so a phone off by a few metres still counts"
                value={geo.geofence_accuracy_slack_m}
                onChange={v => { setDirty(true); setGeo(g => ({ ...g, geofence_accuracy_slack_m: v })); }} />
            </div>
            <a href="/hr/settings/locations" style={{ display: 'inline-block', marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 'var(--weight-semibold)' }}>
              Set office points and radius on the map →
            </a>
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
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={LBL}>Break start time</label>
              <input type="time" style={{ ...INPUT, maxWidth: 200 }}
                value={(form.break_start_time ?? '').slice(0, 5)}
                onChange={e => setForm(f => ({ ...f, break_start_time: e.target.value || null }))} />
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                وقت البريك — الزر يظهر/يختفي نسبةً له. سيبه فاضي عشان ياخد وقت البريك من الشيفت.
              </p>
            </div>
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
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 'var(--space-4)' }}>
              <input type="checkbox" checked={!!form.break_alerts_enabled}
                onChange={e => set('break_alerts_enabled')(e.target.checked)} />
              <span style={{ fontSize: 'var(--text-sm)' }}>تفعيل تنبيهات البريك (قرب / قرب يخلص / تعدّى)</span>
            </label>
            <div style={{ ...GRID, marginTop: 'var(--space-3)' }}>
              <NumField label="Notify before break (min)" hint="تنبيه قبل موعد البريك"
                value={form.break_notify_before_start_min} onChange={set('break_notify_before_start_min') as (v: number) => void} />
              <NumField label="Notify before break ends (min)" hint="تنبيه قبل انتهاء المهلة"
                value={form.break_notify_before_end_min} onChange={set('break_notify_before_end_min') as (v: number) => void} />
            </div>
            <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {([
                ['break_soon_msg', 'نص "البريك قرب"', 'Your break is at {time}.'],
                ['break_ending_msg', 'نص "البريك قرب يخلص"', 'Your break ends at {time}…'],
                ['break_overrun_msg', 'نص "تعدّيت البريك"', 'Your break ran past its limit…'],
              ] as const).map(([k, label, ph]) => (
                <div key={k}>
                  <label style={LBL}>{label}</label>
                  <textarea style={{ ...INPUT, minHeight: 48, resize: 'vertical', fontFamily: 'inherit' }} rows={2}
                    value={(form[k] as string) ?? ''} onChange={e => set(k)(e.target.value)} placeholder={ph} />
                </div>
              ))}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.6 }}>
                تقدر تستخدم <code>{'{time}'}</code> (الوقت) و<code>{'{limit}'}</code> (المدة+السماحية) جوّه النص. بتوصل داخل التطبيق وكـpush على الموبايل.
              </p>
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
            <div style={{ marginTop: 'var(--space-4)' }}>
              <label style={LBL}>Warning text (top of the form)</label>
              <textarea style={{ ...INPUT, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} rows={2}
                value={form.emergency_intro_text ?? ''} onChange={e => set('emergency_intro_text')(e.target.value)}
                placeholder="Use this only for a genuine emergency…" />
            </div>
            <div style={{ marginTop: 'var(--space-3)' }}>
              <label style={LBL}>Acknowledgment text (the employee ticks)</label>
              <textarea style={{ ...INPUT, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} rows={2}
                value={form.emergency_ack_text ?? ''} onChange={e => set('emergency_ack_text')(e.target.value)}
                placeholder="I confirm this is a real emergency…" />
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

          {/* Rolling score (points) + zones */}
          <div style={CARD}>
            <p style={SECTION}>Rolling score & zones</p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-4)', lineHeight: 1.6 }}>
              Points per issue this month add up to a score that maps to a zone colour (green → yellow → orange → red) shown on the clock.
            </p>
            <div style={GRID}>
              <NumField label="Points · minor late" value={form.points_minor_late}
                onChange={set('points_minor_late') as (v: number) => void} />
              <NumField label="Points · severe late" value={form.points_severe_late}
                onChange={set('points_severe_late') as (v: number) => void} />
              <NumField label="Points · absent" value={form.points_absent}
                onChange={set('points_absent') as (v: number) => void} />
              <NumField label="Points · missing punch" value={form.points_missing_punch}
                onChange={set('points_missing_punch') as (v: number) => void} />
              <NumField label="Points · out of range" value={form.points_out_of_range}
                onChange={set('points_out_of_range') as (v: number) => void} />
              <NumField label="Points · late back from break" value={form.points_break_late}
                onChange={set('points_break_late') as (v: number) => void} />
              <NumField label="Points · fake GPS" value={form.points_mock_location}
                onChange={set('points_mock_location') as (v: number) => void} />
            </div>
            <div style={{ ...GRID, marginTop: 'var(--space-4)' }}>
              <NumField label="Yellow zone at (points)" value={form.zone_yellow_at}
                onChange={set('zone_yellow_at') as (v: number) => void} />
              <NumField label="Orange zone at (points)" value={form.zone_orange_at}
                onChange={set('zone_orange_at') as (v: number) => void} />
              <NumField label="Red zone at (points)" value={form.zone_red_at}
                onChange={set('zone_red_at') as (v: number) => void} />
            </div>
          </div>

          {/* Fake / mock GPS */}
          <div style={CARD}>
            <p style={SECTION}>Fake / mock GPS</p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '0 0 var(--space-3)', lineHeight: 1.6 }}>
              The mobile app reports whether the location came from a spoofing app. When blocked, such a punch is rejected; otherwise it is recorded and flagged (and scored).
            </p>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.block_mock_location}
                onChange={e => set('block_mock_location')(e.target.checked)} />
              <span style={{ fontSize: 'var(--text-sm)' }}>Block punches from a fake (mock) location</span>
            </label>
          </div>
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
}
