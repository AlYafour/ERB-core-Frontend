'use client';

import { useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseInvoicesApi } from '@/lib/api/purchase-invoices';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils/format';
import RejectionReasonDialog from '@/components/features/RejectionReasonDialog';
import { Button, PageShell } from '@/components/ui';
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
    onError: (err: unknown) => toast(getApiError(err, 'Failed to approve'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => purchaseInvoicesApi.reject(id, reason),
    onSuccess: () => { invalidate(); setRejectDialogOpen(false); toast('Invoice rejected', 'info'); },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to reject'), 'error'),
  });

  const markPaidMutation = useMutation({
    mutationFn: () => purchaseInvoicesApi.markPaid(id, {}),
    onSuccess: () => { invalidate(); toast('Invoice marked as paid!', 'success'); },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to mark as paid'), 'error'),
  });

  if (isLoading) return <DocLoadState type="loading" />;
  if (!invoice)  return <DocLoadState type="not-found" message="Invoice not found." />;

  const isDraftOrPending = invoice.status === 'draft' || invoice.status === 'pending';
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const poRef = typeof invoice.purchase_order === 'object' && invoice.purchase_order
    ? { id: (invoice.purchase_order as { id: number; order_number?: string }).id, order_number: (invoice.purchase_order as { id: number; order_number?: string }).order_number }
    : invoice.purchase_order_id ? { id: invoice.purchase_order_id } : null;

  const chainNode = poRef ? (
    <>
      <Link href={`/purchase-orders/${poRef.id}`} className="proc-bar-chain-step">
        {poRef.order_number || `LPO-${poRef.id}`}
      </Link>
      <span className="proc-bar-chain-arrow">→</span>
      <span className="proc-bar-chain-current">{invoice.invoice_number}</span>
    </>
  ) : null;

  return (
    <MainLayout>
      <PageShell compact>

        {/* ── Sticky action bar with inline chain ── */}
        <StickyDocBar
          docTypeLabel="Purchase Invoice"
          docNumber={invoice.invoice_number}
          statusVariant={INVOICE_STATUS[invoice.status] ?? 'info'}
          statusLabel={INVOICE_LABEL[invoice.status] || invoice.status}
          chain={chainNode}
        >
          <Link href={`/print/invoice/${invoice.id}`} target="_blank">
            <Button variant="secondary" size="sm">Print</Button>
          </Link>
          {canApprove && isDraftOrPending && (
            <Button variant="success" size="sm" isLoading={approveMutation.isPending} onClick={() => approveMutation.mutate()}>Approve</Button>
          )}
          {canReject && isDraftOrPending && (
            <Button variant="destructive" size="sm" onClick={() => setRejectDialogOpen(true)}>Reject</Button>
          )}
          {canMarkPaid && invoice.status === 'approved' && !invoice.is_fully_paid && (
            <Button variant="success" size="sm" isLoading={markPaidMutation.isPending} onClick={() => markPaidMutation.mutate()}>Mark as Paid</Button>
          )}
        </StickyDocBar>

        {/* ── Two-column: invoice info left / items + financial right ── */}
        <div className="proc-detail-split">

          {/* LEFT: Invoice information */}
          <div className="proc-detail-info">
            <div className="card">
              <div className="proc-section-head">
                <h3 className="proc-section-title">Invoice Information</h3>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{fmt(invoice.invoice_date)}</span>
              </div>
              <div className="proc-info-grid">
                <ProcField label="Invoice Number"   value={<span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{invoice.invoice_number}</span>} />
                <ProcField label="Invoice Date"     value={fmt(invoice.invoice_date)} />
                {invoice.due_date          && <ProcField label="Due Date"          value={fmt(invoice.due_date)} />}
                {invoice.approved_by_name  && <ProcField label="Approved By"       value={invoice.approved_by_name} />}
                {invoice.approved_at       && <ProcField label="Approved At"       value={fmt(invoice.approved_at)} />}
                {invoice.payment_date      && <ProcField label="Payment Date"      value={fmt(invoice.payment_date)} />}
                {invoice.payment_method    && <ProcField label="Payment Method"    value={invoice.payment_method} />}
                {invoice.payment_reference && <ProcField label="Payment Reference" value={<span style={{ fontFamily: 'monospace' }}>{invoice.payment_reference}</span>} />}
                {poRef && (
                  <ProcField label="Purchase Order" value={
                    <Link href={`/purchase-orders/${poRef.id}`} style={{ color: 'var(--brand)', fontWeight: 'var(--weight-semibold)', textDecoration: 'none' }}>
                      {poRef.order_number || `LPO-${poRef.id}`} ↗
                    </Link>
                  } />
                )}
                {invoice.notes && <ProcField label="Notes" value={invoice.notes} />}
              </div>
              {invoice.rejection_reason && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'var(--status-error-bg)', border: '1px solid var(--status-error-border)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--status-error)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Rejection Reason</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: '#991B1B', lineHeight: 1.5 }}>{invoice.rejection_reason}</div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Items + Financial */}
          <div className="proc-detail-products">
            <div className="card">
              <div className="proc-section-head">
                <h3 className="proc-section-title">
                  Invoice Items
                  <span className="proc-section-count">{invoice.items.length}</span>
                </h3>
              </div>
              <ReadOnlyItemsTable
                items={invoice.items}
                columns={[
                  {
                    header: 'Product',
                    cell: (item) => (
                      <div>
                        <div className="cell-product-name">{item.product?.name || `Product #${item.product_id}`}</div>
                        {item.product?.code && <div className="cell-product-code">{item.product.code}</div>}
                      </div>
                    ),
                  },
                  { header: 'Unit',       align: 'center', cell: (item) => <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>{item.product?.unit?.toUpperCase() || '—'}</span> },
                  { header: 'Qty',        align: 'center', cell: (item) => <span style={{ fontWeight: 'var(--weight-semibold)' }}>{item.quantity}</span> },
                  { header: 'Unit Price', align: 'right',  cell: (item) => <span style={{ fontFamily: 'monospace' }}>{formatPrice(item.unit_price)}</span> },
                  { header: 'Disc %',     align: 'center', cell: (item) => item.discount ? <span style={{ color: 'var(--status-error)', fontWeight: 600 }}>{item.discount}%</span> : <span style={{ color: 'var(--text-tertiary)' }}>—</span> },
                  { header: 'Tax %',      align: 'center', cell: (item) => item.tax_rate ? <span style={{ color: 'var(--text-secondary)' }}>{item.tax_rate}%</span> : <span style={{ color: 'var(--text-tertiary)' }}>—</span> },
                  { header: 'Total',      align: 'right',  cell: (item) => <span className="col-total">{formatPrice(item.total ?? 0)}</span> },
                ]}
              />
              <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
                <FinancialSummary
                  rows={[
                    { label: 'Subtotal', value: invoice.subtotal, hidden: invoice.subtotal == null },
                    { label: `Discount (${invoice.discount}%)`, value: invoice.discount, hidden: !Number(invoice.discount), variant: 'discount', prefix: '– ' },
                    { label: 'Tax',      value: invoice.tax_amount, hidden: !Number(invoice.tax_amount) },
                  ]}
                  total={invoice.total}
                />
                {(invoice.paid_amount != null || invoice.remaining_amount != null) && (
                  <div className="proc-financial-grid" style={{ marginTop: 'var(--space-3)' }}>
                    <div className="proc-financial-box">
                      {invoice.paid_amount != null && (
                        <div className="proc-financial-row">
                          <span className="proc-financial-row-label">Paid</span>
                          <span style={{ fontWeight: 700, color: 'var(--status-success)', fontFamily: 'monospace' }}>{formatPrice(invoice.paid_amount)}</span>
                        </div>
                      )}
                      {invoice.remaining_amount != null && (
                        <div className="proc-financial-row">
                          <span className="proc-financial-row-label">Remaining</span>
                          <span style={{ fontWeight: 700, color: 'var(--brand)', fontFamily: 'monospace' }}>{formatPrice(invoice.remaining_amount)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

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

function ProcField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="proc-info-field">
      <span className="proc-info-label">{label}</span>
      <div className="proc-info-value">{value || <span className="proc-info-value--empty">—</span>}</div>
    </div>
  );
}
