'use client';

import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrPayrollApi } from '@/lib/api/hr';
import { HRPayroll } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import FilterPanel, { FilterField } from '@/components/ui/FilterPanel';
import FilterTags from '@/components/ui/FilterTags';
import { Button, Badge, PageHeader, SearchInput, PageShell, WorkspaceSurface } from '@/components/ui';
import { useT } from '@/lib/i18n/useT';
import DataTable, { Column } from '@/components/ui/DataTable';
import { useTableState } from '@/lib/hooks/use-table-state';
import { PAYROLL_STATUS } from '@/lib/utils/status-colors';

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
  const { page, setPage, search, filters, handleSearch, handleFilterChange, handleFilterReset, handleRemoveFilter } = useTableState();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const t = useT();
  const isAdmin = user?.role === 'super_admin' || user?.is_staff || user?.is_superuser;

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-payroll', page, search, filters],
    queryFn: () => hrPayrollApi.getAll({ page, search, ...filters }),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => hrPayrollApi.markPaid(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-payroll'] }); toast('Payroll marked as paid', 'success'); },
    onError: () => toast('Failed to mark as paid', 'error'),
  });

  const handleMarkPaid = async (id: number, employeeName: string, monthName: string) => {
    if (await confirm(`Mark payroll for ${employeeName} (${monthName}) as paid?`)) markPaidMutation.mutate(id);
  };

  const records    = data?.results ?? [];
  const totalCount = data?.count ?? 0;

  const columns: Column<HRPayroll>[] = [
    {
      key: 'employee', header: 'Employee',
      render: r => (
        <div>
          <div className="font-medium text-foreground">{r.employee_name}</div>
          <div className="text-xs text-muted-foreground font-mono">{r.employee_id_code}</div>
        </div>
      ),
    },
    {
      key: 'period', header: 'Period',
      render: r => (
        <div>
          <div className="font-medium text-foreground">{r.month_name || MONTH_NAMES[r.month]}</div>
          <div className="text-xs text-muted-foreground">{r.year}</div>
        </div>
      ),
    },
    { key: 'basic',   header: 'Basic Salary',  render: r => <span className="text-sm font-mono text-foreground">AED {formatCurrency(r.basic_salary)}</span> },
    { key: 'gross',   header: 'Gross Salary',  render: r => <span className="text-sm font-mono font-medium text-foreground">AED {formatCurrency(r.gross_salary)}</span> },
    {
      key: 'deductions', header: 'Deductions',
      render: r => {
        const total = parseFloat(r.deductions) + parseFloat(r.absence_deduction);
        return <span className="text-sm font-mono text-destructive">{total > 0 ? `AED ${formatCurrency(total.toString())}` : '—'}</span>;
      },
    },
    { key: 'net',     header: 'Net Salary',    render: r => <span className="text-sm font-semibold font-mono text-foreground">AED {formatCurrency(r.net_salary)}</span> },
    {
      key: 'days', header: 'Days',
      render: r => (
        <span className="text-sm">
          <span className="text-green-600">{r.present_days}P</span>{' / '}
          <span className="text-red-500">{r.absent_days}A</span>{' / '}
          <span className="text-muted-foreground">{r.working_days}W</span>
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
            <span className="text-xs text-muted-foreground">{new Date(r.paid_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          )}
          {r.status === 'draft' && <span className="text-xs text-muted-foreground">Not processed</span>}
        </div>
      ) : null,
    },
  ];

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={t('page', 'hrPayroll')}
          count={totalCount}
          breadcrumbs={[{ label: 'HR' }, { label: 'Payroll' }]}
        />
        <WorkspaceSurface
          toolbar={
            <>
              <SearchInput value={search} onChange={handleSearch} placeholder="Search by employee name or ID..." />
              <div style={{ flex: 1 }} />
              <FilterPanel fields={filterFields} filters={filters} onFilterChange={handleFilterChange} onReset={handleFilterReset} saveKey="hr-payroll" />
            </>
          }
          filterTags={
            Object.keys(filters).length > 0
              ? <FilterTags filters={filters} fields={filterFields} onRemoveFilter={handleRemoveFilter} onClearAll={handleFilterReset} />
              : undefined
          }
        >
          <DataTable
            surface
            columns={columns}
            data={records}
            isLoading={isLoading}
            error={error}
            emptyMessage={t('empty', 'noPayroll')}
            page={page}
            totalCount={totalCount}
            pageSize={50}
            hasPrev={!!data?.previous}
            hasNext={!!data?.next}
            onPageChange={setPage}
          />
        </WorkspaceSurface>
      </PageShell>
    </MainLayout>
  );
}
