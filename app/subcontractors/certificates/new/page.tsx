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

type InputMode = 'qty' | 'pct';

function ModeToggle({
  mode,
  onChange,
}: {
  mode: InputMode;
  onChange: (m: InputMode) => void;
}) {
  const base: React.CSSProperties = {
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'background 120ms, color 120ms',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  };
  return (
    <div style={{
      display: 'inline-flex',
      border: '1px solid var(--border-default)',
      borderRadius: 6,
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <button
        type="button"
        onClick={() => onChange('qty')}
        style={{
          ...base,
          background: mode === 'qty' ? 'var(--brand)' : 'var(--surface-secondary)',
          color: mode === 'qty' ? '#fff' : 'var(--text-tertiary)',
          borderRight: '1px solid var(--border-default)',
        }}
      >
        Qty
      </button>
      <button
        type="button"
        onClick={() => onChange('pct')}
        style={{
          ...base,
          background: mode === 'pct' ? 'var(--brand)' : 'var(--surface-secondary)',
          color: mode === 'pct' ? '#fff' : 'var(--text-tertiary)',
        }}
      >
        %
      </button>
    </div>
  );
}

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

  // Per-item input mode: 'qty' (absolute) or 'pct' (percentage of contract qty)
  const [modes, setModes]           = useState<Record<number, InputMode>>({});
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [percentages, setPercentages] = useState<Record<number, string>>({});

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

  /** Effective claimed quantity for one item (accounts for both modes) */
  const getClaimedQty = (itemId: number, contractQty: number): number => {
    const mode = modes[itemId] ?? 'qty';
    if (mode === 'pct') {
      const pct = Number(percentages[itemId] ?? 0);
      return (pct / 100) * contractQty;
    }
    return Number(quantities[itemId] ?? 0);
  };

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
        .map(item => ({
          boq_item: item.id,
          claimed: getClaimedQty(item.id, Number(item.contract_quantity)),
        }))
        .filter(x => x.claimed > 0)
        .map(x => ({
          boq_item: x.boq_item,
          contractor_claimed_quantity: String(x.claimed),
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

  const fmt = (v: number) =>
    `AED ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const claimedTotal = (boqItems ?? []).reduce((sum, item) => {
    const qty = getClaimedQty(item.id, Number(item.contract_quantity));
    return sum + qty * Number(item.unit_rate);
  }, 0);

  const retentionPct = Number(contract?.retention_percentage ?? 0);
  const retentionAmt = claimedTotal * (retentionPct / 100);
  const netPayable   = claimedTotal - retentionAmt;

  const allQtyZero = (boqItems ?? []).every(i => Number(i.contract_quantity) === 0);

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
                setPercentages({});
                setModes({});
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
          display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>Subcontractor</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
              {contract.subcontractor_name}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>Contract Value</div>
            <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>
              AED {Number(contract.contract_value).toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>Approved to Date</div>
            <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>
              AED {Number(contract.total_approved_to_date ?? 0).toLocaleString()}
            </div>
          </div>
          {contract.retention_enabled && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>Retention</div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{contract.retention_percentage}%</div>
            </div>
          )}
        </div>
      )}

      {/* ── Measurements table ── */}
      {contractId && boqItems !== undefined && (
        <div className="card">
          {/* Table header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 'var(--space-4)',
          }}>
            <div className="info-section-title" style={{ margin: 0 }}>
              Work Measurements — Contractor Claimed Quantities
            </div>
            {claimedTotal > 0 && (
              <div style={{
                padding: '6px 14px', background: 'var(--brand-subtle)',
                borderRadius: 6, fontSize: 'var(--text-sm)', fontWeight: 600,
                fontFamily: 'monospace', color: 'var(--text-primary)',
              }}>
                Total: {fmt(claimedTotal)}
              </div>
            )}
          </div>

          {boqItems.length === 0 ? (
            <div className="empty-state">
              <p>No BOQ items found for this contract.</p>
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
                      <th style={{ minWidth: 200 }}>Item</th>
                      <th style={{ width: 55 }}>Unit</th>
                      <th style={{ textAlign: 'right', width: 90 }}>Rate (AED)</th>
                      <th style={{ textAlign: 'right', width: 100 }}>Contract Qty</th>
                      <th style={{ textAlign: 'right', width: 90 }}>Approved</th>
                      <th style={{ textAlign: 'right', width: 90 }}>Remaining</th>
                      {/* Input column — wider to hold toggle + field */}
                      <th style={{ width: 200, color: 'var(--brand)' }}>
                        Claimed ▼ &nbsp;
                        <span style={{ fontWeight: 400, fontSize: 10, color: 'var(--text-tertiary)' }}>
                          (Qty or %)
                        </span>
                      </th>
                      <th style={{ textAlign: 'right', width: 130 }}>Amount (AED)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boqItems.map(item => {
                      const contractQty = Number(item.contract_quantity);
                      const approved    = Number(item.approved_quantity_to_date);
                      const remaining   = Number(item.remaining_quantity);
                      const mode        = modes[item.id] ?? 'qty';
                      const claimedQty  = getClaimedQty(item.id, contractQty);
                      const amount      = claimedQty * Number(item.unit_rate);

                      return (
                        <tr key={item.id} style={{ verticalAlign: 'middle' }}>
                          {/* Item name */}
                          <td style={{ paddingTop: 10 }}>
                            <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>
                              {item.item_name}
                            </div>
                            {item.item_code && (
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                {item.item_code}
                              </div>
                            )}
                          </td>

                          {/* Unit */}
                          <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                            {item.unit || '—'}
                          </td>

                          {/* Rate */}
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                            {Number(item.unit_rate).toLocaleString()}
                          </td>

                          {/* Contract Qty */}
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', paddingTop: 10, color: contractQty === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                            {contractQty === 0 ? '—' : contractQty.toLocaleString()}
                          </td>

                          {/* Approved */}
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', paddingTop: 10, color: 'var(--text-tertiary)' }}>
                            {approved.toLocaleString()}
                          </td>

                          {/* Remaining */}
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', paddingTop: 10, color: remaining < 0 ? 'var(--status-error)' : contractQty === 0 ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
                            {contractQty === 0 ? '—' : remaining.toLocaleString()}
                          </td>

                          {/* Input cell: toggle + field on ONE LINE */}
                          <td style={{ padding: '6px 8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <ModeToggle
                                mode={mode}
                                onChange={m => setModes(prev => ({ ...prev, [item.id]: m }))}
                              />

                              {mode === 'qty' ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  placeholder="0.000"
                                  value={quantities[item.id] ?? ''}
                                  onChange={e => setQuantities(q => ({ ...q, [item.id]: e.target.value }))}
                                  style={{
                                    flex: 1, padding: '4px 8px',
                                    border: '2px solid var(--brand)', borderRadius: 6,
                                    fontSize: 'var(--text-sm)', fontFamily: 'monospace',
                                    textAlign: 'right',
                                    background: 'var(--surface-primary)',
                                    color: 'var(--text-primary)', outline: 'none',
                                    minWidth: 0,
                                  }}
                                />
                              ) : (
                                <>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    placeholder="0.0"
                                    value={percentages[item.id] ?? ''}
                                    onChange={e => setPercentages(p => ({ ...p, [item.id]: e.target.value }))}
                                    style={{
                                      flex: 1, padding: '4px 8px',
                                      border: '2px solid var(--brand)', borderRadius: 6,
                                      fontSize: 'var(--text-sm)', fontFamily: 'monospace',
                                      textAlign: 'right',
                                      background: 'var(--surface-primary)',
                                      color: 'var(--text-primary)', outline: 'none',
                                      minWidth: 0,
                                    }}
                                  />
                                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', flexShrink: 0 }}>%</span>
                                </>
                              )}
                            </div>

                            {/* Hint: show calculated qty when % mode & contractQty > 0 */}
                            {mode === 'pct' && contractQty > 0 && claimedQty > 0 && (
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, textAlign: 'right' }}>
                                = {claimedQty.toFixed(3)} {item.unit}
                              </div>
                            )}
                          </td>

                          {/* Amount */}
                          <td style={{
                            textAlign: 'right', fontFamily: 'monospace',
                            fontSize: 'var(--text-sm)', paddingTop: 10,
                            fontWeight: amount > 0 ? 600 : 400,
                            color: amount > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
                          }}>
                            {amount > 0
                              ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* ── Footer totals ── */}
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border-default)' }}>
                      <td colSpan={6} style={{
                        textAlign: 'right', fontWeight: 600,
                        fontSize: 'var(--text-sm)', padding: '10px 8px',
                        color: 'var(--text-secondary)',
                      }}>
                        Gross Claimed This Certificate
                      </td>
                      <td style={{ padding: '10px 8px' }}></td>
                      <td style={{
                        textAlign: 'right', fontFamily: 'monospace',
                        fontWeight: 700, color: 'var(--brand)', padding: '10px 8px',
                      }}>
                        {fmt(claimedTotal)}
                      </td>
                    </tr>

                    {contract?.retention_enabled && claimedTotal > 0 && (
                      <tr style={{ background: 'var(--surface-secondary)' }}>
                        <td colSpan={6} style={{
                          textAlign: 'right', fontSize: 'var(--text-sm)',
                          padding: '6px 8px', color: 'var(--text-tertiary)',
                        }}>
                          Retention ({contract.retention_percentage}%)
                        </td>
                        <td></td>
                        <td style={{
                          textAlign: 'right', fontFamily: 'monospace',
                          fontSize: 'var(--text-sm)', color: 'var(--status-error)',
                          padding: '6px 8px',
                        }}>
                          − {fmt(retentionAmt)}
                        </td>
                      </tr>
                    )}

                    {claimedTotal > 0 && (
                      <tr style={{ background: 'var(--surface-secondary)' }}>
                        <td colSpan={6} style={{
                          textAlign: 'right', fontWeight: 700,
                          fontSize: 'var(--text-sm)', padding: '8px 8px',
                          color: 'var(--text-primary)',
                        }}>
                          Estimated Net Payable
                        </td>
                        <td></td>
                        <td style={{
                          textAlign: 'right', fontFamily: 'monospace',
                          fontWeight: 700, color: 'var(--text-primary)',
                          fontSize: 'var(--text-base)', padding: '8px 8px',
                        }}>
                          {fmt(netPayable)}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>

              {/* Warning: contract quantities not set */}
              {allQtyZero && (
                <div style={{
                  marginTop: 12, padding: '10px 14px',
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: 6, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
                }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Note:</strong>{' '}
                  Contract quantities are not set — the <strong>%</strong> mode is disabled for all items.
                  Use <strong>Qty</strong> mode to enter absolute quantities, or set contract quantities
                  first from the contract BOQ tab.
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
            Gross: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{fmt(claimedTotal)}</strong>
            {contract?.retention_enabled && (
              <> · Net: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{fmt(netPayable)}</strong></>
            )}
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
