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
  const [pendingFiles, setPendingFiles] = useState<{ file: File; docType: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (contract && !ready) {
      setForm({
        subcontractor:               contract.subcontractor,
        contract_type:               contract.contract_type ?? 'unit_rate',
        contract_title:              contract.contract_title,
        scope_of_work:               contract.scope_of_work ?? '',
        contract_value:              contract.contract_value ?? '',
        start_date:                  contract.start_date ?? '',
        end_date:                    contract.end_date ?? '',
        payment_terms:               contract.payment_terms ?? '',
        retention_enabled:           contract.retention_enabled,
        retention_percentage:        contract.retention_percentage ?? '5',
        advance_payment_enabled:     contract.advance_payment_enabled,
        advance_payment_amount:      contract.advance_payment_amount ?? '',
        advance_recovery_method:     contract.advance_recovery_method ?? 'percentage',
        advance_recovery_percentage: contract.advance_recovery_percentage ?? '10',
      });
      const linked = ((contract as unknown as Record<string, unknown>).contract_projects_detail as { project: number }[] ?? []).map(p => p.project);
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
      await subcontractorsApi.contracts.update(Number(id), payload as Parameters<typeof subcontractorsApi.contracts.update>[1]);

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
    onError: (err) => {
      setUploading(false);
      toast(getApiError(err, 'Failed to update contract'), 'error');
    },
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

        <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="form-body">

          {/* Contract Details */}
          <div className="card">
            <div className="form-section-header">
              <div>
                <div className="form-section-title">Contract Details</div>
                <div className="form-section-desc">Core information about this subcontract</div>
              </div>
            </div>
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

              <div className="form-col-full">
                <FormField label="Contract Title" required>
                  <input
                    type="text" required className="form-input"
                    placeholder="e.g. Civil Works — Al Reem Project"
                    value={form.contract_title}
                    onChange={e => set('contract_title', e.target.value)}
                  />
                </FormField>
              </div>

              <div className="form-col-full">
                <FormField label="Contract Type" required>
                  <div className="type-card-group">
                    {(['unit_rate', 'lump_sum'] as const).map(type => (
                      <label
                        key={type}
                        className={`type-card${form.contract_type === type ? ' selected' : ''}`}
                      >
                        <input
                          type="radio" name="contract_type" value={type}
                          checked={form.contract_type === type}
                          onChange={() => set('contract_type', type)}
                        />
                        <div>
                          <div className="type-card-label">
                            {type === 'unit_rate' ? 'Unit Rate' : 'Lump Sum (مقطوع)'}
                          </div>
                          <div className="type-card-desc">
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
                  : 'Required — this is the fixed contract price'}
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

              <div className="form-col-full">
                <FormField label="Scope of Work">
                  <textarea
                    rows={4} className="form-textarea"
                    placeholder="Describe the scope of work…"
                    value={form.scope_of_work}
                    onChange={e => set('scope_of_work', e.target.value)}
                  />
                </FormField>
              </div>
            </div>
          </div>

          {/* Retention */}
          <div className="card">
            <div className="form-section-header">
              <div>
                <div className="form-section-title">Retention Settings</div>
                <div className="form-section-desc">Deduction held from each payment certificate until project completion</div>
              </div>
              <label className="toggle-wrap">
                <input
                  type="checkbox"
                  checked={form.retention_enabled}
                  onChange={e => set('retention_enabled', e.target.checked)}
                />
                <span className="toggle-track"><span className="toggle-thumb" /></span>
                <span className="toggle-label">{form.retention_enabled ? 'Enabled' : 'Disabled'}</span>
              </label>
            </div>

            {form.retention_enabled && (
              <div className="form-grid">
                <FormField label="Retention Percentage (%)">
                  <input
                    type="number" min="0" max="100" step="0.01" className="form-input"
                    placeholder="5.00"
                    value={form.retention_percentage}
                    onChange={e => set('retention_percentage', e.target.value)}
                  />
                </FormField>
              </div>
            )}
          </div>

          {/* Advance Payment */}
          <div className="card">
            <div className="form-section-header">
              <div>
                <div className="form-section-title">Advance Payment</div>
                <div className="form-section-desc">Mobilization advance to be recovered from future certificates</div>
              </div>
              <label className="toggle-wrap">
                <input
                  type="checkbox"
                  checked={form.advance_payment_enabled}
                  onChange={e => set('advance_payment_enabled', e.target.checked)}
                />
                <span className="toggle-track"><span className="toggle-thumb" /></span>
                <span className="toggle-label">{form.advance_payment_enabled ? 'Enabled' : 'Disabled'}</span>
              </label>
            </div>

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
                      placeholder="10.00"
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

          {/* Attachments */}
          <div className="card">
            <div className="form-section-header">
              <div>
                <div className="form-section-title">Upload Attachments</div>
                <div className="form-section-desc">Add documents to this contract — PDF, Word, Excel, images (max 10 MB each)</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {pendingFiles.map((pf, idx) => (
                <div key={idx} className="file-row">
                  <div style={{ flex: 1 }}>
                    <div className="file-row-name">{pf.file.name}</div>
                    <div className="file-row-size">{(pf.file.size / 1024).toFixed(0)} KB</div>
                  </div>
                  <select
                    className="form-select"
                    style={{ width: 'auto' }}
                    value={pf.docType}
                    onChange={e => setPendingFiles(prev =>
                      prev.map((f, i) => i === idx ? { ...f, docType: e.target.value } : f)
                    )}
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

              <label className="file-drop-zone" style={{ cursor: 'pointer' }}>
                <span className="file-drop-icon">📎</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                    Click to add file(s)
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                    PDF, Word, Excel, JPG, PNG accepted
                  </div>
                </div>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    const MAX = 10 * 1024 * 1024;
                    const oversized = files.filter(f => f.size > MAX);
                    if (oversized.length > 0) {
                      toast(`File too large: ${oversized.map(f => f.name).join(', ')}. Max size is 10 MB.`, 'error');
                      e.target.value = '';
                      return;
                    }
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

          <div className="form-actions">
            <Button
              type="submit"
              variant="primary"
              disabled={mutation.isPending || uploading || !form.subcontractor}
            >
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
