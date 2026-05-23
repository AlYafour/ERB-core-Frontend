'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { subcontractorsApi } from '@/lib/api/subcontractors';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import FormField from '@/components/ui/FormField';
import { PageShell, PageHeader, Button } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';

function NewContractForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSubcontractor = searchParams.get('subcontractor');

  const { data: subcontractorsData } = useQuery({
    queryKey: ['subcontractors-all'],
    queryFn: () => subcontractorsApi.list({ page_size: 200, status: 'active' }),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects-list-mini'],
    queryFn: async () => {
      const { projectsApi } = await import('@/lib/api/projects');
      const res = await projectsApi.getAll({ page_size: 200 });
      return res.results ?? [];
    },
  });

  const [form, setForm] = useState({
    subcontractor: preselectedSubcontractor ? Number(preselectedSubcontractor) : null as number | null,
    contract_type: 'unit_rate' as 'unit_rate' | 'lump_sum',
    contract_title: '',
    scope_of_work: '',
    contract_value: '',
    start_date: '',
    end_date: '',
    payment_terms: '',
    retention_enabled: false,
    retention_percentage: '5',
    advance_payment_enabled: false,
    advance_payment_amount: '',
    advance_recovery_method: 'percentage' as 'percentage' | 'fixed_amount' | 'full_first',
    advance_recovery_percentage: '10',
  });

  const [projectIds, setProjectIds] = useState<number[]>([]);
  const [contractFile, setContractFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        contract_value:          form.contract_value          || '0',
        advance_payment_amount:  form.advance_payment_enabled ? (form.advance_payment_amount  || '0') : '0',
        advance_recovery_percentage: form.advance_payment_enabled ? (form.advance_recovery_percentage || '0') : '0',
        project_ids: projectIds,
      };
      const contract = await subcontractorsApi.contracts.create(
        payload as Parameters<typeof subcontractorsApi.contracts.create>[0]
      );
      if (contractFile) {
        const fd = new FormData();
        fd.append('file', contractFile);
        fd.append('contract', String(contract.id));
        fd.append('document_type', 'contract_pdf');
        fd.append('file_name', contractFile.name);
        await subcontractorsApi.attachments.upload(fd);
      }
      return contract;
    },
    onSuccess: (data) => {
      toast('Contract created', 'success');
      router.push(`/subcontractors/contracts/${data.id}`);
    },
    onError: (err) => toast(getApiError(err, 'Failed to create contract'), 'error'),
  });

  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }));

  const subOptions = (subcontractorsData?.results ?? []).map(s => ({
    value: s.id, label: s.company_name,
  }));

  const projectOptions = (projectsData ?? []).map(p => ({
    value: p.id,
    label: p.code ? `${p.code} — ${p.name}` : (p.name ?? String(p.id)),
  }));

  return (
    <form
      onSubmit={e => { e.preventDefault(); mutation.mutate(); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}
    >
      {/* Basic Info */}
      <div className="card">
        <div className="info-section-title">Contract Details</div>
        <div className="form-grid">
          <FormField label="Subcontractor" required>
            <SearchableDropdown
              options={subOptions}
              value={form.subcontractor}
              onChange={v => set('subcontractor', v)}
              placeholder="Select subcontractor"
            />
          </FormField>

          <FormField label="Project (Optional)">
            <SearchableDropdown
              options={projectOptions}
              value={projectIds[0] ?? null}
              onChange={v => setProjectIds(v ? [Number(v)] : [])}
              placeholder="Link to project"
              allowClear
            />
          </FormField>

          <div style={{ gridColumn: 'span 2' }}>
            <FormField label="Contract Title" required>
              <input
                type="text" required className="form-input"
                placeholder="e.g. Civil Works — Al Reem Project"
                value={form.contract_title}
                onChange={e => set('contract_title', e.target.value)}
              />
            </FormField>
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <FormField label="Contract Type" required>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                {(['unit_rate', 'lump_sum'] as const).map(type => (
                  <label
                    key={type}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                      border: form.contract_type === type
                        ? '2px solid var(--brand)'
                        : '2px solid var(--border-default)',
                      background: form.contract_type === type
                        ? 'var(--brand-subtle)'
                        : 'var(--surface-primary)',
                    }}
                  >
                    <input
                      type="radio" name="contract_type"
                      value={type}
                      checked={form.contract_type === type}
                      onChange={() => set('contract_type', type)}
                      style={{ width: 16, height: 16, accentColor: 'var(--brand)' }}
                    />
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {type === 'unit_rate' ? 'Unit Rate' : 'Lump Sum (مقطوع)'}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                        {type === 'unit_rate'
                          ? 'BOQ with quantities × unit prices. Claims by quantity done.'
                          : 'Fixed total price. Claims by % complete per period.'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </FormField>
          </div>

          <FormField
            label="Contract Value (AED)"
            helperText={form.contract_type === 'unit_rate'
              ? 'Optional — BOQ total will be used if left blank'
              : 'Required for lump sum — this is the fixed contract price'}
          >
            <input
              type="number" min="0" step="0.01" className="form-input"
              placeholder="0.00"
              required={form.contract_type === 'lump_sum'}
              value={form.contract_value}
              onChange={e => set('contract_value', e.target.value)}
            />
          </FormField>

          <FormField label="Payment Terms">
            <input
              type="text" className="form-input"
              placeholder="e.g. Net 30 days after IPC approval"
              value={form.payment_terms}
              onChange={e => set('payment_terms', e.target.value)}
            />
          </FormField>

          <FormField label="Start Date">
            <input
              type="date" className="form-input"
              value={form.start_date}
              onChange={e => set('start_date', e.target.value)}
            />
          </FormField>

          <FormField label="End Date" helperText="Optional">
            <input
              type="date" className="form-input"
              value={form.end_date}
              onChange={e => set('end_date', e.target.value)}
            />
          </FormField>

          <div style={{ gridColumn: 'span 2' }}>
            <FormField label="Scope of Work">
              <textarea
                rows={4} className="form-textarea"
                placeholder="Describe the scope of work..."
                value={form.scope_of_work}
                onChange={e => set('scope_of_work', e.target.value)}
              />
            </FormField>
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <FormField label="Contract Document" helperText="Upload the signed contract PDF or Word file (optional — can also be uploaded later)">
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                border: contractFile ? '2px solid var(--brand)' : '2px dashed var(--border-default)',
                borderRadius: 8,
                background: contractFile ? 'var(--brand-subtle)' : 'var(--surface-secondary)',
                cursor: 'pointer',
              }}
                onClick={() => document.getElementById('contract-file-input')?.click()}
              >
                <span style={{ fontSize: 16, color: 'var(--text-tertiary)', fontWeight: 600 }}>⊕</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {contractFile ? contractFile.name : 'Click to attach contract document'}
                  </div>
                  {contractFile && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {(contractFile.size / 1024).toFixed(0)} KB
                    </div>
                  )}
                </div>
                {contractFile && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setContractFile(null); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1, padding: 4 }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <input
                id="contract-file-input"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                style={{ display: 'none' }}
                onChange={e => setContractFile(e.target.files?.[0] ?? null)}
              />
            </FormField>
          </div>
        </div>
      </div>

      {/* Retention */}
      <div className="card">
        <div className="info-section-title">Retention Settings</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.retention_enabled}
              onChange={e => set('retention_enabled', e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
              Enable Retention Deduction
            </span>
          </label>

          {form.retention_enabled && (
            <div className="form-grid">
              <FormField label="Retention Percentage (%)">
                <input
                  type="number" min="0" max="100" step="0.01" className="form-input"
                  value={form.retention_percentage}
                  onChange={e => set('retention_percentage', e.target.value)}
                />
              </FormField>
            </div>
          )}
        </div>
      </div>

      {/* Advance Payment */}
      <div className="card">
        <div className="info-section-title">Advance Payment Settings</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.advance_payment_enabled}
              onChange={e => set('advance_payment_enabled', e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
              Enable Advance Payment
            </span>
          </label>

          {form.advance_payment_enabled && (
            <div className="form-grid">
              <FormField label="Advance Amount (AED)">
                <input
                  type="number" min="0" step="0.01" className="form-input"
                  placeholder="0.00"
                  value={form.advance_payment_amount}
                  onChange={e => set('advance_payment_amount', e.target.value)}
                />
              </FormField>

              <FormField label="Recovery Method">
                <SearchableDropdown
                  options={[
                    { value: 'percentage', label: 'Percentage per IPC' },
                    { value: 'fixed_amount', label: 'Fixed Amount per IPC' },
                    { value: 'full_first', label: 'Recover in Full (First IPC)' },
                  ]}
                  value={form.advance_recovery_method}
                  onChange={v => set('advance_recovery_method', v)}
                  placeholder="Select method"
                />
              </FormField>

              {form.advance_recovery_method === 'percentage' && (
                <FormField label="Recovery Percentage per IPC (%)">
                  <input
                    type="number" min="0" max="100" step="0.01" className="form-input"
                    value={form.advance_recovery_percentage}
                    onChange={e => set('advance_recovery_percentage', e.target.value)}
                  />
                </FormField>
              )}
              {form.advance_recovery_method === 'fixed_amount' && (
                <FormField label="Fixed Recovery Amount per IPC (AED)">
                  <input
                    type="number" min="0" step="0.01" className="form-input"
                    placeholder="0.00"
                    value={form.advance_recovery_percentage}
                    onChange={e => set('advance_recovery_percentage', e.target.value)}
                  />
                </FormField>
              )}
              {form.advance_recovery_method === 'percentage' &&
               Number(form.advance_recovery_percentage) === 0 && (
                <div style={{ gridColumn: 'span 2', padding: '8px 12px', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.4)', borderRadius: 6, fontSize: 'var(--text-sm)', color: 'rgb(161,120,0)' }}>
                  Warning: Recovery % is 0 — the advance will never be automatically deducted from certificates.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <Button type="submit" variant="primary" disabled={mutation.isPending || !form.subcontractor}>
          {mutation.isPending ? 'Saving…' : 'Create Contract'}
        </Button>
        <Link href="/subcontractors/contracts">
          <Button variant="secondary">Cancel</Button>
        </Link>
      </div>
    </form>
  );
}

export default function NewContractPage() {
  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="New Contract"
          breadcrumbs={[
            { label: 'Subcontractors', href: '/subcontractors' },
            { label: 'Contracts', href: '/subcontractors/contracts' },
            { label: 'New Contract' },
          ]}
        />
        <Suspense fallback={<div className="card empty-state"><p>Loading…</p></div>}>
          <NewContractForm />
        </Suspense>
      </PageShell>
    </MainLayout>
  );
}
