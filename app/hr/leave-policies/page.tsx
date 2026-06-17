'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { hrLeavePoliciesApi, hrEmployeeGroupsApi, type AccrualResult } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { Button, Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import { useTableState } from '@/lib/hooks/use-table-state';
import { BaseModal } from '@/components/ui/base/BaseModal';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import type { LeavePolicy, EmployeeGroup } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const NOW_MONTH = new Date().getMonth() + 1;
const NOW_YEAR  = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => NOW_YEAR - i);

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual_leave: 'Annual Leave',
  sick_leave:   'Sick Leave',
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
    { value: '__catchall__', label: 'Any group (catch-all)', searchText: 'any catch-all' },
    ...groups.map(g => ({ value: g.id, label: `${g.name} (${g.code})`, searchText: `${g.name} ${g.code}` })),
  ], [groups]);

  const createMut = useMutation({
    mutationFn: (data: Partial<LeavePolicy>) => hrLeavePoliciesApi.create(data),
    onSuccess: () => { toast('Leave policy created', 'success'); queryClient.invalidateQueries({ queryKey: ['leave-policies'] }); onSuccess(); onClose(); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? Object.values(e?.response?.data ?? {}).flat().join(' ') ?? 'Failed', 'error'),
  });

  const updateMut = useMutation({
    mutationFn: (data: Partial<LeavePolicy>) => hrLeavePoliciesApi.update(editing!.id, data),
    onSuccess: () => { toast('Leave policy updated', 'success'); queryClient.invalidateQueries({ queryKey: ['leave-policies'] }); onSuccess(); onClose(); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? Object.values(e?.response?.data ?? {}).flat().join(' ') ?? 'Failed', 'error'),
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
              <label style={LABEL}>Employee Group</label>
              <SearchableDropdown
                options={groupOptions}
                value={form.employee_group ?? '__catchall__'}
                onChange={v => setForm(f => ({ ...f, employee_group: v === '__catchall__' ? null : v as number }))}
                placeholder="Any group (catch-all)"
                allowClear={false}
              />
              <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                "Any group" is the catch-all fallback used when no group-specific policy matches.
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
              <input type="date" value={form.effective_from} onChange={set('effective_from')} style={INPUT} />
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
    onError: (e: any) => toast(e?.response?.data?.detail ?? 'Accrual failed', 'error'),
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeavePoliciesPage() {
  const tableState = useTableState();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = !!(
    user?.role === 'admin' || user?.role === 'super_admin' ||
    user?.role === 'hr_manager' || user?.role === 'hr_secretary' ||
    user?.role === 'company_director' ||
    user?.is_staff || user?.is_superuser
  );

  const [showModal,  setShowModal]  = useState(false);
  const [editTarget, setEditTarget] = useState<LeavePolicy | null>(null);

  const { data: policyData, isLoading } = useQuery({
    queryKey: ['leave-policies'],
    queryFn:  () => hrLeavePoliciesApi.getAll(),
  });

  const { data: groupData } = useQuery({
    queryKey: ['hr-employee-groups'],
    queryFn:  () => hrEmployeeGroupsApi.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  const groups = groupData?.results ?? [];
  const policies = policyData?.results ?? [];

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
    const ok = await confirm(`Delete policy for ${LEAVE_TYPE_LABELS[policy.leave_type]} — ${policy.employee_group_name ?? 'Any group'}?`);
    if (ok) deleteMut.mutate(policy.id);
  };

  const handleEdit = (policy: LeavePolicy) => {
    setEditTarget(policy);
    setShowModal(true);
  };

  const columns: Column<LeavePolicy>[] = [
    {
      key:    'employee_group_name',
      header: 'Group',
      render: (p) => (
        <span style={{ fontSize: 'var(--text-sm)', color: p.employee_group_name ? 'var(--text-primary)' : 'var(--text-tertiary)', fontStyle: p.employee_group_name ? 'normal' : 'italic' }}>
          {p.employee_group_name ?? 'Any group (catch-all)'}
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
      header: 'Active',
      render: (p) => (
        <Badge variant={p.is_active ? 'success' : 'default'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key:    'actions',
      header: '',
      render: (p) => isAdmin ? (
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="ghost" size="sm" onClick={() => handleEdit(p)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(p)} style={{ color: 'var(--color-error)' }}>Delete</Button>
        </div>
      ) : null,
    },
  ];

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Leave Policies"
          description="Configure annual entitlements, monthly accrual rates, and encashment rules per employee group."
          breadcrumbs={[{ label: 'HR' }, { label: 'Leave Policies' }]}
          actions={
            isAdmin ? (
              <Button variant="primary" size="sm" onClick={() => { setEditTarget(null); setShowModal(true); }}>
                + New Policy
              </Button>
            ) : undefined
          }
        />

        {isAdmin && <AccrualPanel />}

        <TableShell
          tableState={tableState}
          columns={columns}
          data={policies}
          isLoading={isLoading}
          emptyMessage="No leave policies configured. Create one to enable accrual."
          totalCount={policyData?.count ?? 0}
        />

        <PolicyModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['leave-policies'] })}
          editing={editTarget}
          groups={groups}
        />
      </PageShell>
    </MainLayout>
  );
}
