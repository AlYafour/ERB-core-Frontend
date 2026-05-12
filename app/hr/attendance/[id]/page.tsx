'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrAttendanceApi } from '@/lib/api/hr';
import { Badge, Loader, PageHeader, PageShell } from '@/components/ui';

const STATUS_VARIANT: Record<string, string> = {
  present: 'success', absent: 'error', late: 'warning',
  half_day: 'info', holiday: 'default', on_leave: 'default',
};

const fmtTime = (dt: string | null) =>
  dt ? new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';

export default function AttendanceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: record, isLoading, error } = useQuery({
    queryKey: ['hr-attendance', id],
    queryFn: () => hrAttendanceApi.getById(Number(id)),
  });

  if (isLoading) return <MainLayout><div className="card text-center py-16"><Loader className="mx-auto mb-4" /></div></MainLayout>;
  if (error || !record) return <MainLayout><div className="card text-center py-16"><p className="text-destructive">Record not found.</p></div></MainLayout>;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Attendance Record"
          description={`${record.employee_name} — ${new Date(record.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
          breadcrumbs={[{ label: 'HR' }, { label: 'Attendance', href: '/hr/attendance' }, { label: record.employee_name }]}
          actions={<Badge variant={(STATUS_VARIANT[record.status] as any) || 'default'}>{record.status.replace('_', ' ').toUpperCase()}</Badge>}
        />

        <div className="card space-y-5" style={{ maxWidth: '42rem' }}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-muted-foreground">{record.employee_id_code}</span>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--muted)' }}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Check In</p>
              <p className="text-2xl font-bold text-foreground">{fmtTime(record.check_in)}</p>
              {record.check_in_address && <p className="text-xs text-muted-foreground mt-1">{record.check_in_address}</p>}
            </div>
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--muted)' }}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Check Out</p>
              <p className="text-2xl font-bold text-foreground">{fmtTime(record.check_out)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-foreground">{record.work_hours?.toFixed(1) ?? '—'}</p>
              <p className="text-xs text-muted-foreground mt-1">Work Hours</p>
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{record.overtime_hours?.toFixed(1) ?? '—'}</p>
              <p className="text-xs text-muted-foreground mt-1">Overtime Hours</p>
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{record.duration_hours?.toFixed(1) ?? '—'}</p>
              <p className="text-xs text-muted-foreground mt-1">Duration</p>
            </div>
          </div>

          {(record.break_start || record.break_end) && (
            <div className="text-sm border-t pt-3 flex gap-6" style={{ borderColor: 'var(--border)' }}>
              <div><p className="text-muted-foreground">Break Start</p><p className="font-medium">{fmtTime(record.break_start)}</p></div>
              <div><p className="text-muted-foreground">Break End</p><p className="font-medium">{fmtTime(record.break_end)}</p></div>
            </div>
          )}

          {record.notes && (
            <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-foreground">{record.notes}</p>
            </div>
          )}
        </div>
      </PageShell>
    </MainLayout>
  );
}
