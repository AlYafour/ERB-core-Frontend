'use client';

import { useState, Suspense, useEffect } from 'react';
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

function NewPaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const certId = searchParams.get('certificate');
  const contId = searchParams.get('contract');

  const { data: cert } = useQuery({
    queryKey: ['cert-for-payment', certId],
    queryFn: () => subcontractorsApi.certificates.getOne(Number(certId)),
    enabled: !!certId,
  });

  const [form, setForm] = useState({
    contract:               contId ? Number(contId) : null as number | null,
    certificate:            certId ? Number(certId) : null as number | null,
    payment_date:           new Date().toISOString().slice(0, 10),
    gross_amount:           '',
    retention_amount:       '0',
    advance_deduction:      '0',
    other_deductions:       '0',
    other_deductions_notes: '',
    payment_method:         '' as 'bank_transfer' | 'cheque' | 'cash' | '',
    reference_number:       '',
    is_retention_release:   false,
    notes:                  '',
  });

  useEffect(() => {
    if (cert) {
      setForm(f => ({
        ...f,
        gross_amount:      f.gross_amount || String(Number(cert.gross_approved_amount)),
        retention_amount:  f.retention_amount === '0' ? String(Number(cert.retention_amount)) : f.retention_amount,
        advance_deduction: f.advance_deduction === '0' ? String(Number(cert.advance_deduction)) : f.advance_deduction,
        other_deductions:  f.other_deductions === '0' ? String(Number(cert.other_deductions)) : f.other_deductions,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cert?.id]);

  const netPayable = cert
    ? Number(form.gross_amount || cert.gross_approved_amount)
      - Number(form.retention_amount)
      - Number(form.advance_deduction)
      - Number(form.other_deductions)
    : 0;

  const fmt = (v: number) =>
    `AED ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const mutation = useMutation({
    mutationFn: () => subcontractorsApi.payments.create({
      ...form,
      gross_amount: form.gross_amount || String(Number(cert?.gross_approved_amount ?? 0)),
    } as Parameters<typeof subcontractorsApi.payments.create>[0]),
    onSuccess: (data) => {
      toast('Payment created', 'success');
      router.push(`/subcontractors/payments/${data.id}`);
    },
    onError: (err) => toast(getApiError(err, 'Failed to create payment'), 'error'),
  });

  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }));

  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="form-body">

      {/* Certificate context banner */}
      {cert && (
        <div className="info-banner">
          <div>
            <div className="info-banner-item-label">IPC Certificate</div>
            <div className="info-banner-item-value">{cert.certificate_no}</div>
          </div>
          <div>
            <div className="info-banner-item-label">Subcontractor</div>
            <div className="info-banner-item-value">{cert.subcontractor_name}</div>
          </div>
          <div>
            <div className="info-banner-item-label">Gross Approved</div>
            <div className="info-banner-item-value" style={{ fontFamily: 'monospace' }}>
              AED {Number(cert.gross_approved_amount).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="info-banner-item-label">Net Payable</div>
            <div className="info-banner-item-value" style={{ fontFamily: 'monospace' }}>
              AED {Number(cert.net_payable_amount).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Payment Details */}
      <div className="card">
        <div className="form-section-header">
          <div>
            <div className="form-section-title">Payment Details</div>
            <div className="form-section-desc">Record the payment issued for this certificate</div>
          </div>
        </div>
        <div className="form-grid">
          <FormField label="Payment Date" required>
            <input
              type="date" required className="form-input"
              value={form.payment_date}
              onChange={e => set('payment_date', e.target.value)}
            />
          </FormField>

          <FormField label="Payment Method" required>
            <SearchableDropdown
              options={[
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'cheque',        label: 'Cheque' },
                { value: 'cash',          label: 'Cash' },
              ]}
              value={form.payment_method || null}
              onChange={v => set('payment_method', v ?? '')}
              placeholder="Select method"
              allowClear
            />
          </FormField>

          <FormField label="Reference / Cheque No.">
            <input
              type="text" className="form-input"
              placeholder="e.g. TT-2024-0123"
              value={form.reference_number}
              onChange={e => set('reference_number', e.target.value)}
            />
          </FormField>

          <FormField label="Gross Amount (AED)" required>
            <input
              type="number" min="0" step="0.01" className="form-input"
              placeholder={cert ? String(Number(cert.gross_approved_amount)) : '0.00'}
              value={form.gross_amount}
              onChange={e => set('gross_amount', e.target.value)}
            />
          </FormField>
        </div>
      </div>

      {/* Deductions */}
      <div className="card">
        <div className="form-section-header">
          <div>
            <div className="form-section-title">Deductions</div>
            <div className="form-section-desc">Amounts withheld from the gross payment</div>
          </div>
        </div>
        <div className="form-grid">
          <FormField label="Retention Deduction (AED)">
            <input
              type="number" min="0" step="0.01" className="form-input"
              placeholder="0.00"
              value={form.retention_amount}
              onChange={e => set('retention_amount', e.target.value)}
            />
          </FormField>

          <FormField label="Advance Deduction (AED)">
            <input
              type="number" min="0" step="0.01" className="form-input"
              placeholder="0.00"
              value={form.advance_deduction}
              onChange={e => set('advance_deduction', e.target.value)}
            />
          </FormField>

          <FormField label="Other Deductions (AED)">
            <input
              type="number" min="0" step="0.01" className="form-input"
              placeholder="0.00"
              value={form.other_deductions}
              onChange={e => set('other_deductions', e.target.value)}
            />
          </FormField>

          <FormField label="Other Deductions Notes">
            <input
              type="text" className="form-input"
              placeholder="e.g. Penalty deduction"
              value={form.other_deductions_notes}
              onChange={e => set('other_deductions_notes', e.target.value)}
            />
          </FormField>
        </div>

        {/* Net payable summary */}
        <div className="summary-box" style={{ marginTop: 'var(--space-4)' }}>
          <div className="summary-row">
            <span className="summary-row-label">Gross Amount</span>
            <span className="summary-row-value">
              {fmt(Number(form.gross_amount || cert?.gross_approved_amount || 0))}
            </span>
          </div>
          {Number(form.retention_amount) > 0 && (
            <div className="summary-row">
              <span className="summary-row-label">Retention</span>
              <span className="summary-row-value negative">− {fmt(Number(form.retention_amount))}</span>
            </div>
          )}
          {Number(form.advance_deduction) > 0 && (
            <div className="summary-row">
              <span className="summary-row-label">Advance Recovery</span>
              <span className="summary-row-value negative">− {fmt(Number(form.advance_deduction))}</span>
            </div>
          )}
          {Number(form.other_deductions) > 0 && (
            <div className="summary-row">
              <span className="summary-row-label">Other Deductions</span>
              <span className="summary-row-value negative">− {fmt(Number(form.other_deductions))}</span>
            </div>
          )}
          <div className="summary-row">
            <span className="summary-row-label" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Net Payable</span>
            <span className="summary-row-value total">{fmt(netPayable)}</span>
          </div>
        </div>
      </div>

      {/* Additional */}
      <div className="card">
        <div className="form-section-header">
          <div>
            <div className="form-section-title">Additional</div>
            <div className="form-section-desc">Notes and retention release flag</div>
          </div>
        </div>
        <div className="form-grid">
          <div className="form-col-full">
            <FormField label="Notes">
              <textarea
                rows={3} className="form-textarea"
                placeholder="Any remarks about this payment…"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </FormField>
          </div>

          <div className="form-col-full">
            <label className="toggle-wrap">
              <input
                type="checkbox"
                checked={form.is_retention_release}
                onChange={e => set('is_retention_release', e.target.checked)}
              />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
              <span className="toggle-label">
                {form.is_retention_release ? 'Retention Release' : 'Regular Payment'}
              </span>
            </label>
            {form.is_retention_release && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)', marginLeft: 56 }}>
                This payment will be flagged as a retention release in reports.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="form-actions">
        <Button type="submit" variant="primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Create Payment'}
        </Button>
        <Link href="/subcontractors/payments">
          <Button variant="secondary">Cancel</Button>
        </Link>
      </div>
    </form>
  );
}

export default function NewPaymentPage() {
  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="New Payment"
          breadcrumbs={[
            { label: 'Subcontractors', href: '/subcontractors' },
            { label: 'Payments', href: '/subcontractors/payments' },
            { label: 'New Payment' },
          ]}
        />
        <Suspense fallback={<div className="card empty-state"><p>Loading…</p></div>}>
          <NewPaymentForm />
        </Suspense>
      </PageShell>
    </MainLayout>
  );
}
