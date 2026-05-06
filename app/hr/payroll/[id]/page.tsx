'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrPayrollApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { Button, Badge, Loader } from '@/components/ui';
import Link from 'next/link';

const statusColors: Record<string, string> = {
  draft: 'badge-default', processed: 'badge-info', paid: 'badge-success',
};

const fmt = (v: string | number) =>
  `AED ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export default function PayrollDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.is_staff || user?.is_superuser;

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

  if (isLoading) return <MainLayout><div className="card text-center py-16"><Loader className="mx-auto mb-4" /></div></MainLayout>;
  if (error || !payroll) return <MainLayout><div className="card text-center py-16"><p className="text-destructive">Payroll record not found.</p></div></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/hr/payroll"><Button variant="ghost" size="sm">← Back</Button></Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {payroll.month_name} {payroll.year}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{payroll.employee_name} — {payroll.employee_id_code}</p>
          </div>
        </div>

        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <Badge className={statusColors[payroll.status] || 'badge-default'}>{payroll.status.toUpperCase()}</Badge>
            {payroll.paid_at && (
              <span className="text-sm text-muted-foreground">Paid {new Date(payroll.paid_at).toLocaleDateString()}</span>
            )}
          </div>

          {/* Earnings */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Earnings</p>
            {[
              ['Basic Salary', payroll.basic_salary],
              ['Housing Allowance', payroll.housing_allowance],
              ['Transport Allowance', payroll.transport_allowance],
              ['Other Allowances', payroll.other_allowances],
              ['Overtime', payroll.overtime_amount],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-foreground">{fmt(value)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold border-t pt-2" style={{ borderColor: 'var(--border)' }}>
              <span>Gross Salary</span>
              <span>{fmt(payroll.gross_salary)}</span>
            </div>
          </div>

          {/* Deductions */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Deductions</p>
            {[
              ['General Deductions', payroll.deductions],
              ['Absence Deduction', payroll.absence_deduction],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-destructive">-{fmt(value)}</span>
              </div>
            ))}
          </div>

          {/* Net */}
          <div className="flex justify-between text-base font-bold p-3 rounded-lg"
            style={{ backgroundColor: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}>
            <span>Net Salary</span>
            <span>{fmt(payroll.net_salary)}</span>
          </div>

          {/* Attendance summary */}
          <div className="grid grid-cols-4 gap-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            {[
              ['Working Days', payroll.working_days],
              ['Present', payroll.present_days],
              ['Absent', payroll.absent_days],
              ['Leave', payroll.leave_days],
            ].map(([label, value]) => (
              <div key={label} className="text-center">
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>

          {payroll.notes && (
            <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-foreground">{payroll.notes}</p>
            </div>
          )}
        </div>

        {isAdmin && payroll.status === 'processed' && (
          <Button variant="primary" onClick={handleMarkPaid} isLoading={markPaidMutation.isPending}>
            Mark as Paid
          </Button>
        )}
      </div>
    </MainLayout>
  );
}
