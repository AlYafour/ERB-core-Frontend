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

function NewCertificateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preContractId = searchParams.get('contract');

  const [contractId, setContractId] = useState<number | null>(
    preContractId ? Number(preContractId) : null
  );
  const [form, setForm] = useState({
    certificate_date: new Date().toISOString().slice(0, 10),
    period_from: '',
    period_to: '',
    notes: '',
  });
  const [quantities, setQuantities] = useState<Record<number, string>>({});

  const { data: contractsData } = useQuery({
    queryKey: ['subcon-contracts-active'],
    queryFn: () => subcontractorsApi.contracts.list({ page_size: 200 }),
  });

  const { data: contract } = useQuery({
    queryKey: ['subcon-contract', contractId],
    queryFn: () => subcontractorsApi.contracts.getOne(contractId!),
    enabled: !!contractId,
  });

  const { data: boqItems } = useQuery({
    queryKey: ['boq-items', contractId],
    queryFn: () => subcontractorsApi.boqItems.list(contractId!),
    enabled: !!contractId,
  });

  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error('No contract selected');

      const cert = await subcontractorsApi.certificates.create({
        contract: contractId!,
        subcontractor: contract.subcontractor,
        certificate_date: form.certificate_date,
        period_from: form.period_from || undefined,
        period_to: form.period_to || undefined,
        notes: form.notes,
      } as Parameters<typeof subcontractorsApi.certificates.create>[0]);

      const items = (boqItems ?? [])
        .filter(item => quantities[item.id] !== undefined && quantities[item.id] !== '')
        .map(item => ({
          boq_item: item.id,
          contractor_claimed_quantity: quantities[item.id] || '0',
          engineer_approved_quantity: '0',
        }));

      if (items.length > 0) {
        await subcontractorsApi.certificates.saveItems(cert.id, items);
      }

      return cert;
    },
    onSuccess: (cert) => {
      toast('Certificate created', 'success');
      router.push(`/subcontractors/certificates/${cert.id}`);
    },
    onError: () => toast('Failed to create certificate', 'error'),
  });

  const contractOptions = (contractsData?.results ?? []).map(c => ({
    value: c.id,
    label: `${c.contract_no} — ${c.subcontractor_name}`,
  }));

  return (
    <form
      onSubmit={e => { e.preventDefault(); mutation.mutate(); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}
    >
      {/* Certificate Details */}
      <div className="card">
        <div className="info-section-title">Certificate Details</div>
        <div className="form-grid">
          <FormField label="Contract" required>
            <SearchableDropdown
              options={contractOptions}
              value={contractId}
              onChange={v => {
                setContractId(v ? Number(v) : null);
                setQuantities({});
              }}
              placeholder="Select contract"
            />
          </FormField>

          <FormField label="Certificate Date" required>
            <input
              type="date" required className="form-input"
              value={form.certificate_date}
              onChange={e => set('certificate_date', e.target.value)}
            />
          </FormField>

          <FormField label="Period From">
            <input
              type="date" className="form-input"
              value={form.period_from}
              onChange={e => set('period_from', e.target.value)}
            />
          </FormField>

          <FormField label="Period To">
            <input
              type="date" className="form-input"
              value={form.period_to}
              onChange={e => set('period_to', e.target.value)}
            />
          </FormField>

          <div style={{ gridColumn: 'span 2' }}>
            <FormField label="Notes">
              <textarea
                rows={2} className="form-textarea"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </FormField>
          </div>
        </div>
      </div>

      {/* Contract summary banner */}
      {contract && (
        <div className="card" style={{ background: 'var(--brand-subtle)', border: '1px solid var(--brand-border, var(--border-default))' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{contract.subcontractor_name}</strong>
            {' · Contract Value: '}
            <strong style={{ color: 'var(--text-primary)' }}>AED {Number(contract.contract_value).toLocaleString()}</strong>
            {contract.retention_enabled && (
              <span> · Retention: <strong>{contract.retention_percentage}%</strong></span>
            )}
            {contract.advance_payment_enabled && (
              <span> · Advance: <strong>AED {Number(contract.advance_payment_amount).toLocaleString()}</strong></span>
            )}
          </div>
        </div>
      )}

      {/* Measurements table */}
      {contractId && boqItems !== undefined && (
        <div className="card">
          <div className="info-section-title">Measurements — Contractor Claimed Quantities</div>
          {boqItems.length === 0 ? (
            <div className="empty-state">
              <p>No BOQ items found for this contract. Add BOQ items first from the contract page.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Unit</th>
                    <th style={{ textAlign: 'right' }}>Contract Qty</th>
                    <th style={{ textAlign: 'right' }}>Approved to Date</th>
                    <th style={{ textAlign: 'right' }}>Remaining</th>
                    <th style={{ textAlign: 'right', minWidth: 130 }}>Claimed Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {boqItems.map(item => {
                    const remaining = Number(item.remaining_quantity);
                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{item.item_name}</div>
                          {item.item_code && (
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                              {item.item_code}
                            </div>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{item.unit}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {Number(item.contract_quantity).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
                          {Number(item.approved_quantity_to_date).toLocaleString()}
                        </td>
                        <td style={{
                          textAlign: 'right', fontFamily: 'monospace',
                          color: remaining <= 0 ? 'var(--status-error)' : 'var(--text-secondary)',
                        }}>
                          {remaining.toLocaleString()}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            className="form-input"
                            style={{ textAlign: 'right' }}
                            placeholder="0"
                            value={quantities[item.id] ?? ''}
                            onChange={e => setQuantities(q => ({ ...q, [item.id]: e.target.value }))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <Button
          type="submit"
          variant="primary"
          disabled={mutation.isPending || !contractId}
        >
          {mutation.isPending ? 'Creating…' : 'Create Certificate'}
        </Button>
        <Link href="/subcontractors/certificates">
          <Button variant="secondary">Cancel</Button>
        </Link>
      </div>
    </form>
  );
}

export default function NewCertificatePage() {
  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="New IPC Certificate"
          breadcrumbs={[
            { label: 'Subcontractors', href: '/subcontractors' },
            { label: 'Certificates', href: '/subcontractors/certificates' },
            { label: 'New Certificate' },
          ]}
        />
        <Suspense fallback={<div className="card empty-state"><p>Loading…</p></div>}>
          <NewCertificateForm />
        </Suspense>
      </PageShell>
    </MainLayout>
  );
}
