'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { hrLeaveEncashmentsApi, hrLeavePoliciesApi, hrEmployeesApi, hrRequestsApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { Button, Badge, PageHeader, PageShell, TableShell, type Column } from '@/components/ui';
import { useTableState } from '@/lib/hooks/use-table-state';
import { BaseModal } from '@/components/ui/base/BaseModal';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import type { LeaveEncashment, HREmployee, LeavePolicy } from '@/types';

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

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  pending:   'warning',
  approved:  'success',
  rejected:  'error',
  cancelled: 'default',
};

const fmt = (v: string | number) =>
  `AED ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toDec = (s: string) => parseFloat(s) || 0;

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', padding: '7px 10px',
  borderRadius: 'var(--radius-md)', border: '1px solid var(--input-border)',
  background: 'var(--input-bg)', color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)', outline: 'none', boxSizing: 'border-box',
};

const READONLY: React.CSSProperties = {
  ...INPUT, background: 'var(--surface-subtle)', cursor: 'default',
};

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600,
  color: 'var(--text-secondary)', marginBottom: 4,
};

const SECTION: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px 0',
};

// ── New Encashment Modal ───────────────────────────────────────────────────────

interface EncForm {
  employeeId: number | null;
  leave_type: string;
  days_encashed: string;
  month: number;
  year:  number;
  notes: string;
}

const EMPTY: EncForm = {
  employeeId:    null,
  leave_type:    'annual_leave',
  days_encashed: '',
  month:         NOW_MONTH,
  year:          NOW_YEAR,
  notes:         '',
};

function NewEncashmentModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EncForm>(EMPTY);

  useEffect(() => { if (isOpen) setForm(EMPTY); }, [isOpen]);

  // Employees
  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: ['hr-employees-enc-picker'],
    queryFn:  () => hrEmployeesApi.getAll(),
    enabled:  isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const employees: HREmployee[] = empData?.results ?? [];
  const empMap = useMemo(() => {
    const m = new Map<number, HREmployee>();
    employees.forEach(e => m.set(e.id, e));
    return m;
  }, [employees]);

  const empOptions = useMemo(() =>
    employees.map(e => ({ value: e.id, label: `${e.full_name} (${e.employee_id})`, searchText: `${e.full_name} ${e.employee_id}` })),
    [employees],
  );

  // Selected employee
  const selectedEmp = form.employeeId ? empMap.get(form.employeeId) : null;

  // Leave balance — for "remaining days" validation hint
  const balanceEnabled = !!form.employeeId && !!form.year;
  const { data: balData } = useQuery({
    queryKey: ['leave-balance-enc', form.employeeId, form.year, form.leave_type],
    queryFn:  () => hrRequestsApi.getLeaveBalances({ employee: form.employeeId!, year: form.year }),
    enabled:  balanceEnabled,
    staleTime: 30_000,
  });

  const balance = (balData?.results ?? []).find(b => b.leave_type === form.leave_type);
  const remaining = balance ? toDec(balance.remaining_days) : null;

  // Policy — to compute rate preview client-side
  const { data: policyData } = useQuery({
    queryKey: ['leave-policies-for-enc', form.leave_type, selectedEmp?.employee_group],
    queryFn:  async () => {
      const r = await hrLeavePoliciesApi.getAll({ leave_type: form.leave_type });
      const policies = r.results;
      const groupId = selectedEmp?.employee_group ?? null;
      // Mirror backend two-pass: group-specific first, catch-all fallback
      const groupMatch = groupId ? policies.find(p => p.employee_group === groupId && p.is_active) : null;
      return groupMatch ?? policies.find(p => p.employee_group === null && p.is_active) ?? null;
    },
    enabled:  !!form.leave_type && !!selectedEmp,
    staleTime: 60_000,
  });

  const policy: LeavePolicy | null | undefined = policyData;

  // Rate preview
  const ratePerDay = useMemo(() => {
    if (!policy || !selectedEmp) return null;
    const basic  = toDec(selectedEmp.basic_salary);
    const salary = policy.encashment_rate_base === 'total'
      ? basic + toDec(selectedEmp.housing_allowance) + toDec(selectedEmp.transport_allowance) + toDec(selectedEmp.other_allowances)
      : basic;
    return salary / toDec(policy.encashment_rate_divisor);
  }, [policy, selectedEmp]);

  const days = toDec(form.days_encashed);
  const encAmount = ratePerDay !== null && days > 0 ? days * ratePerDay : null;

  // Validation
  const daysErr = remaining !== null && days > 0 && days > remaining
    ? `Cannot encash ${days} days — only ${remaining} days remain`
    : null;

  // Submit
  const createMut = useMutation({
    mutationFn: (payload: Partial<LeaveEncashment>) => hrLeaveEncashmentsApi.create(payload),
    onSuccess: () => {
      toast('Encashment request created', 'success');
      queryClient.invalidateQueries({ queryKey: ['leave-encashments'] });
      onSuccess();
      onClose();
    },
    onError: (e: any) => {
      const data = e?.response?.data;
      const msg = data?.detail ?? data?.non_field_errors?.[0]
        ?? (data && typeof data === 'object' ? Object.values(data).flat().join(' ') : null)
        ?? 'Failed to create encashment';
      toast(String(msg), 'error');
    },
  });

  const handleSubmit = () => {
    if (!form.employeeId) { toast('Please select an employee', 'error'); return; }
    if (!form.days_encashed || days <= 0) { toast('Days must be greater than 0', 'error'); return; }
    if (daysErr) { toast(daysErr, 'error'); return; }
    createMut.mutate({
      employee:      form.employeeId,
      leave_type:    form.leave_type as LeaveEncashment['leave_type'],
      days_encashed: form.days_encashed,
      month:         form.month,
      year:          form.year,
      notes:         form.notes,
    });
  };

  const set = (key: keyof EncForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));

  const setNum = (key: keyof EncForm) =>
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: parseInt(e.target.value) }));

  return (
    <BaseModal
      isOpen={isOpen} onClose={onClose}
      title="New Leave Encashment"
      size="lg"
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={createMut.isPending}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={createMut.isPending} disabled={!!daysErr}>
            Create Request
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxHeight: '65vh', overflowY: 'auto', paddingRight: 2 }}>

        {/* Employee & Type */}
        <div>
          <p style={SECTION}>Employee &amp; Leave Type</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>Employee <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <SearchableDropdown
                options={empOptions}
                value={form.employeeId}
                onChange={v => setForm(f => ({ ...f, employeeId: v as number | null }))}
                placeholder={empLoading ? 'Loading…' : 'Search by name or ID…'}
                allowClear
                emptyMessage="No employees found"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <label style={LABEL}>Leave Type <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <select value={form.leave_type} onChange={set('leave_type')} style={INPUT}>
                  <option value="annual_leave">Annual Leave</option>
                  <option value="sick_leave">Sick Leave</option>
                </select>
              </div>
              <div>
                <label style={LABEL}>Remaining Balance</label>
                <div style={{
                  ...READONLY,
                  color: remaining !== null ? (remaining > 0 ? 'var(--color-success)' : 'var(--color-error)') : 'var(--text-tertiary)',
                }}>
                  {!form.employeeId ? '— select employee' : remaining === null ? 'Checking…' : `${remaining} days`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Days & Period */}
        <div>
          <p style={SECTION}>Days &amp; Period</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>Days to Encash <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                type="number" min="0.01" step="0.5"
                value={form.days_encashed}
                onChange={set('days_encashed')}
                style={{ ...INPUT, borderColor: daysErr ? 'var(--color-error)' : undefined }}
              />
              {daysErr && (
                <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-error)' }}>{daysErr}</p>
              )}
            </div>
            <div>
              <label style={LABEL}>Month</label>
              <select value={form.month} onChange={setNum('month')} style={INPUT}>
                {MONTH_NAMES.slice(1).map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={LABEL}>Year</label>
              <select value={form.year} onChange={setNum('year')} style={INPUT}>
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Rate Preview */}
        {selectedEmp && (
          <div style={{
            padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
            background: 'var(--surface-subtle)', fontSize: 'var(--text-sm)',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <p style={{ margin: 0, fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Rate Preview
            </p>
            {policy === undefined ? (
              <p style={{ margin: 0, color: 'var(--text-tertiary)' }}>Loading policy…</p>
            ) : policy === null ? (
              <p style={{ margin: 0, color: 'var(--color-error)' }}>No active leave policy found — cannot compute rate.</p>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Rate base</span>
                  <span>{policy.encashment_rate_base === 'total' ? 'Total salary' : 'Basic salary'} ÷ {policy.encashment_rate_divisor}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Rate / day</span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                    {ratePerDay !== null ? `AED ${ratePerDay.toFixed(4)}` : '—'}
                  </span>
                </div>
                {encAmount !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 6, fontWeight: 'var(--weight-semibold)' }}>
                    <span>Encashment Amount</span>
                    <span style={{ color: 'var(--color-success)', fontFamily: 'var(--font-mono, monospace)' }}>
                      {fmt(encAmount.toFixed(2))}
                    </span>
                  </div>
                )}
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                  Rate is frozen at creation — future policy changes won't affect this record.
                </p>
              </>
            )}
          </div>
        )}

        {/* Notes */}
        <div>
          <label style={LABEL}>Notes <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>optional</span></label>
          <textarea
            rows={2} value={form.notes} onChange={set('notes')}
            placeholder="e.g. approved by GM, covers June encashment…"
            style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

      </div>
    </BaseModal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeaveEncashmentsPage() {
  const tableState = useTableState();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const router = useRouter();
  const isAdmin = isTenantAdmin || isPlatformAdmin || ['hr_manager', 'hr_secretary', 'company_director'].includes(user?.role ?? '');

  const [showNew, setShowNew] = useState(false);

  // Filters
  const [filterStatus,    setFilterStatus]    = useState('');
  const [filterLeaveType, setFilterLeaveType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['leave-encashments', filterStatus, filterLeaveType],
    queryFn:  () => hrLeaveEncashmentsApi.getAll({
      status:     filterStatus     || undefined,
      leave_type: filterLeaveType  || undefined,
      page_size:  200,
    }),
  });

  const encashments = data?.results ?? [];

  // Workflow mutations
  const approveMut = useMutation({
    mutationFn: (id: number) => hrLeaveEncashmentsApi.approve(id),
    onSuccess: () => { toast('Encashment approved', 'success'); queryClient.invalidateQueries({ queryKey: ['leave-encashments'] }); },
    onError:   () => toast('Approve failed', 'error'),
  });
  const rejectMut = useMutation({
    mutationFn: (id: number) => hrLeaveEncashmentsApi.reject(id),
    onSuccess: () => { toast('Encashment rejected', 'success'); queryClient.invalidateQueries({ queryKey: ['leave-encashments'] }); },
    onError:   () => toast('Reject failed', 'error'),
  });
  const cancelMut = useMutation({
    mutationFn: (id: number) => hrLeaveEncashmentsApi.cancel(id),
    onSuccess: () => { toast('Encashment cancelled', 'success'); queryClient.invalidateQueries({ queryKey: ['leave-encashments'] }); },
    onError:   () => toast('Cancel failed', 'error'),
  });

  useEffect(() => {
    if (user && !isAdmin) router.replace('/');
  }, [user, isAdmin, router]);
  if (user && !isAdmin) return null;

  const handleApprove = async (enc: LeaveEncashment) => {
    const ok = await confirm(`Approve encashment of ${enc.days_encashed} days for ${enc.employee_name}?\nThis will deduct from their leave balance.`);
    if (ok) approveMut.mutate(enc.id);
  };
  const handleReject = async (enc: LeaveEncashment) => {
    const ok = await confirm(`Reject encashment request for ${enc.employee_name}?`);
    if (ok) rejectMut.mutate(enc.id);
  };
  const handleCancel = async (enc: LeaveEncashment) => {
    const ok = await confirm(`Cancel encashment for ${enc.employee_name}? If approved, the leave balance will be reversed.`);
    if (ok) cancelMut.mutate(enc.id);
  };

  const columns: Column<LeaveEncashment>[] = [
    {
      key:    'employee_name',
      header: 'Employee',
      render: (e) => <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>{e.employee_name}</span>,
    },
    {
      key:    'leave_type',
      header: 'Leave Type',
      render: (e) => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{LEAVE_TYPE_LABELS[e.leave_type] ?? e.leave_type}</span>,
    },
    {
      key:    'days_encashed',
      header: 'Days',
      render: (e) => <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--text-sm)' }}>{e.days_encashed}</span>,
    },
    {
      key:    'rate_per_day',
      header: 'Rate / Day',
      render: (e) => <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>AED {parseFloat(e.rate_per_day).toFixed(4)}</span>,
    },
    {
      key:    'encashment_amount',
      header: 'Amount',
      render: (e) => <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-success)' }}>{fmt(e.encashment_amount)}</span>,
    },
    {
      key:    'month',
      header: 'Period',
      render: (e) => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{MONTH_NAMES[e.month]} {e.year}</span>,
    },
    {
      key:    'status',
      header: 'Status',
      render: (e) => <Badge variant={STATUS_VARIANT[e.status] ?? 'default'}>{e.status.charAt(0).toUpperCase() + e.status.slice(1)}</Badge>,
    },
    {
      key:    'actions',
      header: '',
      render: (e) => {
        if (!isAdmin) return null;
        return (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {e.status === 'pending' && (
              <>
                <Button variant="ghost" size="sm" onClick={() => handleApprove(e)} style={{ color: 'var(--color-success)' }}>Approve</Button>
                <Button variant="ghost" size="sm" onClick={() => handleReject(e)}  style={{ color: 'var(--color-error)' }}>Reject</Button>
              </>
            )}
            {(e.status === 'pending' || e.status === 'approved') && (
              <Button variant="ghost" size="sm" onClick={() => handleCancel(e)} style={{ color: 'var(--text-tertiary)' }}>Cancel</Button>
            )}
          </div>
        );
      },
    },
  ];

  const INPUT_SM: React.CSSProperties = { ...INPUT, width: 'auto', minWidth: 140, padding: '5px 10px' };

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Leave Encashments"
          description="Create and approve leave encashment requests — converts leave days to salary."
          breadcrumbs={[{ label: 'HR' }, { label: 'Leave Encashments' }]}
          actions={
            isAdmin ? (
              <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
                + New Encashment
              </Button>
            ) : undefined
          }
        />

        {/* Filters */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={INPUT_SM}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={filterLeaveType} onChange={e => setFilterLeaveType(e.target.value)} style={INPUT_SM}>
            <option value="">All leave types</option>
            <option value="annual_leave">Annual Leave</option>
            <option value="sick_leave">Sick Leave</option>
          </select>
        </div>

        <TableShell
          tableState={tableState}
          columns={columns}
          data={encashments}
          isLoading={isLoading}
          emptyMessage="No encashment requests found."
          totalCount={data?.count ?? 0}
        />

        <NewEncashmentModal
          isOpen={showNew}
          onClose={() => setShowNew(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['leave-encashments'] })}
        />
      </PageShell>
    </MainLayout>
  );
}
