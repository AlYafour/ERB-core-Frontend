'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subcontractorsApi } from '@/lib/api/subcontractors';
import { Button, Badge, PageHeader, PageShell } from '@/components/ui';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { PAYMENT_STATUS } from '@/lib/utils/status-colors';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', paid: 'Paid', cancelled: 'Cancelled',
};

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'Bank Transfer', cheque: 'Cheque', cash: 'Cash',
};

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', paddingBlock: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ width: 200, flexShrink: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function AmountRow({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBlock: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontWeight: highlight ? 700 : 500, color: highlight ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
        AED {Number(value).toLocaleString()}
      </span>
    </div>
  );
}

export default function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [refInput, setRefInput] = useState('');
  const [showRefDialog, setShowRefDialog] = useState(false);

  const { data: payment, isLoading, error } = useQuery({
    queryKey: ['subcon-payment', id],
    queryFn: () => subcontractorsApi.payments.getOne(Number(id)),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['subcon-payment', id] });
    queryClient.invalidateQueries({ queryKey: ['subcon-payments'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => subcontractorsApi.payments.approve(Number(id)),
    onSuccess: () => { invalidate(); toast('Payment approved', 'success'); },
    onError: () => toast('Failed to approve', 'error'),
  });

  const markPaidMutation = useMutation({
    mutationFn: (ref: string) => subcontractorsApi.payments.markPaid(Number(id), { reference_number: ref }),
    onSuccess: () => { invalidate(); toast('Payment marked as paid', 'success'); },
    onError: () => toast('Failed to mark as paid', 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => subcontractorsApi.payments.cancel(Number(id)),
    onSuccess: () => { invalidate(); toast('Payment cancelled', 'info'); },
    onError: () => toast('Failed to cancel', 'error'),
  });

  if (isLoading) return <MainLayout><PageShell><div className="card empty-state"><p>Loading...</p></div></PageShell></MainLayout>;
  if (error || !payment) return <MainLayout><PageShell><div className="card empty-state"><p style={{ color: 'var(--status-error)' }}>Payment not found.</p></div></PageShell></MainLayout>;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={`Payment ${payment.payment_no}`}
          breadcrumbs={[
            { label: 'Subcontractors', href: '/subcontractors' },
            { label: 'Payments', href: '/subcontractors/payments' },
            { label: payment.payment_no },
          ]}
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              {payment.status === 'pending' && (
                <Button variant="primary" size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                  Approve
                </Button>
              )}
              {payment.status === 'approved' && (
                <Button variant="primary" size="sm" onClick={() => { setRefInput(''); setShowRefDialog(true); }} disabled={markPaidMutation.isPending}>
                  Mark Paid
                </Button>
              )}
              {(payment.status === 'pending' || payment.status === 'approved') && (
                <Button variant="secondary" size="sm" onClick={async () => {
                  if (await confirm('Cancel this payment?')) cancelMutation.mutate();
                }} disabled={cancelMutation.isPending}>
                  Cancel
                </Button>
              )}
            </div>
          }
        />

        {/* Status bar */}
        <div className="card" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Badge variant={PAYMENT_STATUS[payment.status] ?? 'default'}>
            {STATUS_LABEL[payment.status]}
          </Badge>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {payment.payment_date}
          </div>
          {payment.is_retention_release && (
            <Badge variant="warning">Retention Release</Badge>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            {payment.subcontractor_name} · {payment.contract_no}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
          {/* Payment breakdown */}
          <div className="card">
            <div className="info-section-title">Payment Breakdown</div>
            <AmountRow label="Gross Amount"        value={payment.gross_amount} />
            <AmountRow label="Retention Deduction" value={payment.retention_amount} />
            <AmountRow label="Advance Deduction"   value={payment.advance_deduction} />
            {Number(payment.other_deductions) > 0 && (
              <AmountRow label="Other Deductions"  value={payment.other_deductions} />
            )}
            <AmountRow label="Net Paid"            value={payment.net_paid_amount} highlight />
          </div>

          {/* Details */}
          <div className="card">
            <div className="info-section-title">Payment Details</div>
            <InfoRow label="Payment No."       value={payment.payment_no} />
            <InfoRow label="Subcontractor"     value={payment.subcontractor_name} />
            <InfoRow label="Contract"          value={payment.contract_no} />
            {payment.certificate_no && (
              <div style={{ display: 'flex', gap: 'var(--space-3)', paddingBlock: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ width: 200, flexShrink: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>IPC Certificate</span>
                <Link href={`/subcontractors/certificates/${payment.certificate}`} style={{ fontSize: 'var(--text-sm)', color: 'var(--brand)' }}>
                  {payment.certificate_no}
                </Link>
              </div>
            )}
            <InfoRow label="Project"           value={payment.project_name} />
            <InfoRow label="Payment Date"      value={payment.payment_date} />
            <InfoRow label="Method"            value={METHOD_LABEL[payment.payment_method] ?? payment.payment_method} />
            <InfoRow label="Reference No."     value={payment.reference_number} />
            <InfoRow label="Created By"        value={payment.created_by_name} />
            <InfoRow label="Approved By"       value={payment.approved_by_name} />
            {payment.approval_date && <InfoRow label="Approval Date" value={payment.approval_date} />}
            {payment.notes && <InfoRow label="Notes" value={payment.notes} />}
          </div>
        </div>
        {/* Reference number dialog for Mark Paid */}
        {showRefDialog && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div className="card" style={{ width: 400, padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Mark as Paid
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Enter a reference or cheque number (optional).
              </div>
              <input
                type="text"
                className="input"
                placeholder="Reference / Cheque number"
                value={refInput}
                onChange={e => setRefInput(e.target.value)}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') { setShowRefDialog(false); markPaidMutation.mutate(refInput); }
                  if (e.key === 'Escape') setShowRefDialog(false);
                }}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <Button variant="secondary" size="sm" onClick={() => setShowRefDialog(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={markPaidMutation.isPending}
                  onClick={() => { setShowRefDialog(false); markPaidMutation.mutate(refInput); }}
                >
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
}
