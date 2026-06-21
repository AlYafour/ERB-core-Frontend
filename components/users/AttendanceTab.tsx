'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { hrAttendanceApi, hrEmployeesApi } from '@/lib/api/hr';
import { Badge } from '@/components/ui';
import type { UserTabProps } from './types';
import type { HRAttendance } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  present:  'Present',
  absent:   'Absent',
  late:     'Late',
  half_day: 'Half Day',
  holiday:  'Holiday',
  on_leave: 'On Leave',
};

const STATUS_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  present:  'success',
  absent:   'error',
  late:     'warning',
  half_day: 'warning',
  holiday:  'info',
  on_leave: 'info',
};

function fmtTime(t: string | null) {
  if (!t) return '—';
  return new Date(`1970-01-01T${t}`).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtHours(h: number | null) {
  if (h == null) return '—';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}

export default function AttendanceTab({ emp }: UserTabProps) {
  const empId: number | undefined = emp?.id;
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM

  const { data: summary } = useQuery({
    queryKey: ['emp-attendance-summary', empId],
    queryFn: () => hrEmployeesApi.getAttendanceSummary(empId!),
    enabled: !!empId,
    staleTime: 5 * 60_000,
  });

  const [year, mon] = month.split('-').map(Number);
  const startDate = `${month}-01`;
  const endDate = new Date(year, mon, 0).toISOString().slice(0, 10); // last day of month

  const { data: records, isLoading } = useQuery({
    queryKey: ['emp-attendance', empId, month],
    queryFn: () => hrAttendanceApi.getAll({ employee: empId!, page: 1 }),
    enabled: !!empId,
    staleTime: 60_000,
    select: (data) => data.results.filter((r: HRAttendance) => r.date >= startDate && r.date <= endDate),
  });

  const summaryMap: Record<string, number> = summary?.summary ?? {};
  const summaryItems = [
    { key: 'present',  label: 'Present',  color: 'var(--status-success)' },
    { key: 'absent',   label: 'Absent',   color: 'var(--status-error)' },
    { key: 'late',     label: 'Late',     color: 'var(--status-warning)' },
    { key: 'on_leave', label: 'On Leave', color: 'var(--status-info)' },
    { key: 'half_day', label: 'Half Day', color: 'var(--status-warning)' },
  ];

  const prevMonth = () => {
    const d = new Date(`${month}-01`);
    d.setMonth(d.getMonth() - 1);
    setMonth(d.toISOString().slice(0, 7));
  };
  const nextMonth = () => {
    const d = new Date(`${month}-01`);
    d.setMonth(d.getMonth() + 1);
    setMonth(d.toISOString().slice(0, 7));
  };
  const isCurrentMonth = month === new Date().toISOString().slice(0, 7);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

      {/* 30-day summary */}
      {summary && (
        <div className="card">
          <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)' }}>
            Last 30 Days
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            {summaryItems.map(({ key, label, color }) => (
              <div key={key} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface-subtle)',
                minWidth: 80,
              }}>
                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color }}>
                  {summaryMap[key] ?? 0}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Month navigation + table */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}>‹</button>
          <span style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-base)', minWidth: 120, textAlign: 'center' }}>
            {new Date(`${month}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth} style={{ background: 'none', border: 'none', cursor: isCurrentMonth ? 'default' : 'pointer', color: isCurrentMonth ? 'var(--text-tertiary)' : 'var(--text-secondary)', padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}>›</button>
        </div>

        {isLoading ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', margin: 0 }}>Loading…</p>
        ) : !records || records.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', margin: 0 }}>No records for this month.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Date', 'Status', 'Check In', 'Check Out', 'Work Hours', 'Overtime', 'Notes'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-secondary)', fontWeight: 'var(--weight-medium)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...records].sort((a, b) => b.date.localeCompare(a.date)).map((rec: HRAttendance) => (
                  <tr key={rec.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{fmtDate(rec.date)}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <Badge variant={STATUS_VARIANT[rec.status] ?? 'default'} size="sm">
                        {STATUS_LABELS[rec.status] ?? rec.status}
                      </Badge>
                    </td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: rec.check_in ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{fmtTime(rec.check_in)}</td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: rec.check_out ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{fmtTime(rec.check_out)}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{fmtHours(rec.work_hours)}</td>
                    <td style={{ padding: '8px 10px', color: rec.overtime_hours ? 'var(--status-warning)' : 'var(--text-tertiary)' }}>{fmtHours(rec.overtime_hours)}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
