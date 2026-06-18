'use client';

import { useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery } from '@tanstack/react-query';
import { hrAttendanceApi } from '@/lib/api/hr';
import { HRAttendance } from '@/types';
import { type FilterField } from '@/components/ui/FilterPanel';
import { Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';
import { ATTENDANCE_STATUS } from '@/lib/utils/status-colors';

const STATUS_LABEL: Record<string, string> = {
  present: 'Present', absent: 'Absent', late: 'Late',
  half_day: 'Half Day', holiday: 'Holiday', on_leave: 'On Leave',
};

const filterFields: FilterField[] = [
  { name: 'status', label: 'Status', type: 'select', group: 'Filters',
    options: Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l })) },
  { name: 'date',         label: 'Date',       type: 'date', group: 'Dates' },
  { name: 'date_after',   label: 'Date From',  type: 'date', group: 'Dates' },
  { name: 'date_before',  label: 'Date To',    type: 'date', group: 'Dates' },
];

function formatTime(time: string | null): string {
  if (!time) return '—';
  const parts = time.split('T');
  const t = parts.length > 1 ? parts[1] : parts[0];
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export default function HRAttendancePage() {
  const tableState = useTableState();
  const { page, search, filters } = tableState;
  const t = useT();

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-attendance', page, search, filters],
    queryFn:  () => hrAttendanceApi.getAll({ page, search, ...filters }),
  });

  const records    = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const columns = useMemo((): Column<HRAttendance>[] => [
    {
      key: 'employee', header: 'Employee',
      render: r => (
        <div>
          <div className="font-medium">{r.employee_name}</div>
          <div className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{r.employee_id_code}</div>
        </div>
      ),
    },
    { key: 'date',     header: 'Date',       render: r => <span>{new Date(r.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span> },
    { key: 'checkin',  header: 'Check In',   render: r => <span>{formatTime(r.check_in)}</span> },
    { key: 'checkout', header: 'Check Out',  render: r => <span>{formatTime(r.check_out)}</span> },
    { key: 'work',     header: 'Work Hours', render: r => <span>{r.work_hours != null ? `${r.work_hours}h` : '—'}</span> },
    { key: 'ot',       header: 'Overtime',   render: r => <span>{r.overtime_hours != null && r.overtime_hours > 0 ? `${r.overtime_hours}h` : '—'}</span> },
    { key: 'status',   header: t('col', 'status'), render: r => <Badge variant={ATTENDANCE_STATUS[r.status] ?? 'default'}>{STATUS_LABEL[r.status] || r.status}</Badge> },
    {
      key: 'notes', header: 'Notes',
      render: r => (
        <span className="block max-w-[240px] truncate" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }} title={r.notes}>
          {r.notes || '—'}
        </span>
      ),
    },
  ], [t]);

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={t('page', 'hrAttendance')}
          count={totalCount}
          breadcrumbs={[{ label: 'HR' }, { label: 'Attendance' }]}
        />
        <TableShell
          tableState={tableState}
          filterFields={filterFields}
          filterSaveKey="hr-attendance"
          searchPlaceholder="Search by employee name or ID..."
          columns={columns}
          data={records}
          isLoading={isLoading}
          error={error}
          emptyMessage={t('empty', 'noAttendance')}
          totalCount={totalCount}
          pageSize={50}
          paginatedData={data}
        />
      </PageShell>
    </MainLayout>
  );
}
