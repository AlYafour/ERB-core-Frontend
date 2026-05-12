'use client';

import MainLayout from '@/components/layout/MainLayout';
import { useQuery } from '@tanstack/react-query';
import { hrAttendanceApi } from '@/lib/api/hr';
import { HRAttendance } from '@/types';
import FilterPanel, { FilterField } from '@/components/ui/FilterPanel';
import FilterTags from '@/components/ui/FilterTags';
import { Button, TextField, Badge } from '@/components/ui';
import { useT } from '@/lib/i18n/useT';
import DataTable, { Column } from '@/components/ui/DataTable';
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
  const { page, setPage, search, filters, handleSearch, handleFilterChange, handleFilterReset, handleRemoveFilter } = useTableState();
  const t = useT();

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-attendance', page, search, filters],
    queryFn: () => hrAttendanceApi.getAll({ page, search, ...filters }),
  });

  const records    = data?.results ?? [];
  const totalCount = data?.count ?? 0;

  const columns: Column<HRAttendance>[] = [
    {
      key: 'employee', header: 'Employee',
      render: r => (
        <div>
          <div className="font-medium text-foreground">{r.employee_name}</div>
          <div className="text-xs text-muted-foreground font-mono">{r.employee_id_code}</div>
        </div>
      ),
    },
    { key: 'date',     header: 'Date',       render: r => <span className="text-sm text-foreground">{new Date(r.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span> },
    { key: 'checkin',  header: 'Check In',   render: r => <span className="text-sm text-foreground">{formatTime(r.check_in)}</span> },
    { key: 'checkout', header: 'Check Out',  render: r => <span className="text-sm text-foreground">{formatTime(r.check_out)}</span> },
    { key: 'work',     header: 'Work Hours', render: r => <span className="text-sm text-foreground">{r.work_hours != null ? `${r.work_hours}h` : '—'}</span> },
    { key: 'ot',       header: 'Overtime',   render: r => <span className="text-sm text-foreground">{r.overtime_hours != null && r.overtime_hours > 0 ? `${r.overtime_hours}h` : '—'}</span> },
    { key: 'status',   header: t('col', 'status'), render: r => <Badge variant={ATTENDANCE_STATUS[r.status] ?? 'default'}>{STATUS_LABEL[r.status] || r.status}</Badge> },
    { key: 'notes',    header: 'Notes',      render: r => <span className="text-sm text-muted-foreground max-w-xs truncate block" title={r.notes}>{r.notes || '—'}</span> },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t('page', 'hrAttendance')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{totalCount} attendance records</p>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <TextField placeholder="Search by employee name or ID..." value={search} onChange={e => handleSearch(e.target.value)} className="flex-1 max-w-md" />
          <FilterPanel fields={filterFields} filters={filters} onFilterChange={handleFilterChange} onReset={handleFilterReset} saveKey="hr-attendance" />
        </div>

        <FilterTags filters={filters} fields={filterFields} onRemoveFilter={handleRemoveFilter} onClearAll={handleFilterReset} />

        <DataTable
          columns={columns}
          data={records}
          isLoading={isLoading}
          error={error}
          emptyMessage={t('empty', 'noAttendance')}
          page={page}
          totalCount={totalCount}
          pageSize={50}
          hasPrev={!!data?.previous}
          hasNext={!!data?.next}
          onPageChange={setPage}
        />
      </div>
    </MainLayout>
  );
}
