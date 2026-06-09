'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils/format';
import RejectionReasonDialog from '@/components/features/RejectionReasonDialog';
import LinkedDocumentsSection from '@/components/features/LinkedDocumentsSection';
import DetailCard, { DetailField } from '@/components/ui/DetailCard';
import { Button, Badge, PageHeader, PageShell } from '@/components/ui';
import { PO_STATUS } from '@/lib/utils/status-colors';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
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
  amendment_requested: 'badge-warning',
  superseded: 'badge-neutral',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  cancelled: 'Cancelled',
  amendment_requested: 'Amendment Requested',
  superseded: 'Superseded',
};

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [amendmentDialogOpen, setAmendmentDialogOpen] = useState(false);
  const [rejectAmendmentOpen, setRejectAmendmentOpen] = useState(false);

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
      toast(getApiError(error, 'Failed to approve purchase order'), 'error');
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
      toast(getApiError(error, 'Failed to reject purchase order'), 'error');
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
      toast(getApiError(error, 'Failed to cancel purchase order'), 'error');
    },
  });

  const requestAmendmentMutation = useMutation({
    mutationFn: (reason: string) => purchaseOrdersApi.requestAmendment(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setAmendmentDialogOpen(false);
      toast('Amendment request submitted. Awaiting manager review.', 'success');
    },
    onError: (error: any) => {
      toast(getApiError(error, 'Failed to submit amendment request'), 'error');
    },
  });

  const approveAmendmentMutation = useMutation({
    mutationFn: () => purchaseOrdersApi.approveAmendment(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast('Amendment approved. Revision draft created.', 'success');
      router.push(`/purchase-orders/${data.revision_po.id}`);
    },
    onError: (error: any) => {
      toast(getApiError(error, 'Failed to approve amendment'), 'error');
    },
  });

  const rejectAmendmentMutation = useMutation({
    mutationFn: (manager_notes: string) => purchaseOrdersApi.rejectAmendment(id, manager_notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setRejectAmendmentOpen(false);
      toast('Amendment request rejected.', 'info');
    },
    onError: (error: any) => {
      toast(getApiError(error, 'Failed to reject amendment'), 'error');
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
    order.status !== 'completed' && order.status !== 'cancelled' &&
    order.status !== 'superseded';
  const canRequestAmendment = order && canUpdate &&
    order.status === 'approved' && !order.pending_amendment;
  const canManageAmendment = order && canApprove &&
    order.status === 'amendment_requested';

  if (isLoading) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Loading...</p>
        </div>
      </MainLayout>
    );
  }

  if (!order) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Purchase Order not found</p>
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
                  <Button variant="primary" size="sm" onClick={async () => {
                    const guard = canCreateInvoice(order.status);
                    if (!guard.canProceed) { toast(guard.reason || 'Cannot create invoice', 'error'); return; }
                    if (guard.warning && !await confirm(guard.warning + '\n\nDo you want to continue?')) return;
                    router.push(`/purchase-invoices/new?purchase_order_id=${id}`);
                  }}>Create Invoice</Button>
                )}
                {order.status === 'approved' && canCreateInvoicePerm && !order.has_grn && (
                  <Button variant="secondary" size="sm" disabled>Create Invoice (GRN Required)</Button>
                )}
                {canRequestAmendment && (
                  <Button variant="secondary" size="sm" onClick={() => setAmendmentDialogOpen(true)}>
                    Request Amendment
                  </Button>
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

          {/* ── Revision banner (this PO is a revision of an original) ── */}
          {order.revision_number != null && order.revision_number > 0 && order.parent_po && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px', borderRadius: 8,
              background: '#eff6ff', border: '1px solid #93c5fd', color: '#1d4ed8',
              fontSize: 'var(--text-sm)',
            }}>
              <span style={{ fontSize: 16 }}>📋</span>
              <span>
                This is <strong>Revision R{order.revision_number}</strong> of{' '}
                <Link href={`/purchase-orders/${order.parent_po}`} style={{ fontWeight: 700, textDecoration: 'underline', color: '#1d4ed8' }}>
                  {order.parent_order_number || `PO #${order.parent_po}`}
                </Link>
                . Edit the items then submit for approval.
              </span>
            </div>
          )}

          {/* ── Superseded banner ── */}
          {order.status === 'superseded' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px', borderRadius: 8,
              background: '#f3f4f6', border: '1px solid #d1d5db', color: '#6b7280',
              fontSize: 'var(--text-sm)',
            }}>
              <span style={{ fontSize: 16 }}>🔁</span>
              <span>
                This LPO has been <strong>superseded</strong> by an amendment.
                {order.latest_approved_amendment?.revision_po_id && (
                  <>
                    {' '}See revision{' '}
                    <Link href={`/purchase-orders/${order.latest_approved_amendment.revision_po_id}`} style={{ fontWeight: 700, textDecoration: 'underline', color: '#374151' }}>
                      {order.latest_approved_amendment.revision_po_number}
                    </Link>.
                  </>
                )}
              </span>
            </div>
          )}

          {/* ── Amendment requested banner ── */}
          {order.status === 'amendment_requested' && order.pending_amendment && (
            <div style={{
              padding: '14px 16px', borderRadius: 8,
              background: '#fffbeb', border: '1px solid #fcd34d',
              fontSize: 'var(--text-sm)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                      Amendment Requested by {order.pending_amendment.requested_by_name || 'a team member'}
                    </div>
                    <div style={{ color: '#78350f', lineHeight: 1.5 }}>
                      <strong>Reason:</strong> {order.pending_amendment.reason}
                    </div>
                    <div style={{ color: '#a16207', fontSize: 'var(--text-xs)', marginTop: 4 }}>
                      Requested on {new Date(order.pending_amendment.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                {canManageAmendment && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => approveAmendmentMutation.mutate()}
                      isLoading={approveAmendmentMutation.isPending}
                    >
                      Approve Amendment
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setRejectAmendmentOpen(true)}
                      disabled={rejectAmendmentMutation.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Order Information */}
          <DetailCard title="Order Information">
            {(order.project_name || order.project_code) && (
              <DetailField
                label="Project"
                value={
                  <div>
                    <div style={{ fontWeight: 'var(--weight-semibold)' }}>{order.project_name}</div>
                    {order.project_code && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{order.project_code}</div>}
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
                    style={{ color: 'var(--text-brand)', textDecoration: 'underline' }}
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
                  <div style={{
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-error-light)',
                    border: '1px solid var(--color-error)',
                  }}>
                    <p style={{ fontSize: 'var(--text-sm)', color: '#991B1B', margin: 0 }}>{order.rejection_reason}</p>
                  </div>
                }
                span={3}
              />
            )}
          </DetailCard>

          {/* Products */}
          <DetailCard title="Products">
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
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 'var(--weight-medium)' }}>{item.product?.name || 'N/A'}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.product?.code || ''}</div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{(item.unit || item.product?.unit)?.toUpperCase() || '—'}</td>
                      <td>{item.quantity}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{formatPrice(item.unit_price)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{item.discount || 0}%</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{item.tax_rate || 0}%</td>
                      <td style={{ fontWeight: 'var(--weight-semibold)' }}>{formatPrice(item.total)}</td>
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
            const transportCharge = Number(order.transportation_charge) || 0;
            const taxableBase = itemsSubtotal - globalDiscount + transportCharge;
            const vatAmount = Number(order.tax_rate) > 0
              ? taxableBase * (Number(order.tax_rate) / 100)
              : itemsVat;
            const computedTotal = taxableBase + vatAmount;
            return (
              <DetailCard title="Financial Summary">
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                      <span style={{ fontWeight: 'var(--weight-semibold)' }}>{formatPrice(itemsSubtotal)}</span>
                    </div>
                    {globalDiscount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Discount:</span>
                        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-error)' }}>− {formatPrice(globalDiscount)}</span>
                      </div>
                    )}
                    {transportCharge > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Transportation:</span>
                        <span style={{ fontWeight: 'var(--weight-semibold)' }}>{formatPrice(transportCharge)}</span>
                      </div>
                    )}
                    {vatAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          VAT{Number(order.tax_rate) > 0 ? ` (${order.tax_rate}%)` : ''}:
                        </span>
                        <span style={{ fontWeight: 'var(--weight-semibold)' }}>{formatPrice(vatAmount)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-2)', fontSize: 'var(--text-base)' }}>
                      <span style={{ fontWeight: 'var(--weight-bold)' }}>Total:</span>
                      <span style={{ fontWeight: 'var(--weight-bold)' }}>{formatPrice(computedTotal)}</span>
                    </div>
                  </div>
                </div>
              </DetailCard>
            );
          })()}

          {/* Terms & Conditions */}
          {order.terms_and_conditions && (
            <div className="card" style={{ backgroundColor: 'var(--surface-inset)' }}>
              <h2 className="section-title" style={{ paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border-subtle)', marginBottom: 'var(--space-4)' }}>
                Terms & Conditions
              </h2>
              <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6, fontFamily: 'monospace' }}>
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

          <RejectionReasonDialog
            isOpen={amendmentDialogOpen}
            onClose={() => setAmendmentDialogOpen(false)}
            onConfirm={(reason) => requestAmendmentMutation.mutate(reason)}
            title="Request Amendment"
            message="Describe what needs to be changed in this Purchase Order. The manager will review your request."
          />

          <RejectionReasonDialog
            isOpen={rejectAmendmentOpen}
            onClose={() => setRejectAmendmentOpen(false)}
            onConfirm={(reason) => rejectAmendmentMutation.mutate(reason)}
            title="Reject Amendment Request"
            message="Please provide a reason for rejecting this amendment request."
          />
        </PageShell>
      </div>
    </MainLayout>
  );
}
