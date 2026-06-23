'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrAttendanceApi } from '@/lib/api/hr';
import { HRAttendance } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { type FilterField } from '@/components/ui/FilterPanel';
import { Badge, BaseModal, type Column } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/PersonCell';
import { AppListPage } from '@/components/app/AppListPage';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';
import { ATTENDANCE_STATUS } from '@/lib/utils/status-colors';

const STATUS_LABEL: Record<string, string> = {
  present: 'Present', absent: 'Absent', late: 'Late',
  half_day: 'Half Day', holiday: 'Holiday', on_leave: 'On Leave',
};

const filterFields: FilterField[] = [
  { name: 'status',       label: 'Status',     type: 'select', group: 'Filters',
    options: Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l })) },
  { name: 'date',         label: 'Date',        type: 'date', group: 'Dates' },
  { name: 'date_after',   label: 'Date From',   type: 'date', group: 'Dates' },
  { name: 'date_before',  label: 'Date To',     type: 'date', group: 'Dates' },
];

function formatTime(dt: string | null): string {
  if (!dt) return '—';
  try {
    return new Date(dt.includes('T') ? dt : `1970-01-01T${dt}`)
      .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch { return dt; }
}

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function toTimeValue(dt: string | null): string {
  if (!dt) return '';
  const raw = dt.includes('T') ? dt.split('T')[1] : dt;
  return raw.slice(0, 5);
}

function buildDatetime(date: string, time: string): string | null {
  return time ? `${date}T${time}:00` : null;
}

// ── Edit Modal ────────────────────────────────────────────────
function AttendanceEditModal({
  record, onClose, onSave, isLoading,
}: {
  record: HRAttendance;
  onClose: () => void;
  onSave: (patch: Partial<HRAttendance>) => void;
  isLoading: boolean;
}) {
  const [checkIn,  setCheckIn]  = useState(toTimeValue(record.check_in));
  const [checkOut, setCheckOut] = useState(toTimeValue(record.check_out));
  const [status,   setStatus]   = useState(record.status);
  const [notes,    setNotes]    = useState(record.notes ?? '');

  const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)' };
  const labelStyle: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' };

  return (
    <BaseModal isOpen onClose={onClose} title="Edit Attendance Record" size="sm">
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '-4px 0 var(--space-4)' }}>
        {record.employee_name} · {formatDate(record.date)}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Check In</label>
            <input type="time" className="form-input" value={checkIn}
              onChange={e => setCheckIn(e.target.value)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Check Out</label>
            <input type="time" className="form-input" value={checkOut}
              onChange={e => setCheckOut(e.target.value)} />
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Status</label>
          <select className="form-input" value={status} onChange={e => setStatus(e.target.value)}>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Admin Notes</label>
          <textarea
            className="form-input"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            style={{ resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }}
            placeholder="Optional correction note…"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
          <button
            type="button" onClick={onClose} disabled={isLoading}
            style={{ padding: '7px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({
              check_in:  buildDatetime(record.date, checkIn)  as any,
              check_out: buildDatetime(record.date, checkOut) as any,
              status,
              notes,
            })}
            disabled={isLoading}
            style={{ padding: '7px 20px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--brand)', color: '#fff', cursor: isLoading ? 'default' : 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', opacity: isLoading ? 0.7 : 1 }}
          >
            {isLoading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

// ── Today + Export buttons ────────────────────────────────────
function QuickActions({
  isToday, onToday, onExport, hasRecords,
}: {
  isToday: boolean;
  onToday: () => void;
  onExport: () => void;
  hasRecords: boolean;
}) {
  const btnStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
    padding: '6px 14px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-default)', cursor: 'pointer',
    background: 'none', color: 'var(--text-secondary)', transition: 'all 0.12s',
    display: 'inline-flex', alignItems: 'center', gap: 5,
  };
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button style={{ ...btnStyle, ...(isToday ? { borderColor: 'var(--brand)', color: 'var(--brand)', background: 'var(--brand-subtle)' } : {}) }}
        onClick={onToday}>
        {isToday ? '✓ Today' : (
          <>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Today
          </>
        )}
      </button>
      {hasRecords && (
        <button style={btnStyle} onClick={onExport}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function HRAttendancePage() {
  const tableState = useTableState();
  const { page, search, filters, handleFilterChange } = tableState;
  const t = useT();
  const { user } = useAuth();
  const { hasPermission } = useMyPermissions();
  const qc = useQueryClient();

  const admin = hasPermission('hr.hr_attendance.view');

  const [editRecord, setEditRecord] = useState<HRAttendance | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const isToday  = (filters as Record<string, string>).date === todayStr;

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-attendance', page, search, filters],
    queryFn:  () => hrAttendanceApi.getAll({ page, search, ...filters }),
  });

  const records    = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const editMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<HRAttendance> }) =>
      hrAttendanceApi.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-attendance'] });
      setEditRecord(null);
      toast('Attendance record updated', 'success');
    },
    onError: () => toast('Failed to update record', 'error'),
  });

  const exportCSV = () => {
    if (!records.length) return;
    const header = ['Employee', 'ID', 'Date', 'Check In', 'Check Out', 'Work Hours', 'Overtime', 'Status', 'Notes'];
    const rows = records.map(r => [
      r.employee_name, r.employee_id_code, r.date,
      formatTime(r.check_in), formatTime(r.check_out),
      r.work_hours ?? '', r.overtime_hours ?? '',
      STATUS_LABEL[r.status] || r.status, r.notes ?? '',
    ]);
    const csv = [header, ...rows]
      .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${(filters as any).date || todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo((): Column<HRAttendance>[] => [
    {
      key: 'employee', header: 'Employee',
      render: r => <PersonCell name={r.employee_name} secondary={r.employee_id_code} avatarUrl={null} />,
    },
    {
      key: 'date', header: 'Date',
      render: r => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{formatDate(r.date)}</span>,
    },
    {
      key: 'checkin', header: 'Check In',
      render: r => <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>{formatTime(r.check_in)}</span>,
    },
    {
      key: 'checkout', header: 'Check Out',
      render: r => <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>{formatTime(r.check_out)}</span>,
    },
    {
      key: 'work', header: 'Work Hrs',
      render: r => <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>{r.work_hours != null ? `${r.work_hours}h` : '—'}</span>,
    },
    {
      key: 'ot', header: 'Overtime',
      render: r => r.overtime_hours != null && r.overtime_hours > 0
        ? <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--brand)', fontWeight: 'var(--weight-semibold)' }}>{r.overtime_hours}h OT</span>
        : <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>—</span>,
    },
    {
      key: 'status', header: t('col', 'status'),
      render: r => <Badge variant={ATTENDANCE_STATUS[r.status] ?? 'default'}>{STATUS_LABEL[r.status] || r.status}</Badge>,
    },
    {
      key: 'notes', header: 'Notes',
      render: r => (
        <span className="block max-w-[200px] truncate" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }} title={r.notes ?? undefined}>
          {r.notes || '—'}
        </span>
      ),
    },
    ...(admin ? [{
      key: 'actions', header: '' as React.ReactNode,
      render: (r: HRAttendance) => (
        <RowActions actions={[{ label: 'Edit Record', onClick: () => setEditRecord(r) }]} />
      ),
    }] : []),
  ], [t, admin]);

  return (
    <AppListPage
      title={t('page', 'hrAttendance')}
      description="Track and manage employee attendance records."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'HR' }, { label: 'Attendance' }]}
      totalCount={totalCount}
      createAction={
        <QuickActions
          isToday={isToday}
          onToday={() => isToday
            ? handleFilterChange({ ...filters, date: undefined })
            : handleFilterChange({ ...filters, date: todayStr })
          }
          onExport={exportCSV}
          hasRecords={records.length > 0}
        />
      }
      filterFields={filterFields}
      searchPlaceholder="Search by employee name or ID…"
      columns={columns}
      data={records}
      isLoading={isLoading}
      error={error}
      emptyTitle={t('empty', 'noAttendance')}
      tableState={tableState}
      paginatedData={data}
      pageSize={50}
    >
      {editRecord && (
        <AttendanceEditModal
          record={editRecord}
          onClose={() => setEditRecord(null)}
          onSave={patch => editMutation.mutate({ id: editRecord.id, patch })}
          isLoading={editMutation.isPending}
        />
      )}
    </AppListPage>
  );
}
