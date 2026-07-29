'use client';

/**
 * Attendance Statement — one employee, one period.
 * /print/attendance/<employeeId>?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * A formal, print/PDF-optimised HR document (A4 portrait): identity card with
 * photo, a summary strip, an attention list, then the daily audit table.
 */

import Image from 'next/image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { hrAttendanceApi, type AttendanceTimesheet } from '@/lib/api/hr';
import { useTenantInfo } from '@/lib/hooks/use-tenant';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { PrintControlsBar } from '@/components/print/PrintControlsBar';
import { formatHoursMinutes } from '@/lib/utils/hr';
import { normalizeImageUrl } from '@/lib/utils/image-url';

/* ── Palette (fixed hex — a print document commits to one look) ────── */
const INK    = '#1b2330';
const NAVY    = '#233047';
const NAVY2  = '#3c4759';
const MUTE   = '#697384';
const FAINT  = '#9aa3b1';
const LINE   = '#e6e9ef';
const PAPER  = '#f7f8fa';
const GOLD   = '#a97e30';
const GOOD   = { fg: '#2f7d55', bg: '#eef7f1', bd: '#cfe6d8' };
const WARN   = { fg: '#a76f1c', bg: '#fbf4e8', bd: '#eddcbd' };
const CRIT   = { fg: '#b23b3b', bg: '#fbf0f0', bd: '#eed1d1' };
const NEUT   = { fg: '#5a6472', bg: '#f6f7f9', bd: '#e6e9ef' };
const LEAVE  = { fg: '#35579f', bg: '#eef3fb', bd: '#d3ddf1' };

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const STATUS_META = {
  GOOD:            { label: 'On Track',        ...GOOD, line: 'Attendance is on track — no issues detected.' },
  NEEDS_ATTENTION: { label: 'Needs Review',    ...WARN, line: 'Some records need review.' },
  CRITICAL:        { label: 'Action Required', ...CRIT, line: 'Multiple attendance issues require action.' },
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

/** From/To picker in the control bar (hidden on print). Changing a date rewrites
 *  the URL query, which re-runs the timesheet query for the new period. */
function PeriodPicker({ employeeId, from, to }: { employeeId: string; from?: string; to?: string }) {
  const router = useRouter();
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now = new Date();
  const [f, setF] = useState(from || ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [t, setT] = useState(to || ymd(now));
  const go = (nf: string, nt: string) => { if (nf && nt) router.replace(`/print/attendance/${employeeId}?from=${nf}&to=${nt}`); };
  const inp: React.CSSProperties = {
    padding: '3px 7px', borderRadius: 6, border: `1px solid ${LINE}`,
    background: '#f8fafc', color: '#475569', fontSize: 11, fontWeight: 600, colorScheme: 'light',
  };
  const lbl: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: '.04em',
  };
  return (
    <>
      <label style={lbl}>From
        <input type="date" style={inp} value={f} max={t || undefined}
          onChange={e => { setF(e.target.value); go(e.target.value, t); }} />
      </label>
      <label style={lbl}>To
        <input type="date" style={inp} value={t} min={f || undefined}
          onChange={e => { setT(e.target.value); go(f, e.target.value); }} />
      </label>
    </>
  );
}

/** Employee photo with a clean initials fallback (no broken-image icon). */
function EmployeePhoto({ src, name }: { src: string | null; name: string }) {
  const [err, setErr] = useState(false);
  const url = normalizeImageUrl(src);
  const box: React.CSSProperties = {
    width: 66, height: 80, borderRadius: 8, flexShrink: 0,
    border: `1px solid ${LINE}`, overflow: 'hidden', background: PAPER,
  };
  if (url && !err) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} onError={() => setErr(true)}
      style={{ ...box, objectFit: 'cover', display: 'block' }} />;
  }
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f3ead8', color: GOLD, fontWeight: 800, fontSize: '17pt', letterSpacing: '.5px' }}>
      {initials || '—'}
    </div>
  );
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
  const rate = T.attendance_rate;

  const dayState = (r: AttendanceTimesheet['days'][number]) => {
    if (r.kind === 'off')      return { key: 'off', label: 'Weekend / Off',      ...NEUT };
    if (r.kind === 'upcoming') return { key: 'up',  label: 'Upcoming',           ...NEUT };
    if (r.kind === 'leave')    return { key: 'lv',  label: 'On Leave',           ...LEAVE };
    if (r.kind === 'absent')   return { key: 'ab',  label: 'Absent',            ...CRIT };
    if (r.check_in && r.check_out)   return { key: 'ok', label: 'Complete',            ...GOOD };
    if (r.check_in && !r.check_out)  return { key: 'no', label: 'Missing check-out', ...WARN };
    if (!r.check_in && r.check_out)  return { key: 'ni', label: 'Missing check-in',  ...WARN };
    return { key: 'rv', label: 'Review required', ...WARN };
  };

  const metrics = [
    { label: 'Attendance', value: rate != null ? `${rate}%` : '—', sub: `${T.present_days}/${T.expected_working_days} days`,
      color: rate == null ? INK : rate >= 90 ? GOOD.fg : rate >= 70 ? WARN.fg : CRIT.fg },
    { label: 'Present',  value: String(T.present_days),      sub: 'days worked', color: INK },
    { label: 'Absent',   value: String(T.absent_days),       sub: 'no record',   color: T.absent_days ? CRIT.fg : INK },
    { label: 'On Leave', value: String(T.leave_days ?? 0),   sub: 'approved',    color: (T.leave_days ?? 0) ? LEAVE.fg : INK },
    { label: 'Worked',   value: formatHoursMinutes(T.work_hours, { keepZero: true }), sub: `of ${formatHoursMinutes(T.expected_hours, { keepZero: true })}`, color: INK },
    { label: 'Overtime', value: formatHoursMinutes(T.overtime_hours, { keepZero: true }), sub: 'extra', color: T.overtime_hours > 0 ? GOLD : FAINT },
  ];

  const facts: [string, string | null][] = [
    ['Employee ID', emp.employee_id],
    ['Job Title', emp.job_title],
    ['Department', emp.department_ar || emp.department],
    ['Employment', emp.employment_type ? emp.employment_type.replace(/_/g, ' ') : null],
    ['Join Date', emp.join_date ? fmtDate(emp.join_date) : null],
    ['Nationality', emp.nationality],
  ];

  return (
    <div className="print-page-bg" style={{ minHeight: '100vh', background: '#e9edf2', fontFamily: FONT }}>
      <PrintControlsBar backHref="/hr/attendance" docType="ATTENDANCE" docTypeColor={GOLD}
        docNumber={emp.employee_id} status={st.label}>
        <PeriodPicker employeeId={String(employeeId)} from={from} to={to} />
      </PrintControlsBar>

      <div className="print-doc" style={{
        width: '210mm', minHeight: '297mm', margin: '12px auto', background: '#fff',
        boxShadow: '0 4px 32px rgba(0,0,0,.14)', color: INK, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '13mm 12mm' }}>

          {/* ── LETTERHEAD ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <Image src={brand?.logo_url || '/xerb-logo.svg'} alt="" width={42} height={42}
                style={{ objectFit: 'contain' }} priority unoptimized />
              <div>
                <div style={{ fontSize: '11pt', fontWeight: 800, color: NAVY, lineHeight: 1.15, letterSpacing: '-.2px' }}>{companyName}</div>
                {brand?.company_address && <div style={{ fontSize: '6.8pt', color: FAINT, marginTop: 2, maxWidth: 300, lineHeight: 1.4 }}>{brand.company_address}</div>}
                {brand?.company_trn && <div style={{ fontSize: '6.8pt', color: FAINT, marginTop: 1 }}>TRN {brand.company_trn}</div>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '7.5pt', fontWeight: 700, letterSpacing: '3px', color: GOLD, textTransform: 'uppercase' }}>Attendance Statement</div>
              <div style={{ fontSize: '6.8pt', color: FAINT, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{reportId}</div>
              <div style={{ fontSize: '7.4pt', color: MUTE, marginTop: 2 }}>{periodLabel}</div>
            </div>
          </div>
          <div style={{ marginTop: 9, height: 2, background: LINE, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: 64, height: 2, background: GOLD }} />
          </div>

          {/* ── IDENTITY CARD (photo + facts) ──────────────────────── */}
          <div style={{ display: 'flex', gap: 14, marginTop: 13, padding: 13, borderRadius: 10,
            border: `1px solid ${LINE}`, background: PAPER }}>
            <EmployeePhoto src={emp.photo} name={emp.name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: '13.5pt', fontWeight: 800, color: NAVY, lineHeight: 1.1, letterSpacing: '-.3px' }}>{emp.name}</div>
                  {emp.name_ar && <div style={{ fontSize: '9.5pt', color: NAVY2, marginTop: 1, direction: 'rtl' }}>{emp.name_ar}</div>}
                </div>
                <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 99, background: st.bg, border: `1px solid ${st.bd}`, color: st.fg,
                  fontSize: '7pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.fg }} />{st.label}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '7px 16px', marginTop: 11 }}>
                {facts.map(([label, val], i) => (
                  <div key={i}>
                    <div style={{ fontSize: '6.2pt', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: FAINT }}>{label}</div>
                    <div style={{ fontSize: '8.4pt', fontWeight: 600, color: val ? INK : FAINT, marginTop: 1 }}>{val || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── SUMMARY STRIP ──────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', marginTop: 14,
            border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden' }}>
            {metrics.map((m, i) => (
              <div key={i} style={{ padding: '11px 12px', borderLeft: i ? `1px solid ${LINE}` : 'none' }}>
                <div style={{ fontSize: '6.2pt', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: MUTE }}>{m.label}</div>
                <div style={{ fontSize: '17pt', fontWeight: 800, lineHeight: 1.05, color: m.color, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
                {m.sub && <div style={{ fontSize: '6.2pt', color: FAINT, marginTop: 2 }}>{m.sub}</div>}
              </div>
            ))}
          </div>

          {/* ── ATTENTION (one slim line) ──────────────────────────── */}
          {data.attention.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
              fontSize: '7.8pt', color: NAVY2, lineHeight: 1.6 }}>
              <span style={{ fontSize: '6.4pt', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: WARN.fg }}>Attention</span>
              {data.attention.map((m, i) => (
                <span key={i}>{i > 0 && <span style={{ color: FAINT, margin: '0 4px' }}>·</span>}{m}</span>
              ))}
            </div>
          )}

          {/* ── DAILY TABLE ────────────────────────────────────────── */}
          <div style={{ marginTop: 15 }}><SectionLabel>Daily Attendance</SectionLabel></div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.4pt', tableLayout: 'fixed',
            fontVariantNumeric: 'tabular-nums' }}>
            <colgroup>
              <col style={{ width: '17%' }} /><col style={{ width: '8%' }} />
              <col style={{ width: '12%' }} /><col style={{ width: '21%' }} />
              <col style={{ width: '12%' }} /><col style={{ width: '12%' }} />
              <col style={{ width: '18%' }} />
            </colgroup>
            <thead>
              <tr>
                {([['Date', 'left'], ['Day', 'center'], ['In', 'center'], ['Break', 'center'], ['Out', 'center'], ['Work', 'right'], ['Status', 'left']] as const)
                  .map(([h, a], i) => (
                    <th key={i} style={{ padding: '0 10px 7px', textAlign: a, fontSize: '6.8pt', fontWeight: 700,
                      letterSpacing: '.8px', textTransform: 'uppercase', color: MUTE, whiteSpace: 'nowrap',
                      borderBottom: `1.5px solid ${NAVY}` }}>{h}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {data.days.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 16, textAlign: 'center', color: FAINT }}>No days in this period.</td></tr>
              ) : data.days.map((r, idx) => {
                const s = dayState(r);
                const off = s.key === 'off';
                const tint = s.key === 'ab' ? CRIT.bg : s.key === 'lv' ? LEAVE.bg : off ? PAPER : '#fff';
                const cell: React.CSSProperties = { padding: '6px 10px', borderBottom: `1px solid ${LINE}` };
                const time = (v: string | null) => <span style={{ color: v ? (off ? MUTE : INK) : '#d0d6de' }}>{fmtTime(v)}</span>;
                const brk = r.break_start || r.break_end ? `${fmtTime(r.break_start)} – ${fmtTime(r.break_end)}` : '—';
                return (
                  <tr key={r.date ?? idx} style={{ background: tint }}>
                    <td style={{ ...cell, fontWeight: 600, color: off ? MUTE : NAVY, whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                    <td style={{ ...cell, textAlign: 'center', color: FAINT }}>{fmtDow(r.date)}</td>
                    <td style={{ ...cell, textAlign: 'center' }}>{time(r.check_in)}</td>
                    <td style={{ ...cell, textAlign: 'center', color: r.break_start || r.break_end ? MUTE : '#d0d6de' }}>{brk}</td>
                    <td style={{ ...cell, textAlign: 'center' }}>{time(r.check_out)}</td>
                    <td style={{ ...cell, textAlign: 'right', fontWeight: 700, color: r.work_hours != null ? INK : '#d0d6de' }}>{formatHoursMinutes(r.work_hours)}</td>
                    <td style={cell}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '7.6pt', fontWeight: 600, color: s.fg, whiteSpace: 'nowrap' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.fg, flexShrink: 0 }} />
                        {s.label}
                        {r.permission_hours ? <span style={{ color: LEAVE.fg }}> · {formatHoursMinutes(r.permission_hours)}</span> : null}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ padding: '9px 10px', fontSize: '7.6pt', fontWeight: 800, color: NAVY, letterSpacing: '.3px', borderTop: `1.5px solid ${NAVY}` }}>TOTAL · {T.present_days} present of {T.expected_working_days} scheduled</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: NAVY, borderTop: `1.5px solid ${NAVY}` }}>{formatHoursMinutes(T.work_hours, { keepZero: true })}</td>
                <td style={{ borderTop: `1.5px solid ${NAVY}` }} />
              </tr>
            </tfoot>
          </table>
          <div style={{ fontSize: '6.8pt', color: NAVY2, marginTop: 8, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {([['Complete', GOOD.fg], ['Missing punch', WARN.fg], ['Absent', CRIT.fg], ['On Leave', LEAVE.fg], ['Off', NEUT.fg]] as const).map(([l, c], i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />{l}
              </span>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* ── SIGNATURES ─────────────────────────────────────────── */}
          <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid', marginTop: 22 }}>
            <div style={{ display: 'flex', border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden' }}>
              {['Employee', 'HR / Supervisor', 'Authorised Signatory'].map((label, i, a) => (
                <div key={i} style={{ flex: 1, padding: '12px 14px', borderRight: i < a.length - 1 ? `1px solid ${LINE}` : 'none' }}>
                  <div style={{ height: 30 }} />
                  <div style={{ height: 1, background: '#c7d0da', marginBottom: 5 }} />
                  <div style={{ fontSize: '6.8pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: MUTE }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '6.5pt', color: FAINT }}>
              <span>System-generated from the ERB attendance system · {companyName}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{reportId}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
      <span style={{ fontSize: '7.5pt', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: NAVY2, whiteSpace: 'nowrap' }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: LINE }} />
    </div>
  );
}

function Msg({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, color }}>{text}</div>
  );
}
