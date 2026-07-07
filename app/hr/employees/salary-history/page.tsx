'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { hrSalaryHistoryApi, hrEmployeesApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { Badge, type Column } from '@/components/ui';
import { AppListPage } from '@/components/app/AppListPage';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { useTableState } from '@/lib/hooks/use-table-state';
import type { SalaryHistory, SalaryChangeReason, HREmployee } from '@/types';

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (v: string | number) =>
  'AED ' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const REASON_LABELS: Record<string, string> = {
  hire:          'Initial Hire',
  annual_review: 'Annual Review',
  promotion:     'Promotion',
  correction:    'Correction',
  backfill:      'Back-fill',
  other:         'Other',
};

const REASON_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning'> = {
  hire:          'success',
  promotion:     'info',
  annual_review: 'default',
  correction:    'warning',
  backfill:      'warning',
  other:         'default',
};

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Shared styles ──────────────────────────────────────────────────────────────

const INPUT_SM: React.CSSProperties = {
  padding:      '6px 10px',
  borderRadius: 'var(--radius-md)',
  border:       '1px solid var(--input-border)',
  background:   'var(--input-bg)',
  color:        'var(--text-primary)',
  fontSize:     'var(--text-sm)',
  outline:      'none',
  height:       34,
};

const NOTE_BANNER: React.CSSProperties = {
  display:      'flex',
  alignItems:   'center',
  gap:          8,
  padding:      '8px 14px',
  borderRadius: 'var(--radius-md)',
  background:   'var(--surface-subtle)',
  border:       '1px solid var(--border-subtle)',
  fontSize:     'var(--text-xs)',
  color:        'var(--text-secondary)',
  marginBottom: 'var(--space-3)',
};

// ── Page Component ─────────────────────────────────────────────────────────────

export default function SalaryHistoryPage() {
  const tableState  = useTableState();
  const { page, search } = tableState;
  const router      = useRouter();
  const { user }    = useAuth();
  const { isTenantAdmin, hasPermission } = useMyPermissions();

  const canView = hasPermission('hr.hr_payroll.view') || isTenantAdmin;

  // Local filter state — employee is a SearchableDropdown, reason is a plain select
  const [filterEmployee, setFilterEmployee] = useState<number | null>(null);
  const [filterReason,   setFilterReason]   = useState('');

  // Guard: redirect if no access
  useEffect(() => {
    if (user && !canView) router.replace('/hr/employees');
  }, [user, canView, router]);
  if (user && !canView) return null;

  // ── Data ───────────────────────────────────────────────────────────────────

  const { data, isLoading, error } = useQuery({
    queryKey: ['salary-history', page, search, filterEmployee, filterReason],
    queryFn:  () => hrSalaryHistoryApi.getAll({
      page,
      ...(filterEmployee ? { employee: filterEmployee } : {}),
      ...(filterReason   ? { change_reason: filterReason } : {}),
    }),
    enabled: !!user && canView,
  });

  const { data: empData } = useQuery({
    queryKey: ['hr-employees-salary-filter'],
    queryFn:  () => hrEmployeesApi.getAll(),
    staleTime: 5 * 60 * 1000,
    enabled:  !!user && canView,
  });

  const employeeOptions = useMemo(() =>
    (empData?.results ?? []).map((e: HREmployee) => ({
      value:      e.id,
      label:      `${e.full_name} (${e.employee_id})`,
      searchText: `${e.full_name} ${e.employee_id}`,
    })),
    [empData?.results],
  );

  const records    = data?.results ?? [];
  const totalCount = data?.count   ?? 0;

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: Column<SalaryHistory>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: r => (
        <div>
          <div className="font-medium" style={{ fontSize: 'var(--text-sm)' }}>{r.employee_name}</div>
          <div className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            {r.employee_id_code}
          </div>
        </div>
      ),
    },
    {
      key: 'effective_date',
      header: 'Effective Date',
      render: r => (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {shortDate(r.effective_date)}
        </span>
      ),
    },
    {
      key: 'basic_salary',
      header: 'Basic Salary',
      render: r => <span className="font-mono" style={{ fontSize: 'var(--text-sm)' }}>{fmt(r.basic_salary)}</span>,
    },
    {
      key: 'housing_allowance',
      header: 'Housing Allow.',
      render: r => (
        <span className="font-mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {fmt(r.housing_allowance)}
        </span>
      ),
    },
    {
      key: 'transport_allowance',
      header: 'Transport Allow.',
      render: r => (
        <span className="font-mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {fmt(r.transport_allowance)}
        </span>
      ),
    },
    {
      key: 'other_allowances',
      header: 'Other Allow.',
      render: r => (
        <span className="font-mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {fmt(r.other_allowances)}
        </span>
      ),
    },
    {
      key: 'gross_salary',
      header: 'Gross Salary',
      render: r => (
        <span className="font-mono" style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          {fmt(r.gross_salary)}
        </span>
      ),
    },
    {
      key: 'change_reason',
      header: 'Change Reason',
      render: r => (
        <Badge variant={REASON_VARIANT[r.change_reason] ?? 'default'}>
          {REASON_LABELS[r.change_reason] ?? r.change_reason_display}
        </Badge>
      ),
    },
    {
      key: 'changed_by',
      header: 'Changed By',
      render: r => (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {r.changed_by_name ?? '—'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Date Recorded',
      render: r => (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          {shortDate(r.created_at)}
        </span>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppListPage
      title="Salary History"
      description="Full audit trail of salary changes across all employees."
      breadcrumbs={[
        { label: 'Home',      href: '/' },
        { label: 'HR' },
        { label: 'Employees', href: '/hr/employees' },
        { label: 'Salary History' },
      ]}
      totalCount={totalCount}
      searchPlaceholder="Search by employee name or ID…"
      extraActions={
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <div style={{ width: 240 }}>
            <SearchableDropdown
              options={employeeOptions}
              value={filterEmployee}
              onChange={v => setFilterEmployee(v as number | null)}
              placeholder="All employees"
              searchPlaceholder="Search employee…"
              allowClear
              emptyMessage="No employees found"
            />
          </div>
          <select
            value={filterReason}
            onChange={e => setFilterReason(e.target.value)}
            style={INPUT_SM}
          >
            <option value="">All reasons</option>
            {(Object.entries(REASON_LABELS) as [SalaryChangeReason, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      }
      headerExtra={
        <div style={NOTE_BANNER}>
          <span style={{ fontSize: '1em' }}>&#128274;</span>
          Records are immutable audit entries — no edits possible
        </div>
      }
      columns={columns}
      data={records}
      isLoading={isLoading}
      error={error}
      emptyTitle="No salary history records found."
      tableState={tableState}
      paginatedData={data}
      pageSize={50}
    />
  );
}
