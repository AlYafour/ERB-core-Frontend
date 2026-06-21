'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { formatPrice, fmtDate } from '@/lib/utils/format';
import RejectionReasonDialog from '@/components/features/RejectionReasonDialog';
import { Button, PageShell } from '@/components/ui';
import { PO_STATUS } from '@/lib/utils/status-colors';
import { PO_LABEL } from '@/lib/constants/status-labels';
import { poItemBreakdown } from '@/lib/utils/po-item-totals';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { useProcPermissions } from '@/lib/hooks/use-proc-permissions';
import { canCreateGRN, canCreateInvoice } from '@/lib/utils/workflow-guards';
import { POLineItemsTable } from '@/components/procurement/shared/POLineItemsTable';
import { FinancialSummary } from '@/components/procurement/shared/FinancialSummary';
import { DocLoadState } from '@/components/procurement/shared/DocLoadState';
import { StickyDocBar } from '@/components/procurement/shared/StickyDocBar';
import { ProcField } from '@/components/procurement/shared/ProcField';

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { isAdmin, can } = useProcPermissions();

  const [rejectDialogOpen,    setRejectDialogOpen]    = useState(false);
  const [cancelDialogOpen,    setCancelDialogOpen]    = useState(false);
  const [amendmentDialogOpen, setAmendmentDialogOpen] = useState(false);
  const [rejectAmendmentOpen, setRejectAmendmentOpen] = useState(false);
  const [termsOpen,           setTermsOpen]           = useState(false);

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
  const globalDiscount       = Number(order.discount) || 0;
  const transportationCharge = Number(order.transportation_charge) || 0;
  const taxAmount            = Number(order.tax_amount) || 0;
  const chargesVat           = Number(order.charges_vat) || 0;
  const hasExplicitTax       = Number(order.tax_rate) > 0;
  const transportVat         = hasExplicitTax ? 0 : Math.max(0, taxAmount - chargesVat);
  const chargesSum           = (order.charges ?? []).reduce((s, c) => s + Number(c.total), 0);
  const combinedSubtotal     = itemsSubtotal + chargesSum;
  const combinedVat          = itemsVat + transportVat + chargesVat + (hasExplicitTax ? taxAmount : 0);
  const vatPct               = hasExplicitTax
    ? Number(order.tax_rate)
    : itemsVat > 0 && itemsSubtotal > 0
      ? Math.round((itemsVat / itemsSubtotal) * 100)
      : 0;

  const prRef = typeof order.purchase_request === 'object' ? order.purchase_request : order.purchase_request ? { id: order.purchase_request } : null;
  const pqRef = typeof order.purchase_quotation === 'object' ? order.purchase_quotation : order.purchase_quotation ? { id: order.purchase_quotation } : null;


  const chainNode = (prRef || pqRef) ? (
    <>
      {prRef && <Link href={`/purchase-requests/${prRef.id}`} className="proc-bar-chain-step">{(prRef as { code?: string }).code || `PR-${prRef.id}`}</Link>}
      {prRef && <span className="proc-bar-chain-arrow">→</span>}
      {pqRef && <Link href={`/purchase-quotations/${pqRef.id}`} className="proc-bar-chain-step">{(pqRef as { quotation_number?: string }).quotation_number || `PQ-${pqRef.id}`}</Link>}
      {pqRef && <span className="proc-bar-chain-arrow">→</span>}
      <span className="proc-bar-chain-current">{order.order_number}</span>
    </>
  ) : null;

  return (
    <MainLayout>
      <div className="lpo-print">
        <PageShell compact>

          {/* ── Sticky action bar with inline chain ── */}
          <StickyDocBar
            backHref="/purchase-orders"
            docTypeLabel="Purchase Order"
            docNumber={order.order_number}
            statusVariant={PO_STATUS[order.status] ?? 'info'}
            statusLabel={PO_LABEL[order.status] || order.status}
            chain={chainNode}
          >
            <Button variant="secondary" size="sm" onClick={() => window.open(`/print/lpo/${id}`, '_blank')}>Print LPO</Button>
            {canEdit && (
              <Link href={`/purchase-orders/${id}/edit`}><Button variant="edit" size="sm">Edit</Button></Link>
            )}
            {canApprove && isDraftOrPending && (
              <Button variant="success" size="sm" isLoading={approveMutation.isPending} onClick={() => approveMutation.mutate()}>Approve</Button>
            )}
            {canReject && isDraftOrPending && (
              <Button variant="destructive" size="sm" onClick={() => setRejectDialogOpen(true)}>Reject</Button>
            )}
            {canCancelOrder && (
              <Button variant="destructive" size="sm" onClick={() => setCancelDialogOpen(true)}>Cancel</Button>
            )}
            {order.status === 'approved' && canCreateGRNPerm && (
              <Button variant="primary" size="sm" onClick={() => {
                const guard = canCreateGRN(order.status);
                if (!guard.canProceed) { toast(guard.reason || 'Cannot create GRN', 'error'); return; }
                router.push(`/goods-receiving/new?purchase_order_id=${id}`);
              }}>+ GRN</Button>
            )}
            {order.status === 'approved' && canCreateInvPerm && order.has_grn && (
              <Button variant="primary" size="sm" onClick={async () => {
                const guard = canCreateInvoice(order.status);
                if (!guard.canProceed) { toast(guard.reason || 'Cannot create invoice', 'error'); return; }
                if (guard.warning && !await confirm(guard.warning + '\n\nContinue?')) return;
                router.push(`/purchase-invoices/new?purchase_order_id=${id}`);
              }}>+ Invoice</Button>
            )}
            {order.status === 'approved' && canCreateInvPerm && !order.has_grn && (
              <Button variant="secondary" size="sm" disabled title="GRN required before creating invoice">+ Invoice</Button>
            )}
            {canRequestAmend && (
              <Button variant="secondary" size="sm" onClick={() => setAmendmentDialogOpen(true)}>Request Amendment</Button>
            )}
          </StickyDocBar>

          {/* ── Status banners ── */}
          {order.revision_number != null && order.revision_number > 0 && order.parent_po && (
            <div className="proc-status-banner proc-status-banner--info">
              <span>📋</span>
              <span>Revision <strong>R{order.revision_number}</strong> of{' '}
                <Link href={`/purchase-orders/${order.parent_po}`} style={{ fontWeight: 700, textDecoration: 'underline', color: '#1d4ed8' }}>
                  {order.parent_order_number || `PO #${order.parent_po}`}
                </Link>.
              </span>
            </div>
          )}

          {order.status === 'superseded' && (
            <div className="proc-status-banner proc-status-banner--neutral">
              <span>🔁</span>
              <span>This LPO has been <strong>superseded</strong> by an amendment.
                {order.latest_approved_amendment?.revision_po_id && (
                  <> → <Link href={`/purchase-orders/${order.latest_approved_amendment.revision_po_id}`} style={{ fontWeight: 700, textDecoration: 'underline', color: 'var(--text-primary)' }}>
                    {order.latest_approved_amendment.revision_po_number}
                  </Link></>
                )}
              </span>
            </div>
          )}

          {order.status === 'amendment_requested' && order.pending_amendment && (
            <div className="proc-status-banner proc-status-banner--warning">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                  ⚠️ Amendment Requested — {order.pending_amendment.requested_by_name || 'team member'}
                </div>
                <div style={{ color: '#78350f', lineHeight: 1.5 }}><strong>Reason:</strong> {order.pending_amendment.reason}</div>
                <div style={{ color: '#a16207', fontSize: 'var(--text-xs)', marginTop: 4 }}>
                  {new Date(order.pending_amendment.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
              {canManageAmend && (
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <Button variant="success" size="sm" isLoading={approveAmendmentMutation.isPending} onClick={() => approveAmendmentMutation.mutate()}>Approve</Button>
                  <Button variant="destructive" size="sm" onClick={() => setRejectAmendmentOpen(true)}>Reject</Button>
                </div>
              )}
            </div>
          )}

          {/* ── Two-column: info left / products right ── */}
          <div className="proc-detail-split">

            {/* LEFT: Order information */}
            <div className="proc-detail-info">
              <div className="card">
                <div className="proc-section-head">
                  <h3 className="proc-section-title">Order Information</h3>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{fmtDate(order.order_date)}</span>
                </div>
                <div className="proc-info-grid">
                  <ProcField label="Supplier" value={typeof order.supplier === 'object' ? ((order.supplier as any)?.business_name || (order.supplier as any)?.name || '—') : '—'} />
                  <ProcField label="Order Date" value={fmtDate(order.order_date)} />
                  {order.delivery_date && <ProcField label="Delivery Date" value={fmtDate(order.delivery_date)} />}
                  {order.delivery_method && <ProcField label="Delivery Method" value={order.delivery_method === 'pickup' ? 'Pick Up' : 'Delivery'} />}
                  {order.approved_by_name && <ProcField label="Approved By" value={order.approved_by_name} />}
                  {order.approved_at && <ProcField label="Approved At" value={fmtDate(order.approved_at)} />}
                  {(order.project_name || order.project_code) && (
                    <ProcField label="Project" value={
                      <div>
                        <div style={{ fontWeight: 'var(--weight-medium)' }}>{order.project_name}</div>
                        {order.project_code && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{order.project_code}</div>}
                      </div>
                    } />
                  )}
                  {prRef && (
                    <ProcField label="Purchase Request" value={
                      <Link href={`/purchase-requests/${prRef.id}`} style={{ color: 'var(--brand)', fontWeight: 'var(--weight-semibold)', textDecoration: 'none' }}>
                        {(prRef as { code?: string }).code || `PR-${prRef.id}`} ↗
                      </Link>
                    } />
                  )}
                  {order.payment_terms && <ProcField label="Payment Terms" value={order.payment_terms} />}
                  {order.delivery_terms && <ProcField label="Delivery Terms" value={order.delivery_terms} />}
                  {order.notes && <ProcField label="Notes" value={order.notes} />}
                </div>
                {order.rejection_reason && (
                  <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--status-error-bg)', border: '1px solid var(--status-error-border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--status-error)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                      {order.status === 'cancelled' ? 'Cancellation Reason' : 'Rejection Reason'}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: '#991B1B', lineHeight: 1.5 }}>{order.rejection_reason}</div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Products + Financial */}
            <div className="proc-detail-products">
              <div className="card">
                <div className="proc-section-head">
                  <h3 className="proc-section-title">
                    Products
                    <span className="proc-section-count">{order.items.length + (order.charges?.length ?? 0)}</span>
                  </h3>
                </div>
                <POLineItemsTable
                  items={order.items}
                  charges={order.charges}
                  chargesVat={chargesVat}
                />
                <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
                  <FinancialSummary
                    rows={[
                      { label: 'Subtotal',       value: combinedSubtotal },
                      { label: `Discount (${order.discount}%)`, value: globalDiscount, variant: 'discount', prefix: '– ', hidden: !globalDiscount },
                      { label: 'Transportation', value: transportationCharge, hidden: !transportationCharge },
                      { label: vatPct > 0 ? `VAT (${vatPct}%)` : 'VAT', value: combinedVat, hidden: !combinedVat },
                    ]}
                    total={order.total}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* ── Terms & Conditions accordion ── */}
          {order.terms_and_conditions && (
            <div className="proc-terms-accordion">
              <button className="proc-terms-toggle" onClick={() => setTermsOpen((o) => !o)} aria-expanded={termsOpen}>
                <span>Terms &amp; Conditions</span>
                <svg className={`proc-terms-icon${termsOpen ? ' proc-terms-icon--open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {termsOpen && <div className="proc-terms-body">{order.terms_and_conditions}</div>}
            </div>
          )}

          <RejectionReasonDialog isOpen={rejectDialogOpen}    onClose={() => setRejectDialogOpen(false)}    onConfirm={(r) => rejectMutation.mutate(r)}            title="Reject Purchase Order"    message="Please provide a reason for rejecting this purchase order." />
          <RejectionReasonDialog isOpen={cancelDialogOpen}    onClose={() => setCancelDialogOpen(false)}    onConfirm={(r) => cancelMutation.mutate(r)}             title="Cancel Purchase Order"    message="Please provide a reason for cancelling this purchase order." />
          <RejectionReasonDialog isOpen={amendmentDialogOpen} onClose={() => setAmendmentDialogOpen(false)} onConfirm={(r) => requestAmendmentMutation.mutate(r)}  title="Request Amendment"        message="Describe what needs to be changed." />
          <RejectionReasonDialog isOpen={rejectAmendmentOpen} onClose={() => setRejectAmendmentOpen(false)} onConfirm={(r) => rejectAmendmentMutation.mutate(r)}   title="Reject Amendment Request" message="Please provide a reason for rejecting this amendment request." />
        </PageShell>
      </div>
    </MainLayout>
  );
}

