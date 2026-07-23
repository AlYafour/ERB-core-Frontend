'use client';

/**
 * Executive Attendance Report — one employee, one period.
 * /print/attendance/<employeeId>?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Designed as an enterprise HR document: a manager reads the status banner +
 * KPI grid + attention list in seconds; the daily table is the audit detail.
 * A4 portrait, print/PDF-optimised.
 */

import Image from 'next/image';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { hrAttendanceApi, type AttendanceTimesheet } from '@/lib/api/hr';
import { useTenantInfo } from '@/lib/hooks/use-tenant';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { PrintControlsBar } from '@/components/print/PrintControlsBar';

/* ── Enterprise palette ──────────────────────────────────────────── */
const NAVY   = '#16233d';
const NAVY2  = '#33415c';
const ORANGE = '#C9943A';
const INK    = '#0f172a';
const MUTE   = '#64748b';
const FAINT  = '#94a3b8';
const LINE   = '#e7ebf0';
const GOOD   = { fg: '#15803d', bg: '#effaf1', bd: '#bbe7c4' };
const WARN   = { fg: '#b45309', bg: '#fef8ee', bd: '#f0d9a8' };
const CRIT   = { fg: '#b91c1c', bg: '#fef2f2', bd: '#f4c4c4' };
const NEUT   = { fg: '#475569', bg: '#f6f8fa', bd: '#e2e8f0' };

const STATUS_META = {
  GOOD:            { label: 'GOOD',            dot: '🟢', ...GOOD, line: 'Attendance is on track — no issues detected.' },
  NEEDS_ATTENTION: { label: 'NEEDS ATTENTION', dot: '🟠', ...WARN, line: 'Some records need review.' },
  CRITICAL:        { label: 'CRITICAL',        dot: '🔴', ...CRIT, line: 'Multiple attendance issues require action.' },
} as const;

const fmtDate = (d?: string | null) =>
  !d ? '—' : new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtDow = (d: string) => {
  const t = new Date(d); return isNaN(t.getTime()) ? '' : t.toLocaleDateString('en-GB', { weekday: 'short' });
};
function fmtTime(dt: string | null): string {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d.getTime())) {
    const m = String(dt).match(/^(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : String(dt);
  }
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function PrintAttendancePage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const sp = useSearchParams();
  const from = sp.get('from') || undefined;
  const to = sp.get('to') || undefined;
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => { setHasToken(!!localStorage.getItem('access_token')); }, []);

  const { hasPermission, isLoading: permsLoading } = usePermissions();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;
  const canView = isAdmin || (hasPermission('hr_attendance', 'view') ?? false);

  const { data, isLoading, isError } = useQuery<AttendanceTimesheet>({
    queryKey: ['attendance-timesheet', employeeId, from, to],
    queryFn: () => hrAttendanceApi.timesheet({ employee: employeeId, date_after: from, date_before: to }),
    enabled: hasToken && canView, retry: 1,
  });
  const { data: tenantData } = useTenantInfo();
  const brand = tenantData?.branding;

  if (!hasToken || isLoading || permsLoading) return <Msg text="Loading…" color={MUTE} />;
  if (!canView) return <Msg text="You don't have permission to view this document." color={INK} />;
  if (isError || !data) return <Msg text="Report not found. Please make sure you are logged in." color="#ef4444" />;

  const emp = data.employee;
  const T = data.totals;
  const st = STATUS_META[data.status] ?? STATUS_META.NEEDS_ATTENTION;
  const periodLabel = `${fmtDate(data.period.from)} — ${fmtDate(data.period.to)}`;
  const reportId = `ATT-${emp.employee_id}-${(data.period.to || '').replace(/-/g, '')}`;
  const companyName = brand?.company_legal_name || data.company.name || 'Company';

  const dayState = (r: AttendanceTimesheet['days'][number]) => {
    if (r.kind === 'off')      return { key: 'off', icon: '·', label: 'Weekend / Off', ...NEUT };
    if (r.kind === 'upcoming') return { key: 'up',  icon: '·', label: 'Upcoming',      ...NEUT };
    if (r.kind === 'absent')   return { key: 'ab',  icon: '✕', label: 'Absent',        ...CRIT };
    if (r.check_in && r.check_out) return { key: 'ok', icon: '✓', label: 'Complete',        ...GOOD };
    if (r.check_in && !r.check_out) return { key: 'no', icon: '!', label: 'Missing check-out', ...WARN };
    if (!r.check_in && r.check_out) return { key: 'ni', icon: '!', label: 'Missing check-in',  ...WARN };
    return { key: 'rv', icon: '!', label: 'Review required', ...WARN };
  };

  // KPI cells — `tone` drives the accent only when the number is abnormal.
  const kpis: { label: string; value: string; sub?: string; tone: typeof GOOD | typeof WARN | typeof CRIT | typeof NEUT }[] = [
    { label: 'Attendance Rate', value: T.attendance_rate != null ? `${T.attendance_rate}%` : '—',
      sub: `${T.present_days}/${T.expected_working_days} days`,
      tone: T.attendance_rate == null ? NEUT : T.attendance_rate >= 90 ? GOOD : T.attendance_rate >= 70 ? WARN : CRIT },
    { label: 'Present Days', value: String(T.present_days), sub: `of ${T.expected_working_days} expected`, tone: NEUT },
    { label: 'Absent Days', value: String(T.absent_days), sub: 'scheduled, no record', tone: T.absent_days ? CRIT : GOOD },
    { label: 'Work Hours', value: T.work_hours.toFixed(1), sub: `of ${T.expected_hours.toFixed(0)} expected`, tone: NEUT },
    { label: 'Overtime', value: T.overtime_hours.toFixed(1), sub: 'hours', tone: T.overtime_hours > 0 ? WARN : NEUT },
    { label: 'Late Arrivals', value: String(T.late_days), sub: 'days', tone: T.late_days ? WARN : GOOD },
    { label: 'Complete Records', value: String(T.complete_records), sub: 'full punch days', tone: GOOD },
    { label: 'Attendance Issues', value: String(T.incomplete_records + T.absent_days),
      sub: `${T.missing_check_ins} in · ${T.missing_check_outs} out`, tone: (T.incomplete_records + T.absent_days) ? WARN : GOOD },
  ];

  const profile: [string, string | null][] = [
    ['Employee ID', emp.employee_id],
    ['Job Title', emp.job_title],
    ['Department', emp.department],
    ['Employment', emp.employment_type ? emp.employment_type.replace(/_/g, ' ') : null],
    ['Join Date', emp.join_date ? fmtDate(emp.join_date) : null],
    ['Nationality', emp.nationality],
  ];

  return (
    <div className="print-page-bg" style={{ minHeight: '100vh', background: '#eef1f5', fontFamily: "'Inter','IBM Plex Sans','Helvetica Neue',sans-serif" }}>
      <PrintControlsBar backHref="/hr/attendance" docType="ATTENDANCE" docTypeColor={ORANGE}
        docNumber={emp.employee_id} status={st.label} />

      <div className="print-doc" style={{
        width: '210mm', minHeight: '297mm', margin: '12px auto', background: '#fff',
        borderRadius: 4, boxShadow: '0 4px 32px rgba(0,0,0,.14)', color: INK,
        display: 'flex', flexDirection: 'column', padding: '13mm 12mm',
      }}>
        {/* ── HEADER ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <Image src={brand?.logo_url || '/xerb-logo.svg'} alt="" width={44} height={44}
              style={{ objectFit: 'contain' }} priority unoptimized />
            <div>
              <div style={{ fontSize: '10.5pt', fontWeight: 800, color: NAVY, lineHeight: 1.15, letterSpacing: '-.2px' }}>{companyName}</div>
              {brand?.company_address && <div style={{ fontSize: '6.8pt', color: FAINT, marginTop: 2, maxWidth: 260, lineHeight: 1.4 }}>{brand.company_address}</div>}
              {brand?.company_trn && <div style={{ fontSize: '6.8pt', color: FAINT, marginTop: 1 }}>TRN {brand.company_trn}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '2px', color: ORANGE, textTransform: 'uppercase' }}>Attendance Report</div>
            <div style={{ fontSize: '15pt', fontWeight: 800, color: NAVY, lineHeight: 1.1, marginTop: 1 }}>{emp.name}</div>
            <div style={{ fontSize: '7.2pt', color: MUTE, marginTop: 4, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <span><b style={{ color: NAVY2 }}>Period</b> {periodLabel}</span>
            </div>
            <div style={{ fontSize: '6.8pt', color: FAINT, marginTop: 2, fontFamily: 'monospace' }}>{reportId}</div>
          </div>
        </div>

        {/* ── STATUS BANNER ───────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginTop: 14,
          padding: '10px 16px', borderRadius: 10, background: st.bg, border: `1px solid ${st.bd}`,
          borderLeft: `4px solid ${st.fg}`,
        }}>
          <div style={{ fontSize: '13pt' }}>{st.dot}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11pt', fontWeight: 800, color: st.fg, letterSpacing: '.3px' }}>{st.label}</div>
            <div style={{ fontSize: '8pt', color: NAVY2, marginTop: 1 }}>
              {T.complete_records} complete records · {T.incomplete_records + T.absent_days} attendance issue(s) · {st.line}
            </div>
          </div>
          <div style={{ textAlign: 'right', paddingLeft: 12, borderLeft: `1px solid ${st.bd}` }}>
            <div style={{ fontSize: '20pt', fontWeight: 800, color: st.fg, lineHeight: 1, fontFamily: 'monospace' }}>
              {T.attendance_rate != null ? `${T.attendance_rate}%` : '—'}
            </div>
            <div style={{ fontSize: '6.5pt', color: MUTE, textTransform: 'uppercase', letterSpacing: '.5px' }}>Attendance</div>
          </div>
        </div>

        {/* ── KPI GRID ────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 12 }}>
          {kpis.map((k, i) => (
            <div key={i} style={{ borderRadius: 9, border: `1px solid ${LINE}`, padding: '9px 11px', background: '#fff' }}>
              <div style={{ fontSize: '6.6pt', fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: MUTE }}>{k.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 3 }}>
                <span style={{ fontSize: '17pt', fontWeight: 800, lineHeight: 1, color: k.tone.fg, fontFamily: 'monospace' }}>{k.value}</span>
              </div>
              {k.sub && <div style={{ fontSize: '6.6pt', color: FAINT, marginTop: 3 }}>{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* ── ATTENTION + PROFILE (two columns) ───────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 14, marginTop: 14 }}>
          <div>
            <SectionLabel>Attention Required</SectionLabel>
            {data.attention.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 9,
                background: GOOD.bg, border: `1px solid ${GOOD.bd}`, fontSize: '8.5pt', color: GOOD.fg, fontWeight: 600 }}>
                ✓ No anomalies — all records are complete.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {data.attention.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 11px', borderRadius: 8,
                    background: WARN.bg, border: `1px solid ${WARN.bd}` }}>
                    <span style={{ width: 15, height: 15, borderRadius: '50%', background: WARN.fg, color: '#fff',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9pt', fontWeight: 800, flexShrink: 0 }}>!</span>
                    <span style={{ fontSize: '8.3pt', color: NAVY2, fontWeight: 500 }}>{m}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <SectionLabel>Employee</SectionLabel>
            <div style={{ borderRadius: 9, border: `1px solid ${LINE}`, overflow: 'hidden' }}>
              {profile.map(([label, val], i) => (
                <div key={i} style={{ display: 'flex', padding: '5.5px 12px', fontSize: '8pt',
                  borderBottom: i < profile.length - 1 ? `1px solid ${LINE}` : 'none' }}>
                  <span style={{ width: 92, flexShrink: 0, color: MUTE, fontWeight: 500 }}>{label}</span>
                  <span style={{ fontWeight: val ? 600 : 400, color: val ? INK : FAINT }}>{val || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── DAILY TABLE ─────────────────────────────────────────── */}
        <SectionLabel style={{ marginTop: 16 }}>Daily Attendance</SectionLabel>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.4pt' }}>
          <thead>
            <tr style={{ background: NAVY, color: '#fff' }}>
              {[['Date','left'],['Day','center'],['Check In','center'],['Break Out','center'],['Break In','center'],['Check Out','center'],['Work','right'],['OT','right'],['Status','left']]
                .map(([h, a], i) => (
                <th key={i} style={{ padding: '8px 10px', textAlign: a as 'left'|'center'|'right',
                  fontSize: '6.8pt', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.days.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 16, textAlign: 'center', color: FAINT }}>No days in this period.</td></tr>
            ) : data.days.map((r, idx) => {
              const s = dayState(r);
              const alt = idx % 2 === 1;
              const noPunch = s.key === 'off' || s.key === 'up' || s.key === 'ab';
              const dash = (v: string | null, on: string) =>
                <span style={{ color: v ? on : '#cbd5e1', fontFamily: 'monospace' }}>{fmtTime(v)}</span>;
              return (
                <tr key={r.date ?? idx} style={{ background: s.key === 'ok' ? (alt ? '#fbfcfd' : '#fff') : s.bg, borderBottom: `1px solid ${LINE}` }}>
                  <td style={{ padding: '7px 10px', fontWeight: 700, color: s.key === 'ab' ? CRIT.fg : NAVY, whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'center', color: MUTE }}>{fmtDow(r.date)}</td>
                  {noPunch ? (
                    <td colSpan={6} style={{ padding: '7px 10px', textAlign: 'center', color: FAINT, fontStyle: 'italic', fontSize: '7.6pt' }}>
                      {s.key === 'ab' ? 'No attendance recorded' : s.key === 'off' ? 'Non-working day' : 'Upcoming'}
                    </td>
                  ) : (<>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>{dash(r.check_in, INK)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>{dash(r.break_start, ORANGE)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>{dash(r.break_end, ORANGE)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>{dash(r.check_out, INK)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{r.work_hours != null ? Number(r.work_hours).toFixed(2) : '—'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: Number(r.overtime_hours) > 0 ? ORANGE : '#cbd5e1' }}>{Number(r.overtime_hours) > 0 ? Number(r.overtime_hours).toFixed(2) : '—'}</td>
                  </>)}
                  <td style={{ padding: '7px 10px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '7pt', fontWeight: 700, color: s.fg }}>
                      <span style={{ width: 13, height: 13, borderRadius: '50%', background: s.fg, color: '#fff',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '8pt', flexShrink: 0 }}>{s.icon}</span>
                      {s.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: NAVY, color: '#fff', fontWeight: 800 }}>
              <td colSpan={6} style={{ padding: '8px 10px', fontSize: '8pt' }}>TOTAL · {T.present_days} present of {T.expected_working_days} expected day(s)</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{T.work_hours.toFixed(2)}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{T.overtime_hours.toFixed(2)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
        <div style={{ fontSize: '6.8pt', color: FAINT, marginTop: 5, display: 'flex', gap: 14 }}>
          <span><b style={{ color: GOOD.fg }}>✓</b> Complete = both check-in and check-out captured.</span>
          <span><b style={{ color: WARN.fg }}>!</b> A punch is missing on the device or app; recorded punches shown as captured.</span>
        </div>

        <div style={{ flex: 1, minHeight: 16 }} />

        {/* ── CERTIFICATION ───────────────────────────────────────── */}
        <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <div style={{ display: 'flex', gap: 0, border: `1px solid ${LINE}`, borderRadius: 9, overflow: 'hidden' }}>
            {['Employee', 'HR / Supervisor', 'Authorised Signatory'].map((label, i, a) => (
              <div key={i} style={{ flex: 1, padding: '10px 14px', borderRight: i < a.length - 1 ? `1px solid ${LINE}` : 'none' }}>
                <div style={{ height: 30 }} />
                <div style={{ height: 1, background: '#cbd5e1', marginBottom: 5 }} />
                <div style={{ fontSize: '6.8pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: MUTE }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '6.5pt', color: FAINT }}>
            <span>System-generated from the ERB attendance system · {companyName}</span>
            <span style={{ fontFamily: 'monospace' }}>{reportId}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: '7.5pt', fontWeight: 700, letterSpacing: '.9px', textTransform: 'uppercase',
      color: NAVY2, borderBottom: `1.5px solid ${ORANGE}`, paddingBottom: 4, marginBottom: 9, display: 'inline-block', ...style }}>
      {children}
    </div>
  );
}

function Msg({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,sans-serif', color }}>{text}</div>
  );
}
