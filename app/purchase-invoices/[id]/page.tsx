'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseInvoicesApi } from '@/lib/api/purchase-invoices';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils/format';
import DetailCard, { DetailField } from '@/components/ui/DetailCard';
import RejectionReasonDialog from '@/components/features/RejectionReasonDialog';
import LinkedDocumentsSection from '@/components/features/LinkedDocumentsSection';
import { Button, PageHeader, PageShell } from '@/components/ui';
import { INVOICE_STATUS } from '@/lib/utils/status-colors';
import { INVOICE_LABEL } from '@/lib/constants/status-labels';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { useProcPermissions } from '@/lib/hooks/use-proc-permissions';
import { ReadOnlyItemsTable } from '@/components/procurement/ReadOnlyItemsTable';
import { FinancialSummary } from '@/components/procurement/shared/FinancialSummary';
import { DocLoadState } from '@/components/procurement/shared/DocLoadState';
import { StickyDocBar } from '@/components/procurement/shared/StickyDocBar';

export default function PurchaseInvoiceDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { can } = useProcPermissions();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const canApprove  = can('purchase_invoice', 'approve');
  const canReject   = can('purchase_invoice', 'reject');
  const canMarkPaid = can('purchase_invoice', 'mark_paid');

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['purchase-invoices', id],
    queryFn: () => purchaseInvoicesApi.getById(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
    queryClient.invalidateQueries({ queryKey: ['pending-count'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => purchaseInvoicesApi.approve(id),
    onSuccess: () => { invalidate(); toast('Invoice approved!', 'success'); },
    onError: (err: any) => toast(getApiError(err, 'Failed to approve'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => purchaseInvoicesApi.reject(id, reason),
    onSuccess: () => { invalidate(); setRejectDialogOpen(false); toast('Invoice rejected', 'info'); },
    onError: (err: any) => toast(getApiError(err, 'Failed to reject'), 'error'),
  });

  const markPaidMutation = useMutation({
    mutationFn: () => purchaseInvoicesApi.markPaid(id, {}),
    onSuccess: () => { invalidate(); toast('Invoice marked as paid!', 'success'); },
    onError: (err: any) => toast(getApiError(err, 'Failed to mark as paid'), 'error'),
  });

  if (isLoading) return <DocLoadState type="loading" />;
  if (!invoice)  return <DocLoadState type="not-found" message="Invoice not found." />;

  const isDraftOrPending = invoice.status === 'draft' || invoice.status === 'pending';

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={`Invoice: ${invoice.invoice_number}`}
          breadcrumbs={[{ label: 'Purchase Invoices', href: '/purchase-invoices' }, { label: invoice.invoice_number }]}
        />

        {/* ── Sticky action bar ── */}
        <StickyDocBar
          docTypeLabel="Purchase Invoice"
          docNumber={invoice.invoice_number}
          statusVariant={INVOICE_STATUS[invoice.status] ?? 'info'}
          statusLabel={INVOICE_LABEL[invoice.status] || invoice.status}
        >
          <Link href={`/print/invoice/${invoice.id}`} target="_blank">
            <Button variant="secondary" size="sm">Print</Button>
          </Link>
          {canApprove && isDraftOrPending && (
            <Button variant="success" size="sm" isLoading={approveMutation.isPending} onClick={() => approveMutation.mutate()}>Approve</Button>
          )}
          {canReject && isDraftOrPending && (
            <Button variant="destructive" size="sm" disabled={rejectMutation.isPending} onClick={() => setRejectDialogOpen(true)}>Reject</Button>
          )}
          {canMarkPaid && invoice.status === 'approved' && !invoice.is_fully_paid && (
            <Button variant="success" size="sm" isLoading={markPaidMutation.isPending} onClick={() => markPaidMutation.mutate()}>Mark as Paid</Button>
          )}
        </StickyDocBar>

        <LinkedDocumentsSection
          documents={{
            purchaseOrder: typeof invoice.purchase_order === 'object' && invoice.purchase_order
              ? { id: (invoice.purchase_order as any).id, order_number: (invoice.purchase_order as any).order_number }
              : invoice.purchase_order_id ? { id: invoice.purchase_order_id } : null,
            invoice: { id: invoice.id, invoice_number: invoice.invoice_number },
          }}
        />

        <DetailCard title="Invoice Information">
          <DetailField label="Invoice Number" value={invoice.invoice_number} />
          <DetailField label="Invoice Date"   value={new Date(invoice.invoice_date).toLocaleDateString('en-US')} />
          {invoice.due_date       && <DetailField label="Due Date"         value={new Date(invoice.due_date).toLocaleDateString('en-US')} />}
          {invoice.approved_by_name && <DetailField label="Approved By"    value={invoice.approved_by_name} />}
          {invoice.approved_at    && <DetailField label="Approved At"      value={new Date(invoice.approved_at).toLocaleDateString('en-US')} />}
          {invoice.payment_date   && <DetailField label="Payment Date"     value={new Date(invoice.payment_date).toLocaleDateString('en-US')} />}
          {invoice.payment_method && <DetailField label="Payment Method"   value={invoice.payment_method} />}
          {invoice.payment_reference && <DetailField label="Payment Reference" value={invoice.payment_reference} />}
          {invoice.notes && <DetailField label="Notes" value={invoice.notes} span={3} />}
          {invoice.rejection_reason && (
            <DetailField
              label="Rejection Reason"
              span={3}
              value={
                <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-error-light)', border: '1px solid var(--color-error)' }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: '#991B1B', margin: 0 }}>{invoice.rejection_reason}</p>
                </div>
              }
            />
          )}
        </DetailCard>

        <DetailCard title="Items">
          <div style={{ gridColumn: '1 / -1' }}>
            <ReadOnlyItemsTable
              items={invoice.items}
              columns={[
                { header: 'Product',    cell: (item) => item.product?.name || `Product #${item.product_id}` },
                { header: 'Unit',       cell: (item) => <span style={{ color: 'var(--text-secondary)' }}>{item.product?.unit?.toUpperCase() || '—'}</span> },
                { header: 'Qty',        cell: (item) => item.quantity },
                { header: 'Unit Price', cell: (item) => <span style={{ color: 'var(--text-secondary)' }}>{formatPrice(item.unit_price)}</span> },
                { header: 'Disc %',     cell: (item) => <span style={{ color: 'var(--text-secondary)' }}>{item.discount || 0}%</span> },
                { header: 'Tax %',      cell: (item) => <span style={{ color: 'var(--text-secondary)' }}>{item.tax_rate || 0}%</span> },
                { header: 'Total',      cell: (item) => <span style={{ fontWeight: 'var(--weight-semibold)' }}>{formatPrice(item.total ?? 0)}</span> },
              ]}
            />
          </div>
        </DetailCard>

        <DetailCard title="Financial Summary">
          <div style={{ gridColumn: '1 / -1' }}>
            <FinancialSummary
              rows={[
                { label: 'Subtotal',   value: invoice.subtotal,   hidden: invoice.subtotal == null },
                { label: 'Discount',   value: invoice.discount,   hidden: !Number(invoice.discount), variant: 'discount', prefix: '- ' },
                { label: 'Tax',        value: invoice.tax_amount,  hidden: !Number(invoice.tax_amount) },
              ]}
              total={invoice.total}
              totalLabel="Total"
            />
            {/* Payment rows below the separator */}
            {(invoice.paid_amount != null || invoice.remaining_amount != null) && (
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: 272, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {invoice.paid_amount != null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Paid:</span>
                      <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-success)' }}>{formatPrice(invoice.paid_amount)}</span>
                    </div>
                  )}
                  {invoice.remaining_amount != null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Remaining:</span>
                      <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--brand)' }}>{formatPrice(invoice.remaining_amount)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DetailCard>

        <RejectionReasonDialog
          isOpen={rejectDialogOpen}
          onClose={() => setRejectDialogOpen(false)}
          onConfirm={(reason) => rejectMutation.mutate(reason)}
          title="Reject Invoice"
          message="Please provide a reason for rejecting this invoice."
        />
      </PageShell>
    </MainLayout>
  );
}
