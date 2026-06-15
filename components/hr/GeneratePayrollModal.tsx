'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BaseModal } from '@/components/ui/base/BaseModal';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { Button } from '@/components/ui';
import { hrEmployeesApi, hrPayrollApi, hrPenaltyApplicationsApi, hrLoansApi, hrLeaveEncashmentsApi, type PenaltyApplicationPreview } from '@/lib/api/hr';
import { toast } from '@/lib/hooks/use-toast';
import type { HREmployee, EmployeeLoan, LeaveEncashment } from '@/types';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const NOW_MONTH = new Date().getMonth() + 1;
const NOW_YEAR  = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => NOW_YEAR - i);

interface FormState {
  employeeId:        number | null;
  month:             number;
  year:              number;
  basic_salary:      string;
  housing_allowance: string;
  transport_allowance: string;
  other_allowances:  string;
  overtime_amount:   string;
  deductions:        string;
  absence_deduction: string;
  working_days:      string;
  present_days:      string;
  absent_days:       string;
  leave_days:        string;
  notes:             string;
}

const INITIAL: FormState = {
  employeeId: null,
  month: NOW_MONTH,
  year:  NOW_YEAR,
  basic_salary:      '0.00',
  housing_allowance: '0.00',
  transport_allowance: '0.00',
  other_allowances:  '0.00',
  overtime_amount:   '0.00',
  deductions:        '0.00',
  absence_deduction: '0.00',
  working_days: '26',
  present_days: '0',
  absent_days:  '0',
  leave_days:   '0',
  notes: '',
};

const fmtNum = (v: number | string) =>
  Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toDec = (s: string) => parseFloat(s) || 0;

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

const READONLY: React.CSSProperties = {
  ...INPUT,
  background: 'var(--surface-subtle)',
  cursor: 'default',
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

interface Props {
  isOpen:    boolean;
  onClose:   () => void;
  onSuccess: () => void;
}

export function GeneratePayrollModal({ isOpen, onClose, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(INITIAL);

  // Reset on open
  useEffect(() => {
    if (isOpen) setForm(INITIAL);
  }, [isOpen]);

  // All employees (endpoint has pagination_class=None — returns full list)
  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: ['hr-employees-payroll-picker'],
    queryFn:  () => hrEmployeesApi.getAll(),
    enabled:  isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const employeeMap = useMemo(() => {
    const m = new Map<number, HREmployee>();
    (empData?.results ?? []).forEach(e => m.set(e.id, e));
    return m;
  }, [empData?.results]);

  const employeeOptions = useMemo(() =>
    (empData?.results ?? []).map(e => ({
      value:      e.id,
      label:      `${e.full_name} (${e.employee_id})`,
      searchText: `${e.full_name} ${e.employee_id}`,
    })),
    [empData?.results],
  );

  // Confirmed penalties preview — fires only when all three selectors are set
  const previewReady = form.employeeId !== null && form.month > 0 && form.year > 0;

  const { data: penaltyData, isLoading: penaltyLoading } = useQuery({
    queryKey: ['penalty-preview', form.employeeId, form.month, form.year],
    queryFn:  () => hrPenaltyApplicationsApi.getAll({
      employee: form.employeeId!,
      month:    form.month,
      year:     form.year,
      status:   'confirmed',
    }),
    enabled:   previewReady,
    staleTime: 30_000,
  });

  const confirmedPenalties: PenaltyApplicationPreview[] = penaltyData?.results ?? [];
  const penaltyTotal = confirmedPenalties.reduce((s, p) => s + toDec(p.penalty_amount), 0);

  // Active loans preview — queries all active loans for the employee, filtered client-side
  const { data: loansData, isLoading: loansLoading } = useQuery({
    queryKey: ['loans-preview', form.employeeId],
    queryFn:  () => hrLoansApi.getAll({ employee: form.employeeId!, status: 'active', page_size: 50 }),
    enabled:  previewReady,
    staleTime: 30_000,
  });

  const activeLoans: EmployeeLoan[] = useMemo(() => {
    const all = loansData?.results ?? [];
    // Mirror _populate_loan_deduction: include loans that have started by this month/year
    return all.filter(loan => {
      if (loan.start_year < form.year) return true;
      if (loan.start_year === form.year && loan.start_month <= form.month) return true;
      return false;
    });
  }, [loansData?.results, form.year, form.month]);

  const loanTotal = activeLoans.reduce((s, loan) => {
    const due = Math.min(toDec(loan.installment_amount), toDec(loan.remaining_balance));
    return s + Math.max(0, due);
  }, 0);

  // Approved leave encashments — EARNING, adds to gross
  const { data: encData, isLoading: encLoading } = useQuery({
    queryKey: ['enc-preview', form.employeeId, form.month, form.year],
    queryFn:  () => hrLeaveEncashmentsApi.getAll({
      employee:  form.employeeId!,
      month:     form.month,
      year:      form.year,
      status:    'approved',
      page_size: 50,
    }),
    enabled:   previewReady,
    staleTime: 30_000,
  });

  const approvedEncashments: LeaveEncashment[] = encData?.results ?? [];
  const encashmentTotal = approvedEncashments.reduce((s, e) => s + toDec(e.encashment_amount), 0);

  // Live gross & net (mirrors backend calculate_net exactly — encashment is part of gross)
  const componentSum = toDec(form.basic_salary)
    + toDec(form.housing_allowance)
    + toDec(form.transport_allowance)
    + toDec(form.other_allowances)
    + toDec(form.overtime_amount);

  const gross = componentSum + encashmentTotal;  // leave_encashment is an EARNING

  const netPreview = gross
    - toDec(form.deductions)
    - toDec(form.absence_deduction)
    - penaltyTotal
    - loanTotal;

  // Field helpers
  const handleEmployeeChange = (value: string | number | null) => {
    const id = value as number | null;
    const emp = id ? employeeMap.get(id) : null;
    setForm(f => ({
      ...f,
      employeeId:          id,
      basic_salary:        emp?.basic_salary      ?? '0.00',
      housing_allowance:   emp?.housing_allowance  ?? '0.00',
      transport_allowance: emp?.transport_allowance ?? '0.00',
      other_allowances:    emp?.other_allowances   ?? '0.00',
    }));
  };

  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));

  const setNum = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: parseInt(e.target.value) }));

  // Submit
  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => hrPayrollApi.create(payload as any),
    onSuccess: () => {
      toast('Payroll record generated', 'success');
      queryClient.invalidateQueries({ queryKey: ['hr-payroll'] });
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      const msg = data?.detail
        ?? data?.non_field_errors?.[0]
        ?? (data && typeof data === 'object' ? Object.values(data).flat().join(' ') : null)
        ?? 'Failed to generate payroll';
      toast(String(msg), 'error');
    },
  });

  const handleSubmit = () => {
    if (!form.employeeId)        { toast('Please select an employee', 'error'); return; }
    if (!form.month || !form.year) { toast('Please select a period', 'error'); return; }
    if (toDec(form.basic_salary) <= 0) { toast('Basic salary must be greater than 0', 'error'); return; }

    createMutation.mutate({
      employee:            form.employeeId,
      month:               form.month,
      year:                form.year,
      basic_salary:        form.basic_salary,
      housing_allowance:   form.housing_allowance,
      transport_allowance: form.transport_allowance,
      other_allowances:    form.other_allowances,
      overtime_amount:     form.overtime_amount,
      deductions:          form.deductions,
      absence_deduction:   form.absence_deduction,
      working_days:        parseInt(form.working_days) || 0,
      present_days:        parseInt(form.present_days) || 0,
      absent_days:         parseInt(form.absent_days)  || 0,
      leave_days:          parseInt(form.leave_days)   || 0,
      net_salary:          Math.max(0, netPreview).toFixed(2),
      notes:               form.notes,
      status:              'draft',
    });
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Payroll"
      size="lg"
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={createMutation.isPending}
            disabled={!form.employeeId}
          >
            Generate
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxHeight: '68vh', overflowY: 'auto', paddingRight: 2 }}>

        {/* ── Employee & Period ── */}
        <div>
          <p style={SECTION}>Employee &amp; Period</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>
                Employee <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <SearchableDropdown
                options={employeeOptions}
                value={form.employeeId}
                onChange={handleEmployeeChange}
                placeholder={empLoading ? 'Loading employees…' : 'Search by name or ID…'}
                searchPlaceholder="Type to search…"
                allowClear
                emptyMessage="No employees found"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <label style={LABEL}>Month <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <select value={form.month} onChange={setNum('month')} style={INPUT}>
                  {MONTH_NAMES.slice(1).map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={LABEL}>Year <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <select value={form.year} onChange={setNum('year')} style={INPUT}>
                  {YEAR_OPTIONS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Earnings ── */}
        <div>
          <p style={SECTION}>Earnings</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            {([
              ['basic_salary',       'Basic Salary', true],
              ['housing_allowance',  'Housing Allowance', false],
              ['transport_allowance','Transport Allowance', false],
              ['other_allowances',   'Other Allowances', false],
              ['overtime_amount',    'Overtime Amount', false],
            ] as [keyof FormState, string, boolean][]).map(([key, label, required]) => (
              <div key={key}>
                <label style={LABEL}>
                  {label}
                  {required && <span style={{ color: 'var(--color-error)' }}> *</span>}
                </label>
                <input
                  type="number" min="0" step="0.01"
                  value={form[key] as string}
                  onChange={set(key)}
                  style={INPUT}
                />
              </div>
            ))}

            {/* Leave Encashment — EARNING, auto-filled from approved encashments */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL}>
                Leave Encashment
                <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                  — auto-filled from approved encashments on save (EARNING)
                </span>
              </label>
              <div style={{
                ...READONLY,
                color: encashmentTotal > 0 ? 'var(--color-success)' : 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono, monospace)',
              }}>
                {encLoading && previewReady
                  ? 'Checking approved encashments…'
                  : encashmentTotal > 0
                    ? `+AED ${fmtNum(encashmentTotal)}`
                    : '— no approved encashments this period'
                }
              </div>
              {approvedEncashments.length > 0 && (
                <div style={{
                  marginTop: 6,
                  borderLeft: '2px solid var(--border-subtle)', paddingLeft: 10,
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  {approvedEncashments.map(e => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', gap: 8 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {e.leave_type === 'annual_leave' ? 'Annual Leave' : 'Sick Leave'}
                        <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>
                          · {e.days_encashed} days × AED {parseFloat(e.rate_per_day).toFixed(4)}/day
                        </span>
                      </span>
                      <span style={{ color: 'var(--color-success)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        +AED {fmtNum(e.encashment_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={LABEL}>Gross (computed)</label>
              <div style={{ ...READONLY, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)' }}>
                AED {fmtNum(gross)}
              </div>
            </div>
          </div>
        </div>

        {/* ── Deductions ── */}
        <div>
          <p style={SECTION}>Deductions</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <label style={LABEL}>General Deductions</label>
                <input type="number" min="0" step="0.01"
                  value={form.deductions}
                  onChange={set('deductions')}
                  style={INPUT}
                />
              </div>
              <div>
                <label style={LABEL}>Absence Deduction</label>
                <input type="number" min="0" step="0.01"
                  value={form.absence_deduction}
                  onChange={set('absence_deduction')}
                  style={INPUT}
                />
              </div>
            </div>

            {/* Penalty preview — read-only, auto-filled by server on save */}
            <div>
              <label style={LABEL}>
                Penalty Deduction
                <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                  — auto-filled from confirmed penalties on save
                </span>
              </label>
              <div style={{
                ...READONLY,
                color: penaltyTotal > 0 ? 'var(--color-error)' : 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono, monospace)',
              }}>
                {penaltyLoading && previewReady
                  ? 'Checking confirmed penalties…'
                  : penaltyTotal > 0
                    ? `AED ${fmtNum(penaltyTotal)}`
                    : '— no confirmed penalties this period'
                }
              </div>

              {confirmedPenalties.length > 0 && (
                <div style={{
                  marginTop: 6,
                  borderLeft: '2px solid var(--border-subtle)',
                  paddingLeft: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                  {confirmedPenalties.map(p => (
                    <div key={p.id} style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 'var(--text-xs)', gap: 8,
                    }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {p.attendance_date}
                        {p.rule_name  && <> · {p.rule_name}</>}
                        {p.tier_label && <> · {p.tier_label}</>}
                        <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>
                          ({p.minutes_evaluated} min late)
                        </span>
                      </span>
                      <span style={{ color: 'var(--color-error)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        -AED {fmtNum(p.penalty_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Loan deductions preview — read-only, auto-filled from active loans on save */}
            <div>
              <label style={LABEL}>
                Loan Deductions
                <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                  — auto-filled from active loans on save
                </span>
              </label>
              <div style={{
                ...READONLY,
                color: loanTotal > 0 ? 'var(--color-error)' : 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono, monospace)',
              }}>
                {loansLoading && previewReady
                  ? 'Checking active loans…'
                  : loanTotal > 0
                    ? `AED ${fmtNum(loanTotal)}`
                    : '— no active loans this period'
                }
              </div>

              {activeLoans.length > 0 && (
                <div style={{
                  marginTop: 6,
                  borderLeft: '2px solid var(--border-subtle)',
                  paddingLeft: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                  {activeLoans.map(loan => {
                    const due = Math.min(toDec(loan.installment_amount), toDec(loan.remaining_balance));
                    return (
                      <div key={loan.id} style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: 'var(--text-xs)', gap: 8,
                      }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {loan.notes || `Loan #${loan.id}`}
                          <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>
                            · remaining AED {fmtNum(loan.remaining_balance)}
                          </span>
                        </span>
                        <span style={{ color: 'var(--color-error)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          -AED {fmtNum(due)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Attendance Days ── */}
        <div>
          <p style={SECTION}>
            Attendance Days
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> — optional, for reporting</span>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
            {([
              ['working_days', 'Working Days'],
              ['present_days', 'Present'],
              ['absent_days',  'Absent'],
              ['leave_days',   'Leave'],
            ] as [keyof FormState, string][]).map(([key, label]) => (
              <div key={key}>
                <label style={LABEL}>{label}</label>
                <input
                  type="number" min="0" step="1"
                  value={form[key] as string}
                  onChange={set(key)}
                  style={INPUT}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Notes ── */}
        <div>
          <label style={LABEL}>
            Notes
            <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 6 }}>optional</span>
          </label>
          <textarea
            value={form.notes}
            onChange={set('notes')}
            rows={2}
            placeholder="e.g. includes bonus, overtime verified by site manager…"
            style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        {/* ── Net Preview ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--sidebar-active-bg)',
          color: 'var(--sidebar-active-text)',
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600 }}>Net Salary Preview</p>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', opacity: 0.75, marginTop: 2 }}>
              Gross AED {fmtNum(gross)}
              {encashmentTotal > 0 && ` (incl. encashment +AED ${fmtNum(encashmentTotal)})`}
              {toDec(form.deductions) > 0 && ` − ded. AED ${fmtNum(form.deductions)}`}
              {toDec(form.absence_deduction) > 0 && ` − abs. AED ${fmtNum(form.absence_deduction)}`}
              {penaltyTotal > 0 && ` − penalties AED ${fmtNum(penaltyTotal)}`}
              {loanTotal > 0 && ` − loans AED ${fmtNum(loanTotal)}`}
            </p>
          </div>
          <p style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 700 }}>
            AED {fmtNum(Math.max(0, netPreview))}
          </p>
        </div>

      </div>
    </BaseModal>
  );
}
