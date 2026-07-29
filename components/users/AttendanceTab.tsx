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

const STATUS_BAR_COLOR: Record<string, string> = {
  present:  'var(--status-success)',
  absent:   'var(--status-error)',
  late:     'var(--status-warning)',
  on_leave: 'var(--status-info)',
  half_day: 'var(--status-warning)',
};

function fmtTime(t: string | null) {
  if (!t) return '—';
  try {
    const dt = t.includes('T') ? t : `1970-01-01T${t}`;
    return new Date(dt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function fmtDateShort(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function fmtHours(h: number | null) {
  if (h == null || h === 0) return '—';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function getDayName(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
}

export default function AttendanceTab({ emp }: UserTabProps) {
  const empId: number | undefined = emp?.id;
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const { data: summary } = useQuery({
    queryKey: ['emp-attendance-summary', empId],
    queryFn: () => hrEmployeesApi.getAttendanceSummary(empId!),
    enabled: !!empId,
    staleTime: 5 * 60_000,
  });

  const [year, mon] = month.split('-').map(Number);
  const startDate = `${month}-01`;
  const endDate = new Date(year, mon, 0).toISOString().slice(0, 10);

  const { data: records, isLoading } = useQuery({
    queryKey: ['emp-attendance', empId, month],
    // Filter the month server-side (was: page 1 only, no date filter — older
    // months fell outside the first page and showed "No records" despite data).
    queryFn: () => hrAttendanceApi.getAll({ employee: empId!, date_after: startDate, date_before: endDate, page_size: 100 }),
    enabled: !!empId,
    staleTime: 60_000,
    select: (data) => data.results.filter((r: HRAttendance) => r.date >= startDate && r.date <= endDate),
  });

  const summaryMap: Record<string, number> = summary?.summary ?? {};
  const summaryItems = [
    { key: 'present',  label: 'Present',  color: STATUS_BAR_COLOR.present },
    { key: 'absent',   label: 'Absent',   color: STATUS_BAR_COLOR.absent },
    { key: 'late',     label: 'Late',     color: STATUS_BAR_COLOR.late },
    { key: 'on_leave', label: 'On Leave', color: STATUS_BAR_COLOR.on_leave },
    { key: 'half_day', label: 'Half Day', color: STATUS_BAR_COLOR.half_day },
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

  const sortedRecords: HRAttendance[] = records ? [...records].sort((a, b) => b.date.localeCompare(a.date)) : [];
  const totalWorkHours = sortedRecords.reduce((sum, r) => sum + (r.work_hours ?? 0), 0);
  const totalOTHours   = sortedRecords.reduce((sum, r) => sum + (r.overtime_hours ?? 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

      {/* ── 30-day summary ── */}
      {summary && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
              Attendance Summary
            </p>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>Last 30 days</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {summaryItems.map(({ key, label, color }) => (
              <div key={key} style={{
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden',
              }}>
                <div style={{ height: 3, background: color }} />
                <div style={{ padding: '10px var(--space-3)', textAlign: 'center' }}>
                  <p style={{
                    fontSize: 26, fontWeight: 800, color: 'var(--text-primary)',
                    margin: 0, lineHeight: 1, letterSpacing: '-0.03em',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {summaryMap[key] ?? 0}
                  </p>
                  <p style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--text-tertiary)',
                    margin: '4px 0 0',
                  }}>
                    {label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Monthly view (single card) ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

        {/* Header: month nav + totals */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px var(--space-5)',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button
              onClick={prevMonth}
              style={{
                width: 28, height: 28, borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)', background: 'var(--surface-card)',
                cursor: 'pointer', color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, lineHeight: 1,
              }}
            >‹</button>
            <span style={{
              fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)',
              minWidth: 130, textAlign: 'center', color: 'var(--text-primary)',
            }}>
              {new Date(`${month}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={nextMonth}
              disabled={isCurrentMonth}
              style={{
                width: 28, height: 28, borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                background: isCurrentMonth ? 'var(--surface-subtle)' : 'var(--surface-card)',
                cursor: isCurrentMonth ? 'default' : 'pointer',
                color: isCurrentMonth ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, lineHeight: 1, opacity: isCurrentMonth ? 0.45 : 1,
              }}
            >›</button>
          </div>

          {sortedRecords.length > 0 && (
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', margin: 0, fontWeight: 700 }}>Work Hours</p>
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtHours(totalWorkHours)}
                </p>
              </div>
              {totalOTHours > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', margin: 0, fontWeight: 700 }}>Overtime</p>
                  <p style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--status-warning)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtHours(totalOTHours)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Table or empty state */}
        {isLoading ? (
          <div style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', margin: 0 }}>Loading…</p>
          </div>
        ) : sortedRecords.length === 0 ? (
          <div style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 8, opacity: 0.5 }}>
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>No records for this month.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ background: 'var(--surface-subtle)' }}>
                  {['Date', 'Status', 'Check In', 'Check Out', 'Work Hrs', 'Overtime', 'Notes'].map((h) => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '8px 16px',
                      color: 'var(--text-tertiary)', fontSize: 11,
                      fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.06em', whiteSpace: 'nowrap',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((rec, i) => (
                  <tr
                    key={rec.id}
                    style={{
                      borderBottom: i < sortedRecords.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--table-row-hover)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: 6 }}>
                        {fmtDateShort(rec.date)}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {getDayName(rec.date)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge variant={STATUS_VARIANT[rec.status] ?? 'default'} size="sm">
                        {STATUS_LABELS[rec.status] ?? rec.status}
                      </Badge>
                    </td>
                    <td style={{
                      padding: '10px 16px',
                      fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap',
                      color: rec.check_in ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    }}>
                      {fmtTime(rec.check_in)}
                    </td>
                    <td style={{
                      padding: '10px 16px',
                      fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap',
                      color: rec.check_out ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    }}>
                      {fmtTime(rec.check_out)}
                    </td>
                    <td style={{
                      padding: '10px 16px',
                      fontFamily: 'ui-monospace, monospace', fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}>
                      {fmtHours(rec.work_hours)}
                    </td>
                    <td style={{
                      padding: '10px 16px',
                      fontFamily: 'ui-monospace, monospace',
                      fontWeight: rec.overtime_hours && rec.overtime_hours > 0 ? 600 : 400,
                      color: rec.overtime_hours && rec.overtime_hours > 0 ? 'var(--status-warning)' : 'var(--text-tertiary)',
                    }}>
                      {fmtHours(rec.overtime_hours)}
                    </td>
                    <td style={{
                      padding: '10px 16px',
                      color: 'var(--text-secondary)', fontSize: 12,
                      maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {rec.notes || '—'}
                    </td>
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
