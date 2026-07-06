'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { hrLeavePoliciesApi, hrEmployeeGroupsApi, hrRequestsApi, type AccrualResult } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { Button, Badge } from '@/components/ui';
import { useTableState } from '@/lib/hooks/use-table-state';
import { AppListPage } from '@/components/app/AppListPage';
import { type Column } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { BaseModal } from '@/components/ui/base/BaseModal';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import DateInput from '@/components/ui/DateInput';
import type { LeavePolicy, EmployeeGroup, HRLeaveBalance } from '@/types';
import { MONTH_NAMES } from '@/lib/utils/hr';

// ── Constants ─────────────────────────────────────────────────────────────────

const NOW_MONTH = new Date().getMonth() + 1;
const NOW_YEAR  = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => NOW_YEAR - i);

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual_leave:    'Annual Leave',
  sick_leave:      'Sick Leave',
  emergency_leave: 'Emergency Leave',
  unpaid_leave:    'Unpaid Leave',
};

const LEAVE_TYPE_VARIANT: Record<string, 'success' | 'info'> = {
  annual_leave: 'success',
  sick_leave:   'info',
};

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', padding: '7px 10px',
  borderRadius: 'var(--radius-md)', border: '1px solid var(--input-border)',
  background: 'var(--input-bg)', color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)', outline: 'none', boxSizing: 'border-box',
};

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600,
  color: 'var(--text-secondary)', marginBottom: 4,
};

const SECTION: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px 0',
};

// ── Policy form ───────────────────────────────────────────────────────────────

interface PolicyForm {
  employee_group:          number | null;
  leave_type:              string;
  annual_entitlement_days: string;
  monthly_accrual_days:    string;
  max_accrual_days:        string;
  accrual_start_month:     number;
  effective_from:          string;
  encashment_rate_base:    string;
  encashment_rate_divisor: string;
  is_active:               boolean;
}

const today = new Date().toISOString().slice(0, 10);

const EMPTY_FORM: PolicyForm = {
  employee_group:          null,
  leave_type:              'annual_leave',
  annual_entitlement_days: '30',
  monthly_accrual_days:    '2.50',
  max_accrual_days:        '60',
  accrual_start_month:     1,
  effective_from:          today,
  encashment_rate_base:    'basic',
  encashment_rate_divisor: '30',
  is_active:               true,
};

function policyToForm(p: LeavePolicy): PolicyForm {
  return {
    employee_group:          p.employee_group,
    leave_type:              p.leave_type,
    annual_entitlement_days: p.annual_entitlement_days,
    monthly_accrual_days:    p.monthly_accrual_days,
    max_accrual_days:        p.max_accrual_days,
    accrual_start_month:     p.accrual_start_month,
    effective_from:          p.effective_from,
    encashment_rate_base:    p.encashment_rate_base,
    encashment_rate_divisor: p.encashment_rate_divisor,
    is_active:               p.is_active,
  };
}

// ── Policy Modal ──────────────────────────────────────────────────────────────

function PolicyModal({
  isOpen, onClose, onSuccess, editing,
  groups,
}: {
  isOpen: boolean; onClose: () => void; onSuccess: () => void;
  editing: LeavePolicy | null; groups: EmployeeGroup[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PolicyForm>(EMPTY_FORM);

  useEffect(() => {
    if (isOpen) setForm(editing ? policyToForm(editing) : EMPTY_FORM);
  }, [isOpen, editing]);

  const set = (key: keyof PolicyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));

  const setNum = (key: keyof PolicyForm) =>
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: parseInt(e.target.value) }));

  const groupOptions = useMemo(() => [
    { value: '__catchall__', label: 'Any category (catch-all)', searchText: 'any catch-all' },
    ...groups.map(g => ({ value: g.id, label: `${g.name} (${g.code})`, searchText: `${g.name} ${g.code}` })),
  ], [groups]);

  const createMut = useMutation({
    mutationFn: (data: Partial<LeavePolicy>) => hrLeavePoliciesApi.create(data),
    onSuccess: () => { toast('Leave policy created', 'success'); queryClient.invalidateQueries({ queryKey: ['leave-policies'] }); onSuccess(); onClose(); },
    onError: (e: unknown) => {
      const d = (e as { response?: { data?: Record<string, unknown> } })?.response?.data;
      toast((d?.detail as string | undefined) ?? Object.values(d ?? {}).flat().join(' ') ?? 'Failed', 'error');
    },
  });

  const updateMut = useMutation({
    mutationFn: (data: Partial<LeavePolicy>) => hrLeavePoliciesApi.update(editing!.id, data),
    onSuccess: () => { toast('Leave policy updated', 'success'); queryClient.invalidateQueries({ queryKey: ['leave-policies'] }); onSuccess(); onClose(); },
    onError: (e: unknown) => {
      const d = (e as { response?: { data?: Record<string, unknown> } })?.response?.data;
      toast((d?.detail as string | undefined) ?? Object.values(d ?? {}).flat().join(' ') ?? 'Failed', 'error');
    },
  });

  const isPending = createMut.isPending || updateMut.isPending;

  const handleSubmit = () => {
    const payload: Partial<LeavePolicy> = {
      employee_group:          form.employee_group,
      leave_type:              form.leave_type as LeavePolicy['leave_type'],
      annual_entitlement_days: form.annual_entitlement_days,
      monthly_accrual_days:    form.monthly_accrual_days,
      max_accrual_days:        form.max_accrual_days,
      accrual_start_month:     form.accrual_start_month,
      effective_from:          form.effective_from,
      encashment_rate_base:    form.encashment_rate_base as LeavePolicy['encashment_rate_base'],
      encashment_rate_divisor: form.encashment_rate_divisor,
      is_active:               form.is_active,
    };
    editing ? updateMut.mutate(payload) : createMut.mutate(payload);
  };

  return (
    <BaseModal
      isOpen={isOpen} onClose={onClose}
      title={editing ? 'Edit Leave Policy' : 'New Leave Policy'}
      size="lg"
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isPending}>
            {editing ? 'Save Changes' : 'Create Policy'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxHeight: '65vh', overflowY: 'auto', paddingRight: 2 }}>

        {/* Group & Type */}
        <div>
          <p style={SECTION}>Scope</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL}>Employee Category</label>
              <SearchableDropdown
                options={groupOptions}
                value={form.employee_group ?? '__catchall__'}
                onChange={v => setForm(f => ({ ...f, employee_group: v === '__catchall__' ? null : v as number }))}
                placeholder="Any category (catch-all)"
                allowClear={false}
                onCreateOption={async (label) => {
                  const code = label.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 20);
                  const g = await hrEmployeeGroupsApi.create({ name: label, name_ar: '', code, description: '', is_active: true });
                  queryClient.invalidateQueries({ queryKey: ['hr-employee-groups'] });
                  return { value: g.id, label: `${g.name} (${g.code})` };
                }}
              />
              <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                {'"'}Any category{'"'} is the catch-all fallback used when no category-specific policy matches.
              </p>
            </div>
            <div>
              <label style={LABEL}>Leave Type <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <select value={form.leave_type} onChange={set('leave_type')} style={INPUT}>
                <option value="annual_leave">Annual Leave</option>
                <option value="sick_leave">Sick Leave</option>
              </select>
            </div>
            <div>
              <label style={LABEL}>Effective From <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <DateInput value={form.effective_from} onChange={(v) => setForm(f => ({ ...f, effective_from: v }))} style={INPUT} />
            </div>
          </div>
        </div>

        {/* Accrual */}
        <div>
          <p style={SECTION}>Accrual</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>Annual Entitlement (days) <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input type="number" min="0.01" step="0.5" value={form.annual_entitlement_days} onChange={set('annual_entitlement_days')} style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Monthly Accrual (days) <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input type="number" min="0.01" step="0.01" value={form.monthly_accrual_days} onChange={set('monthly_accrual_days')} style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Max Accrual Cap (days) <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input type="number" min="0.01" step="0.5" value={form.max_accrual_days} onChange={set('max_accrual_days')} style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Accrual Starts (month)</label>
              <select value={form.accrual_start_month} onChange={setNum('accrual_start_month')} style={INPUT}>
                {MONTH_NAMES.slice(1).map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Encashment Rate */}
        <div>
          <p style={SECTION}>Encashment Rate</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>Rate Base</label>
              <select value={form.encashment_rate_base} onChange={set('encashment_rate_base')} style={INPUT}>
                <option value="basic">Basic Salary only</option>
                <option value="total">Total Salary (basic + allowances)</option>
              </select>
            </div>
            <div>
              <label style={LABEL}>Divisor</label>
              <input type="number" min="1" step="1" value={form.encashment_rate_divisor} onChange={set('encashment_rate_divisor')} style={INPUT} />
              <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                Rate/day = salary ÷ divisor. Use 30 (calendar) or 26 (working days).
              </p>
            </div>
          </div>
        </div>

        {/* Active */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
            />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
              Active — inactive policies are ignored by the accrual engine
            </span>
          </label>
        </div>

      </div>
    </BaseModal>
  );
}

// ── Accrual Panel ─────────────────────────────────────────────────────────────

function AccrualPanel() {
  const [month,  setMonth]  = useState(NOW_MONTH);
  const [year,   setYear]   = useState(NOW_YEAR);
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<AccrualResult | null>(null);
  const [expanded, setExpanded] = useState(false);

  const runMut = useMutation({
    mutationFn: () => hrLeavePoliciesApi.accrueLeave({ month, year, dry_run: dryRun }),
    onSuccess: (data) => {
      setResult(data);
      setExpanded(true);
      toast(
        data.dry_run
          ? `Dry run: ${data.accrued} employees would accrue leave`
          : `Accrual complete: ${data.accrued} employees updated`,
        'success',
      );
    },
    onError: (e: unknown) => toast((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Accrual failed', 'error'),
  });

  const STATUS_COLOR: Record<string, string> = {
    accrued:      'var(--color-success)',
    would_accrue: 'var(--color-info, var(--color-primary))',
    no_policy:    'var(--color-error)',
    already_run:  'var(--text-tertiary)',
  };

  return (
    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>Monthly Accrual Engine</p>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Runs for all active employees — idempotent, safe to re-run.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <select
            value={month} onChange={e => { setMonth(parseInt(e.target.value)); setResult(null); }}
            style={{ ...INPUT, width: 'auto', minWidth: 130 }}
          >
            {MONTH_NAMES.slice(1).map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={year} onChange={e => { setYear(parseInt(e.target.value)); setResult(null); }}
            style={{ ...INPUT, width: 'auto', minWidth: 80 }}
          >
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={dryRun} onChange={e => { setDryRun(e.target.checked); setResult(null); }} />
            Dry run (preview only)
          </label>
          <Button
            variant={dryRun ? 'ghost' : 'primary'}
            size="sm"
            onClick={() => runMut.mutate()}
            isLoading={runMut.isPending}
          >
            {dryRun ? 'Preview Accrual' : 'Run Accrual'}
          </Button>
        </div>
      </div>

      {result && (
        <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
          {/* Summary chips */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
            {[
              { label: result.dry_run ? 'Would accrue' : 'Accrued', value: result.accrued, color: 'var(--color-success)' },
              { label: 'No policy', value: result.skipped_no_policy, color: 'var(--color-error)' },
              { label: 'Already run', value: result.skipped_already_run, color: 'var(--text-tertiary)' },
            ].map(chip => (
              <div key={chip.label} style={{
                padding: '4px 12px', borderRadius: 'var(--radius-full)',
                background: 'var(--surface-subtle)', fontSize: 'var(--text-xs)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontWeight: 700, color: chip.color }}>{chip.value}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{chip.label}</span>
              </div>
            ))}
            {result.details.length > 0 && (
              <button
                onClick={() => setExpanded(o => !o)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', color: 'var(--color-primary)' }}
              >
                {expanded ? 'Hide details' : 'Show details'}
              </button>
            )}
          </div>

          {/* Details table */}
          {expanded && result.details.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Employee', 'Leave Type', 'Status', 'Days Added', 'Balance After'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-tertiary)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.details.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '4px 8px', color: 'var(--text-primary)' }}>{row.employee_id}</td>
                      <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{LEAVE_TYPE_LABELS[row.leave_type] ?? row.leave_type}</td>
                      <td style={{ padding: '4px 8px' }}>
                        <span style={{ color: STATUS_COLOR[row.status] ?? 'var(--text-secondary)', fontWeight: 600 }}>
                          {row.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '4px 8px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)' }}>
                        {row.days_added ?? '—'}
                      </td>
                      <td style={{ padding: '4px 8px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)' }}>
                        {row.balance_after ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Leave Balances Panel ──────────────────────────────────────────────────────

const LEAVE_TYPE_COLOR: Record<string, { color: string; bg: string }> = {
  annual_leave:    { color: 'var(--color-success)',           bg: 'var(--status-success-bg)' },
  sick_leave:      { color: 'var(--color-info, var(--brand))', bg: 'var(--brand-subtle)' },
  emergency_leave: { color: 'var(--color-warning, #b45309)',  bg: 'var(--status-warning-bg)' },
  unpaid_leave:    { color: 'var(--text-tertiary)',           bg: 'var(--surface-subtle)' },
};

function LeaveBalancesPanel() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const YEARS = Array.from({ length: 3 }, (_, i) => currentYear - i);

  const { data, isLoading } = useQuery({
    queryKey: ['leave-balances', year],
    queryFn:  () => hrRequestsApi.getLeaveBalances({ year }),
    staleTime: 60_000,
  });

  const balances = data?.results ?? [];

  // Group by employee_name
  const grouped = useMemo(() => {
    const map = new Map<number, { name: string; balances: HRLeaveBalance[] }>();
    for (const b of balances) {
      if (!map.has(b.employee)) map.set(b.employee, { name: b.employee_name, balances: [] });
      map.get(b.employee)!.balances.push(b);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [balances]);

  return (
    <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>Leave Balances</p>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Current balances per employee — updated by the accrual engine and approved requests.
          </p>
        </div>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...INPUT, width: 'auto', minWidth: 80, height: 32 }}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {isLoading ? (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--space-4)' }}>Loading…</p>
      ) : grouped.length === 0 ? (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--space-4)' }}>
          No leave balances recorded for {year}. Run the accrual engine to generate them.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Employee', 'Leave Type', 'Total', 'Used', 'Pending', 'Remaining'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-tertiary)', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.flatMap(g =>
                g.balances.map((b, bi) => {
                  const remaining = parseFloat(b.remaining_days);
                  const total     = parseFloat(b.total_days);
                  const pct       = total > 0 ? Math.min(100, Math.round((remaining / total) * 100)) : 0;
                  const lc        = LEAVE_TYPE_COLOR[b.leave_type] ?? LEAVE_TYPE_COLOR.unpaid_leave;
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {bi === 0 && (
                        <td rowSpan={g.balances.length} style={{ padding: '6px 8px', verticalAlign: 'top', fontWeight: 600, color: 'var(--text-primary)', borderRight: '1px solid var(--border-subtle)' }}>
                          {g.name}
                        </td>
                      )}
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: lc.color, background: lc.bg }}>
                          {LEAVE_TYPE_LABELS[b.leave_type] ?? b.leave_type}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{b.total_days}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{b.used_days}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>{b.pending_days}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: remaining > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                            {b.remaining_days}
                          </span>
                          <div style={{ flex: 1, minWidth: 48, height: 5, background: 'var(--border-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: remaining > 5 ? 'var(--color-success)' : remaining > 0 ? 'var(--color-warning, #f59e0b)' : 'var(--color-error)', borderRadius: 3, transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeavePoliciesPage() {
  const tableState = useTableState();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasPermission } = useMyPermissions();
  const router = useRouter();
  const isAdmin = hasPermission('hr.hr_leave.view');

  const [showModal,  setShowModal]  = useState(false);
  const [editTarget, setEditTarget] = useState<LeavePolicy | null>(null);

  const { data: policyData, isLoading, error } = useQuery({
    queryKey: ['leave-policies'],
    queryFn:  () => hrLeavePoliciesApi.getAll(),
  });

  const { data: groupData } = useQuery({
    queryKey: ['hr-employee-groups'],
    queryFn:  () => hrEmployeeGroupsApi.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  const groups  = groupData?.results ?? [];
  const all     = policyData?.results ?? [];
  const { search } = tableState;

  const filtered = useMemo(() => {
    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter(p =>
      (p.employee_group_name ?? 'any group').toLowerCase().includes(q) ||
      (LEAVE_TYPE_LABELS[p.leave_type] ?? p.leave_type).toLowerCase().includes(q)
    );
  }, [all, search]);

  const deleteMut = useMutation({
    mutationFn: (id: number) => hrLeavePoliciesApi.delete(id),
    onSuccess: () => { toast('Policy deleted', 'success'); queryClient.invalidateQueries({ queryKey: ['leave-policies'] }); },
    onError:   () => toast('Delete failed', 'error'),
  });

  useEffect(() => {
    if (user && !isAdmin) router.replace('/');
  }, [user, isAdmin, router]);
  if (user && !isAdmin) return null;

  const handleDelete = async (policy: LeavePolicy) => {
    const ok = await confirm(`Delete policy for ${LEAVE_TYPE_LABELS[policy.leave_type]} — ${policy.employee_group_name ?? 'Any category'}?`);
    if (ok) deleteMut.mutate(policy.id);
  };

  const handleEdit = (policy: LeavePolicy) => {
    setEditTarget(policy);
    setShowModal(true);
  };

  const columns: Column<LeavePolicy>[] = [
    {
      key:    'employee_group_name',
      header: 'Category',
      render: (p) => (
        <span style={{ fontSize: 'var(--text-sm)', color: p.employee_group_name ? 'var(--text-primary)' : 'var(--text-tertiary)', fontStyle: p.employee_group_name ? 'normal' : 'italic' }}>
          {p.employee_group_name ?? 'Any category (catch-all)'}
        </span>
      ),
    },
    {
      key:    'leave_type',
      header: 'Leave Type',
      render: (p) => (
        <Badge variant={LEAVE_TYPE_VARIANT[p.leave_type] ?? 'default'}>
          {LEAVE_TYPE_LABELS[p.leave_type] ?? p.leave_type}
        </Badge>
      ),
    },
    {
      key:    'annual_entitlement_days',
      header: 'Annual',
      render: (p) => <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--text-sm)' }}>{p.annual_entitlement_days} days</span>,
    },
    {
      key:    'monthly_accrual_days',
      header: 'Monthly',
      render: (p) => <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--text-sm)' }}>{p.monthly_accrual_days}/mo</span>,
    },
    {
      key:    'max_accrual_days',
      header: 'Cap',
      render: (p) => <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--text-sm)' }}>{p.max_accrual_days} days</span>,
    },
    {
      key:    'encashment_rate_base',
      header: 'Rate',
      render: (p) => (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
          {p.encashment_rate_base === 'total' ? 'Total' : 'Basic'} ÷ {p.encashment_rate_divisor}
        </span>
      ),
    },
    {
      key:    'is_active',
      header: 'Status',
      render: (p) => (
        <Badge variant={p.is_active ? 'success' : 'default'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key:    'actions',
      header: '',
      render: (p) => isAdmin ? (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => handleEdit(p) },
            { separator: true },
            { label: 'Delete', variant: 'danger', onClick: () => handleDelete(p) },
          ]}
        />
      ) : null,
    },
  ];

  return (
    <AppListPage
      title="Leave Policies"
      description="Configure annual entitlements, monthly accrual rates, and encashment rules per employee category."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'HR' }, { label: 'Leave Policies' }]}
      totalCount={all.length}
      createAction={
        isAdmin ? (
          <Button variant="primary" size="sm" onClick={() => { setEditTarget(null); setShowModal(true); }}>
            + New Policy
          </Button>
        ) : undefined
      }
      selectable={true}
      columns={columns}
      data={filtered}
      isLoading={isLoading}
      error={error}
      emptyTitle="No leave policies configured. Create one to enable accrual."
      searchPlaceholder="Search by category or leave type..."
      tableState={tableState}
    >
      {isAdmin && <AccrualPanel />}
      {isAdmin && <LeaveBalancesPanel />}

      <PolicyModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['leave-policies'] })}
        editing={editTarget}
        groups={groups}
      />
    </AppListPage>
  );
}
