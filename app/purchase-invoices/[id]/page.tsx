'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseInvoicesApi } from '@/lib/api/purchase-invoices';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils/format';
import DetailCard, { DetailField } from '@/components/ui/DetailCard';
import RejectionReasonDialog from '@/components/ui/RejectionReasonDialog';
import LinkedDocumentsSection from '@/components/ui/LinkedDocumentsSection';
import { Button } from '@/components/ui';
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
        <div className="card text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </MainLayout>
    );
  }

  if (!invoice) {
    return (
      <MainLayout>
        <div className="card text-center py-12">
          <p className="text-muted-foreground">Invoice not found</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <Link href="/purchase-invoices" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">
            ← Back to Invoices
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Invoice: {invoice.invoice_number}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">View invoice details</p>
            </div>
            <span className={`badge ${statusColors[invoice.status] || 'badge-info'}`}>
              {statusLabels[invoice.status] || invoice.status}
            </span>
          </div>
        </div>

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
                <div className="p-3 rounded-md" style={{
                  backgroundColor: 'var(--color-error-light)',
                  border: '1px solid var(--color-error)',
                }}>
                  <p className="text-sm" style={{ color: '#991B1B', margin: 0 }}>{invoice.rejection_reason}</p>
                </div>
              }
              span={3}
            />
          )}
        </DetailCard>

        <DetailCard title="Items">
          <div className="col-span-3 overflow-x-auto">
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
                    <td className="text-muted-foreground">{item.product?.unit?.toUpperCase() || '—'}</td>
                    <td>{item.quantity}</td>
                    <td className="text-muted-foreground">{formatPrice(item.unit_price)}</td>
                    <td className="text-muted-foreground">{item.discount || 0}%</td>
                    <td className="text-muted-foreground">{item.tax_rate || 0}%</td>
                    <td className="font-semibold">{formatPrice(item.total ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailCard>

        <DetailCard title="Financial Summary">
          <div className="col-span-3 flex justify-end">
            <div className="w-64 flex flex-col gap-2">
              {invoice.subtotal !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-semibold">{formatPrice(invoice.subtotal)}</span>
                </div>
              )}
              {invoice.discount !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount:</span>
                  <span className="font-semibold">{formatPrice(invoice.discount)}</span>
                </div>
              )}
              {invoice.tax_amount !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax:</span>
                  <span className="font-semibold">{formatPrice(invoice.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base">
                <span className="font-bold">Total:</span>
                <span className="font-bold">{formatPrice(invoice.total)}</span>
              </div>
              {invoice.paid_amount !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid:</span>
                  <span className="font-semibold text-green-600">{formatPrice(invoice.paid_amount)}</span>
                </div>
              )}
              {invoice.remaining_amount !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Remaining:</span>
                  <span className="font-semibold text-orange-600">{formatPrice(invoice.remaining_amount)}</span>
                </div>
              )}
            </div>
          </div>
        </DetailCard>

        <div className="flex flex-wrap gap-3">
          <Link href={`/print/invoice/${invoice.id}`} target="_blank">
            <Button variant="secondary">Print</Button>
          </Link>

          {canApprove && (invoice.status === 'draft' || invoice.status === 'pending') && (
            <Button
              variant="success"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              isLoading={approveMutation.isPending}
            >
              Approve
            </Button>
          )}

          {canReject && (invoice.status === 'draft' || invoice.status === 'pending') && (
            <Button
              variant="destructive"
              onClick={() => setRejectDialogOpen(true)}
              disabled={rejectMutation.isPending}
            >
              Reject
            </Button>
          )}

          {canMarkPaid && invoice.status === 'approved' && !invoice.is_fully_paid && (
            <Button
              variant="success"
              onClick={() => markPaidMutation.mutate()}
              disabled={markPaidMutation.isPending}
              isLoading={markPaidMutation.isPending}
            >
              Mark as Paid
            </Button>
          )}
        </div>

        <RejectionReasonDialog
          isOpen={rejectDialogOpen}
          onClose={() => setRejectDialogOpen(false)}
          onConfirm={(reason) => rejectMutation.mutate(reason)}
          title="Reject Invoice"
          message="Please provide a reason for rejecting this invoice."
        />
      </div>
    </MainLayout>
  );
}
