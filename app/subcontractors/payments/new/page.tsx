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
  const certId  = searchParams.get('certificate');
  const contId  = searchParams.get('contract');

  const { data: cert } = useQuery({
    queryKey: ['cert-for-payment', certId],
    queryFn: () => subcontractorsApi.certificates.getOne(Number(certId)),
    enabled: !!certId,
  });

  const [form, setForm] = useState({
    contract:              contId  ? Number(contId)  : null as number | null,
    certificate:           certId  ? Number(certId)  : null as number | null,
    payment_date:          new Date().toISOString().slice(0, 10),
    gross_amount:          '',
    retention_amount:      '0',
    advance_deduction:     '0',
    other_deductions:      '0',
    other_deductions_notes: '',
    payment_method:        '' as 'bank_transfer' | 'cheque' | 'cash' | '',
    reference_number:      '',
    is_retention_release:  false,
    notes:                 '',
  });

  // Pre-fill form when certificate loads
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
    <form
      onSubmit={e => { e.preventDefault(); mutation.mutate(); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}
    >
      {cert && (
        <div className="card" style={{ background: 'var(--brand-subtle)', border: '1px solid var(--brand-border, var(--border-default))' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Creating payment for IPC <strong>{cert.certificate_no}</strong> — {cert.subcontractor_name} — Net Payable:&nbsp;
            <strong style={{ color: 'var(--text-primary)' }}>AED {Number(cert.net_payable_amount).toLocaleString()}</strong>
          </div>
        </div>
      )}

      <div className="card">
        <div className="info-section-title">Payment Details</div>
        {cert && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Estimated Net Payable</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
            AED {netPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}
      <div className="form-grid">
          <FormField label="Payment Date" required>
            <input
              type="date" required className="form-input"
              value={form.payment_date}
              onChange={e => set('payment_date', e.target.value)}
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

          <FormField label="Retention Deduction (AED)">
            <input
              type="number" min="0" step="0.01" className="form-input"
              value={form.retention_amount}
              onChange={e => set('retention_amount', e.target.value)}
            />
          </FormField>

          <FormField label="Advance Deduction (AED)">
            <input
              type="number" min="0" step="0.01" className="form-input"
              value={form.advance_deduction}
              onChange={e => set('advance_deduction', e.target.value)}
            />
          </FormField>

          <FormField label="Other Deductions (AED)">
            <input
              type="number" min="0" step="0.01" className="form-input"
              value={form.other_deductions}
              onChange={e => set('other_deductions', e.target.value)}
            />
          </FormField>

          <FormField label="Payment Method" required>
            <SearchableDropdown
              options={[
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'cheque', label: 'Cheque' },
                { value: 'cash', label: 'Cash' },
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
              value={form.reference_number}
              onChange={e => set('reference_number', e.target.value)}
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

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.is_retention_release}
                onChange={e => set('is_retention_release', e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                This is a Retention Release payment
              </span>
            </label>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
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
