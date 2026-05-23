'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { subcontractorsApi } from '@/lib/api/subcontractors';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import FormField from '@/components/ui/FormField';
import { PageShell, PageHeader, Button } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';

export default function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: contract, isLoading } = useQuery({
    queryKey: ['subcon-contract', id],
    queryFn: () => subcontractorsApi.contracts.getOne(Number(id)),
  });

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
    subcontractor: null as number | null,
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
  const [ready, setReady] = useState(false);

  // File uploads — multiple files, each with a document type
  const DOCUMENT_TYPES = [
    { value: 'contract_pdf',       label: 'Contract PDF' },
    { value: 'commercial_license', label: 'Commercial License' },
    { value: 'vat_certificate',    label: 'VAT Certificate' },
    { value: 'insurance',          label: 'Insurance' },
    { value: 'drawing',            label: 'Drawing' },
    { value: 'measurement_sheet',  label: 'Measurement Sheet' },
    { value: 'invoice',            label: 'Invoice' },
    { value: 'other',              label: 'Other' },
  ];
  const [pendingFiles, setPendingFiles] = useState<{ file: File; docType: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (contract && !ready) {
      setForm({
        subcontractor:            contract.subcontractor,
        contract_type:            contract.contract_type ?? 'unit_rate',
        contract_title:           contract.contract_title,
        scope_of_work:            contract.scope_of_work ?? '',
        contract_value:           contract.contract_value ?? '',
        start_date:               contract.start_date ?? '',
        end_date:                 contract.end_date ?? '',
        payment_terms:            contract.payment_terms ?? '',
        retention_enabled:        contract.retention_enabled,
        retention_percentage:     contract.retention_percentage ?? '5',
        advance_payment_enabled:  contract.advance_payment_enabled,
        advance_payment_amount:   contract.advance_payment_amount ?? '',
        advance_recovery_method:  contract.advance_recovery_method ?? 'percentage',
        advance_recovery_percentage: contract.advance_recovery_percentage ?? '10',
      });
      const linked = (contract.contract_projects_detail ?? []).map((p: { project: number }) => p.project);
      setProjectIds(linked);
      setReady(true);
    }
  }, [contract, ready]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        contract_value:              form.contract_value || '0',
        advance_payment_amount:      form.advance_payment_enabled ? (form.advance_payment_amount || '0') : '0',
        advance_recovery_percentage: form.advance_payment_enabled ? (form.advance_recovery_percentage || '0') : '0',
        project_ids: projectIds,
      };
      await subcontractorsApi.contracts.update(Number(id), payload);

      if (pendingFiles.length > 0) {
        setUploading(true);
        for (const { file, docType } of pendingFiles) {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('contract', id);
          fd.append('document_type', docType);
          fd.append('file_name', file.name);
          await subcontractorsApi.attachments.upload(fd);
        }
        setUploading(false);
      }
    },
    onSuccess: () => {
      toast('Contract updated', 'success');
      router.push(`/subcontractors/contracts/${id}`);
    },
    onError: (err) => { setUploading(false); toast(getApiError(err, 'Failed to update contract'), 'error'); },
  });

  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }));

  const subOptions = (subcontractorsData?.results ?? []).map(s => ({ value: s.id, label: s.company_name }));
  const projectOptions = (projectsData ?? []).map(p => ({
    value: p.id,
    label: p.code ? `${p.code} — ${p.name}` : (p.name ?? String(p.id)),
  }));

  if (isLoading || !ready) {
    return (
      <MainLayout>
        <PageShell>
          <div className="card empty-state"><p style={{ color: 'var(--text-secondary)' }}>Loading…</p></div>
        </PageShell>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Edit Contract"
          breadcrumbs={[
            { label: 'Subcontractors', href: '/subcontractors' },
            { label: 'Contracts', href: '/subcontractors/contracts' },
            { label: contract?.contract_no ?? 'Edit' },
          ]}
        />

        <form
          onSubmit={e => { e.preventDefault(); mutation.mutate(); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}
        >
          {/* Contract Details */}
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
                          type="radio" name="contract_type" value={type}
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
                        { value: 'percentage',   label: 'Percentage per IPC' },
                        { value: 'fixed_amount', label: 'Fixed Amount per IPC' },
                        { value: 'full_first',   label: 'Recover in Full (First IPC)' },
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
                </div>
              )}
            </div>
          </div>

          {/* Attachments */}
          <div className="card">
            <div className="info-section-title">Upload Attachments</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {pendingFiles.map((pf, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 8,
                  border: '1px solid var(--border-default)',
                  background: 'var(--surface-secondary)',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{pf.file.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {(pf.file.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  <select
                    value={pf.docType}
                    onChange={e => setPendingFiles(prev => prev.map((f, i) => i === idx ? { ...f, docType: e.target.value } : f))}
                    style={{
                      padding: '4px 8px', fontSize: 'var(--text-sm)',
                      border: '1px solid var(--border-default)', borderRadius: 6,
                      background: 'var(--surface-primary)', color: 'var(--text-primary)',
                    }}
                  >
                    {DOCUMENT_TYPES.map(dt => (
                      <option key={dt.value} value={dt.value}>{dt.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 18, padding: 4 }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <label style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                border: '2px dashed var(--border-default)',
                background: 'var(--surface-secondary)',
              }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  + Click to add file(s) — PDF, Word, Excel accepted
                </span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    setPendingFiles(prev => [
                      ...prev,
                      ...files.map(f => ({ file: f, docType: 'contract_pdf' })),
                    ]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button type="submit" variant="primary" disabled={mutation.isPending || uploading || !form.subcontractor}>
              {uploading ? 'Uploading files…' : mutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
            <Link href={`/subcontractors/contracts/${id}`}>
              <Button variant="secondary">Cancel</Button>
            </Link>
          </div>
        </form>
      </PageShell>
    </MainLayout>
  );
}
