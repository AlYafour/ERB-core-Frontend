'use client';

import React, { useState, Suspense } from 'react';
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

type InputMode = 'qty' | 'pct';

function ModeToggle({ mode, onChange }: { mode: InputMode; onChange: (m: InputMode) => void }) {
  const base: React.CSSProperties = {
    padding: '4px 10px', fontSize: 11, fontWeight: 600,
    border: 'none', cursor: 'pointer',
    transition: 'background 120ms, color 120ms',
    lineHeight: 1, whiteSpace: 'nowrap',
  };
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--border-default)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
      <button type="button" onClick={() => onChange('qty')} style={{ ...base, background: mode === 'qty' ? 'var(--brand)' : 'var(--surface-secondary)', color: mode === 'qty' ? '#fff' : 'var(--text-tertiary)', borderRight: '1px solid var(--border-default)' }}>Qty</button>
      <button type="button" onClick={() => onChange('pct')} style={{ ...base, background: mode === 'pct' ? 'var(--brand)' : 'var(--surface-secondary)', color: mode === 'pct' ? '#fff' : 'var(--text-tertiary)' }}>%</button>
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

  const [modes, setModes]               = useState<Record<number, InputMode>>({});
  const [quantities, setQuantities]     = useState<Record<number, string>>({});
  const [percentages, setPercentages]   = useState<Record<number, string>>({});
  const [breakdownQty, setBreakdownQty] = useState<Record<number, Record<string, string>>>({});
  const [lumpSumPct, setLumpSumPct]     = useState('');

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

  const getClaimedQty = (itemId: number, contractQty: number, hasBreakdowns = false): number => {
    if (hasBreakdowns) {
      const locs = breakdownQty[itemId] ?? {};
      return Object.values(locs).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    }
    const mode = modes[itemId] ?? 'qty';
    if (mode === 'pct') return (Number(percentages[itemId] ?? 0) / 100) * contractQty;
    return Number(quantities[itemId] ?? 0);
  };

  const isLumpSum = contract?.contract_type === 'lump_sum';

  const mutation = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error('No contract selected');

      const basePayload: Record<string, unknown> = {
        contract: contractId!,
        subcontractor: contract.subcontractor,
        certificate_date: form.certificate_date,
        period_from: form.period_from || undefined,
        period_to: form.period_to || undefined,
        notes: form.notes,
      };

      if (isLumpSum) {
        basePayload.lump_sum_claimed_pct  = lumpSumPct || '0';
        basePayload.lump_sum_approved_pct = '0';
      }

      const cert = await subcontractorsApi.certificates.create(
        basePayload as Parameters<typeof subcontractorsApi.certificates.create>[0]
      );

      if (!isLumpSum) {
        const items = (boqItems ?? [])
          .map(item => {
            const hasBreakdowns = (item.breakdowns?.length ?? 0) > 0;
            const claimedQty    = getClaimedQty(item.id, Number(item.contract_quantity), hasBreakdowns);
            if (hasBreakdowns) {
              const bds = item.breakdowns!
                .map((bd, i) => ({
                  location: bd.location,
                  contractor_quantity: String(parseFloat((breakdownQty[item.id] ?? {})[bd.location] ?? '0') || 0),
                  engineer_quantity: '0',
                  order: i,
                }))
                .filter(bd => Number(bd.contractor_quantity) > 0);
              return { boq_item: item.id, contractor_claimed_quantity: String(claimedQty), engineer_approved_quantity: '0', breakdowns: bds };
            }
            return { boq_item: item.id, contractor_claimed_quantity: String(claimedQty), engineer_approved_quantity: '0' };
          })
          .filter(item => Number(item.contractor_claimed_quantity) > 0);

        if (items.length > 0) {
          await subcontractorsApi.certificates.saveItems(cert.id, items);
        }
      }

      return cert;
    },
    onSuccess: (cert) => {
      toast('Certificate created successfully', 'success');
      router.push(`/subcontractors/certificates/${cert.id}`);
    },
    onError: (err) => toast(getApiError(err, 'Failed to create certificate'), 'error'),
  });

  const contractOptions = (contractsData?.results ?? []).map(c => ({
    value: c.id,
    label: `${c.contract_no} — ${c.subcontractor_name}`,
  }));

  const fmt = (v: number) =>
    `AED ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const lumpSumClaimedAmt = isLumpSum
    ? Number(contract?.contract_value ?? 0) * (parseFloat(lumpSumPct) || 0) / 100
    : 0;

  const claimedTotal = isLumpSum
    ? lumpSumClaimedAmt
    : (boqItems ?? []).reduce((sum, item) => {
        const qty = getClaimedQty(item.id, Number(item.contract_quantity), (item.breakdowns?.length ?? 0) > 0);
        return sum + qty * Number(item.unit_rate);
      }, 0);

  const retentionPct = Number(contract?.retention_percentage ?? 0);
  const retentionAmt = claimedTotal * (retentionPct / 100);
  const netPayable   = claimedTotal - retentionAmt;
  const allQtyZero   = (boqItems ?? []).every(i => Number(i.contract_quantity) === 0);

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        if (form.period_from && form.period_to && form.period_to < form.period_from) {
          toast('Period "To" date must be on or after the "From" date.', 'error');
          return;
        }
        mutation.mutate();
      }}
      className="form-body"
    >

      {/* Certificate Details */}
      <div className="card">
        <div className="form-section-header">
          <div>
            <div className="form-section-title">Certificate Details</div>
            <div className="form-section-desc">Select the contract and set the claim period</div>
          </div>
        </div>
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
                setBreakdownQty({});
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

          <div className="form-col-full">
            <FormField label="Notes">
              <textarea
                rows={2} className="form-textarea"
                placeholder="Any remarks for this certificate…"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </FormField>
          </div>
        </div>
      </div>

      {/* Contract summary */}
      {contract && (
        <div className="info-banner">
          <div>
            <div className="info-banner-item-label">Subcontractor</div>
            <div className="info-banner-item-value">{contract.subcontractor_name}</div>
          </div>
          <div>
            <div className="info-banner-item-label">Contract Value</div>
            <div className="info-banner-item-value" style={{ fontFamily: 'monospace' }}>
              AED {Number(contract.contract_value).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="info-banner-item-label">Approved to Date</div>
            <div className="info-banner-item-value" style={{ fontFamily: 'monospace' }}>
              AED {Number(contract.total_approved_to_date ?? 0).toLocaleString()}
            </div>
          </div>
          {contract.retention_enabled && (
            <div>
              <div className="info-banner-item-label">Retention</div>
              <div className="info-banner-item-value">{contract.retention_percentage}%</div>
            </div>
          )}
        </div>
      )}

      {/* Lump sum % input */}
      {contractId && isLumpSum && (
        <div className="card">
          <div className="form-section-header">
            <div>
              <div className="form-section-title">Claim — Lump Sum Contract (مقطوع)</div>
              <div className="form-section-desc">Enter the percentage of work completed this period</div>
            </div>
          </div>

          <div className="warning-banner" style={{ marginBottom: 'var(--space-4)' }}>
            This is a lump sum contract. Enter the percentage of work completed this period.
          </div>

          <div style={{ maxWidth: 480 }}>
            <FormField label="% Completed This Period (Contractor Claimed)" required>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <input
                  type="number" min="0" max="100" step="0.1"
                  required className="form-input"
                  placeholder="e.g. 30"
                  value={lumpSumPct}
                  onChange={e => setLumpSumPct(e.target.value)}
                  style={{ maxWidth: 140, textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-base)', fontWeight: 600 }}
                />
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--brand)' }}>%</span>
                {lumpSumClaimedAmt > 0 && (
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    = {fmt(lumpSumClaimedAmt)}
                  </span>
                )}
              </div>
            </FormField>

            {lumpSumClaimedAmt > 0 && (
              <div className="summary-box" style={{ marginTop: 'var(--space-4)' }}>
                <div className="summary-row">
                  <span className="summary-row-label">Gross Claimed</span>
                  <span className="summary-row-value">{fmt(lumpSumClaimedAmt)}</span>
                </div>
                {contract?.retention_enabled && (
                  <div className="summary-row">
                    <span className="summary-row-label">Retention ({retentionPct}%)</span>
                    <span className="summary-row-value negative">− {fmt(retentionAmt)}</span>
                  </div>
                )}
                <div className="summary-row">
                  <span className="summary-row-label" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Est. Net Payable</span>
                  <span className="summary-row-value total">{fmt(netPayable)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Measurements table (unit rate) */}
      {contractId && !isLumpSum && boqItems !== undefined && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div>
              <div className="form-section-title">Work Measurements</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>Contractor claimed quantities for this certificate</div>
            </div>
            {claimedTotal > 0 && (
              <div style={{ padding: '6px 14px', background: 'var(--brand-subtle)', borderRadius: 6, fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
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
                      <th style={{ width: 200, color: 'var(--brand)' }}>
                        Claimed ▼&nbsp;
                        <span style={{ fontWeight: 400, fontSize: 10, color: 'var(--text-tertiary)' }}>(Qty or %)</span>
                      </th>
                      <th style={{ textAlign: 'right', width: 130 }}>Amount (AED)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boqItems.map(item => {
                      const contractQty   = Number(item.contract_quantity);
                      const approved      = Number(item.approved_quantity_to_date);
                      const remaining     = Number(item.remaining_quantity);
                      const hasBreakdowns = (item.breakdowns?.length ?? 0) > 0;

                      if (hasBreakdowns) {
                        const claimedQty = getClaimedQty(item.id, contractQty, true);
                        const amount     = claimedQty * Number(item.unit_rate);
                        return (
                          <React.Fragment key={item.id}>
                            <tr style={{ background: 'var(--surface-secondary)', borderTop: '2px solid var(--border-subtle)' }}>
                              <td colSpan={2} style={{ padding: '8px', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                                {item.item_name}
                                {item.item_code && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8, fontWeight: 400 }}>{item.item_code}</span>}
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 500 }}>{Number(item.unit_rate) > 0 ? Number(item.unit_rate).toLocaleString() : '—'}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>{contractQty > 0 ? contractQty.toLocaleString() : '—'}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{approved.toLocaleString()}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: remaining < 0 ? 'var(--status-error)' : 'var(--text-secondary)' }}>{contractQty > 0 ? remaining.toLocaleString() : '—'}</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: claimedQty > 0 ? 'var(--brand)' : 'var(--text-tertiary)', fontWeight: 600 }}>{claimedQty > 0 ? `${claimedQty.toFixed(3)} ${item.unit || ''}`.trim() : '—'}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: amount > 0 ? 700 : 400, color: amount > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{amount > 0 ? amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}</td>
                            </tr>
                            {item.breakdowns!.map((bd, bi) => {
                              const locVal = (breakdownQty[item.id] ?? {})[bd.location] ?? '';
                              const isLast = bi === item.breakdowns!.length - 1;
                              const cellStyle: React.CSSProperties = { borderBottom: isLast ? '2px solid var(--border-subtle)' : '1px solid var(--border-subtle)' };
                              return (
                                <tr key={`${item.id}-bd-${bi}`}>
                                  <td colSpan={2} style={{ ...cellStyle, paddingLeft: 28, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', paddingTop: 6, paddingBottom: 6 }}>
                                    <span style={{ color: 'var(--text-tertiary)', marginRight: 6, fontSize: 11 }}>↳</span>{bd.location}
                                  </td>
                                  <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>—</td>
                                  <td style={{ ...cellStyle, textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{Number(bd.quantity).toLocaleString()}</td>
                                  <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>—</td>
                                  <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>—</td>
                                  <td style={{ ...cellStyle, padding: '4px 8px' }}>
                                    <input
                                      type="number" min="0" step="0.001" placeholder="0.000"
                                      value={locVal}
                                      onChange={e => setBreakdownQty(prev => ({ ...prev, [item.id]: { ...(prev[item.id] ?? {}), [bd.location]: e.target.value } }))}
                                      style={{ width: '100%', padding: '4px 8px', border: '2px solid var(--brand)', borderRadius: 6, fontSize: 'var(--text-sm)', fontFamily: 'monospace', textAlign: 'right', background: 'var(--surface-primary)', color: 'var(--text-primary)', outline: 'none' }}
                                    />
                                  </td>
                                  <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>—</td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      }

                      const mode       = modes[item.id] ?? 'qty';
                      const claimedQty = getClaimedQty(item.id, contractQty, false);
                      const amount     = claimedQty * Number(item.unit_rate);
                      return (
                        <tr key={item.id} style={{ verticalAlign: 'middle' }}>
                          <td style={{ paddingTop: 10 }}>
                            <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{item.item_name}</div>
                            {item.item_code && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{item.item_code}</div>}
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{item.unit || '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 500 }}>{Number(item.unit_rate).toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', paddingTop: 10, color: contractQty === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{contractQty === 0 ? '—' : contractQty.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', paddingTop: 10, color: 'var(--text-tertiary)' }}>{approved.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', paddingTop: 10, color: remaining < 0 ? 'var(--status-error)' : contractQty === 0 ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>{contractQty === 0 ? '—' : remaining.toLocaleString()}</td>
                          <td style={{ padding: '6px 8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <ModeToggle mode={mode} onChange={m => setModes(prev => ({ ...prev, [item.id]: m }))} />
                              {mode === 'qty' ? (
                                <input
                                  type="number" min="0" step="0.001" placeholder="0.000"
                                  value={quantities[item.id] ?? ''}
                                  onChange={e => setQuantities(q => ({ ...q, [item.id]: e.target.value }))}
                                  style={{ flex: 1, padding: '4px 8px', border: '2px solid var(--brand)', borderRadius: 6, fontSize: 'var(--text-sm)', fontFamily: 'monospace', textAlign: 'right', background: 'var(--surface-primary)', color: 'var(--text-primary)', outline: 'none', minWidth: 0 }}
                                />
                              ) : (
                                <>
                                  <input
                                    type="number" min="0" max="100" step="0.1" placeholder="0.0"
                                    value={percentages[item.id] ?? ''}
                                    onChange={e => setPercentages(p => ({ ...p, [item.id]: e.target.value }))}
                                    style={{ flex: 1, padding: '4px 8px', border: '2px solid var(--brand)', borderRadius: 6, fontSize: 'var(--text-sm)', fontFamily: 'monospace', textAlign: 'right', background: 'var(--surface-primary)', color: 'var(--text-primary)', outline: 'none', minWidth: 0 }}
                                  />
                                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', flexShrink: 0 }}>%</span>
                                </>
                              )}
                            </div>
                            {mode === 'pct' && contractQty > 0 && claimedQty > 0 && (
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, textAlign: 'right' }}>
                                = {claimedQty.toFixed(3)} {item.unit}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', paddingTop: 10, fontWeight: amount > 0 ? 600 : 400, color: amount > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                            {amount > 0 ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border-default)' }}>
                      <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, fontSize: 'var(--text-sm)', padding: '10px 8px', color: 'var(--text-secondary)' }}>
                        Gross Claimed This Certificate
                      </td>
                      <td style={{ padding: '10px 8px' }} />
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--brand)', padding: '10px 8px' }}>
                        {fmt(claimedTotal)}
                      </td>
                    </tr>
                    {contract?.retention_enabled && claimedTotal > 0 && (
                      <tr style={{ background: 'var(--surface-secondary)' }}>
                        <td colSpan={6} style={{ textAlign: 'right', fontSize: 'var(--text-sm)', padding: '6px 8px', color: 'var(--text-tertiary)' }}>
                          Retention ({contract.retention_percentage}%)
                        </td>
                        <td />
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--status-error)', padding: '6px 8px' }}>
                          − {fmt(retentionAmt)}
                        </td>
                      </tr>
                    )}
                    {claimedTotal > 0 && (
                      <tr style={{ background: 'var(--surface-secondary)' }}>
                        <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, fontSize: 'var(--text-sm)', padding: '8px', color: 'var(--text-primary)' }}>
                          Estimated Net Payable
                        </td>
                        <td />
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-base)', padding: '8px' }}>
                          {fmt(netPayable)}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>

              {allQtyZero && (
                <div className="warning-banner" style={{ marginTop: 12 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Note:</strong>{' '}
                  Contract quantities are not set — the <strong>%</strong> mode is disabled for all items.
                  Use <strong>Qty</strong> mode to enter absolute quantities, or set contract quantities first from the contract BOQ tab.
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="form-actions">
        <Button type="submit" variant="primary" disabled={mutation.isPending || !contractId}>
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
