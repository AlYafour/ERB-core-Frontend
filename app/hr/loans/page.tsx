'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { hrLoansApi, hrEmployeesApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { Button, Badge, type Column } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import { AppListPage } from '@/components/app/AppListPage';
import { BaseModal } from '@/components/ui/base/BaseModal';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';
import type { EmployeeLoan, HREmployee } from '@/types';
import { MONTH_NAMES } from '@/lib/utils/hr';

// ── Helpers ───────────────────────────────────────────────────────────────────

const LOAN_STATUS_VARIANT: Record<string, 'success' | 'info' | 'default' | 'warning' | 'error'> = {
  active:    'success',
  completed: 'info',
  paused:    'warning',
  cancelled: 'error',
};

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
    } as Partial<EmployeeLoan>),
    onSuccess: () => { toast('Loan created', 'success'); onSuccess(); onClose(); },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const msg = (data?.detail as string | undefined)
        ?? (data?.non_field_errors as string[] | undefined)?.[0]
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

// ── Pay Cash Modal ─────────────────────────────────────────────────────────────

function PayCashModal({ loan, onClose, onSuccess }: { loan: EmployeeLoan; onClose: () => void; onSuccess: (updated: EmployeeLoan) => void }) {
  const [month,  setMonth]  = useState(NOW_MONTH);
  const [year,   setYear]   = useState(NOW_YEAR);
  const [amount, setAmount] = useState('');

  const defaultAmount = Math.min(
    parseFloat(loan.installment_amount as unknown as string),
    parseFloat(loan.remaining_balance as unknown as string),
  );

  const mutation = useMutation({
    mutationFn: () => hrLoansApi.payCash(loan.id, {
      month, year,
      amount: amount ? parseFloat(amount) : undefined,
    }),
    onSuccess: (updated) => { toast('Cash payment recorded', 'success'); onSuccess(updated); onClose(); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to record payment';
      toast(msg, 'error');
    },
  });

  return (
    <BaseModal
      isOpen onClose={onClose}
      title="Record Cash Payment" size="sm"
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button variant="primary" onClick={() => mutation.mutate()} isLoading={mutation.isPending}>
            Confirm Payment
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 'var(--text-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Remaining Balance</span>
            <strong>{fmt(loan.remaining_balance)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Default Installment</span>
            <strong>{fmt(loan.installment_amount)}</strong>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label style={LABEL}>Month <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={INPUT}>
              {MONTH_NAMES.slice(1).map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={LABEL}>Year <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} style={INPUT}>
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={LABEL}>
            Amount (AED)
            <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>
              leave blank to use default ({fmt(defaultAmount)})
            </span>
          </label>
          <input
            type="number" min="0.01" step="0.01"
            placeholder={`Default: ${defaultAmount.toFixed(2)}`}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={INPUT}
          />
        </div>
      </div>
    </BaseModal>
  );
}

// ── Skip Installment Modal ────────────────────────────────────────────────────

function SkipModal({ loan, onClose, onSuccess }: { loan: EmployeeLoan; onClose: () => void; onSuccess: (updated: EmployeeLoan) => void }) {
  const [month, setMonth] = useState(NOW_MONTH);
  const [year,  setYear]  = useState(NOW_YEAR);

  const mutation = useMutation({
    mutationFn: () => hrLoansApi.skip(loan.id, { month, year }),
    onSuccess: (updated) => { toast('Installment skipped — loan term extended by 1 month', 'success'); onSuccess(updated); onClose(); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to skip installment';
      toast(msg, 'error');
    },
  });

  return (
    <BaseModal
      isOpen onClose={onClose}
      title="Skip Installment" size="sm"
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button variant="warning" onClick={() => mutation.mutate()} isLoading={mutation.isPending}>
            Skip Month
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          No deduction will be made for the selected month. The loan term will extend by one month to compensate.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label style={LABEL}>Month <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={INPUT}>
              {MONTH_NAMES.slice(1).map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={LABEL}>Year <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} style={INPUT}>
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

// ── Reschedule Modal ──────────────────────────────────────────────────────────

function RescheduleModal({ loan, onClose, onSuccess }: { loan: EmployeeLoan; onClose: () => void; onSuccess: (updated: EmployeeLoan) => void }) {
  const [installmentAmount, setInstallmentAmount] = useState(
    parseFloat(loan.installment_amount as unknown as string).toFixed(2)
  );

  const remaining    = parseFloat(loan.remaining_balance as unknown as string);
  const newAmount    = parseFloat(installmentAmount) || 0;
  const newInstCount = newAmount > 0 ? Math.ceil(remaining / newAmount) : null;

  const mutation = useMutation({
    mutationFn: () => hrLoansApi.reschedule(loan.id, { installment_amount: newAmount }),
    onSuccess: (updated) => { toast('Loan rescheduled successfully', 'success'); onSuccess(updated); onClose(); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to reschedule loan';
      toast(msg, 'error');
    },
  });

  return (
    <BaseModal
      isOpen onClose={onClose}
      title="Reschedule Loan" size="sm"
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button variant="primary" onClick={() => mutation.mutate()} isLoading={mutation.isPending} disabled={newAmount <= 0}>
            Apply Reschedule
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 'var(--text-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Remaining Balance</span>
            <strong>{fmt(loan.remaining_balance)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Current Installment</span>
            <strong>{fmt(loan.installment_amount)}</strong>
          </div>
        </div>

        <div>
          <label style={LABEL}>New Monthly Installment (AED) <span style={{ color: 'var(--color-error)' }}>*</span></label>
          <input
            type="number" min="0.01" step="0.01"
            value={installmentAmount}
            onChange={e => setInstallmentAmount(e.target.value)}
            style={INPUT}
          />
        </div>

        {newInstCount !== null && newAmount > 0 && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
            New schedule: <strong>{newInstCount}</strong> remaining installment{newInstCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </BaseModal>
  );
}

// ── Loan Detail Modal ──────────────────────────────────────────────────────────

interface LoanDetailProps {
  loan: EmployeeLoan;
  onClose: () => void;
  canPayCash:   boolean;
  canSkip:      boolean;
  canReschedule: boolean;
  onPayCash:    () => void;
  onSkip:       () => void;
  onReschedule: () => void;
}

function LoanDetailModal({ loan, onClose, canPayCash, canSkip, canReschedule, onPayCash, onSkip, onReschedule }: LoanDetailProps) {
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

  const isActive = loan.status === 'active';
  const showActions = isActive && (canPayCash || canSkip || canReschedule);

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

        {/* Action buttons */}
        {showActions && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-1)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {canPayCash && (
              <Button variant="primary" size="sm" onClick={onPayCash}>
                Pay Cash
              </Button>
            )}
            {canSkip && (
              <Button variant="secondary" size="sm" onClick={onSkip}>
                Skip Month
              </Button>
            )}
            {canReschedule && (
              <Button variant="secondary" size="sm" onClick={onReschedule}>
                Reschedule
              </Button>
            )}
          </div>
        )}
        {/* Reschedule also available for paused loans */}
        {!isActive && loan.status === 'paused' && canReschedule && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
            <Button variant="secondary" size="sm" onClick={onReschedule}>
              Reschedule
            </Button>
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
  const { hasPermission } = useMyPermissions();
  const router = useRouter();

  const isAdmin       = hasPermission('hr.hr_loan.view');
  const canPayCash    = hasPermission('hr.hr_loan.pay_cash');
  const canSkip       = hasPermission('hr.hr_loan.skip');
  const canReschedule = hasPermission('hr.hr_loan.reschedule');

  const [showNew,      setShowNew]      = useState(false);
  const [detailLoan,   setDetailLoan]   = useState<EmployeeLoan | null>(null);
  const [payCashLoan,  setPayCashLoan]  = useState<EmployeeLoan | null>(null);
  const [skipLoan,     setSkipLoan]     = useState<EmployeeLoan | null>(null);
  const [rescheduleLoan, setRescheduleLoan] = useState<EmployeeLoan | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-loans', page, search, filters],
    queryFn:  () => hrLoansApi.getAll({ page, search, ...filters }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hr-loans'] });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => hrLoansApi.cancel(id),
    onSuccess:  () => { invalidate(); toast('Loan cancelled', 'success'); },
    onError:    () => toast('Failed to cancel loan', 'error'),
  });
  const pauseMutation = useMutation({
    mutationFn: (id: number) => hrLoansApi.pause(id),
    onSuccess:  () => { invalidate(); toast('Loan paused', 'success'); },
    onError:    () => toast('Failed to pause loan', 'error'),
  });
  const resumeMutation = useMutation({
    mutationFn: (id: number) => hrLoansApi.resume(id),
    onSuccess:  () => { invalidate(); toast('Loan resumed', 'success'); },
    onError:    () => toast('Failed to resume loan', 'error'),
  });

  const handleCancel = async (loan: EmployeeLoan) => {
    if (await confirm(`Cancel loan for ${loan.employee_name}?\nRemaining: ${fmt(loan.remaining_balance)}`)) {
      cancelMutation.mutate(loan.id);
    }
  };

  const handleLoanUpdated = (updated: EmployeeLoan) => {
    invalidate();
    setDetailLoan(updated);
  };

  useEffect(() => {
    if (user && !isAdmin) router.replace('/');
  }, [user, isAdmin, router]);
  if (user && !isAdmin) return null;

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
      key: 'actions', header: '',
      render: r => (
        <RowActions actions={[
          { label: 'View Details', onClick: () => setDetailLoan(r) },
          { separator: true, hidden: !isAdmin },
          { label: 'Pay Cash',   onClick: () => { setDetailLoan(null); setPayCashLoan(r); },  hidden: !canPayCash    || r.status !== 'active' },
          { label: 'Skip Month', onClick: () => { setDetailLoan(null); setSkipLoan(r); },     hidden: !canSkip       || r.status !== 'active' },
          { label: 'Reschedule', onClick: () => { setDetailLoan(null); setRescheduleLoan(r); }, hidden: !canReschedule || (r.status !== 'active' && r.status !== 'paused') },
          { separator: true, hidden: !isAdmin || (r.status !== 'active' && r.status !== 'paused') },
          { label: 'Pause',   onClick: () => pauseMutation.mutate(r.id),  hidden: !isAdmin || r.status !== 'active' },
          { label: 'Resume',  onClick: () => resumeMutation.mutate(r.id), hidden: !isAdmin || r.status !== 'paused' },
          { separator: true, hidden: !isAdmin || (r.status !== 'active' && r.status !== 'paused') },
          { label: 'Cancel',  onClick: () => handleCancel(r), variant: 'danger', hidden: !isAdmin || (r.status !== 'active' && r.status !== 'paused') },
        ]} />
      ),
    },
  ];

  return (
    <AppListPage
      title="Loans & Advances"
      description="Manage employee loans and salary advances."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'HR' }, { label: 'Loans & Advances' }]}
      totalCount={totalCount}
      createAction={isAdmin ? (
        <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
          + New Loan
        </Button>
      ) : undefined}
      filterFields={filterFields}
      onRowClick={r => setDetailLoan(r)}
      searchPlaceholder="Search by employee name or ID…"
      columns={columns}
      data={records}
      isLoading={isLoading}
      error={error}
      emptyTitle="No loans found."
      tableState={tableState}
      paginatedData={data}
      pageSize={50}
    >
      <NewLoanModal
        isOpen={showNew}
        onClose={() => setShowNew(false)}
        onSuccess={invalidate}
      />
      {detailLoan && (
        <LoanDetailModal
          loan={detailLoan}
          onClose={() => setDetailLoan(null)}
          canPayCash={canPayCash}
          canSkip={canSkip}
          canReschedule={canReschedule}
          onPayCash={() => { setPayCashLoan(detailLoan); setDetailLoan(null); }}
          onSkip={() => { setSkipLoan(detailLoan); setDetailLoan(null); }}
          onReschedule={() => { setRescheduleLoan(detailLoan); setDetailLoan(null); }}
        />
      )}
      {payCashLoan && (
        <PayCashModal
          loan={payCashLoan}
          onClose={() => setPayCashLoan(null)}
          onSuccess={handleLoanUpdated}
        />
      )}
      {skipLoan && (
        <SkipModal
          loan={skipLoan}
          onClose={() => setSkipLoan(null)}
          onSuccess={handleLoanUpdated}
        />
      )}
      {rescheduleLoan && (
        <RescheduleModal
          loan={rescheduleLoan}
          onClose={() => setRescheduleLoan(null)}
          onSuccess={handleLoanUpdated}
        />
      )}
    </AppListPage>
  );
}
