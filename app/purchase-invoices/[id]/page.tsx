'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseInvoicesApi } from '@/lib/api/purchase-invoices';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils/format';
import DetailCard, { DetailField } from '@/components/ui/DetailCard';
import RejectionReasonDialog from '@/components/features/RejectionReasonDialog';
import LinkedDocumentsSection from '@/components/features/LinkedDocumentsSection';
import { Button, Badge, PageHeader, PageShell } from '@/components/ui';
import { INVOICE_STATUS } from '@/lib/utils/status-colors';
import { toast } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';

const statusColors: Record<string, string> = {
  draft: 'badge-info',
  pending: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-error',
  paid: 'badge-success',
  cancelled: 'badge-error',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export default function PurchaseInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['purchase-invoices', id],
    queryFn: () => purchaseInvoicesApi.getById(id),
  });

  const approveMutation = useMutation({
    mutationFn: () => purchaseInvoicesApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      toast('Invoice approved successfully!', 'success');
    },
    onError: (error: any) => {
      toast(error?.response?.data?.error || 'Failed to approve invoice', 'error');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => purchaseInvoicesApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      setRejectDialogOpen(false);
      toast('Invoice rejected', 'info');
    },
    onError: (error: any) => {
      toast(error?.response?.data?.error || 'Failed to reject invoice', 'error');
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: () => purchaseInvoicesApi.markPaid(id, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      toast('Invoice marked as paid!', 'success');
    },
    onError: (error: any) => {
      toast(error?.response?.data?.error || 'Failed to mark invoice as paid', 'error');
    },
  });

  const isSuperuser = user?.is_superuser ?? false;
  const canApprove = isSuperuser || ((hasPermission('purchase_invoice', 'approve') ?? false) &&
    user?.role !== 'procurement_officer' && user?.role !== 'site_engineer');
  const canReject = isSuperuser || ((hasPermission('purchase_invoice', 'reject') ?? false) &&
    user?.role !== 'procurement_officer' && user?.role !== 'site_engineer');
  const canMarkPaid = isSuperuser || (hasPermission('purchase_invoice', 'update') ?? false);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Loading...</p>
        </div>
      </MainLayout>
    );
  }

  if (!invoice) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Invoice not found</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={`Invoice: ${invoice.invoice_number}`}
          breadcrumbs={[{ label: 'Purchase Invoices', href: '/purchase-invoices' }, { label: invoice.invoice_number }]}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge variant={INVOICE_STATUS[invoice.status] ?? 'info'}>{statusLabels[invoice.status] || invoice.status}</Badge>
              <Link href={`/print/invoice/${invoice.id}`} target="_blank">
                <Button variant="secondary" size="sm">Print</Button>
              </Link>
              {canApprove && (invoice.status === 'draft' || invoice.status === 'pending') && (
                <Button variant="success" size="sm" onClick={() => approveMutation.mutate()} isLoading={approveMutation.isPending}>Approve</Button>
              )}
              {canReject && (invoice.status === 'draft' || invoice.status === 'pending') && (
                <Button variant="destructive" size="sm" onClick={() => setRejectDialogOpen(true)} disabled={rejectMutation.isPending}>Reject</Button>
              )}
              {canMarkPaid && invoice.status === 'approved' && !invoice.is_fully_paid && (
                <Button variant="success" size="sm" onClick={() => markPaidMutation.mutate()} isLoading={markPaidMutation.isPending}>Mark as Paid</Button>
              )}
            </div>
          }
        />

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
          <DetailField label="Invoice Date" value={new Date(invoice.invoice_date).toLocaleDateString('en-US')} />
          {invoice.due_date && (
            <DetailField label="Due Date" value={new Date(invoice.due_date).toLocaleDateString('en-US')} />
          )}
          {invoice.approved_by_name && (
            <DetailField label="Approved By" value={invoice.approved_by_name} />
          )}
          {invoice.approved_at && (
            <DetailField label="Approved At" value={new Date(invoice.approved_at).toLocaleDateString('en-US')} />
          )}
          {invoice.payment_date && (
            <DetailField label="Payment Date" value={new Date(invoice.payment_date).toLocaleDateString('en-US')} />
          )}
          {invoice.payment_method && (
            <DetailField label="Payment Method" value={invoice.payment_method} />
          )}
          {invoice.payment_reference && (
            <DetailField label="Payment Reference" value={invoice.payment_reference} />
          )}
          {invoice.notes && (
            <DetailField label="Notes" value={invoice.notes} span={3} />
          )}
          {invoice.rejection_reason && (
            <DetailField
              label="Rejection Reason"
              value={
                <div style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-error-light)',
                  border: '1px solid var(--color-error)',
                }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: '#991B1B', margin: 0 }}>{invoice.rejection_reason}</p>
                </div>
              }
              span={3}
            />
          )}
        </DetailCard>

        <DetailCard title="Items">
          <div style={{ gridColumn: '1 / -1', overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Unit</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Disc %</th>
                  <th>Tax %</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, idx) => (
                  <tr key={item.id ?? idx}>
                    <td>{item.product?.name || `Product #${item.product_id}`}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{item.product?.unit?.toUpperCase() || '—'}</td>
                    <td>{item.quantity}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{formatPrice(item.unit_price)}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{item.discount || 0}%</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{item.tax_rate || 0}%</td>
                    <td style={{ fontWeight: 'var(--weight-semibold)' }}>{formatPrice(item.total ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailCard>

        <DetailCard title="Financial Summary">
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: 256, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {invoice.subtotal !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                  <span style={{ fontWeight: 'var(--weight-semibold)' }}>{formatPrice(invoice.subtotal)}</span>
                </div>
              )}
              {invoice.discount !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Discount:</span>
                  <span style={{ fontWeight: 'var(--weight-semibold)' }}>{formatPrice(invoice.discount)}</span>
                </div>
              )}
              {invoice.tax_amount !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Tax:</span>
                  <span style={{ fontWeight: 'var(--weight-semibold)' }}>{formatPrice(invoice.tax_amount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-2)', fontSize: 'var(--text-base)' }}>
                <span style={{ fontWeight: 'var(--weight-bold)' }}>Total:</span>
                <span style={{ fontWeight: 'var(--weight-bold)' }}>{formatPrice(invoice.total)}</span>
              </div>
              {invoice.paid_amount !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Paid:</span>
                  <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-success)' }}>{formatPrice(invoice.paid_amount)}</span>
                </div>
              )}
              {invoice.remaining_amount !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Remaining:</span>
                  <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--brand)' }}>{formatPrice(invoice.remaining_amount)}</span>
                </div>
              )}
            </div>
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
