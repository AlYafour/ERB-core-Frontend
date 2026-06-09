'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrPayrollApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { Button, Badge, Loader, PageHeader, PageShell } from '@/components/ui';

const STATUS_VARIANT: Record<string, string> = {
  draft: 'default', processed: 'info', paid: 'success',
};

const fmt = (v: string | number) =>
  `AED ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export default function PayrollDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.is_staff || user?.is_superuser;

  const { data: payroll, isLoading, error } = useQuery({
    queryKey: ['hr-payroll', id],
    queryFn: () => hrPayrollApi.getById(Number(id)),
  });

  const markPaidMutation = useMutation({
    mutationFn: () => hrPayrollApi.markPaid(Number(id)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-payroll', id] }); toast('Marked as paid', 'success'); },
    onError: () => toast('Failed', 'error'),
  });

  const handleMarkPaid = async () => {
    const ok = await confirm('Mark this payroll as paid?');
    if (ok) markPaidMutation.mutate();
  };

  if (isLoading) return <MainLayout><div className="card empty-state"><Loader /></div></MainLayout>;
  if (error || !payroll) return <MainLayout><div className="card empty-state"><p style={{ color: 'var(--color-error)', margin: 0 }}>Payroll record not found.</p></div></MainLayout>;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={`${payroll.month_name} ${payroll.year}`}
          description={`${payroll.employee_name} — ${payroll.employee_id_code}`}
          breadcrumbs={[{ label: 'HR' }, { label: 'Payroll', href: '/hr/payroll' }, { label: `${payroll.month_name} ${payroll.year}` }]}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Badge variant={(STATUS_VARIANT[payroll.status] as any) || 'default'}>{payroll.status.toUpperCase()}</Badge>
              {isAdmin && payroll.status === 'processed' && (
                <Button variant="primary" size="sm" onClick={handleMarkPaid} isLoading={markPaidMutation.isPending}>
                  Mark as Paid
                </Button>
              )}
            </div>
          }
        />

        <div className="card" style={{ maxWidth: '42rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {payroll.paid_at && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>Paid {new Date(payroll.paid_at).toLocaleDateString()}</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>Earnings</p>
            {[
              ['Basic Salary', payroll.basic_salary],
              ['Housing Allowance', payroll.housing_allowance],
              ['Transport Allowance', payroll.transport_allowance],
              ['Other Allowances', payroll.other_allowances],
              ['Overtime', payroll.overtime_amount],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span>{fmt(value)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-2)' }}>
              <span>Gross Salary</span>
              <span>{fmt(payroll.gross_salary)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>Deductions</p>
            {[
              ['General Deductions', payroll.deductions],
              ['Absence Deduction', payroll.absence_deduction],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ color: 'var(--color-error)' }}>-{fmt(value)}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}>
            <span>Net Salary</span>
            <span>{fmt(payroll.net_salary)}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
            {[
              ['Working Days', payroll.working_days],
              ['Present', payroll.present_days],
              ['Absent', payroll.absent_days],
              ['Leave', payroll.leave_days],
            ].map(([label, value]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>{value}</p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)', marginBottom: 0 }}>{label}</p>
              </div>
            ))}
          </div>

          {payroll.notes && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
              <p style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: '0 0 var(--space-1) 0' }}>Notes</p>
              <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>{payroll.notes}</p>
            </div>
          )}
        </div>
      </PageShell>
    </MainLayout>
  );
}
