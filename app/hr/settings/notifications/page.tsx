'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, PageHeader, Button } from '@/components/ui';
import HRSettingsNav from '@/components/hr/HRSettingsNav';
import { hrCompanySettingsApi, type TestNotificationResult } from '@/lib/api/hr';
import { toast, confirm } from '@/lib/hooks/use-toast';
import type { HRCompanySettings } from '@/types';

// ── shared styles (design tokens only) ────────────────────────────────────────
const INPUT_CS: React.CSSProperties = {
  width: '100%', padding: '8px 11px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
  color: 'var(--text-primary)', fontSize: 'var(--text-sm)', outline: 'none',
  boxSizing: 'border-box',
};
const LBL_CS: React.CSSProperties = {
  display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600,
  color: 'var(--text-secondary)', marginBottom: 6,
};
const SUBHINT_CS: React.CSSProperties = {
  fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '5px 0 0', lineHeight: 1.5,
};

const PLACEHOLDERS = ['employee', 'employee_id', 'minutes', 'date', 'shift', 'department'];
const RECIPIENTS = [
  { key: 'employee' as const,        label: 'The employee',   hint: 'The person who was late' },
  { key: 'direct_manager' as const,  label: 'Direct manager', hint: 'Their line manager' },
  { key: 'hr' as const,              label: 'HR managers',    hint: 'Everyone with the HR role' },
];

function todayLabel() {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Client-side mirror of the backend _render: fill {placeholders}, leave unknown intact.
function renderTemplate(tpl: string, fallback: string, sample: Record<string, string>) {
  return (tpl || fallback).replace(/\{(\w+)\}/g, (m, k) => (k in sample ? sample[k] : m));
}

export default function AttendanceNotificationsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<HRCompanySettings>>({});
  const [dirty, setDirty] = useState(false);
  const [testResult, setTestResult] = useState<TestNotificationResult | null>(null);
  const lastFocused = useRef<'subject' | 'body'>('body');

  const { data, isLoading } = useQuery({
    queryKey: ['hr-company-settings'],
    queryFn: hrCompanySettingsApi.get,
    staleTime: 300_000,
  });

  useEffect(() => { if (data && !dirty) setForm(data); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () => hrCompanySettingsApi.update(form),
    onSuccess: (updated) => {
      qc.setQueryData(['hr-company-settings'], updated);
      setForm(updated);
      setDirty(false);
      toast('Notification settings saved', 'success');
    },
    onError: () => toast('Could not save — please try again', 'error'),
  });

  const test = useMutation({
    mutationFn: () => hrCompanySettingsApi.testNotification({
      late_notify_subject: form.late_notify_subject ?? '',
      late_notify_body: form.late_notify_body ?? '',
      notify_cc_emails: form.notify_cc_emails ?? [],
    }),
    onSuccess: (res) => {
      setTestResult(res);
      if (res.email.delivered) toast('Test sent — check your inbox', 'success');
      else if (res.email.attempted && !res.email.smtp_configured) toast('In-app test sent (email not configured yet)', 'info');
      else toast('Test notification sent', 'success');
    },
    onError: () => toast('Could not send the test', 'error'),
  });

  const backfill = useMutation({
    mutationFn: (force: boolean) => hrCompanySettingsApi.backfillLateNotices({ force }),
    onSuccess: (res) => {
      if (res.disabled) toast('Turn notifications on and save first', 'info');
      else if (res.sent > 0) toast(`Sent ${res.forced ? '(re-sent) ' : ''}late notices for ${res.sent} record(s) today`, 'success');
      else toast('No new late arrivals to notify for today', 'info');
    },
    onError: () => toast('Could not send today’s notices', 'error'),
  });

  const runBackfill = async () => {
    const ok = await confirm(
      'Send late-arrival notices for everyone who already checked in late today? '
      + 'Anyone already notified is skipped, so it is safe to run.',
    );
    if (ok) backfill.mutate(false);
  };

  const set = <K extends keyof HRCompanySettings>(k: K, v: HRCompanySettings[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setDirty(true);
  };

  if (isLoading) return null;

  const g = <K extends keyof HRCompanySettings>(k: K, dflt: NonNullable<HRCompanySettings[K]>): NonNullable<HRCompanySettings[K]> =>
    (form[k] ?? data?.[k] ?? dflt) as NonNullable<HRCompanySettings[K]>;

  const enabled = g('notifications_enabled', true);
  const recipients = (g('notify_recipients', {}) ?? {}) as Record<string, boolean>;
  const cc = g('notify_cc_emails', []) ?? [];
  const threshold = g('late_notify_after_mins', 15);
  const subject = g('late_notify_subject', '');
  const body = g('late_notify_body', '');

  const sample: Record<string, string> = {
    employee: 'Ahmed Ali', employee_id: 'EMP-0142', minutes: String(threshold || 15),
    date: todayLabel(), shift: 'Morning Shift', department: 'Operations',
  };
  const previewSubject = renderTemplate(subject, 'Late check-in recorded', sample);
  const previewBody = renderTemplate(
    body, `${sample.employee} checked in ${sample.minutes} minute(s) after the shift start on ${sample.date}.`, sample);

  const insertPlaceholder = (ph: string) => {
    const token = `{${ph}}`;
    if (lastFocused.current === 'subject') set('late_notify_subject', `${subject}${token}`);
    else set('late_notify_body', `${body}${token}`);
  };

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Attendance Notifications"
          description="Decide who is notified when someone checks in late, personalise the message, and send yourself a test."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'HR' }, { label: 'Settings', href: '/hr/settings' }, { label: 'Notifications' }]}
        />

        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
          <HRSettingsNav />

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', paddingBottom: 84 }}>

            {/* 1 ── Master switch ─────────────────────────────────────────── */}
            <section className="card" style={{ padding: 'var(--space-5)' }}>
              <ToggleRow
                label="Attendance notifications"
                hint="The master switch. When off, no attendance notices are sent at all."
                checked={enabled}
                onChange={v => set('notifications_enabled', v)}
                strong
              />
              <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none' }}>
                <ToggleRow
                  label="Notify on late check-in"
                  hint="Send a notice when someone checks in after the threshold below."
                  checked={g('notify_late_arrival', true)}
                  onChange={v => set('notify_late_arrival', v)}
                />
                <ToggleRow
                  label="Notify on incomplete hours"
                  hint="Send a notice when someone leaves before completing the day's required hours."
                  checked={g('notify_incomplete_hours', true)}
                  onChange={v => set('notify_incomplete_hours', v)}
                />
              </div>
            </section>

            {/* 2 ── Recipients + CC ───────────────────────────────────────── */}
            <section className="card" style={{ padding: 'var(--space-5)' }}>
              <SectionTitle title="Who receives it" subtitle="Pick the in-app recipients, and add any extra email addresses to CC." />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                {RECIPIENTS.map(r => {
                  const on = !!recipients[r.key];
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => set('notify_recipients', { ...recipients, [r.key]: !on })}
                      style={{
                        textAlign: 'left', cursor: 'pointer',
                        padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
                        border: `1.5px solid ${on ? 'var(--brand)' : 'var(--border-subtle)'}`,
                        background: on ? 'var(--brand-subtle)' : 'var(--surface-subtle)',
                        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                        transition: 'border-color .15s, background .15s',
                      }}
                    >
                      <span style={{
                        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                        border: `1.5px solid ${on ? 'var(--brand)' : 'var(--border-strong, var(--text-tertiary))'}`,
                        background: on ? 'var(--brand)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{r.label}</span>
                        <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{r.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 'var(--space-5)' }}>
                <label style={LBL_CS}>CC email addresses</label>
                <input
                  style={INPUT_CS}
                  placeholder="hr@yourcompany.com, manager@yourcompany.com"
                  value={cc.join(', ')}
                  onChange={e => set('notify_cc_emails', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                />
                <p style={SUBHINT_CS}>Separate addresses with commas. These addresses are emailed a copy directly.</p>
              </div>
            </section>

            {/* 3 ── Late message ──────────────────────────────────────────── */}
            <section className="card" style={{ padding: 'var(--space-5)' }}>
              <SectionTitle title="Late check-in message" subtitle="Set how late is “late”, then write the notice. Leave blank to use the default wording." />

              <div style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
                <div>
                  <label style={LBL_CS}>Only notify when late by at least</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <input
                      type="number" min={0} style={{ ...INPUT_CS, width: 110 }}
                      value={threshold}
                      onChange={e => set('late_notify_after_mins', Math.max(0, parseInt(e.target.value || '0', 10)))}
                    />
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>minutes</span>
                  </div>
                  <p style={SUBHINT_CS}>Set 0 to notify on any lateness.</p>
                </div>
              </div>

              <div style={{ marginTop: 'var(--space-4)' }}>
                <label style={LBL_CS}>Subject</label>
                <input
                  style={INPUT_CS}
                  placeholder="Late check-in recorded"
                  value={subject}
                  onFocus={() => { lastFocused.current = 'subject'; }}
                  onChange={e => set('late_notify_subject', e.target.value)}
                />
              </div>

              <div style={{ marginTop: 'var(--space-4)' }}>
                <label style={LBL_CS}>Message</label>
                <textarea
                  style={{ ...INPUT_CS, minHeight: 96, resize: 'vertical', lineHeight: 1.55 }}
                  placeholder="{employee} checked in {minutes} minute(s) late on {date}."
                  value={body}
                  onFocus={() => { lastFocused.current = 'body'; }}
                  onChange={e => set('late_notify_body', e.target.value)}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginRight: 2 }}>Insert:</span>
                  {PLACEHOLDERS.map(ph => (
                    <button
                      key={ph}
                      type="button"
                      onClick={() => insertPlaceholder(ph)}
                      style={{
                        fontFamily: 'monospace', fontSize: 'var(--text-xs)',
                        padding: '3px 8px', borderRadius: 'var(--radius-sm, 6px)',
                        border: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)',
                        color: 'var(--text-secondary)', cursor: 'pointer',
                      }}
                    >{`{${ph}}`}</button>
                  ))}
                </div>
              </div>

              {/* live preview */}
              <div style={{ marginTop: 'var(--space-5)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)', overflow: 'hidden' }}>
                <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview</div>
                <div style={{ padding: 'var(--space-4)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{previewSubject}</p>
                  <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{previewBody}</p>
                  <p style={{ margin: '10px 0 0', paddingTop: 10, borderTop: '1px dashed var(--border-subtle)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                    This is a simplified preview. The emailed copy is a professionally formatted, bilingual (Arabic + English) message with your company logo and a clear details table. Leave the message blank to use the polished bilingual default.
                  </p>
                </div>
              </div>
            </section>

            {/* 4 ── Test ──────────────────────────────────────────────────── */}
            <section className="card" style={{ padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <SectionTitle title="Send a test" subtitle="Fires the message above to you now (and to the CC addresses) so you can confirm it works." />
                <Button variant="secondary" onClick={() => test.mutate()} disabled={test.isPending}>
                  {test.isPending ? 'Sending…' : 'Send test to me'}
                </Button>
              </div>

              {testResult && <TestResultPanel result={testResult} />}

              <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <SectionTitle
                  title="Catch up today's late arrivals"
                  subtitle="Notifications fire automatically at check-in. Use this once to also notify everyone who already checked in late today. Safe to run — anyone already notified is skipped."
                />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <Button variant="secondary" onClick={runBackfill} disabled={backfill.isPending}>
                    {backfill.isPending ? 'Sending…' : "Send today's late notices"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => backfill.mutate(true)}
                    disabled={backfill.isPending}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textDecoration: 'underline' }}
                  >
                    Re-send for testing (ignores “already sent”)
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* sticky save bar — always reachable, never hidden */}
        <div style={{
          position: 'sticky', bottom: 0, marginTop: 'var(--space-4)',
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--surface-primary)', borderTop: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-3)',
          boxShadow: '0 -4px 12px -8px rgba(0,0,0,0.25)',
        }}>
          <span style={{ fontSize: 'var(--text-xs)', color: dirty ? 'var(--status-warning)' : 'var(--text-tertiary)', marginRight: 'auto' }}>
            {dirty ? 'You have unsaved changes' : 'All changes saved'}
          </span>
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </PageShell>
    </MainLayout>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>{title}</p>
      <p style={{ margin: '3px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 520 }}>{subtitle}</p>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange, strong }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; strong?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: strong ? 'var(--weight-semibold)' : 500, color: 'var(--text-primary)' }}>{label}</p>
        {hint && <p style={{ margin: '3px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          flexShrink: 0, width: 40, height: 23, borderRadius: 999, border: 'none', cursor: 'pointer',
          background: checked ? 'var(--brand)' : 'var(--border-strong, var(--text-tertiary))',
          position: 'relative', transition: 'background .18s', marginTop: 1,
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 19 : 2, width: 19, height: 19,
          borderRadius: '50%', background: '#fff', transition: 'left .18s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }} />
      </button>
    </div>
  );
}

function TestResultPanel({ result }: { result: TestNotificationResult }) {
  const { email } = result;
  const ok = email.delivered;
  const warn = email.attempted && !email.smtp_configured;
  const tone = ok ? 'success' : warn ? 'warning' : 'success';
  const border = `var(--status-${tone}-border, var(--status-${tone}))`;
  const bg = `var(--status-${tone}-bg)`;

  return (
    <div style={{ marginTop: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: `1px solid ${border}`, background: bg, padding: 'var(--space-4)' }}>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
        {ok ? '✓ Test sent' : warn ? 'In-app test sent' : '✓ Test sent'}
      </p>

      <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        <Line label="In-app to">
          {result.inapp_recipients.length
            ? result.inapp_recipients.map(r => r.name).join(', ')
            : '—'}
        </Line>
        <Line label="Email to">
          {email.to.length ? email.to.join(', ') : 'no address on file'}
        </Line>
        <Line label="Email status">
          {ok
            ? <span style={{ color: 'var(--status-success)' }}>delivered</span>
            : warn
              ? <span style={{ color: 'var(--status-warning)' }}>not configured on the server yet — the in-app notice still went out</span>
              : email.error
                ? <span style={{ color: 'var(--status-error)' }}>{email.error}</span>
                : <span>not attempted (no email address)</span>}
        </Line>
      </div>

      <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: `1px solid ${border}` }}>
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>What was sent</p>
        <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{result.subject}</p>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{result.body}</p>
      </div>
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
      <span style={{ flexShrink: 0, width: 96, color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', paddingTop: 1 }}>{label}</span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  );
}
