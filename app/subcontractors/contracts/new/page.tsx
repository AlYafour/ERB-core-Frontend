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

  const mutation = useMutation({
    mutationFn: () => subcontractorsApi.contracts.create({ ...form, project_ids: projectIds } as Parameters<typeof subcontractorsApi.contracts.create>[0]),
    onSuccess: (data) => {
      toast('Contract created', 'success');
      router.push(`/subcontractors/contracts/${data.id}`);
    },
    onError: () => toast('Failed to create contract', 'error'),
  });

  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }));

  const subOptions = (subcontractorsData?.results ?? []).map(s => ({
    value: s.id, label: s.company_name,
  }));

  const projectOptions = (projectsData ?? []).map(p => ({
    value: p.id, label: p.name ?? String(p.id),
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

          <FormField label="Contract Value (AED)" required>
            <input
              type="number" required min="0" step="0.01" className="form-input"
              placeholder="0.00"
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

          <FormField label="End Date">
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
              <FormField label="Advance Amount (AED)" required>
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
