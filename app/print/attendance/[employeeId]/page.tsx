'use client';

/**
 * Attendance Statement — one employee, one period.
 * /print/attendance/<employeeId>?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * A formal, editorial HR document (A4 portrait): letterhead, photo identity
 * card, a hero attendance figure with supporting stats, then the daily table.
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
const INK   = '#1c2431';
const NAVY  = '#22314a';
const NAVY2 = '#42506a';
const MUTE  = '#737d8c';
const FAINT = '#a6adb8';
const LINE  = '#ecedf1';
const PAPER = '#f8f9fb';
const GOLD  = '#a8823c';
const GOOD  = { fg: '#3a7d5c', bg: '#f0f7f2' };
const WARN  = { fg: '#a76f1c', bg: '#faf4e9' };
const CRIT  = { fg: '#b0413e', bg: '#fcf4f3' };
const NEUT  = { fg: '#5a6472', bg: '#f6f7f9' };
const LEAVE = { fg: '#3f5fa6', bg: '#f1f4fb' };

const SANS  = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";

const STATUS_META = {
  GOOD:            { label: 'On Track',        ...GOOD },
  NEEDS_ATTENTION: { label: 'Needs Review',    ...WARN },
  CRITICAL:        { label: 'Action Required', ...CRIT },
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

/** From/To picker in the control bar (hidden on print). */
function PeriodPicker({ employeeId, from, to }: { employeeId: string; from?: string; to?: string }) {
  const router = useRouter();
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now = new Date();
  const [f, setF] = useState(from || ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [t, setT] = useState(to || ymd(now));
  const go = (nf: string, nt: string) => { if (nf && nt) router.replace(`/print/attendance/${employeeId}?from=${nf}&to=${nt}`); };
  const inp: React.CSSProperties = { padding: '3px 7px', borderRadius: 6, border: `1px solid ${LINE}`, background: '#f8fafc', color: '#475569', fontSize: 11, fontWeight: 600, colorScheme: 'light' };
  const lbl: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', letterSpacing: '.04em' };
  return (
    <>
      <label style={lbl}>From<input type="date" style={inp} value={f} max={t || undefined} onChange={e => { setF(e.target.value); go(e.target.value, t); }} /></label>
      <label style={lbl}>To<input type="date" style={inp} value={t} min={f || undefined} onChange={e => { setT(e.target.value); go(f, e.target.value); }} /></label>
    </>
  );
}

/** Employee photo with a clean initials fallback. */
function EmployeePhoto({ src, name }: { src: string | null; name: string }) {
  const [err, setErr] = useState(false);
  const url = normalizeImageUrl(src);
  const box: React.CSSProperties = { width: 68, height: 82, borderRadius: 6, flexShrink: 0, border: `1px solid ${LINE}`, overflow: 'hidden', background: PAPER };
  if (url && !err) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} onError={() => setErr(true)} style={{ ...box, objectFit: 'cover', display: 'block' }} />;
  }
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return <div style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4ecdb', color: GOLD, fontFamily: SERIF, fontWeight: 700, fontSize: '19pt' }}>{initials || '—'}</div>;
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
  const rateColor = rate == null ? NAVY : rate >= 90 ? GOOD.fg : rate >= 70 ? WARN.fg : CRIT.fg;

  const dayState = (r: AttendanceTimesheet['days'][number]) => {
    if (r.kind === 'off')      return { key: 'off', label: 'Weekend / Off',       ...NEUT };
    if (r.kind === 'upcoming') return { key: 'up',  label: 'Upcoming',            ...NEUT };
    if (r.kind === 'leave')    return { key: 'lv',  label: 'On Leave',            ...LEAVE };
    if (r.kind === 'absent')   return { key: 'ab',  label: 'Absent',             ...CRIT };
    if (r.check_in && r.check_out)   return { key: 'ok', label: 'Complete',             ...GOOD };
    if (r.check_in && !r.check_out)  return { key: 'no', label: 'Missing check-out', ...WARN };
    if (!r.check_in && r.check_out)  return { key: 'ni', label: 'Missing check-in',  ...WARN };
    return { key: 'rv', label: 'Review required', ...WARN };
  };

  const stats = [
    { label: 'Present',  value: String(T.present_days),    sub: 'days' },
    { label: 'Absent',   value: String(T.absent_days),     sub: 'days',  color: T.absent_days ? CRIT.fg : INK },
    { label: 'On Leave', value: String(T.leave_days ?? 0), sub: 'days',  color: (T.leave_days ?? 0) ? LEAVE.fg : INK },
    { label: 'Worked',   value: formatHoursMinutes(T.work_hours, { keepZero: true }), sub: `of ${formatHoursMinutes(T.expected_hours, { keepZero: true })}` },
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
    <div className="print-page-bg" style={{ minHeight: '100vh', background: '#e7eaee', fontFamily: SANS, padding: '0 0 28px' }}>
      <PrintControlsBar backHref="/hr/attendance" docType="ATTENDANCE" docTypeColor={GOLD}
        docNumber={emp.employee_id} status={st.label}>
        <PeriodPicker employeeId={String(employeeId)} from={from} to={to} />
      </PrintControlsBar>

      <div className="print-doc" style={{ width: '210mm', margin: '14px auto', background: '#fff', boxShadow: '0 6px 34px rgba(20,30,50,.15)', color: INK }}>
        <div style={{ padding: '15mm 14mm' }}>

          {/* ── LETTERHEAD ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Image src={brand?.logo_url || '/xerb-logo.svg'} alt="" width={44} height={44} style={{ objectFit: 'contain' }} priority unoptimized />
              <div>
                <div style={{ fontFamily: SERIF, fontSize: '13.5pt', fontWeight: 700, color: NAVY, lineHeight: 1.15 }}>{companyName}</div>
                {brand?.company_address && <div style={{ fontSize: '6.8pt', color: FAINT, marginTop: 3, maxWidth: 320, lineHeight: 1.45 }}>{brand.company_address}</div>}
                {brand?.company_trn && <div style={{ fontSize: '6.8pt', color: FAINT, marginTop: 1 }}>TRN {brand.company_trn}</div>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '8pt', fontWeight: 700, letterSpacing: '3.5px', color: GOLD, textTransform: 'uppercase' }}>Attendance Statement</div>
              <div style={{ fontSize: '7.4pt', color: MUTE, marginTop: 5 }}>{periodLabel}</div>
              <div style={{ fontSize: '6.8pt', color: FAINT, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{reportId}</div>
            </div>
          </div>
          <div style={{ marginTop: 11, height: 1, background: LINE, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: -1, width: 58, height: 3, background: GOLD }} />
          </div>

          {/* ── IDENTITY ───────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 15, marginTop: 15, alignItems: 'center' }}>
            <EmployeePhoto src={emp.photo} name={emp.name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontFamily: SERIF, fontSize: '15pt', fontWeight: 700, color: NAVY, lineHeight: 1.1 }}>{emp.name}</div>
                  {emp.name_ar && <div style={{ fontSize: '10pt', color: NAVY2, marginTop: 2, direction: 'rtl' }}>{emp.name_ar}</div>}
                </div>
                <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 11px', borderRadius: 99, background: st.bg, color: st.fg, fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.fg }} />{st.label}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '9px 16px', marginTop: 12 }}>
                {facts.map(([label, val], i) => (
                  <div key={i}>
                    <div style={{ fontSize: '6.2pt', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: FAINT }}>{label}</div>
                    <div style={{ fontSize: '8.6pt', fontWeight: 600, color: val ? INK : FAINT, marginTop: 2 }}>{val || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── HERO + STATS ───────────────────────────────────────── */}
          <div style={{ display: 'flex', marginTop: 16, border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '15px 20px', borderRight: `1px solid ${LINE}`, background: PAPER, minWidth: 168 }}>
              <div style={{ fontFamily: SERIF, fontSize: '33pt', fontWeight: 700, lineHeight: 1, color: rateColor, letterSpacing: '-1px' }}>
                {rate != null ? `${rate}%` : '—'}
              </div>
              <div style={{ fontSize: '6.6pt', fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: MUTE, marginTop: 7 }}>Attendance Rate</div>
              <div style={{ fontSize: '7.4pt', color: FAINT, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{T.present_days} of {T.expected_working_days} scheduled days</div>
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {stats.map((s, i) => (
                <div key={i} style={{ padding: '15px 14px', borderLeft: i ? `1px solid ${LINE}` : 'none' }}>
                  <div style={{ fontSize: '6.2pt', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: MUTE }}>{s.label}</div>
                  <div style={{ fontFamily: SERIF, fontSize: '16pt', fontWeight: 700, lineHeight: 1.05, color: s.color ?? INK, marginTop: 5 }}>{s.value}</div>
                  {s.sub && <div style={{ fontSize: '6.2pt', color: FAINT, marginTop: 3 }}>{s.sub}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* ── ATTENTION (one slim line) ──────────────────────────── */}
          {data.attention.length > 0 && (
            <div style={{ marginTop: 13, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', fontSize: '7.8pt', color: NAVY2, lineHeight: 1.6 }}>
              <span style={{ fontSize: '6.4pt', fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: WARN.fg }}>Attention</span>
              {data.attention.map((m, i) => (
                <span key={i}>{i > 0 && <span style={{ color: FAINT, margin: '0 4px' }}>·</span>}{m}</span>
              ))}
            </div>
          )}

          {/* ── DAILY TABLE ────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 20, marginBottom: 4 }}>
            <span style={{ fontFamily: SERIF, fontSize: '11pt', fontWeight: 700, color: NAVY, whiteSpace: 'nowrap' }}>Daily Attendance</span>
            <span style={{ flex: 1, height: 1, background: LINE }} />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.6pt', tableLayout: 'fixed', fontVariantNumeric: 'tabular-nums' }}>
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
                    <th key={i} style={{ padding: '0 11px 9px', textAlign: a, fontSize: '6.6pt', fontWeight: 700, letterSpacing: '.9px', textTransform: 'uppercase', color: MUTE, whiteSpace: 'nowrap', borderBottom: `1px solid ${NAVY}` }}>{h}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {data.days.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 18, textAlign: 'center', color: FAINT }}>No days in this period.</td></tr>
              ) : data.days.map((r, idx) => {
                const s = dayState(r);
                const off = s.key === 'off';
                const tint = s.key === 'ab' ? CRIT.bg : s.key === 'lv' ? LEAVE.bg : off ? PAPER : '#fff';
                const cell: React.CSSProperties = { padding: '7.5px 11px', borderBottom: `1px solid ${LINE}` };
                const time = (v: string | null) => <span style={{ color: v ? (off ? MUTE : INK) : '#d6dae0' }}>{fmtTime(v)}</span>;
                const brk = r.break_start || r.break_end ? `${fmtTime(r.break_start)} – ${fmtTime(r.break_end)}` : '—';
                return (
                  <tr key={r.date ?? idx} style={{ background: tint }}>
                    <td style={{ ...cell, fontWeight: 600, color: off ? MUTE : NAVY, whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                    <td style={{ ...cell, textAlign: 'center', color: FAINT }}>{fmtDow(r.date)}</td>
                    <td style={{ ...cell, textAlign: 'center' }}>{time(r.check_in)}</td>
                    <td style={{ ...cell, textAlign: 'center', color: r.break_start || r.break_end ? MUTE : '#d6dae0' }}>{brk}</td>
                    <td style={{ ...cell, textAlign: 'center' }}>{time(r.check_out)}</td>
                    <td style={{ ...cell, textAlign: 'right', fontWeight: 700, color: r.work_hours != null ? INK : '#d6dae0' }}>{formatHoursMinutes(r.work_hours)}</td>
                    <td style={cell}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '7.8pt', fontWeight: 600, color: s.fg, whiteSpace: 'nowrap' }}>
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
                <td colSpan={5} style={{ padding: '10px 11px', fontSize: '7.6pt', fontWeight: 700, color: NAVY, letterSpacing: '.3px', borderTop: `1px solid ${NAVY}` }}>TOTAL · {T.present_days} present of {T.expected_working_days} scheduled</td>
                <td style={{ padding: '10px 11px', textAlign: 'right', fontFamily: SERIF, fontSize: '10pt', fontWeight: 700, color: NAVY, borderTop: `1px solid ${NAVY}` }}>{formatHoursMinutes(T.work_hours, { keepZero: true })}</td>
                <td style={{ borderTop: `1px solid ${NAVY}` }} />
              </tr>
            </tfoot>
          </table>
          <div style={{ fontSize: '6.8pt', color: NAVY2, marginTop: 9, display: 'flex', gap: 15, flexWrap: 'wrap' }}>
            {([['Complete', GOOD.fg], ['Missing punch', WARN.fg], ['Absent', CRIT.fg], ['On Leave', LEAVE.fg], ['Off', NEUT.fg]] as const).map(([l, c], i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />{l}
              </span>
            ))}
          </div>

          {/* ── SIGNATURES ─────────────────────────────────────────── */}
          <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid', marginTop: 30, display: 'flex', gap: 26 }}>
            {['Employee', 'HR / Supervisor', 'Authorised Signatory'].map((label) => (
              <div key={label} style={{ flex: 1 }}>
                <div style={{ height: 34 }} />
                <div style={{ height: 1, background: '#c7cdd6' }} />
                <div style={{ fontSize: '6.8pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: MUTE, marginTop: 6 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 9, borderTop: `1px solid ${LINE}`, fontSize: '6.5pt', color: FAINT }}>
            <span>System-generated from the ERB attendance system · {companyName}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{reportId}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Msg({ text, color }: { text: string; color: string }) {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, color }}>{text}</div>;
}
