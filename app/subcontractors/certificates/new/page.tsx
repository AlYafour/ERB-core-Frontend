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
        .filter(item => quantities[item.id] && Number(quantities[item.id]) > 0)
        .map(item => ({
          boq_item: item.id,
          contractor_claimed_quantity: quantities[item.id],
          engineer_approved_quantity: '0',
        }));

      if (items.length > 0) {
        await subcontractorsApi.certificates.saveItems(cert.id, items);
      }

      return cert;
    },
    onSuccess: (cert) => {
      toast('Certificate created successfully', 'success');
      router.push(`/subcontractors/certificates/${cert.id}`);
    },
    onError: () => toast('Failed to create certificate', 'error'),
  });

  const contractOptions = (contractsData?.results ?? []).map(c => ({
    value: c.id,
    label: `${c.contract_no} — ${c.subcontractor_name}`,
  }));

  // Running totals
  const claimedTotal = (boqItems ?? []).reduce((sum, item) => {
    const qty = Number(quantities[item.id] ?? 0);
    const rate = Number(item.unit_rate);
    return sum + qty * rate;
  }, 0);

  const fmt = (v: number) => `AED ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <form
      onSubmit={e => { e.preventDefault(); mutation.mutate(); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}
    >
      {/* ── Certificate Details ── */}
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
              placeholder="Select contract…"
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

      {/* ── Contract summary banner ── */}
      {contract && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--brand-subtle)',
          border: '1px solid var(--brand-border, var(--border-default))',
          borderRadius: 8,
          display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>Subcontractor</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
              {contract.subcontractor_name}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>Contract Value</div>
            <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>
              AED {Number(contract.contract_value).toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>Approved to Date</div>
            <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>
              AED {Number(contract.total_approved_to_date ?? 0).toLocaleString()}
            </div>
          </div>
          {contract.retention_enabled && (
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>Retention</div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{contract.retention_percentage}%</div>
            </div>
          )}
          {contract.advance_payment_enabled && (
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>Advance</div>
              <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>
                AED {Number(contract.advance_payment_amount).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Measurements table ── */}
      {contractId && boqItems !== undefined && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div className="info-section-title" style={{ margin: 0 }}>
              Work Measurements — Contractor Claimed Quantities
            </div>
            {claimedTotal > 0 && (
              <div style={{
                padding: '6px 14px',
                background: 'var(--brand-subtle)',
                borderRadius: 6,
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                fontFamily: 'monospace',
                color: 'var(--text-primary)',
              }}>
                Claiming: {fmt(claimedTotal)}
              </div>
            )}
          </div>

          {boqItems.length === 0 ? (
            <div className="empty-state">
              <p style={{ marginBottom: 8 }}>No BOQ items found for this contract.</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                Go to the contract BOQ tab and add items first.
              </p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 220 }}>Item</th>
                      <th style={{ width: 55 }}>Unit</th>
                      <th style={{ textAlign: 'right', width: 90 }}>Rate (AED)</th>
                      <th style={{ textAlign: 'right', width: 100 }}>Contract Qty</th>
                      <th style={{ textAlign: 'right', width: 100 }}>Approved</th>
                      <th style={{ textAlign: 'right', width: 100 }}>Remaining</th>
                      <th style={{ textAlign: 'right', width: 140, color: 'var(--brand)' }}>Claimed Qty ▼</th>
                      <th style={{ textAlign: 'right', width: 130 }}>Amount (AED)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boqItems.map(item => {
                      const claimedQty    = Number(quantities[item.id] ?? 0);
                      const claimedAmount = claimedQty * Number(item.unit_rate);
                      const remaining     = Number(item.remaining_quantity);
                      const contractQty   = Number(item.contract_quantity);

                      return (
                        <tr key={item.id}>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{item.item_name}</div>
                            {item.item_code && (
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                {item.item_code}
                              </div>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                            {item.unit || '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                            {Number(item.unit_rate).toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: contractQty === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                            {contractQty === 0 ? '—' : contractQty.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                            {Number(item.approved_quantity_to_date).toLocaleString()}
                          </td>
                          <td style={{
                            textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)',
                            color: remaining < 0 ? 'var(--status-error)' : contractQty === 0 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                          }}>
                            {contractQty === 0 ? '—' : remaining.toLocaleString()}
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              placeholder="0.000"
                              value={quantities[item.id] ?? ''}
                              onChange={e => setQuantities(q => ({ ...q, [item.id]: e.target.value }))}
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                border: '2px solid var(--brand)',
                                borderRadius: 6,
                                fontSize: 'var(--text-sm)',
                                fontFamily: 'monospace',
                                textAlign: 'right',
                                background: 'var(--surface-primary)',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                boxSizing: 'border-box',
                              }}
                            />
                          </td>
                          <td style={{
                            textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)',
                            fontWeight: claimedAmount > 0 ? 600 : 400,
                            color: claimedAmount > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
                          }}>
                            {claimedAmount > 0 ? claimedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals footer */}
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border-default)' }}>
                      <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, fontSize: 'var(--text-sm)', padding: '10px 8px', color: 'var(--text-secondary)' }}>
                        Total Claimed This Certificate
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--brand)', padding: '10px 8px' }}>
                        {(boqItems ?? []).reduce((s, i) => s + Number(quantities[i.id] ?? 0), 0)
                          .toLocaleString(undefined, { minimumFractionDigits: 3 })}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--brand)', padding: '10px 8px' }}>
                        {fmt(claimedTotal)}
                      </td>
                    </tr>
                    {contract?.retention_enabled && claimedTotal > 0 && (
                      <tr style={{ background: 'var(--surface-secondary)' }}>
                        <td colSpan={6} style={{ textAlign: 'right', fontSize: 'var(--text-sm)', padding: '6px 8px', color: 'var(--text-tertiary)' }}>
                          Estimated Retention ({contract.retention_percentage}%)
                        </td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', padding: '6px 8px' }}>
                          − {fmt(claimedTotal * Number(contract.retention_percentage) / 100)}
                        </td>
                      </tr>
                    )}
                    {contract?.retention_enabled && claimedTotal > 0 && (
                      <tr style={{ background: 'var(--surface-secondary)' }}>
                        <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, fontSize: 'var(--text-sm)', padding: '6px 8px', color: 'var(--text-primary)' }}>
                          Est. Net Payable
                        </td>
                        <td></td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)', padding: '6px 8px' }}>
                          {fmt(claimedTotal * (1 - Number(contract.retention_percentage) / 100))}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>

              {/* Note if contract quantities are all 0 */}
              {boqItems.every(i => Number(i.contract_quantity) === 0) && (
                <div style={{
                  marginTop: 12, padding: '10px 14px',
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: 6,
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Note:</strong>{' '}
                  Contract quantities are not set yet. You can still enter claimed quantities above.
                  To set contract quantities, go to the contract BOQ tab and edit each item.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Actions ── */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
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
        {claimedTotal > 0 && (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginLeft: 8 }}>
            Total claim: <strong style={{ color: 'var(--text-primary)' }}>{fmt(claimedTotal)}</strong>
          </span>
        )}
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
