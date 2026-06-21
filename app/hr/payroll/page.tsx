'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrPayrollApi, hrEmployeesApi } from '@/lib/api/hr';
import { HRPayroll } from '@/types';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { type FilterField } from '@/components/ui/FilterPanel';
import { Button, Badge, type Column } from '@/components/ui';
import { BaseModal } from '@/components/ui/base/BaseModal';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { RowActions } from '@/components/ui/RowActions';
import { AppListPage } from '@/components/app/AppListPage';
import { useT } from '@/lib/i18n/useT';
import { useTableState } from '@/lib/hooks/use-table-state';
import { PAYROLL_STATUS } from '@/lib/utils/status-colors';
import { GeneratePayrollModal } from '@/components/hr/GeneratePayrollModal';
import { MONTH_NAMES, formatCurrency } from '@/lib/utils/hr';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', processed: 'Processed', paid: 'Paid',
};

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
  const [showGenerate,   setShowGenerate]   = useState(false);
  const [showAutoCalc,   setShowAutoCalc]   = useState(false);
  const [showWpsExport,  setShowWpsExport]  = useState(false);
  const [acEmployee,     setAcEmployee]     = useState<number | null>(null);
  const [acMonth,        setAcMonth]        = useState(new Date().getMonth() + 1);
  const [acYear,         setAcYear]         = useState(new Date().getFullYear());
  const [wpsMonth,       setWpsMonth]       = useState(new Date().getMonth() + 1);
  const [wpsYear,        setWpsYear]        = useState(new Date().getFullYear());
  const [wpsLoading,     setWpsLoading]     = useState(false);

  const { data: empData } = useQuery({
    queryKey: ['hr-employees-payroll-picker'],
    queryFn:  () => hrEmployeesApi.getAll(),
    enabled:  showAutoCalc,
    staleTime: 5 * 60 * 1000,
  });

  const autoCalcMutation = useMutation({
    mutationFn: () => hrPayrollApi.autoCalculate({ employee_id: acEmployee!, month: acMonth, year: acYear }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-payroll'] });
      toast('Payroll auto-calculated from attendance', 'success');
      setShowAutoCalc(false);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Auto-calculate failed';
      toast(String(msg), 'error');
    },
  });

  const handleWpsExport = async () => {
    setWpsLoading(true);
    try {
      const blob = await hrPayrollApi.wpsExport(wpsMonth, wpsYear);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `WPS_${wpsYear}_${String(wpsMonth).padStart(2, '0')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowWpsExport(false);
      toast('WPS file downloaded', 'success');
    } catch {
      toast('Export failed — ensure payrolls are processed for this period', 'error');
    } finally {
      setWpsLoading(false);
    }
  };

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
      key: 'actions', header: '',
      render: r => (
        <RowActions actions={[
          { label: 'Mark Paid', onClick: () => handleMarkPaid(r.id, r.employee_name, r.month_name || MONTH_NAMES[r.month]), hidden: !isAdmin || r.status !== 'processed' },
        ]} />
      ),
    },
  ];

  return (
    <AppListPage
      title={t('page', 'hrPayroll')}
      description="Generate and manage employee payroll records."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'HR' }, { label: 'Payroll' }]}
      totalCount={totalCount}
      createAction={isAdmin ? (
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="secondary" size="sm" onClick={() => setShowWpsExport(true)}>
            WPS Export
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowAutoCalc(true)}>
            Auto Calculate
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowGenerate(true)}>
            + Generate Payroll
          </Button>
        </div>
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

      {/* Auto Calculate Modal */}
      <BaseModal
        isOpen={showAutoCalc}
        onClose={() => setShowAutoCalc(false)}
        title="Auto Calculate Payroll"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAutoCalc(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => autoCalcMutation.mutate()}
              isLoading={autoCalcMutation.isPending}
              disabled={!acEmployee}
            >
              Calculate
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Reads attendance records and computes absent days, overtime, penalties, and loan deductions automatically.
          </p>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Employee <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <SearchableDropdown
              options={(empData?.results ?? []).map(e => ({ value: e.id, label: `${e.full_name} (${e.employee_id})`, searchText: `${e.full_name} ${e.employee_id}` }))}
              value={acEmployee}
              onChange={v => setAcEmployee(v as number | null)}
              placeholder="Select employee…"
              allowClear
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Month</label>
              <select value={acMonth} onChange={e => setAcMonth(Number(e.target.value))} style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                {MONTH_NAMES.slice(1).map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Year</label>
              <select value={acYear} onChange={e => setAcYear(Number(e.target.value))} style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
      </BaseModal>

      {/* WPS Export Modal */}
      <BaseModal
        isOpen={showWpsExport}
        onClose={() => setShowWpsExport(false)}
        title="WPS Salary Export"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowWpsExport(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleWpsExport} isLoading={wpsLoading}>
              Download CSV
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Exports processed/paid payrolls as a UAE MOHRE-compatible WPS file. Only includes employees with a primary bank account.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Month</label>
              <select value={wpsMonth} onChange={e => setWpsMonth(Number(e.target.value))} style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                {MONTH_NAMES.slice(1).map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Year</label>
              <select value={wpsYear} onChange={e => setWpsYear(Number(e.target.value))} style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
      </BaseModal>
    </AppListPage>
  );
}