'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrLoansApi, hrEmployeesApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { Button, Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import { BaseModal } from '@/components/ui/base/BaseModal';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';
import type { EmployeeLoan, HREmployee } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const LOAN_STATUS_VARIANT: Record<string, 'success' | 'info' | 'default' | 'warning' | 'error'> = {
  active:    'success',
  completed: 'info',
  paused:    'warning',
  cancelled: 'error',
};

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const NOW_MONTH = new Date().getMonth() + 1;
const NOW_YEAR  = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => NOW_YEAR - i);

const fmt = (v: string | number) =>
  `AED ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toDec = (s: string) => parseFloat(s) || 0;

const filterFields: FilterField[] = [
  {
    name: 'status', label: 'Status', type: 'select', group: 'Filters',
    options: [
      { value: 'active',    label: 'Active' },
      { value: 'completed', label: 'Completed' },
      { value: 'paused',    label: 'Paused' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
  },
];

// ── Shared styles ─────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)',
  outline: 'none',
  boxSizing: 'border-box',
};

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 4,
};

const SECTION: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  margin: '0 0 8px 0',
};

// ── New Loan form ─────────────────────────────────────────────────────────────

interface LoanForm {
  employeeId:         number | null;
  total_amount:       string;
  installment_amount: string;
  start_month:        number;
  start_year:         number;
  notes:              string;
}

const LOAN_INITIAL: LoanForm = {
  employeeId:         null,
  total_amount:       '',
  installment_amount: '',
  start_month:        NOW_MONTH,
  start_year:         NOW_YEAR,
  notes:              '',
};

function NewLoanModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<LoanForm>(LOAN_INITIAL);

  useEffect(() => { if (isOpen) setForm(LOAN_INITIAL); }, [isOpen]);

  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: ['hr-employees-loan-picker'],
    queryFn:  () => hrEmployeesApi.getAll(),
    enabled:  isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const employeeOptions = useMemo(() =>
    (empData?.results ?? []).map((e: HREmployee) => ({
      value:      e.id,
      label:      `${e.full_name} (${e.employee_id})`,
      searchText: `${e.full_name} ${e.employee_id}`,
    })),
    [empData?.results],
  );

  const computedInstallments = useMemo(() => {
    const total = toDec(form.total_amount);
    const inst  = toDec(form.installment_amount);
    if (total > 0 && inst > 0) return Math.ceil(total / inst);
    return null;
  }, [form.total_amount, form.installment_amount]);

  const createMutation = useMutation({
    mutationFn: () => hrLoansApi.create({
      employee:           form.employeeId!,
      total_amount:       form.total_amount,
      installment_amount: form.installment_amount,
      start_month:        form.start_month,
      start_year:         form.start_year,
      notes:              form.notes,
    } as any),
    onSuccess: () => { toast('Loan created', 'success'); onSuccess(); onClose(); },
    onError: (err: any) => {
      const data = err?.response?.data;
      const msg = data?.detail ?? data?.non_field_errors?.[0]
        ?? (data && typeof data === 'object' ? Object.values(data).flat().join(' ') : null)
        ?? 'Failed to create loan';
      toast(String(msg), 'error');
    },
  });

  const handleSubmit = () => {
    if (!form.employeeId)                    { toast('Please select an employee', 'error'); return; }
    if (toDec(form.total_amount) <= 0)       { toast('Total amount must be > 0', 'error'); return; }
    if (toDec(form.installment_amount) <= 0) { toast('Installment amount must be > 0', 'error'); return; }
    if (toDec(form.installment_amount) > toDec(form.total_amount)) {
      toast('Installment cannot exceed total', 'error'); return;
    }
    createMutation.mutate();
  };

  const set = (key: keyof LoanForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));

  const setInt = (key: keyof LoanForm) =>
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: parseInt(e.target.value) }));

  return (
    <BaseModal
      isOpen={isOpen} onClose={onClose}
      title="New Loan / Advance" size="md"
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={createMutation.isPending}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={createMutation.isPending} disabled={!form.employeeId}>
            Create Loan
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        <div>
          <p style={SECTION}>Employee</p>
          <label style={LABEL}>Employee <span style={{ color: 'var(--color-error)' }}>*</span></label>
          <SearchableDropdown
            options={employeeOptions}
            value={form.employeeId}
            onChange={v => setForm(f => ({ ...f, employeeId: v as number | null }))}
            placeholder={empLoading ? 'Loading…' : 'Search by name or ID…'}
            searchPlaceholder="Type to search…"
            allowClear emptyMessage="No employees found"
          />
        </div>

        <div>
          <p style={SECTION}>Loan Details</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>Total Amount (AED) <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input type="number" min="0.01" step="0.01" placeholder="e.g. 6000"
                value={form.total_amount} onChange={set('total_amount')} style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Installment / Month (AED) <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input type="number" min="0.01" step="0.01" placeholder="e.g. 1000"
                value={form.installment_amount} onChange={set('installment_amount')} style={INPUT} />
            </div>
          </div>
          {computedInstallments !== null && (
            <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              = <strong>{computedInstallments}</strong> monthly installment{computedInstallments !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div>
          <p style={SECTION}>Start Period</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>Start Month <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <select value={form.start_month} onChange={setInt('start_month')} style={INPUT}>
                {MONTH_NAMES.slice(1).map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={LABEL}>Start Year <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <select value={form.start_year} onChange={setInt('start_year')} style={INPUT}>
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label style={LABEL}>
            Notes <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>optional — shown on payslip</span>
          </label>
          <textarea value={form.notes} onChange={set('notes')} rows={2}
            placeholder="e.g. Vehicle purchase advance, approved by GM…"
            style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

      </div>
    </BaseModal>
  );
}

// ── Loan Detail Modal ──────────────────────────────────────────────────────────

function LoanDetailModal({ loan, onClose }: { loan: EmployeeLoan; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Employee',          loan.employee_name],
    ['Employee ID',       loan.employee_id_code],
    ['Total Amount',      fmt(loan.total_amount)],
    ['Installment / Mo.', fmt(loan.installment_amount)],
    ['Remaining Balance', fmt(loan.remaining_balance)],
    ['Start',             `${MONTH_NAMES[loan.start_month]} ${loan.start_year}`],
    ['Progress',          `${loan.installments_taken} of ${loan.number_of_installments} installments taken`],
    ['Status',            loan.status.charAt(0).toUpperCase() + loan.status.slice(1)],
    ['Notes',             loan.notes || '—'],
  ];

  return (
    <BaseModal
      isOpen onClose={onClose}
      title="Loan Details" size="sm"
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', gap: 8 }}>
            <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
            <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
          </div>
        ))}

        {/* Progress bar */}
        {loan.number_of_installments > 0 && (
          <div style={{ marginTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 6px' }}>
              Repayment progress
            </p>
            <div style={{ background: 'var(--surface-subtle)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (loan.installments_taken / loan.number_of_installments) * 100)}%`,
                background: loan.status === 'completed' ? 'var(--color-success)' : 'var(--color-primary)',
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '4px 0 0', textAlign: 'right' }}>
              {Math.round((loan.installments_taken / loan.number_of_installments) * 100)}%
            </p>
          </div>
        )}
      </div>
    </BaseModal>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function HRLoansPage() {
  const tableState = useTableState();
  const { page, search, filters } = tableState;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.is_staff || user?.is_superuser;

  const [showNew, setShowNew]         = useState(false);
  const [detailLoan, setDetailLoan]   = useState<EmployeeLoan | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-loans', page, search, filters],
    queryFn:  () => hrLoansApi.getAll({ page, search, ...filters }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => hrLoansApi.cancel(id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['hr-loans'] }); toast('Loan cancelled', 'success'); },
    onError:    () => toast('Failed to cancel loan', 'error'),
  });
  const pauseMutation = useMutation({
    mutationFn: (id: number) => hrLoansApi.pause(id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['hr-loans'] }); toast('Loan paused', 'success'); },
    onError:    () => toast('Failed to pause loan', 'error'),
  });
  const resumeMutation = useMutation({
    mutationFn: (id: number) => hrLoansApi.resume(id),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['hr-loans'] }); toast('Loan resumed', 'success'); },
    onError:    () => toast('Failed to resume loan', 'error'),
  });

  const handleCancel = async (loan: EmployeeLoan) => {
    if (await confirm(`Cancel loan for ${loan.employee_name}?\nRemaining: ${fmt(loan.remaining_balance)}`)) {
      cancelMutation.mutate(loan.id);
    }
  };

  const records    = data?.results ?? [];
  const totalCount = data?.count ?? 0;

  const columns: Column<EmployeeLoan>[] = [
    {
      key: 'employee', header: 'Employee',
      render: r => (
        <div>
          <div className="font-medium">{r.employee_name}</div>
          <div className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            {r.employee_id_code}
          </div>
        </div>
      ),
    },
    {
      key: 'total', header: 'Total Amount',
      render: r => <span className="font-mono">{fmt(r.total_amount)}</span>,
    },
    {
      key: 'installment', header: 'Installment / Mo.',
      render: r => (
        <div>
          <div className="font-mono">{fmt(r.installment_amount)}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            {r.installments_taken} / {r.number_of_installments} taken
          </div>
        </div>
      ),
    },
    {
      key: 'remaining', header: 'Remaining',
      render: r => (
        <span className="font-mono" style={{
          color: parseFloat(r.remaining_balance) > 0
            ? 'var(--color-warning, #f59e0b)'
            : 'var(--text-tertiary)',
        }}>
          {parseFloat(r.remaining_balance) > 0 ? fmt(r.remaining_balance) : '—'}
        </span>
      ),
    },
    {
      key: 'start', header: 'Start',
      render: r => (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {MONTH_NAMES[r.start_month]} {r.start_year}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: r => (
        <Badge variant={LOAN_STATUS_VARIANT[r.status] ?? 'default'}>
          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'actions', header: 'Actions',
      render: r => (
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="ghost" size="sm" onClick={() => setDetailLoan(r)}>
            Details
          </Button>
          {isAdmin && r.status === 'active' && (
            <Button variant="ghost" size="sm"
              onClick={() => pauseMutation.mutate(r.id)}
              isLoading={pauseMutation.isPending && pauseMutation.variables === r.id}>
              Pause
            </Button>
          )}
          {isAdmin && r.status === 'paused' && (
            <Button variant="primary" size="sm"
              onClick={() => resumeMutation.mutate(r.id)}
              isLoading={resumeMutation.isPending && resumeMutation.variables === r.id}>
              Resume
            </Button>
          )}
          {isAdmin && (r.status === 'active' || r.status === 'paused') && (
            <Button variant="destructive" size="sm"
              onClick={() => handleCancel(r)}
              isLoading={cancelMutation.isPending && cancelMutation.variables === r.id}>
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Loans & Advances"
          count={totalCount}
          breadcrumbs={[{ label: 'HR' }, { label: 'Loans & Advances' }]}
          actions={isAdmin ? (
            <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
              + New Loan
            </Button>
          ) : undefined}
        />

        <NewLoanModal
          isOpen={showNew}
          onClose={() => setShowNew(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['hr-loans'] })}
        />

        {detailLoan && (
          <LoanDetailModal loan={detailLoan} onClose={() => setDetailLoan(null)} />
        )}

        <TableShell
          tableState={tableState}
          filterFields={filterFields}
          filterSaveKey="hr-loans"
          searchPlaceholder="Search by employee name or ID…"
          columns={columns}
          data={records}
          isLoading={isLoading}
          error={error}
          emptyMessage="No loans found."
          totalCount={totalCount}
          pageSize={50}
          paginatedData={data}
        />
      </PageShell>
    </MainLayout>
  );
}
