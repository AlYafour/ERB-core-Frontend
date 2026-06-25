'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrAttendanceApi } from '@/lib/api/hr';
import { Badge, BadgeProps, Loader, PageHeader, PageShell } from '@/components/ui';

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

  if (isLoading) return <MainLayout><div className="card empty-state"><Loader /></div></MainLayout>;
  if (error || !record) return <MainLayout><div className="card empty-state"><p style={{ color: 'var(--color-error)', margin: 0 }}>Record not found.</p></div></MainLayout>;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Attendance Record"
          description={`${record.employee_name} — ${new Date(record.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
          breadcrumbs={[{ label: 'HR' }, { label: 'Attendance', href: '/hr/attendance' }, { label: record.employee_name }]}
          actions={<Badge variant={(STATUS_VARIANT[record.status] as BadgeProps['variant']) || 'default'}>{record.status.replace('_', ' ').toUpperCase()}</Badge>}
        />

        <div className="card" style={{ maxWidth: '42rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{record.employee_id_code}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
            <div style={{ textAlign: 'center', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-subtle)' }}>
              <p style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)', margin: '0 0 var(--space-2) 0' }}>Check In</p>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>{fmtTime(record.check_in)}</p>
              {record.check_in_address && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)', marginBottom: 0 }}>{record.check_in_address}</p>}
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-subtle)' }}>
              <p style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: '0 0 var(--space-2) 0' }}>Check Out</p>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>{fmtTime(record.check_out)}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', textAlign: 'center' }}>
            <div>
              <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>{record.work_hours?.toFixed(1) ?? '—'}</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)', marginBottom: 0 }}>Work Hours</p>
            </div>
            <div>
              <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>{record.overtime_hours?.toFixed(1) ?? '—'}</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)', marginBottom: 0 }}>Overtime Hours</p>
            </div>
            <div>
              <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>{record.duration_hours?.toFixed(1) ?? '—'}</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)', marginBottom: 0 }}>Duration</p>
            </div>
          </div>

          {(record.break_start || record.break_end) && (
            <div style={{ fontSize: 'var(--text-sm)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-6)' }}>
              <div><p style={{ color: 'var(--text-secondary)', margin: '0 0 var(--space-1) 0' }}>Break Start</p><p style={{ fontWeight: 'var(--weight-medium)', margin: 0 }}>{fmtTime(record.break_start)}</p></div>
              <div><p style={{ color: 'var(--text-secondary)', margin: '0 0 var(--space-1) 0' }}>Break End</p><p style={{ fontWeight: 'var(--weight-medium)', margin: 0 }}>{fmtTime(record.break_end)}</p></div>
            </div>
          )}

          {record.notes && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
              <p style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: '0 0 var(--space-1) 0' }}>Notes</p>
              <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>{record.notes}</p>
            </div>
          )}
        </div>
      </PageShell>
    </MainLayout>
  );
}
