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
import { Button, PageHeader, PageShell } from '@/components/ui';
import { PO_STATUS } from '@/lib/utils/status-colors';
import { PO_LABEL } from '@/lib/constants/status-labels';
import { poItemBreakdown } from '@/lib/utils/po-item-totals';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { useProcPermissions } from '@/lib/hooks/use-proc-permissions';
import { canCreateGRN, canCreateInvoice } from '@/lib/utils/workflow-guards';
import { ReadOnlyItemsTable } from '@/components/procurement/ReadOnlyItemsTable';
import { FinancialSummary } from '@/components/procurement/shared/FinancialSummary';
import { DocLoadState } from '@/components/procurement/shared/DocLoadState';
import { StickyDocBar } from '@/components/procurement/shared/StickyDocBar';

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { isAdmin, can } = useProcPermissions();

  const [rejectDialogOpen,   setRejectDialogOpen]   = useState(false);
  const [cancelDialogOpen,   setCancelDialogOpen]   = useState(false);
  const [amendmentDialogOpen, setAmendmentDialogOpen] = useState(false);
  const [rejectAmendmentOpen, setRejectAmendmentOpen] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ['purchase-orders', id],
    queryFn: () => purchaseOrdersApi.getById(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    queryClient.invalidateQueries({ queryKey: ['pending-count'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => purchaseOrdersApi.approve(id),
    onSuccess: () => { invalidate(); toast('Purchase Order approved!', 'success'); },
    onError: (err: any) => toast(getApiError(err, 'Failed to approve'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => purchaseOrdersApi.reject(id, reason),
    onSuccess: () => { invalidate(); setRejectDialogOpen(false); toast('Purchase Order rejected', 'info'); },
    onError: (err: any) => toast(getApiError(err, 'Failed to reject'), 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => purchaseOrdersApi.cancel(id, reason),
    onSuccess: () => { invalidate(); setCancelDialogOpen(false); toast('Purchase Order cancelled', 'info'); },
    onError: (err: any) => toast(getApiError(err, 'Failed to cancel'), 'error'),
  });

  const requestAmendmentMutation = useMutation({
    mutationFn: (reason: string) => purchaseOrdersApi.requestAmendment(id, reason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); setAmendmentDialogOpen(false); toast('Amendment request submitted.', 'success'); },
    onError: (err: any) => toast(getApiError(err, 'Failed to submit amendment'), 'error'),
  });

  const approveAmendmentMutation = useMutation({
    mutationFn: () => purchaseOrdersApi.approveAmendment(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast('Amendment approved. Revision draft created.', 'success');
      router.push(`/purchase-orders/${data.revision_po.id}`);
    },
    onError: (err: any) => toast(getApiError(err, 'Failed to approve amendment'), 'error'),
  });

  const rejectAmendmentMutation = useMutation({
    mutationFn: (notes: string) => purchaseOrdersApi.rejectAmendment(id, notes),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); setRejectAmendmentOpen(false); toast('Amendment request rejected.', 'info'); },
    onError: (err: any) => toast(getApiError(err, 'Failed to reject amendment'), 'error'),
  });

  if (isLoading) return <DocLoadState type="loading" />;
  if (!order)    return <DocLoadState type="not-found" message="Purchase Order not found." />;

  const canApprove         = can('purchase_order', 'approve');
  const canReject          = can('purchase_order', 'reject');
  const canCancel          = can('purchase_order', 'cancel');
  const canUpdate          = can('purchase_order', 'update');
  const canCreateGRNPerm   = can('goods_receiving', 'create');
  const canCreateInvPerm   = can('purchase_invoice', 'create');

  const isDraftOrPending   = order.status === 'draft' || order.status === 'pending';
  const canEdit            = canUpdate && (isDraftOrPending || order.status === 'rejected');
  const canCancelOrder     = canCancel && !['completed','cancelled','superseded'].includes(order.status);
  const canRequestAmend    = canUpdate && order.status === 'approved' && !order.pending_amendment;
  const canManageAmend     = canApprove && order.status === 'amendment_requested';

  const { itemsSubtotal, itemsVat } = poItemBreakdown(order.items);
  const globalDiscount      = Number(order.discount) || 0;
  const transportationCharge = Number(order.transportation_charge) || 0;
  const taxAmount            = Number(order.tax_amount) || 0;

  return (
    <MainLayout>
      <div className="lpo-print">
        <PageShell>
          <PageHeader
            title={`Purchase Order: ${order.order_number}`}
            breadcrumbs={[{ label: 'Purchase Orders', href: '/purchase-orders' }, { label: order.order_number }]}
          />

          {/* ── Sticky action bar ── */}
          <StickyDocBar
            docTypeLabel="Purchase Order"
            docNumber={order.order_number}
            statusVariant={PO_STATUS[order.status] ?? 'info'}
            statusLabel={PO_LABEL[order.status] || order.status}
          >
            <Button variant="secondary" size="sm" onClick={() => window.open(`/print/lpo/${id}`, '_blank')}>Print LPO</Button>
            {canEdit && (
              <Link href={`/purchase-orders/${id}/edit`}><Button variant="edit" size="sm">Edit</Button></Link>
            )}
            {canApprove && isDraftOrPending && (
              <Button variant="success" size="sm" isLoading={approveMutation.isPending} onClick={() => approveMutation.mutate()}>Approve</Button>
            )}
            {canReject && isDraftOrPending && (
              <Button variant="destructive" size="sm" disabled={rejectMutation.isPending} onClick={() => setRejectDialogOpen(true)}>Reject</Button>
            )}
            {canCancelOrder && (
              <Button variant="destructive" size="sm" disabled={cancelMutation.isPending} onClick={() => setCancelDialogOpen(true)}>Cancel</Button>
            )}
            {order.status === 'approved' && canCreateGRNPerm && (
              <Button variant="primary" size="sm" onClick={() => {
                const guard = canCreateGRN(order.status);
                if (!guard.canProceed) { toast(guard.reason || 'Cannot create GRN', 'error'); return; }
                router.push(`/goods-receiving/new?purchase_order_id=${id}`);
              }}>Create GRN</Button>
            )}
            {order.status === 'approved' && canCreateInvPerm && order.has_grn && (
              <Button variant="primary" size="sm" onClick={async () => {
                const guard = canCreateInvoice(order.status);
                if (!guard.canProceed) { toast(guard.reason || 'Cannot create invoice', 'error'); return; }
                if (guard.warning && !await confirm(guard.warning + '\n\nDo you want to continue?')) return;
                router.push(`/purchase-invoices/new?purchase_order_id=${id}`);
              }}>Create Invoice</Button>
            )}
            {order.status === 'approved' && canCreateInvPerm && !order.has_grn && (
              <Button variant="secondary" size="sm" disabled>Create Invoice (GRN Required)</Button>
            )}
            {canRequestAmend && (
              <Button variant="secondary" size="sm" onClick={() => setAmendmentDialogOpen(true)}>Request Amendment</Button>
            )}
          </StickyDocBar>

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

          {/* Revision banner */}
          {order.revision_number != null && order.revision_number > 0 && order.parent_po && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 8, background: '#eff6ff', border: '1px solid #93c5fd', color: '#1d4ed8', fontSize: 'var(--text-sm)' }}>
              <span style={{ fontSize: 16 }}>📋</span>
              <span>
                This is <strong>Revision R{order.revision_number}</strong> of{' '}
                <Link href={`/purchase-orders/${order.parent_po}`} style={{ fontWeight: 700, textDecoration: 'underline', color: '#1d4ed8' }}>
                  {order.parent_order_number || `PO #${order.parent_po}`}
                </Link>. Edit the items then submit for approval.
              </span>
            </div>
          )}

          {/* Superseded banner */}
          {order.status === 'superseded' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 8, background: '#f3f4f6', border: '1px solid #d1d5db', color: '#6b7280', fontSize: 'var(--text-sm)' }}>
              <span style={{ fontSize: 16 }}>🔁</span>
              <span>
                This LPO has been <strong>superseded</strong> by an amendment.
                {order.latest_approved_amendment?.revision_po_id && (
                  <> See revision{' '}
                    <Link href={`/purchase-orders/${order.latest_approved_amendment.revision_po_id}`} style={{ fontWeight: 700, textDecoration: 'underline', color: '#374151' }}>
                      {order.latest_approved_amendment.revision_po_number}
                    </Link>.
                  </>
                )}
              </span>
            </div>
          )}

          {/* Amendment requested banner */}
          {order.status === 'amendment_requested' && order.pending_amendment && (
            <div style={{ padding: '14px 16px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fcd34d', fontSize: 'var(--text-sm)' }}>
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
                {canManageAmend && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Button variant="success" size="sm" isLoading={approveAmendmentMutation.isPending} onClick={() => approveAmendmentMutation.mutate()}>Approve Amendment</Button>
                    <Button variant="destructive" size="sm" disabled={rejectAmendmentMutation.isPending} onClick={() => setRejectAmendmentOpen(true)}>Reject</Button>
                  </div>
                )}
              </div>
            </div>
          )}

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
            {order.delivery_date && <DetailField label="Delivery Date" value={new Date(order.delivery_date).toLocaleDateString('en-US')} />}
            {order.delivery_method && <DetailField label="Delivery Method" value={order.delivery_method === 'pickup' ? 'Pick Up' : 'Delivery'} />}
            {order.purchase_request && (
              <DetailField
                label="Purchase Request"
                value={
                  <Link href={`/purchase-requests/${typeof order.purchase_request === 'object' ? order.purchase_request.id : order.purchase_request}`} style={{ color: 'var(--text-brand)', textDecoration: 'underline' }}>
                    {typeof order.purchase_request === 'object' ? order.purchase_request.code : 'View'}
                  </Link>
                }
              />
            )}
            {order.approved_by_name && <DetailField label="Approved By" value={order.approved_by_name} />}
            {order.approved_at && <DetailField label="Approved At" value={new Date(order.approved_at).toLocaleDateString('en-US')} />}
            {order.payment_terms && <DetailField label="Payment Terms" value={order.payment_terms} span={3} />}
            {order.delivery_terms && <DetailField label="Delivery Terms" value={order.delivery_terms} span={3} />}
            {order.notes && <DetailField label="Notes" value={order.notes} span={3} />}
            {order.rejection_reason && (
              <DetailField
                label={order.status === 'cancelled' ? 'Cancel Reason' : 'Rejection Reason'}
                span={3}
                value={
                  <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-error-light)', border: '1px solid var(--color-error)' }}>
                    <p style={{ fontSize: 'var(--text-sm)', color: '#991B1B', margin: 0 }}>{order.rejection_reason}</p>
                  </div>
                }
              />
            )}
          </DetailCard>

          <DetailCard title="Products">
            <div style={{ gridColumn: '1 / -1' }}>
              <ReadOnlyItemsTable
                items={order.items}
                columns={[
                  {
                    header: 'Product',
                    cell: (item) => (
                      <>
                        <div style={{ fontWeight: 'var(--weight-medium)' }}>{item.product?.name || 'N/A'}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.product?.code}</div>
                      </>
                    ),
                  },
                  { header: 'Unit',       cell: (item) => <span style={{ color: 'var(--text-secondary)' }}>{item.product?.unit?.toUpperCase() || '—'}</span> },
                  { header: 'Qty',        cell: (item) => item.quantity },
                  { header: 'Unit Price', cell: (item) => <span style={{ color: 'var(--text-secondary)' }}>{formatPrice(item.unit_price)}</span> },
                  { header: 'Disc %',     cell: (item) => <span style={{ color: 'var(--text-secondary)' }}>{item.discount || 0}%</span> },
                  { header: 'Tax %',      cell: (item) => <span style={{ color: 'var(--text-secondary)' }}>{item.tax_rate || 0}%</span> },
                  { header: 'Total',      cell: (item) => <span style={{ fontWeight: 'var(--weight-semibold)' }}>{formatPrice(item.total)}</span> },
                ]}
              />
            </div>
          </DetailCard>

          <DetailCard title="Financial Summary">
            <div style={{ gridColumn: '1 / -1' }}>
              <FinancialSummary
                rows={[
                  { label: 'Subtotal',       value: itemsSubtotal },
                  { label: 'Discount',       value: globalDiscount,       variant: 'discount', prefix: '- ', hidden: !globalDiscount },
                  { label: 'VAT',            value: itemsVat,             hidden: !itemsVat },
                  { label: 'Transportation', value: transportationCharge, hidden: !transportationCharge },
                  { label: Number(order.tax_rate) > 0 ? `Additional Tax (${order.tax_rate}%)` : 'Transport VAT', value: taxAmount, hidden: !taxAmount },
                ]}
                total={order.total}
              />
            </div>
          </DetailCard>

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
                    <div key={i} style={{ direction: hasArabic ? 'rtl' : 'ltr', textAlign: hasArabic ? 'right' : 'left', marginBottom: '0.5rem', whiteSpace: 'pre-wrap' }}>
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <RejectionReasonDialog isOpen={rejectDialogOpen}   onClose={() => setRejectDialogOpen(false)}   onConfirm={(r) => rejectMutation.mutate(r)}           title="Reject Purchase Order"       message="Please provide a reason for rejecting this purchase order." />
          <RejectionReasonDialog isOpen={cancelDialogOpen}   onClose={() => setCancelDialogOpen(false)}   onConfirm={(r) => cancelMutation.mutate(r)}            title="Cancel Purchase Order"       message="Please provide a reason for cancelling this purchase order." />
          <RejectionReasonDialog isOpen={amendmentDialogOpen} onClose={() => setAmendmentDialogOpen(false)} onConfirm={(r) => requestAmendmentMutation.mutate(r)} title="Request Amendment"           message="Describe what needs to be changed. The manager will review your request." />
          <RejectionReasonDialog isOpen={rejectAmendmentOpen} onClose={() => setRejectAmendmentOpen(false)} onConfirm={(r) => rejectAmendmentMutation.mutate(r)} title="Reject Amendment Request"    message="Please provide a reason for rejecting this amendment request." />
        </PageShell>
      </div>
    </MainLayout>
  );
}
