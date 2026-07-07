'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { hrEosApi, hrEmployeesApi } from '@/lib/api/hr';
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
import type { EOSCalculation, EOSPreview, EOSTerminationReason } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const REASON_LABELS: Record<string, string> = {
  resignation:      'Resignation',
  termination:      'Termination',
  mutual_agreement: 'Mutual Agreement',
  contract_expiry:  'Contract Expiry',
  death:            'Death',
  disability:       'Disability',
  retirement:       'Retirement',
};

const STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  draft:     'default',
  approved:  'info',
  paid:      'success',
  cancelled: 'error',
};

const fmt = (v: string | number) =>
  'AED ' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toNum = (s: string) => parseFloat(s) || 0;

const filterFields: FilterField[] = [
  {
    name: 'status', label: 'Status', type: 'select', group: 'Filters',
    options: [
      { value: 'draft',     label: 'Draft' },
      { value: 'approved',  label: 'Approved' },
      { value: 'paid',      label: 'Paid' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
  },
  {
    name: 'termination_reason', label: 'Reason', type: 'select', group: 'Filters',
    options: [
      { value: 'resignation',      label: 'Resignation' },
      { value: 'termination',      label: 'Termination' },
      { value: 'mutual_agreement', label: 'Mutual Agreement' },
      { value: 'contract_expiry',  label: 'Contract Expiry' },
      { value: 'retirement',       label: 'Retirement' },
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

// ── EOS Preview form types ────────────────────────────────────────────────────

interface EOSForm {
  employeeId:         number | null;
  termination_date:   string;
  termination_reason: EOSTerminationReason | '';
  leave_balance_days: string;
  other_deductions:   string;
  other_additions:    string;
}

const EOS_INITIAL: EOSForm = {
  employeeId:         null,
  termination_date:   '',
  termination_reason: '',
  leave_balance_days: '',
  other_deductions:   '',
  other_additions:    '',
};

// ── Preview Modal ─────────────────────────────────────────────────────────────

function PreviewModal({
  isOpen,
  onClose,
  onSaved,
}: {
  isOpen:    boolean;
  onClose:   () => void;
  onSaved:   () => void;
}) {
  const [form, setForm]         = useState<EOSForm>(EOS_INITIAL);
  const [preview, setPreview]   = useState<EOSPreview | null>(null);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (isOpen) { setForm(EOS_INITIAL); setPreview(null); }
  }, [isOpen]);

  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey:  ['hr-employees-eos-picker'],
    queryFn:   () => hrEmployeesApi.getAll(),
    enabled:   isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const employeeOptions = useMemo(
    () =>
      (empData?.results ?? []).map((e: { id: number; full_name: string; employee_id: string }) => ({
        value:      e.id,
        label:      `${e.full_name} (${e.employee_id})`,
        searchText: `${e.full_name} ${e.employee_id}`,
      })),
    [empData?.results],
  );

  const validateForm = () => {
    if (!form.employeeId)         { toast('Please select an employee', 'error'); return false; }
    if (!form.termination_date)   { toast('Please enter a termination date', 'error'); return false; }
    if (!form.termination_reason) { toast('Please select a termination reason', 'error'); return false; }
    return true;
  };

  const buildPayload = () => ({
    employee:           form.employeeId!,
    termination_date:   form.termination_date,
    termination_reason: form.termination_reason as EOSTerminationReason,
    ...(form.leave_balance_days !== '' ? { leave_balance_days: toNum(form.leave_balance_days) } : {}),
    ...(form.other_deductions   !== '' ? { other_deductions:   toNum(form.other_deductions)   } : {}),
    ...(form.other_additions    !== '' ? { other_additions:    toNum(form.other_additions)    } : {}),
  });

  const previewMutation = useMutation({
    mutationFn: () => hrEosApi.preview(buildPayload()),
    onSuccess:  (data: EOSPreview) => setPreview(data),
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const msg =
        (data?.detail as string | undefined) ??
        (data?.non_field_errors as string[] | undefined)?.[0] ??
        (data && typeof data === 'object' ? Object.values(data).flat().join(' ') : null) ??
        'Failed to calculate preview';
      toast(String(msg), 'error');
    },
  });

  const handlePreview = () => {
    if (!validateForm()) return;
    previewMutation.mutate();
  };

  const handleSaveAsDraft = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      await hrEosApi.create(buildPayload());
      toast('EOS record saved as draft', 'success');
      onSaved();
      onClose();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const msg =
        (data?.detail as string | undefined) ??
        (data && typeof data === 'object' ? Object.values(data).flat().join(' ') : null) ??
        'Failed to save EOS record';
      toast(String(msg), 'error');
    } finally {
      setSaving(false);
    }
  };

  const set =
    (key: keyof EOSForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));

  const isCalculated = preview !== null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="EOS Calculator & Preview"
      size="lg"
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={previewMutation.isPending || saving}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handlePreview}
            isLoading={previewMutation.isPending}
            disabled={saving}
          >
            Calculate
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveAsDraft}
            isLoading={saving}
            disabled={previewMutation.isPending}
          >
            Save as Draft
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {/* Employee */}
        <div>
          <p style={SECTION}>Employee</p>
          <label style={LABEL}>
            Employee <span style={{ color: 'var(--color-error)' }}>*</span>
          </label>
          <SearchableDropdown
            options={employeeOptions}
            value={form.employeeId}
            onChange={v => setForm(f => ({ ...f, employeeId: v as number | null }))}
            placeholder={empLoading ? 'Loading...' : 'Search by name or ID...'}
            searchPlaceholder="Type to search..."
            allowClear
            emptyMessage="No employees found"
          />
        </div>

        {/* Termination info */}
        <div>
          <p style={SECTION}>Termination Details</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>
                Termination Date <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                type="date"
                value={form.termination_date}
                onChange={set('termination_date')}
                style={INPUT}
              />
            </div>
            <div>
              <label style={LABEL}>
                Reason <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <select
                value={form.termination_reason}
                onChange={set('termination_reason')}
                style={INPUT}
              >
                <option value="">Select reason...</option>
                {(Object.entries(REASON_LABELS) as [string, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Adjustments */}
        <div>
          <p style={SECTION}>Adjustments</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={LABEL}>Leave Balance (days)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 12.5"
                value={form.leave_balance_days}
                onChange={set('leave_balance_days')}
                style={INPUT}
              />
            </div>
            <div>
              <label style={LABEL}>Other Deductions (AED)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 500.00"
                value={form.other_deductions}
                onChange={set('other_deductions')}
                style={INPUT}
              />
            </div>
            <div>
              <label style={LABEL}>Other Additions (AED)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 1000.00"
                value={form.other_additions}
                onChange={set('other_additions')}
                style={INPUT}
              />
            </div>
          </div>
        </div>

        {/* Preview breakdown */}
        {isCalculated && preview && (
          <div style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 'var(--space-4)',
          }}>
            <p style={SECTION}>Calculation Breakdown</p>
            <div style={{
              background: 'var(--surface-subtle)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <tbody>
                  {[
                    ['Years of Service',      preview.years_of_service != null      ? `${Number(preview.years_of_service).toFixed(2)} yrs` : '—'],
                    ['Basic Salary',          preview.basic_salary      != null      ? fmt(preview.basic_salary)      : '—'],
                    ['Gratuity Amount',       preview.gratuity_amount   != null      ? fmt(preview.gratuity_amount)   : '—'],
                    ['Leave Encashment',      preview.leave_encashment  != null      ? fmt(preview.leave_encashment)  : '—'],
                    ['Other Additions',       preview.other_additions   != null      ? fmt(preview.other_additions)   : '—'],
                    ['Other Deductions',      preview.other_deductions  != null      ? fmt(preview.other_deductions)  : '—'],
                  ].map(([label, value]) => (
                    <tr key={label} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '8px 14px', color: 'var(--text-secondary)' }}>{label}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{value}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--surface-emphasis, rgba(0,0,0,0.04))' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Total Settlement
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-success, #2e7d32)' }}>
                      {preview.total_settlement != null ? fmt(preview.total_settlement) : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </BaseModal>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function HREosPage() {
  const tableState = useTableState();
  const { page, search, filters } = tableState;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasPermission, isTenantAdmin } = useMyPermissions();
  const router = useRouter();

  const canView   = hasPermission('hr.hr_payroll.view')   || isTenantAdmin;
  const canCreate = hasPermission('hr.hr_payroll.create') || isTenantAdmin;

  const [showPreview, setShowPreview] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-eos', page, search, filters],
    queryFn:  () => hrEosApi.getAll({ page, search, ...filters }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hr-eos'] });

  const approveMutation = useMutation({
    mutationFn: (id: number) => hrEosApi.approve(id),
    onSuccess:  () => { invalidate(); toast('EOS record approved', 'success'); },
    onError:    () => toast('Failed to approve EOS record', 'error'),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => hrEosApi.markPaid(id),
    onSuccess:  () => { invalidate(); toast('EOS record marked as paid', 'success'); },
    onError:    () => toast('Failed to mark EOS record as paid', 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => hrEosApi.cancel(id),
    onSuccess:  () => { invalidate(); toast('EOS record cancelled', 'success'); },
    onError:    () => toast('Failed to cancel EOS record', 'error'),
  });

  const handleApprove = async (record: EOSCalculation) => {
    if (await confirm(`Approve EOS settlement for ${record.employee_name}?\nTotal: ${fmt(record.total_settlement)}`)) {
      approveMutation.mutate(record.id);
    }
  };

  const handleMarkPaid = async (record: EOSCalculation) => {
    if (await confirm(`Mark EOS settlement as paid for ${record.employee_name}?\nTotal: ${fmt(record.total_settlement)}`)) {
      markPaidMutation.mutate(record.id);
    }
  };

  const handleCancel = async (record: EOSCalculation) => {
    if (await confirm(`Cancel EOS record for ${record.employee_name}? This action cannot be undone.`)) {
      cancelMutation.mutate(record.id);
    }
  };

  useEffect(() => {
    if (user && !canView) router.replace('/');
  }, [user, canView, router]);
  if (user && !canView) return null;

  const records    = data?.results ?? [];
  const totalCount = data?.count ?? 0;

  const columns: Column<EOSCalculation>[] = [
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
      key: 'termination_date', header: 'Termination Date',
      render: r => (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {r.termination_date ?? '—'}
        </span>
      ),
    },
    {
      key: 'reason', header: 'Reason',
      render: r => (
        <span style={{ fontSize: 'var(--text-sm)' }}>
          {r.termination_reason_display ?? REASON_LABELS[r.termination_reason] ?? r.termination_reason ?? '—'}
        </span>
      ),
    },
    {
      key: 'years', header: 'Years of Service',
      render: r => (
        <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
          {r.years_of_service != null ? `${Number(r.years_of_service).toFixed(2)} yrs` : '—'}
        </span>
      ),
    },
    {
      key: 'gratuity', header: 'Gratuity',
      render: r => (
        <span className="font-mono">
          {r.gratuity_amount != null ? fmt(r.gratuity_amount) : '—'}
        </span>
      ),
    },
    {
      key: 'total', header: 'Total Settlement',
      render: r => (
        <span className="font-mono" style={{ fontWeight: 600 }}>
          {r.total_settlement != null ? fmt(r.total_settlement) : '—'}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: r => (
        <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>
          {r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : '—'}
        </Badge>
      ),
    },
    {
      key: 'actions', header: '',
      render: r => (
        <RowActions actions={[
          {
            label:  'Approve',
            onClick: () => handleApprove(r),
            hidden: !canCreate || r.status !== 'draft',
          },
          {
            label:  'Mark Paid',
            onClick: () => handleMarkPaid(r),
            hidden: !canCreate || r.status !== 'approved',
          },
          {
            separator: true,
            hidden: !canCreate || (r.status !== 'draft' && r.status !== 'approved'),
          },
          {
            label:   'Cancel',
            onClick:  () => handleCancel(r),
            variant: 'danger',
            hidden:  !canCreate || (r.status !== 'draft' && r.status !== 'approved'),
          },
        ]} />
      ),
    },
  ];

  return (
    <AppListPage
      title="End of Service"
      description="Calculate and manage employee end-of-service gratuity settlements."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'HR' }, { label: 'End of Service' }]}
      totalCount={totalCount}
      createAction={canCreate ? (
        <Button variant="primary" size="sm" onClick={() => setShowPreview(true)}>
          + New EOS
        </Button>
      ) : undefined}
      filterFields={filterFields}
      searchPlaceholder="Search by employee name or ID..."
      columns={columns}
      data={records}
      isLoading={isLoading}
      error={error}
      emptyTitle="No EOS records found."
      tableState={tableState}
      paginatedData={data}
      pageSize={50}
    >
      <PreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onSaved={invalidate}
      />
    </AppListPage>
  );
}
