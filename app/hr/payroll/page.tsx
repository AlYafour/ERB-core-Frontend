'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrPayrollApi } from '@/lib/api/hr';
import { HRPayroll } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { type FilterField } from '@/components/ui/FilterPanel';
import { Button, Badge, type Column } from '@/components/ui';
import { AppListPage } from '@/components/app/AppListPage';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';
import { PAYROLL_STATUS } from '@/lib/utils/status-colors';
import { GeneratePayrollModal } from '@/components/hr/GeneratePayrollModal';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', processed: 'Processed', paid: 'Paid',
};

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => ({ value: String(currentYear - i), label: String(currentYear - i) }));

const filterFields: FilterField[] = [
  { name: 'status', label: 'Status', type: 'select', group: 'Filters',
    options: [{ value: 'draft', label: 'Draft' }, { value: 'processed', label: 'Processed' }, { value: 'paid', label: 'Paid' }] },
  { name: 'month', label: 'Month', type: 'select', group: 'Period',
    options: MONTH_NAMES.slice(1).map((name, i) => ({ value: String(i + 1), label: name })) },
  { name: 'year',  label: 'Year',  type: 'select', group: 'Period', options: yearOptions },
];

export default function HRPayrollPage() {
  const tableState = useTableState();
  const { page, search, filters } = tableState;

  const queryClient = useQueryClient();
  const { user }    = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const router      = useRouter();
  const t           = useT();
  const isAdmin     = isTenantAdmin || isPlatformAdmin || ['hr_manager', 'hr_secretary', 'company_director'].includes(user?.role ?? '');
  const [showGenerate, setShowGenerate] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-payroll', page, search, filters],
    queryFn:  () => hrPayrollApi.getAll({ page, search, ...filters }),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => hrPayrollApi.markPaid(id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['hr-payroll'] }); toast('Payroll marked as paid', 'success'); },
    onError:    () => toast('Failed to mark as paid', 'error'),
  });

  const handleMarkPaid = async (id: number, employeeName: string, monthName: string) => {
    if (await confirm(`Mark payroll for ${employeeName} (${monthName}) as paid?`)) markPaidMutation.mutate(id);
  };

  useEffect(() => {
    if (user && !isAdmin) router.replace('/');
  }, [user, isAdmin, router]);
  if (user && !isAdmin) return null;

  const records    = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const columns: Column<HRPayroll>[] = [
    {
      key: 'employee', header: 'Employee',
      render: r => (
        <div>
          <div className="font-medium">{r.employee_name}</div>
          <div className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{r.employee_id_code}</div>
        </div>
      ),
    },
    {
      key: 'period', header: 'Period',
      render: r => (
        <div>
          <div className="font-medium">{r.month_name || MONTH_NAMES[r.month]}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{r.year}</div>
        </div>
      ),
    },
    { key: 'basic',  header: 'Basic Salary', render: r => <span className="font-mono">AED {formatCurrency(r.basic_salary)}</span> },
    { key: 'gross',  header: 'Gross Salary', render: r => <span className="font-mono font-medium">AED {formatCurrency(r.gross_salary)}</span> },
    {
      key: 'deductions', header: 'Deductions',
      render: r => {
        const total = parseFloat(r.deductions) + parseFloat(r.absence_deduction) + parseFloat(r.penalty_deduction ?? '0') + parseFloat(r.loan_deduction ?? '0');
        return <span className="font-mono" style={{ color: 'var(--color-error)' }}>{total > 0 ? `AED ${formatCurrency(total.toString())}` : '—'}</span>;
      },
    },
    { key: 'net',    header: 'Net Salary',   render: r => <span className="font-mono font-semibold">AED {formatCurrency(r.net_salary)}</span> },
    {
      key: 'days', header: 'Days',
      render: r => (
        <span>
          <span style={{ color: 'var(--color-success)' }}>{r.present_days}P</span>{' / '}
          <span style={{ color: 'var(--color-error)' }}>{r.absent_days}A</span>{' / '}
          <span style={{ color: 'var(--text-secondary)' }}>{r.working_days}W</span>
        </span>
      ),
    },
    { key: 'status', header: t('col', 'status'), render: r => <Badge variant={PAYROLL_STATUS[r.status] ?? 'default'}>{STATUS_LABEL[r.status] || r.status}</Badge> },
    {
      key: 'actions', header: t('col', 'actions'),
      render: r => isAdmin ? (
        <div className="flex items-center gap-2">
          {r.status === 'processed' && (
            <Button variant="success" size="sm" onClick={() => handleMarkPaid(r.id, r.employee_name, r.month_name || MONTH_NAMES[r.month])} isLoading={markPaidMutation.isPending}>
              Mark Paid
            </Button>
          )}
          {r.status === 'paid' && r.paid_at && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{new Date(r.paid_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          )}
          {r.status === 'draft' && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Not processed</span>}
        </div>
      ) : null,
    },
  ];

  return (
    <AppListPage
      title={t('page', 'hrPayroll')}
      description="Generate and manage employee payroll records."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'HR' }, { label: 'Payroll' }]}
      totalCount={totalCount}
      createAction={isAdmin ? (
        <Button variant="primary" size="sm" onClick={() => setShowGenerate(true)}>
          + Generate Payroll
        </Button>
      ) : undefined}
      filterFields={filterFields}
      searchPlaceholder="Search by employee name or ID..."
      columns={columns}
      data={records}
      isLoading={isLoading}
      error={error}
      emptyTitle={t('empty', 'noPayroll')}
      tableState={tableState}
      paginatedData={data}
      pageSize={50}
    >
      <GeneratePayrollModal
        isOpen={showGenerate}
        onClose={() => setShowGenerate(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['hr-payroll'] })}
      />
    </AppListPage>
  );
}