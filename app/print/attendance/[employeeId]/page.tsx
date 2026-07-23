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
                ['Employment', emp.employment_type ?? '—'],
                ['Join Date', emp.join_date ? fmtDate(emp.join_date) : '—'],
                ['Labour Card', emp.labor_card ?? '—'],
                ['Present Days', `${data.totals.present_days} of ${data.period.days}`],
              ]} />
            </div>
          </div>

          {/* Daily log */}
          <SectionTitle>Daily Attendance</SectionTitle>
          <PrintTable headers={[
            { label: 'Date', width: 78 },
            { label: 'Day', align: 'center', width: 40 },
            { label: 'Check In', align: 'center', width: 60 },
            { label: 'Break Out', align: 'center', width: 62 },
            { label: 'Break In', align: 'center', width: 60 },
            { label: 'Check Out', align: 'center', width: 62 },
            { label: 'Work Hrs', align: 'right', width: 55 },
            { label: 'OT', align: 'right', width: 42 },
            { label: 'Status', align: 'center', width: 62 },
            { label: 'Notes' },
          ]}
            footer={
              <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: 700 }}>
                <td colSpan={6} style={{ padding: '7px 10px', fontSize: '8.5pt', color: GREY }}>
                  TOTALS — {data.totals.present_days} present day(s)
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>{data.totals.work_hours.toFixed(2)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#b45309' }}>{data.totals.overtime_hours.toFixed(2)}</td>
                <td colSpan={2} />
              </tr>
            }
          >
            {data.rows.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>No records in this period.</td></tr>
            ) : data.rows.map((r, idx) => (
              <tr key={r.id ?? idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', color: GREY }}>{fmtDow(r.date)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace' }}>{fmtTime(r.check_in)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', color: '#b45309' }}>{fmtTime(r.break_start)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', color: '#b45309' }}>{fmtTime(r.break_end)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace' }}>{fmtTime(r.check_out)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{r.work_hours != null ? Number(r.work_hours).toFixed(2) : '—'}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: Number(r.overtime_hours) > 0 ? '#b45309' : '#94a3b8' }}>{r.overtime_hours != null ? Number(r.overtime_hours).toFixed(2) : '—'}</td>
                <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                  <span style={{ fontSize: '7.5pt', fontWeight: 700, color: STATUS_COLOR[r.status] ?? GREY }}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </td>
                <td style={{ padding: '6px 10px', fontSize: '8pt', color: '#555' }}>{r.notes || '—'}</td>
              </tr>
            ))}
          </PrintTable>

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
