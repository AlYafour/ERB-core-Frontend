'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { subcontractorsApi } from '@/lib/api/subcontractors';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import FormField from '@/components/ui/FormField';
import { PageShell, PageHeader, Button } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';

export default function NewSubcontractorPage() {
  const router = useRouter();

  const { data: tradeTypes = [] } = useQuery({
    queryKey: ['trade-types'],
    queryFn: subcontractorsApi.tradeTypes.getAll,
  });

  const [form, setForm] = useState({
    company_name: '',
    trade_type: null as number | null,
    contact_person: '',
    mobile: '',
    email: '',
    address: '',
    commercial_license: '',
    vat_number: '',
    notes: '',
    status: 'active' as 'active' | 'inactive',
  });

  const mutation = useMutation({
    mutationFn: () => subcontractorsApi.create(form),
    onSuccess: (data) => {
      toast('Subcontractor created', 'success');
      router.push(`/subcontractors/${data.id}`);
    },
    onError: () => toast('Failed to create subcontractor', 'error'),
  });

  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }));

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="New Subcontractor"
          breadcrumbs={[
            { label: 'Subcontractors', href: '/subcontractors' },
            { label: 'New Subcontractor' },
          ]}
        />

        <form
          onSubmit={e => { e.preventDefault(); mutation.mutate(); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}
        >
          <div className="card">
            <div className="info-section-title">Company Information</div>
            <div className="form-grid">
              <div style={{ gridColumn: 'span 2' }}>
                <FormField label="Company Name" required>
                  <input
                    type="text" required className="form-input"
                    placeholder="e.g. ABC Contracting LLC"
                    value={form.company_name}
                    onChange={e => set('company_name', e.target.value)}
                  />
                </FormField>
              </div>

              <FormField label="Trade Type">
                <SearchableDropdown
                  options={tradeTypes.map(t => ({ value: t.id, label: t.name }))}
                  value={form.trade_type}
                  onChange={v => set('trade_type', v)}
                  placeholder="Select trade type"
                  allowClear
                />
              </FormField>

              <FormField label="Status">
                <SearchableDropdown
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                  ]}
                  value={form.status}
                  onChange={v => set('status', v)}
                  placeholder="Select status"
                />
              </FormField>
            </div>
          </div>

          <div className="card">
            <div className="info-section-title">Contact Details</div>
            <div className="form-grid">
              <FormField label="Contact Person">
                <input
                  type="text" className="form-input"
                  value={form.contact_person}
                  onChange={e => set('contact_person', e.target.value)}
                />
              </FormField>

              <FormField label="Mobile">
                <input
                  type="tel" className="form-input"
                  value={form.mobile}
                  onChange={e => set('mobile', e.target.value)}
                />
              </FormField>

              <FormField label="Email">
                <input
                  type="email" className="form-input"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                />
              </FormField>

              <div style={{ gridColumn: 'span 2' }}>
                <FormField label="Address">
                  <input
                    type="text" className="form-input"
                    value={form.address}
                    onChange={e => set('address', e.target.value)}
                  />
                </FormField>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="info-section-title">Legal Information</div>
            <div className="form-grid">
              <FormField label="Commercial License No.">
                <input
                  type="text" className="form-input"
                  value={form.commercial_license}
                  onChange={e => set('commercial_license', e.target.value)}
                />
              </FormField>

              <FormField label="VAT / TRN Number">
                <input
                  type="text" className="form-input"
                  value={form.vat_number}
                  onChange={e => set('vat_number', e.target.value)}
                />
              </FormField>

              <div style={{ gridColumn: 'span 2' }}>
                <FormField label="Notes">
                  <textarea
                    rows={3} className="form-textarea"
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)}
                  />
                </FormField>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button type="submit" variant="primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Create Subcontractor'}
            </Button>
            <Link href="/subcontractors">
              <Button variant="secondary">Cancel</Button>
            </Link>
          </div>
        </form>
      </PageShell>
    </MainLayout>
  );
}
