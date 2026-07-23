'use client';

/**
 * Printable legal attendance timesheet for ONE employee over a period.
 * /print/attendance/<employeeId>?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Renders on the company letterhead (PrintTemplate) with the employee's
 * identity block, every day's punches (in / break out / break in / out),
 * totals and a signature row — export to PDF via the browser print button.
 */

import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { hrAttendanceApi, type AttendanceTimesheet } from '@/lib/api/hr';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { usePermissions } from '@/lib/hooks/use-permissions';
import PrintTemplate, {
  SectionTitle, InfoGrid, PrintTable, SignatureRow, fmtDate,
} from '@/components/print/PrintTemplate';
import { PrintControlsBar } from '@/components/print/PrintControlsBar';

const NAVY = '#1a1a2e';
const GREY = '#64748b';
const BORDER = '#e2e8f0';

const STATUS_LABEL: Record<string, string> = {
  present: 'Present', absent: 'Absent', late: 'Late',
  half_day: 'Half day', holiday: 'Holiday', on_leave: 'On leave',
};
const STATUS_COLOR: Record<string, string> = {
  present: '#15803d', absent: '#b91c1c', late: '#b45309',
  half_day: '#a16207', holiday: '#6b7280', on_leave: '#6b7280',
};

function fmtTime(dt: string | null): string {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d.getTime())) {
    // plain HH:MM[:SS] time string
    const m = String(dt).match(/^(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : String(dt);
  }
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function fmtDow(d: string): string {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-GB', { weekday: 'short' });
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
    enabled: hasToken && canView,
    retry: 1,
  });

  if (!hasToken || isLoading || permsLoading) return <Msg text="Loading…" color="#888" />;
  if (!canView) return <Msg text="You don't have permission to view this document." color="#374151" />;
  if (isError || !data) return <Msg text="Timesheet not found. Please make sure you are logged in." color="#ef4444" />;

  const emp = data.employee;
  const periodLabel = `${fmtDate(data.period.from)} — ${fmtDate(data.period.to)}`;

  // Per-row completeness + summary for the KPI strip.
  const rowState = (r: typeof data.rows[number]) => {
    const hasIn = !!r.check_in, hasOut = !!r.check_out;
    if (hasIn && hasOut) return { key: 'complete', label: 'Complete', color: '#15803d', bg: '#f0fdf4' };
    if (hasIn && !hasOut) return { key: 'no_out', label: 'No check-out', color: '#b45309', bg: '#fffbeb' };
    if (!hasIn && hasOut) return { key: 'no_in', label: 'No check-in', color: '#b45309', bg: '#fffbeb' };
    return { key: 'none', label: '—', color: GREY, bg: '#fff' };
  };
  const complete = data.rows.filter(r => rowState(r).key === 'complete').length;
  const incomplete = data.rows.filter(r => ['no_in', 'no_out'].includes(rowState(r).key)).length;
  const KPI = [
    { label: 'Present Days', value: `${data.totals.present_days}`, sub: `of ${data.period.days} days`, color: NAVY },
    { label: 'Total Work Hours', value: data.totals.work_hours.toFixed(2), sub: 'hours', color: '#15803d' },
    { label: 'Overtime', value: data.totals.overtime_hours.toFixed(2), sub: 'hours', color: '#b45309' },
    { label: 'Complete / Incomplete', value: `${complete} / ${incomplete}`, sub: 'punch days', color: incomplete ? '#b45309' : '#15803d' },
  ];

  return (
    <div className="print-page-bg" style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Inter','Cairo','Segoe UI',sans-serif", fontSize: '12px' }}>
      <PrintControlsBar
        backHref={`/hr/attendance`}
        docType="TIMESHEET" docTypeColor="#C9943A"
        docNumber={emp.employee_id} status="official"
      />

      <div className="print-doc" style={{
        width: '210mm', minHeight: '297mm', margin: '12px auto', background: '#fff',
        borderRadius: 4, boxShadow: '0 4px 32px rgba(0,0,0,.15)',
        display: 'flex', flexDirection: 'column',
      }}>
        <PrintTemplate
          docType="ATTENDANCE TIMESHEET"
          docNumber={emp.employee_id}
          date={data.period.to}
          status="official"
        >
          {/* Employee + period */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <SectionTitle>Employee</SectionTitle>
              <InfoGrid rows={[
                ['Name', emp.name],
                ['Employee ID', emp.employee_id],
                ['Job Title', emp.job_title ?? '—'],
                ['Department', emp.department ?? '—'],
                ['Nationality', emp.nationality ?? '—'],
              ]} />
            </div>
            <div>
              <SectionTitle>Period</SectionTitle>
              <InfoGrid rows={[
                ['Period', periodLabel],
                ['Employment', (emp.employment_type ?? '—').replace('_', ' ')],
                ['Join Date', emp.join_date ? fmtDate(emp.join_date) : '—'],
                ['Labour Card', emp.labor_card ?? '—'],
              ]} />
            </div>
          </div>

          {/* KPI summary strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 14 }}>
            {KPI.map((k, i) => (
              <div key={i} style={{
                border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 12px',
                background: '#fafafa', borderTop: `2.5px solid ${k.color}`,
              }}>
                <div style={{ fontSize: '6.5pt', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: GREY }}>{k.label}</div>
                <div style={{ fontSize: '15pt', fontWeight: 800, color: k.color, lineHeight: 1.15, marginTop: 2, fontFamily: 'monospace' }}>{k.value}</div>
                <div style={{ fontSize: '6.5pt', color: '#94a3b8' }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Daily log */}
          <SectionTitle>Daily Attendance</SectionTitle>
          <PrintTable headers={[
            { label: 'Date', width: 74 },
            { label: 'Day', align: 'center', width: 38 },
            { label: 'Check In', align: 'center', width: 58 },
            { label: 'Break Out', align: 'center', width: 60 },
            { label: 'Break In', align: 'center', width: 58 },
            { label: 'Check Out', align: 'center', width: 60 },
            { label: 'Work Hrs', align: 'right', width: 52 },
            { label: 'OT', align: 'right', width: 38 },
            { label: 'Record', align: 'center', width: 78 },
          ]}
            footer={
              <tr style={{ background: NAVY, color: '#fff', fontWeight: 800 }}>
                <td colSpan={6} style={{ padding: '8px 10px', fontSize: '8.5pt' }}>
                  TOTAL — {data.totals.present_days} present day(s)
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{data.totals.work_hours.toFixed(2)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{data.totals.overtime_hours.toFixed(2)}</td>
                <td />
              </tr>
            }
          >
            {data.rows.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>No records in this period.</td></tr>
            ) : data.rows.map((r, idx) => {
              const st = rowState(r);
              return (
              <tr key={r.id ?? idx} style={{ borderBottom: '1px solid #f1f5f9', background: st.key === 'complete' ? (idx % 2 === 0 ? '#fff' : '#fafafa') : st.bg }}>
                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', fontWeight: 600, color: NAVY }}>{fmtDate(r.date)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', color: GREY }}>{fmtDow(r.date)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', color: r.check_in ? NAVY : '#cbd5e1' }}>{fmtTime(r.check_in)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', color: r.break_start ? '#b45309' : '#cbd5e1' }}>{fmtTime(r.break_start)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', color: r.break_end ? '#b45309' : '#cbd5e1' }}>{fmtTime(r.break_end)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', color: r.check_out ? NAVY : '#cbd5e1' }}>{fmtTime(r.check_out)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{r.work_hours != null ? Number(r.work_hours).toFixed(2) : '—'}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: Number(r.overtime_hours) > 0 ? '#b45309' : '#cbd5e1' }}>{Number(r.overtime_hours) > 0 ? Number(r.overtime_hours).toFixed(2) : '—'}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                  <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: '6.5pt', fontWeight: 700, letterSpacing: '.3px', textTransform: 'uppercase', color: st.color, border: `1px solid ${st.color}`, background: '#fff' }}>
                    {st.label}
                  </span>
                </td>
              </tr>
            );})}
          </PrintTable>
          <p style={{ fontSize: '7pt', color: '#94a3b8', margin: '6px 0 0' }}>
            &ldquo;No check-in / No check-out&rdquo; marks a day where a punch is missing on the device or app — the recorded punches are shown as captured.
          </p>

          <div style={{ flex: 1 }} />

          <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid', marginTop: 14 }}>
            <SectionTitle>Certification</SectionTitle>
            <p style={{ fontSize: '8pt', color: GREY, margin: '0 0 10px', lineHeight: 1.6 }}>
              This is a system-generated attendance record for the period {periodLabel}. It reflects
              the punches captured in the ERB attendance system for the above employee.
            </p>
            <SignatureRow signatories={[
              { label: 'Employee' },
              { label: 'HR / Supervisor' },
              { label: 'Authorised Signatory' },
            ]} />
          </div>
        </PrintTemplate>
      </div>
    </div>
  );
}

function Msg({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,sans-serif', color }}>
      {text}
    </div>
  );
}
