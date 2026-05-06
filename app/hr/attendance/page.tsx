'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery } from '@tanstack/react-query';
import { hrAttendanceApi } from '@/lib/api/hr';
import { HRAttendance } from '@/types';
import FilterPanel, { FilterField } from '@/components/ui/FilterPanel';
import FilterTags from '@/components/ui/FilterTags';
import { Button, TextField, Badge, Loader } from '@/components/ui';
import { useT } from '@/lib/i18n/useT';

const statusColors: Record<string, string> = {
  present:  'badge-success',
  absent:   'badge-error',
  late:     'badge-warning',
  half_day: 'badge-info',
  holiday:  'badge-default',
  on_leave: 'badge-default',
};

const statusLabels: Record<string, string> = {
  present:  'Present',
  absent:   'Absent',
  late:     'Late',
  half_day: 'Half Day',
  holiday:  'Holiday',
  on_leave: 'On Leave',
};

function formatTime(time: string | null): string {
  if (!time) return '—';
  // time may be HH:MM:SS or full ISO
  const parts = time.split('T');
  const t = parts.length > 1 ? parts[1] : parts[0];
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = `${hour % 12 || 12}:${m} ${ampm}`;
  return display;
}

export default function HRAttendancePage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const t = useT();

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-attendance', page, search, filters],
    queryFn: () => hrAttendanceApi.getAll({ page, search, ...filters }),
  });

  const filterFields: FilterField[] = [
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      group: 'Filters',
      options: [
        { value: 'present',  label: 'Present' },
        { value: 'absent',   label: 'Absent' },
        { value: 'late',     label: 'Late' },
        { value: 'half_day', label: 'Half Day' },
        { value: 'holiday',  label: 'Holiday' },
        { value: 'on_leave', label: 'On Leave' },
      ],
    },
    { name: 'date',         label: 'Date',       type: 'date', group: 'Dates' },
    { name: 'date_after',   label: 'Date From',  type: 'date', group: 'Dates' },
    { name: 'date_before',  label: 'Date To',    type: 'date', group: 'Dates' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t('page', 'hrAttendance')}</h1>
            <p className="text-sm text-muted-foreground mt-1">Track employee attendance records</p>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="card flex items-center gap-4">
          <TextField
            type="text"
            placeholder="Search by employee name or ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 max-w-md"
          />
          <FilterPanel
            fields={filterFields}
            filters={filters}
            onFilterChange={(f) => { setFilters(f); setPage(1); }}
            onReset={() => { setFilters({}); setPage(1); }}
            saveKey="hr-attendance"
          />
        </div>

        {Object.keys(filters).length > 0 && (
          <FilterTags
            filters={filters}
            fields={filterFields}
            onRemoveFilter={(k) => {
              const f = { ...filters };
              delete f[k];
              setFilters(f);
              setPage(1);
            }}
            onClearAll={() => { setFilters({}); setPage(1); }}
          />
        )}

        {/* Content */}
        {isLoading ? (
          <div className="card text-center py-12">
            <Loader className="mx-auto mb-4" />
            <p className="text-muted-foreground">{t('btn', 'loading')}</p>
          </div>
        ) : error ? (
          <div className="card border-destructive bg-destructive/10">
            <p className="text-destructive text-sm">Error loading attendance records.</p>
          </div>
        ) : !data?.results?.length ? (
          <div className="card text-center py-12">
            <p className="text-muted-foreground">{t('empty', 'noAttendance')}</p>
          </div>
        ) : (
          <>
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Date</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Work Hours</th>
                      <th>Overtime</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((record: HRAttendance) => (
                      <tr key={record.id}>
                        <td>
                          <div>
                            <div className="font-medium text-foreground">{record.employee_name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{record.employee_id_code}</div>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm text-foreground">
                            {new Date(record.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm text-foreground">{formatTime(record.check_in)}</span>
                        </td>
                        <td>
                          <span className="text-sm text-foreground">{formatTime(record.check_out)}</span>
                        </td>
                        <td>
                          <span className="text-sm text-foreground">
                            {record.work_hours != null ? `${record.work_hours}h` : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm text-foreground">
                            {record.overtime_hours != null && record.overtime_hours > 0
                              ? `${record.overtime_hours}h`
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <Badge className={statusColors[record.status] || 'badge-default'}>
                            {statusLabels[record.status] || record.status}
                          </Badge>
                        </td>
                        <td>
                          <span className="text-sm text-muted-foreground max-w-xs truncate block" title={record.notes}>
                            {record.notes || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {data.count > 50 && (
              <div className="flex items-center justify-between card">
                <p className="text-sm text-muted-foreground">
                  {t('misc', 'showing')} {((page - 1) * 50) + 1} {t('misc', 'pageTo')} {Math.min(page * 50, data.count)} {t('misc', 'pageOf')} {data.count}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={!data.previous}
                  >
                    {t('btn', 'previous')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setPage(p => p + 1)}
                    disabled={!data.next}
                  >
                    {t('btn', 'next')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
