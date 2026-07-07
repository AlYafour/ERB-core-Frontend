'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrPayrollRunsApi } from '@/lib/api/hr';
import type { PayrollRun, PayrollRunStatus } from '@/types';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { type FilterField } from '@/components/ui/FilterPanel';
import { Button, Badge, type Column } from '@/components/ui';
import { BaseModal } from '@/components/ui/base/BaseModal';
import { RowActions } from '@/components/ui/RowActions';
import { AppListPage } from '@/components/app/AppListPage';
import { useTableState } from '@/lib/hooks/use-table-state';
import { MONTH_NAMES, formatCurrency } from '@/lib/utils/hr';

// ── Helpers ───────────────────────────────────────────────────────────────────

const RUN_STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  draft:      'default',
  processing: 'warning',
  processed:  'info',
  paid:       'success',
  cancelled:  'error',
};

const RUN_STATUS_LABEL: Record<string, string> = {
  draft:      'Draft',
  processing: 'Processing',
  processed:  'Processed',
  paid:       'Paid',
  cancelled:  'Cancelled',
};

const NOW_MONTH = new Date().getMonth() + 1;
const NOW_YEAR  = new Date().getFullYear();

const filterFields: FilterField[] = [
  {
    name: 'status', label: 'Status', type: 'select', group: 'Filters',
    options: [
      { value: 'draft',      label: 'Draft' },
      { value: 'processing', label: 'Processing' },
      { value: 'processed',  label: 'Processed' },
      { value: 'paid',       label: 'Paid' },
      { value: 'cancelled',  label: 'Cancelled' },
    ],
  },
  {
    name: 'year', label: 'Year', type: 'select', group: 'Period',
    options: Array.from({ length: 3 }, (_, i) => NOW_YEAR - i).map(y => ({ value: String(y), label: String(y) })),
  },
];

// ── Shared input styles ────────────────────────────────────────────────────────

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

// ── Create Run Modal ───────────────────────────────────────────────────────────

interface CreateRunForm {
  month: number;
  year:  number;
  notes: string;
}

const CREATE_INITIAL: CreateRunForm = {
  month: NOW_MONTH,
  year:  NOW_YEAR,
  notes: '',
};

function CreateRunModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen:     boolean;
  onClose:    () => void;
  onSuccess:  () => void;
}) {
  const [form, setForm] = useState<CreateRunForm>(CREATE_INITIAL);

  useEffect(() => {
    if (isOpen) setForm(CREATE_INITIAL);
  }, [isOpen]);

  const createMutation = useMutation({
    mutationFn: () => hrPayrollRunsApi.create({
      month: form.month,
      year:  form.year,
      notes: form.notes,
    }),
    onSuccess: () => {
      toast('Payroll run created', 'success');
      onSuccess();
      onClose();
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const msg = (data?.detail as string | undefined)
        ?? (data?.non_field_errors as string[] | undefined)?.[0]
        ?? (data && typeof data === 'object' ? Object.values(data).flat().join(' ') : null)
        ?? 'Failed to create payroll run';
      toast(String(msg), 'error');
    },
  });

  const setInt = (key: keyof CreateRunForm) =>
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: parseInt(e.target.value) }));

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="New Payroll Run"
      size="sm"
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => createMutation.mutate()}
            isLoading={createMutation.isPending}
          >
            Create Run
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          A payroll run covers one month for all active employees. After creating,
          click <strong>Generate</strong> to create individual payroll records.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label style={LABEL}>
              Month <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <select value={form.month} onChange={setInt('month')} style={INPUT}>
              {MONTH_NAMES.slice(1).map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={LABEL}>
              Year <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <select value={form.year} onChange={setInt('year')} style={INPUT}>
              {Array.from({ length: 3 }, (_, i) => NOW_YEAR - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={LABEL}>Notes <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>optional</span></label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
            placeholder="e.g. July 2026 regular payroll…"
            style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
      </div>
    </BaseModal>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PayrollRunsPage() {
  const tableState = useTableState();
  const { page, search, filters } = tableState;

  const queryClient = useQueryClient();
  const { user }    = useAuth();
  const { hasPermission } = useMyPermissions();
  const router      = useRouter();

  const isAdmin = hasPermission('hr.hr_payroll.view');

  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-payroll-runs', page, search, filters],
    queryFn:  () => hrPayrollRunsApi.getAll({ page, search, ...filters }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hr-payroll-runs'] });

  // ── Mutations ────────────────────────────────────────────────────────────────

  const generateMutation = useMutation({
    mutationFn: (id: number) => hrPayrollRunsApi.generate(id),
    onSuccess:  () => { invalidate(); toast('Payroll records generated for all active employees', 'success'); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Generate failed';
      toast(String(msg), 'error');
    },
  });

  const processAllMutation = useMutation({
    mutationFn: (id: number) => hrPayrollRunsApi.processAll(id),
    onSuccess:  () => { invalidate(); toast('All payrolls processed successfully', 'success'); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Process failed';
      toast(String(msg), 'error');
    },
  });

  const markPaidAllMutation = useMutation({
    mutationFn: (id: number) => hrPayrollRunsApi.markPaidAll(id),
    onSuccess:  () => { invalidate(); toast('All payrolls marked as paid', 'success'); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Mark paid failed';
      toast(String(msg), 'error');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => hrPayrollRunsApi.cancel(id),
    onSuccess:  () => { invalidate(); toast('Payroll run cancelled', 'success'); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Cancel failed';
      toast(String(msg), 'error');
    },
  });

  // ── Action handlers (all with confirm) ───────────────────────────────────────

  const runPeriod = (run: PayrollRun) => `${run.month_name || MONTH_NAMES[run.month]} ${run.year}`;

  const handleGenerate = async (run: PayrollRun) => {
    if (await confirm(`Generate payroll records for all active employees for ${runPeriod(run)}?`)) {
      generateMutation.mutate(run.id);
    }
  };

  const handleProcessAll = async (run: PayrollRun) => {
    if (await confirm(`Auto-calculate all payrolls for ${runPeriod(run)}? This will compute salaries, deductions, and loan installments.`)) {
      processAllMutation.mutate(run.id);
    }
  };

  const handleMarkPaidAll = async (run: PayrollRun) => {
    if (await confirm(`Mark all ${run.total_employees} payrolls as paid for ${runPeriod(run)}?`)) {
      markPaidAllMutation.mutate(run.id);
    }
  };

  const handleCancel = async (run: PayrollRun) => {
    if (await confirm(`Cancel the payroll run for ${runPeriod(run)}? This cannot be undone.`)) {
      cancelMutation.mutate(run.id);
    }
  };

  const handleWpsExport = async (run: PayrollRun) => {
    try {
      const blob = await hrPayrollRunsApi.wpsExportByRun(run.id);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `WPS_${run.year}_${String(run.month).padStart(2, '0')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('WPS export failed', 'error');
    }
  };

  // ── Auth guard ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (user && !isAdmin) router.replace('/');
  }, [user, isAdmin, router]);
  if (user && !isAdmin) return null;

  // ── Table ─────────────────────────────────────────────────────────────────────

  const records    = Array.isArray(data?.results) ? data!.results : [];
  const totalCount = data?.count ?? 0;

  const isBusy = (id: number) =>
    (generateMutation.isPending   && generateMutation.variables   === id) ||
    (processAllMutation.isPending  && processAllMutation.variables  === id) ||
    (markPaidAllMutation.isPending && markPaidAllMutation.variables === id) ||
    (cancelMutation.isPending      && cancelMutation.variables      === id);

  const columns: Column<PayrollRun>[] = [
    {
      key: 'period', header: 'Period',
      render: r => (
        <div>
          <div className="font-medium">{r.month_name || MONTH_NAMES[r.month]} {r.year}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Run #{r.id}
          </div>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: r => (
        <Badge variant={RUN_STATUS_VARIANT[r.status] ?? 'default'}>
          {RUN_STATUS_LABEL[r.status] ?? r.status}
        </Badge>
      ),
    },
    {
      key: 'total_employees', header: 'Employees',
      render: r => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {r.total_employees > 0 ? r.total_employees : '—'}
        </span>
      ),
    },
    {
      key: 'total_net', header: 'Total Net',
      render: r => (
        <span className="font-mono font-semibold">
          {parseFloat(r.total_net) > 0 ? `AED ${formatCurrency(r.total_net)}` : '—'}
        </span>
      ),
    },
    {
      key: 'created_by', header: 'Created By',
      render: r => (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {r.created_by_name ?? '—'}
        </span>
      ),
    },
    {
      key: 'created_at', header: 'Created',
      render: r => (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {new Date(r.created_at).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions', header: '',
      render: r => {
        const busy = isBusy(r.id);
        const s = r.status as PayrollRunStatus;
        return (
          <RowActions
            actions={[
              {
                label: busy ? 'Working…' : 'Generate',
                onClick: () => handleGenerate(r),
                hidden: !isAdmin || (s !== 'draft' && s !== 'processing'),
              },
              {
                label: busy ? 'Working…' : 'Process All',
                onClick: () => handleProcessAll(r),
                hidden: !isAdmin || s !== 'processing',
              },
              {
                label: busy ? 'Working…' : 'Mark All Paid',
                onClick: () => handleMarkPaidAll(r),
                hidden: !isAdmin || s !== 'processed',
              },
              {
                label: 'WPS Export (Excel)',
                onClick: () => handleWpsExport(r),
                hidden: s !== 'processed' && s !== 'paid',
              },
              {
                separator: true,
                hidden: !isAdmin || (s !== 'draft' && s !== 'processing'),
              },
              {
                label: busy ? 'Working…' : 'Cancel Run',
                onClick: () => handleCancel(r),
                variant: 'danger',
                hidden: !isAdmin || (s !== 'draft' && s !== 'processing'),
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    <AppListPage
      title="Payroll Runs"
      description="Manage batch payroll processing — one run per month covers all active employees."
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'HR' },
        { label: 'Payroll', href: '/hr/payroll' },
        { label: 'Runs' },
      ]}
      totalCount={totalCount}
      createAction={isAdmin ? (
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          + New Payroll Run
        </Button>
      ) : undefined}
      filterFields={filterFields}
      searchPlaceholder="Search by run ID or notes…"
      columns={columns}
      data={records}
      isLoading={isLoading}
      error={error}
      emptyTitle="No payroll runs found."
      tableState={tableState}
      paginatedData={data}
      pageSize={25}
    >
      <CreateRunModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={invalidate}
      />
    </AppListPage>
  );
}
