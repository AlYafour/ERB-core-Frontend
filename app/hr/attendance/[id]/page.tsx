'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrAttendanceApi } from '@/lib/api/hr';
import { Badge, Loader } from '@/components/ui';
import Link from 'next/link';
import { Button } from '@/components/ui';

const statusColors: Record<string, string> = {
  present: 'badge-success', absent: 'badge-error', late: 'badge-warning',
  half_day: 'badge-info', holiday: 'badge-default', on_leave: 'badge-default',
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
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/hr/attendance"><Button variant="ghost" size="sm">← Back</Button></Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Attendance Record</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {record.employee_name} — {new Date(record.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <Badge className={statusColors[record.status] || 'badge-default'}>{record.status.replace('_', ' ').toUpperCase()}</Badge>
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
      </div>
    </MainLayout>
  );
}
