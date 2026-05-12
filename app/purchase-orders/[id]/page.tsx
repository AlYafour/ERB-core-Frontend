'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils/format';
import RejectionReasonDialog from '@/components/ui/RejectionReasonDialog';
import LinkedDocumentsSection from '@/components/ui/LinkedDocumentsSection';
import DetailCard, { DetailField } from '@/components/ui/DetailCard';
import { Button, Badge, PageHeader, PageShell } from '@/components/ui';
import { PO_STATUS } from '@/lib/utils/status-colors';
import { toast } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { canCreateGRN, canCreateInvoice } from '@/lib/utils/workflow-guards';

const statusColors: Record<string, string> = {
  draft: 'badge-info',
  pending: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-error',
  completed: 'badge-success',
  cancelled: 'badge-error',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ['purchase-orders', id],
    queryFn: () => purchaseOrdersApi.getById(id),
  });

  const approveMutation = useMutation({
    mutationFn: () => purchaseOrdersApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      toast('Purchase Order approved successfully!', 'success');
    },
    onError: (error: any) => {
      toast(error?.response?.data?.error || 'Failed to approve purchase order', 'error');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => purchaseOrdersApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      setRejectDialogOpen(false);
      toast('Purchase Order rejected', 'info');
    },
    onError: (error: any) => {
      toast(error?.response?.data?.error || 'Failed to reject purchase order', 'error');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => purchaseOrdersApi.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      setCancelDialogOpen(false);
      toast('Purchase Order cancelled', 'info');
    },
    onError: (error: any) => {
      toast(error?.response?.data?.error || 'Failed to cancel purchase order', 'error');
    },
  });

  const { hasPermission } = usePermissions();
  const isSuperuser = user?.is_superuser ?? false;

  const canApprove = isSuperuser || ((hasPermission('purchase_order', 'approve') ?? false) &&
    user?.role !== 'procurement_officer' && user?.role !== 'site_engineer');
  const canReject = isSuperuser || ((hasPermission('purchase_order', 'reject') ?? false) &&
    user?.role !== 'procurement_officer' && user?.role !== 'site_engineer');
  const canCancel = isSuperuser || (hasPermission('purchase_order', 'cancel') ?? false);
  const canUpdate = isSuperuser || (hasPermission('purchase_order', 'update') ?? false);
  const canCreateGRNPerm = isSuperuser || (hasPermission('goods_receiving', 'create') ?? false);
  const canCreateInvoicePerm = isSuperuser || (hasPermission('purchase_invoice', 'create') ?? false);

  const canEdit = order && canUpdate &&
    (order.status === 'draft' || order.status === 'pending' || order.status === 'rejected');
  const canCancelOrder = order && canCancel &&
    order.status !== 'completed' && order.status !== 'cancelled';

  if (isLoading) {
    return (
      <MainLayout>
        <div className="card text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </MainLayout>
    );
  }

  if (!order) {
    return (
      <MainLayout>
        <div className="card text-center py-12">
          <p className="text-muted-foreground">Purchase Order not found</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="lpo-print">
        <PageShell>
          <PageHeader
            title={`Purchase Order: ${order.order_number}`}
            breadcrumbs={[{ label: 'Purchase Orders', href: '/purchase-orders' }, { label: order.order_number }]}
            actions={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Badge variant={PO_STATUS[order.status] ?? 'info'}>{statusLabels[order.status] || order.status}</Badge>
                <Button variant="secondary" size="sm" onClick={() => window.open(`/print/lpo/${id}`, '_blank')}>Print LPO</Button>
                {canEdit && (
                  <Link href={`/purchase-orders/${id}/edit`}><Button variant="edit" size="sm">Edit</Button></Link>
                )}
                {canApprove && (order.status === 'draft' || order.status === 'pending') && (
                  <Button variant="success" size="sm" onClick={() => approveMutation.mutate()} isLoading={approveMutation.isPending}>Approve</Button>
                )}
                {canReject && (order.status === 'draft' || order.status === 'pending') && (
                  <Button variant="destructive" size="sm" onClick={() => setRejectDialogOpen(true)} disabled={rejectMutation.isPending}>Reject</Button>
                )}
                {canCancelOrder && (
                  <Button variant="destructive" size="sm" onClick={() => setCancelDialogOpen(true)} disabled={cancelMutation.isPending}>Cancel</Button>
                )}
                {order.status === 'approved' && canCreateGRNPerm && (user?.role === 'site_engineer' || user?.role === 'procurement_officer' || user?.is_superuser) && (
                  <Button variant="primary" size="sm" onClick={() => {
                    const guard = canCreateGRN(order.status);
                    if (!guard.canProceed) { toast(guard.reason || 'Cannot create GRN', 'error'); return; }
                    router.push(`/goods-receiving/new?purchase_order_id=${id}`);
                  }}>Create GRN</Button>
                )}
                {order.status === 'approved' && canCreateInvoicePerm && order.has_grn && (
                  <Button variant="primary" size="sm" onClick={() => {
                    const guard = canCreateInvoice(order.status);
                    if (!guard.canProceed) { toast(guard.reason || 'Cannot create invoice', 'error'); return; }
                    if (guard.warning && !confirm(guard.warning + '\n\nDo you want to continue?')) return;
                    router.push(`/purchase-invoices/new?purchase_order_id=${id}`);
                  }}>Create Invoice</Button>
                )}
                {order.status === 'approved' && canCreateInvoicePerm && !order.has_grn && (
                  <Button variant="secondary" size="sm" disabled>Create Invoice (GRN Required)</Button>
                )}
              </div>
            }
          />

          {/* Linked Documents */}
          <LinkedDocumentsSection
            documents={{
              purchaseRequest: typeof order.purchase_request === 'object'
                ? order.purchase_request
                : order.purchase_request ? { id: order.purchase_request } : null,
              purchaseQuotation: typeof order.purchase_quotation === 'object'
                ? order.purchase_quotation
                : order.purchase_quotation ? { id: order.purchase_quotation } : null,
              purchaseOrder: { id: order.id, order_number: order.order_number },
            }}
          />

          {/* Order Information */}
          <DetailCard title="Order Information">
            {(order.project_name || order.project_code) && (
              <DetailField
                label="Project"
                value={
                  <div>
                    <div className="font-semibold">{order.project_name}</div>
                    {order.project_code && <div className="text-sm text-muted-foreground font-mono">{order.project_code}</div>}
                  </div>
                }
              />
            )}
            <DetailField label="Supplier" value={typeof order.supplier === 'object' ? order.supplier.name : 'N/A'} />
            <DetailField label="Order Date" value={new Date(order.order_date).toLocaleDateString('en-US')} />
            {order.delivery_date && (
              <DetailField label="Delivery Date" value={new Date(order.delivery_date).toLocaleDateString('en-US')} />
            )}
            {order.delivery_method && (
              <DetailField label="Delivery Method" value={order.delivery_method === 'pickup' ? 'Pick Up' : 'Delivery'} />
            )}
            {order.purchase_request && (
              <DetailField
                label="Purchase Request"
                value={
                  <Link
                    href={`/purchase-requests/${typeof order.purchase_request === 'object' ? order.purchase_request.id : order.purchase_request}`}
                    className="text-primary hover:text-orange-500 underline"
                  >
                    {typeof order.purchase_request === 'object' ? order.purchase_request.code : 'View'}
                  </Link>
                }
              />
            )}
            {order.approved_by_name && (
              <DetailField label="Approved By" value={order.approved_by_name} />
            )}
            {order.approved_at && (
              <DetailField label="Approved At" value={new Date(order.approved_at).toLocaleDateString('en-US')} />
            )}
            {order.payment_terms && (
              <DetailField label="Payment Terms" value={order.payment_terms} span={3} />
            )}
            {order.delivery_terms && (
              <DetailField label="Delivery Terms" value={order.delivery_terms} span={3} />
            )}
            {order.notes && (
              <DetailField label="Notes" value={order.notes} span={3} />
            )}
            {order.rejection_reason && (
              <DetailField
                label={order.status === 'cancelled' ? 'Cancel Reason' : 'Rejection Reason'}
                value={
                  <div className="p-3 rounded-md" style={{
                    backgroundColor: 'var(--color-error-light)',
                    border: '1px solid var(--color-error)',
                  }}>
                    <p className="text-sm" style={{ color: '#991B1B', margin: 0 }}>{order.rejection_reason}</p>
                  </div>
                }
                span={3}
              />
            )}
          </DetailCard>

          {/* Products */}
          <DetailCard title="Products">
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
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="font-medium">{item.product?.name || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground">{item.product?.code || ''}</div>
                      </td>
                      <td className="text-muted-foreground">{item.product?.unit?.toUpperCase() || '—'}</td>
                      <td>{item.quantity}</td>
                      <td className="text-muted-foreground">{formatPrice(item.unit_price)}</td>
                      <td className="text-muted-foreground">{item.discount || 0}%</td>
                      <td className="text-muted-foreground">{item.tax_rate || 0}%</td>
                      <td className="font-semibold">{formatPrice(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DetailCard>

          {/* Financial Summary */}
          {(() => {
            const itemsSubtotal = order.items.reduce((sum, item) => {
              const s = Number(item.quantity) * Number(item.unit_price);
              const d = s * ((Number(item.discount) || 0) / 100);
              return sum + s - d;
            }, 0);
            const itemsVat = order.items.reduce((sum, item) => {
              const s = Number(item.quantity) * Number(item.unit_price);
              const d = s * ((Number(item.discount) || 0) / 100);
              return sum + (s - d) * ((Number(item.tax_rate) || 0) / 100);
            }, 0);
            const globalDiscount = Number(order.discount) || 0;
            const computedTotal = itemsSubtotal - globalDiscount + itemsVat;
            return (
              <DetailCard title="Financial Summary">
                <div className="col-span-3 flex justify-end">
                  <div className="w-64 flex flex-col gap-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-semibold">{formatPrice(itemsSubtotal)}</span>
                    </div>
                    {globalDiscount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount:</span>
                        <span className="font-semibold text-red-500">- {formatPrice(globalDiscount)}</span>
                      </div>
                    )}
                    {itemsVat > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">VAT:</span>
                        <span className="font-semibold">{formatPrice(itemsVat)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-border pt-2 text-base">
                      <span className="font-bold">Total:</span>
                      <span className="font-bold">{formatPrice(computedTotal)}</span>
                    </div>
                  </div>
                </div>
              </DetailCard>
            );
          })()}

          {/* Terms & Conditions */}
          {order.terms_and_conditions && (
            <div className="card" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <h2 className="text-base font-semibold mb-5 pb-3 border-b text-foreground" style={{ borderColor: 'var(--border-primary)' }}>
                Terms & Conditions
              </h2>
              <div className="text-sm leading-relaxed font-mono">
                {order.terms_and_conditions.split('\n').map((line, i) => {
                  if (!line.trim()) return <div key={i} style={{ marginBottom: '0.5rem' }} />;
                  const hasArabic = /[؀-ۿ]/.test(line);
                  return (
                    <div key={i} style={{
                      direction: hasArabic ? 'rtl' : 'ltr',
                      textAlign: hasArabic ? 'right' : 'left',
                      marginBottom: '0.5rem',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <RejectionReasonDialog
            isOpen={rejectDialogOpen}
            onClose={() => setRejectDialogOpen(false)}
            onConfirm={(reason) => rejectMutation.mutate(reason)}
            title="Reject Purchase Order"
            message="Please provide a reason for rejecting this purchase order."
          />

          <RejectionReasonDialog
            isOpen={cancelDialogOpen}
            onClose={() => setCancelDialogOpen(false)}
            onConfirm={(reason) => cancelMutation.mutate(reason)}
            title="Cancel Purchase Order"
            message="Please provide a reason for cancelling this purchase order."
          />
        </PageShell>
      </div>
    </MainLayout>
  );
}
