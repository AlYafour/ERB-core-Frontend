'use client';

import { type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goodsReceivingApi } from '@/lib/api/goods-receiving';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { canCreateInvoice } from '@/lib/utils/workflow-guards';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { useProcPermissions } from '@/lib/hooks/use-proc-permissions';
import { Button, Badge, PageShell } from '@/components/ui';
import { QUALITY_STATUS, GRN_STATUS } from '@/lib/utils/status-colors';
import { GRN_LABEL } from '@/lib/constants/status-labels';
import { useT } from '@/lib/i18n/useT';
import { ReadOnlyItemsTable } from '@/components/procurement/ReadOnlyItemsTable';
import { DocLoadState } from '@/components/procurement/shared/DocLoadState';
import { StickyDocBar } from '@/components/procurement/shared/StickyDocBar';

export default function GRNDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const t = useT();
  const { can } = useProcPermissions();

  const canMarkInvoice   = can('goods_receiving', 'update');
  const canCreateInvPerm = can('purchase_invoice', 'create');

  const qualityLabel: Record<string, string> = {
    good: t('status', 'good'), damaged: t('status', 'damaged'),
    defective: t('status', 'defective'), missing: t('empty', 'notFound'),
  };

  const { data: grn, isLoading } = useQuery({
    queryKey: ['goods-receiving', id],
    queryFn: () => goodsReceivingApi.getById(id),
  });

  const markInvoiceDeliveredMutation = useMutation({
    mutationFn: () => goodsReceivingApi.markInvoiceDelivered(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receiving', id] });
      toast('Invoice marked as delivered to office', 'success');
    },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to mark invoice as delivered'), 'error'),
  });

  if (isLoading) return <DocLoadState type="loading" />;
  if (!grn)      return <DocLoadState type="not-found" message="GRN not found." />;

  const purchaseOrder = typeof grn.purchase_order === 'object' ? grn.purchase_order : null;
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const chainNode = purchaseOrder ? (
    <>
      <Link href={`/purchase-orders/${purchaseOrder.id}`} className="proc-bar-chain-step">
        {purchaseOrder.order_number || `LPO-${purchaseOrder.id}`}
      </Link>
      <span className="proc-bar-chain-arrow">→</span>
      <span className="proc-bar-chain-current">{grn.grn_number}</span>
    </>
  ) : null;

  return (
    <MainLayout>
      <PageShell compact>

        {/* ── Sticky action bar with inline chain ── */}
        <StickyDocBar
          docTypeLabel="Goods Receiving Note"
          docNumber={grn.grn_number}
          statusVariant={GRN_STATUS[grn.status] ?? 'default'}
          statusLabel={GRN_LABEL[grn.status] || grn.status}
          chain={chainNode}
        >
          <Button variant="secondary" size="sm" onClick={() => window.open(`/print/grn/${id}`, '_blank')}>Print GRN</Button>
          {grn.invoices && grn.invoices.length > 0 ? (
            <Link href={`/purchase-invoices/${grn.invoices[0].id}`}>
              <Button variant="primary" size="sm">View Invoice</Button>
            </Link>
          ) : (
            purchaseOrder && purchaseOrder.status === 'approved' && canCreateInvPerm && (
              <Button variant="primary" size="sm"
                onClick={async () => {
                  const guard = canCreateInvoice(purchaseOrder.status);
                  if (!guard.canProceed) { toast(guard.reason || 'Cannot create invoice', 'error'); return; }
                  if (guard.warning && !await confirm(guard.warning + '\n\nContinue?')) return;
                  router.push(`/purchase-invoices/new?purchase_order_id=${purchaseOrder.id}&grn_id=${id}`);
                }}
              >
                + Invoice
              </Button>
            )
          )}
        </StickyDocBar>

        {/* ── Two-column: GRN info left / items right ── */}
        <div className="proc-detail-split">

          {/* LEFT: GRN information + attachments */}
          <div className="proc-detail-info">
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="proc-section-head">
                <h3 className="proc-section-title">GRN Information</h3>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{fmt(grn.receipt_date)}</span>
              </div>
              <div className="proc-info-grid">
                {purchaseOrder && (
                  <ProcField label={t('page', 'purchaseOrders')} value={
                    <Link href={`/purchase-orders/${purchaseOrder.id}`} style={{ color: 'var(--brand)', fontWeight: 'var(--weight-semibold)', textDecoration: 'none' }}>
                      {purchaseOrder.order_number} ↗
                    </Link>
                  } />
                )}
                <ProcField label={t('field', 'receiptDate')} value={fmt(grn.receipt_date)} />
                <ProcField label={t('col', 'createdBy')}     value={grn.received_by_name || '—'} />
                <ProcField label="Total Items"               value={<span style={{ fontWeight: 700 }}>{grn.total_items || 0}</span>} />
                <ProcField label="Total Received"            value={<span style={{ fontWeight: 700, color: 'var(--status-success)' }}>{grn.total_received_quantity || 0}</span>} />
                <ProcField label="Invoice Status" value={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Badge variant={grn.invoice_delivery_status === 'delivered' ? 'success' : 'warning'}>
                      {grn.invoice_delivery_status === 'delivered' ? t('status', 'delivered') : t('status', 'notDelivered')}
                    </Badge>
                    {grn.invoice_delivery_status === 'not_delivered' && canMarkInvoice && (
                      <Button variant="primary" size="sm" isLoading={markInvoiceDeliveredMutation.isPending} onClick={() => markInvoiceDeliveredMutation.mutate()}>
                        Mark Delivered
                      </Button>
                    )}
                  </div>
                } />
                {grn.notes && <ProcField label={t('col', 'notes')} value={grn.notes} />}
              </div>
            </div>

            {/* Attachments / supplier invoice */}
            {((grn.material_images && grn.material_images.length > 0) || grn.supplier_invoice_file_url) && (
              <div className="card">
                <div className="proc-section-head">
                  <h3 className="proc-section-title">{t('section', 'receiptInfo')}</h3>
                </div>
                {grn.material_images && grn.material_images.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: grn.supplier_invoice_file_url ? 10 : 0 }}>
                    {grn.material_images.map((img: { id?: number; image_url?: string; image?: string }, i: number) => (
                      <div key={img.id || i} style={{ width: 100, height: 100, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border-subtle)' }}
                        onClick={() => window.open(img.image_url || img.image, '_blank')}>
                        <img src={img.image_url || img.image} alt={`Material ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
                {grn.supplier_invoice_file_url && (
                  grn.supplier_invoice_file_url.endsWith('.pdf') ? (
                    <a href={grn.supplier_invoice_file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">View Supplier Invoice PDF</Button>
                    </a>
                  ) : (
                    <img src={grn.supplier_invoice_file_url} alt="Supplier Invoice" style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border-subtle)' }}
                      onClick={() => window.open(grn.supplier_invoice_file_url!, '_blank')} />
                  )
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Received items */}
          <div className="proc-detail-products">
            <div className="card">
              <div className="proc-section-head">
                <h3 className="proc-section-title">
                  {t('section', 'receivedItems')}
                  <span className="proc-section-count">{(grn.items ?? []).length}</span>
                </h3>
              </div>
              <ReadOnlyItemsTable
                items={grn.items ?? []}
                emptyMessage={t('empty', 'noResults')}
                columns={[
                  {
                    header: t('col', 'product'),
                    cell: (item) => (
                      <div>
                        <div className="cell-product-name">{item.product?.name || 'N/A'}</div>
                        {item.product?.code && <div className="cell-product-code">{item.product.code}</div>}
                      </div>
                    ),
                  },
                  { header: t('col', 'unit'),        align: 'center', cell: (item) => <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>{item.product?.unit?.toUpperCase() || '—'}</span> },
                  { header: t('col', 'orderedQty'),  align: 'center', cell: (item) => item.ordered_quantity },
                  { header: t('col', 'receivedQty'), align: 'center', cell: (item) => <span style={{ color: 'var(--status-success)', fontWeight: 700 }}>{item.received_quantity}</span> },
                  { header: t('col', 'rejectedQty'), align: 'center', cell: (item) => item.rejected_quantity ? <span style={{ color: 'var(--status-error)', fontWeight: 700 }}>{item.rejected_quantity}</span> : <span style={{ color: 'var(--text-tertiary)' }}>—</span> },
                  {
                    header: t('col', 'qualityStatus'),
                    cell: (item) => <Badge variant={QUALITY_STATUS[item.quality_status] ?? 'info'}>{qualityLabel[item.quality_status] || item.quality_status}</Badge>,
                  },
                  { header: t('col', 'notes'), cell: (item) => <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.notes || '—'}</span> },
                ]}
              />
            </div>
          </div>

        </div>

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
