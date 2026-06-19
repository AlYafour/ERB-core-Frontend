'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goodsReceivingApi } from '@/lib/api/goods-receiving';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import LinkedDocumentsSection from '@/components/features/LinkedDocumentsSection';
import DetailCard, { DetailField } from '@/components/ui/DetailCard';
import { canCreateInvoice } from '@/lib/utils/workflow-guards';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { useProcPermissions } from '@/lib/hooks/use-proc-permissions';
import { Button, Badge, PageHeader, PageShell } from '@/components/ui';
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
  const { isAdmin, can } = useProcPermissions();

  const canMarkInvoice    = can('goods_receiving', 'update');
  const canCreateInvPerm  = can('purchase_invoice', 'create');

  const qualityStatusLabels: Record<string, string> = {
    good:      t('status', 'good'),
    damaged:   t('status', 'damaged'),
    defective: t('status', 'defective'),
    missing:   t('empty', 'notFound'),
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
    onError: (err: any) => toast(getApiError(err, 'Failed to mark invoice as delivered'), 'error'),
  });

  if (isLoading) return <DocLoadState type="loading" />;
  if (!grn)      return <DocLoadState type="not-found" message="GRN not found." />;

  const purchaseOrder = typeof grn.purchase_order === 'object' ? grn.purchase_order : null;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          backHref="/goods-receiving"
          title={`GRN: ${grn.grn_number}`}
          breadcrumbs={[{ label: t('page', 'goodsReceiving'), href: '/goods-receiving' }, { label: grn.grn_number }]}
        />

        {/* ── Sticky action bar ── */}
        <StickyDocBar
          docTypeLabel="Goods Receiving Note"
          docNumber={grn.grn_number}
          statusVariant={GRN_STATUS[grn.status] ?? 'default'}
          statusLabel={GRN_LABEL[grn.status] || grn.status}
        >
          <Button variant="secondary" size="sm" onClick={() => window.open(`/print/grn/${id}`, '_blank')}>Print GRN</Button>
          {grn.invoices && grn.invoices.length > 0 ? (
            <Link href={`/purchase-invoices/${grn.invoices[0].id}`}>
              <Button variant="primary" size="sm">View Invoice</Button>
            </Link>
          ) : (
            purchaseOrder && purchaseOrder.status === 'approved' && canCreateInvPerm && (
              <Button
                variant="primary"
                size="sm"
                onClick={async () => {
                  const guard = canCreateInvoice(purchaseOrder.status);
                  if (!guard.canProceed) { toast(guard.reason || 'Cannot create invoice', 'error'); return; }
                  if (guard.warning && !await confirm(guard.warning + '\n\nDo you want to continue?')) return;
                  router.push(`/purchase-invoices/new?purchase_order_id=${purchaseOrder.id}&grn_id=${id}`);
                }}
              >
                Create Invoice
              </Button>
            )
          )}
        </StickyDocBar>

        <LinkedDocumentsSection
          documents={{
            purchaseOrder: purchaseOrder ? { id: purchaseOrder.id, order_number: purchaseOrder.order_number } : null,
            grn: { id: grn.id, grn_number: grn.grn_number },
          }}
        />

        <DetailCard title="GRN Information">
          <DetailField
            label={t('page', 'purchaseOrders')}
            value={
              purchaseOrder ? (
                <div>
                  <div style={{ fontWeight: 'var(--weight-semibold)' }}>{purchaseOrder.order_number}</div>
                  <Link href={`/purchase-orders/${purchaseOrder.id}`} style={{ fontSize: 'var(--text-sm)', color: 'var(--text-brand)', textDecoration: 'underline' }}>
                    {t('btn', 'view')} {t('page', 'purchaseOrders')}
                  </Link>
                </div>
              ) : 'N/A'
            }
          />
          <DetailField label={t('field', 'receiptDate')} value={new Date(grn.receipt_date).toLocaleDateString('en-US')} />
          <DetailField label={t('col', 'createdBy')} value={grn.received_by_name || 'N/A'} />
          {grn.notes && <DetailField label={t('col', 'notes')} value={grn.notes} span={3} />}
        </DetailCard>

        {/* Material Images & Invoice */}
        {((grn.material_images && grn.material_images.length > 0) || grn.supplier_invoice_file_url || grn.invoice_delivery_status) && (
          <DetailCard title={t('section', 'receiptInfo')}>
            {grn.material_images && grn.material_images.length > 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {grn.material_images.map((img: any, i: number) => (
                    <div key={img.id || i} style={{ width: 150, height: 150, borderRadius: 4, overflow: 'hidden', cursor: 'pointer' }} onClick={() => window.open(img.image_url || img.image, '_blank')}>
                      <img src={img.image_url || img.image} alt={`Material ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {grn.supplier_invoice_file_url && (
              <div>
                {grn.supplier_invoice_file_url.endsWith('.pdf') ? (
                  <a href={grn.supplier_invoice_file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="primary">{t('btn', 'view')} PDF</Button>
                  </a>
                ) : (
                  <img src={grn.supplier_invoice_file_url} alt="Supplier Invoice" style={{ maxWidth: 300, maxHeight: 300, objectFit: 'contain', borderRadius: 4, cursor: 'pointer' }} onClick={() => window.open(grn.supplier_invoice_file_url!, '_blank')} />
                )}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Badge variant={grn.invoice_delivery_status === 'delivered' ? 'success' : 'warning'}>
                {grn.invoice_delivery_status === 'delivered' ? t('status', 'delivered') : t('status', 'notDelivered')}
              </Badge>
              {grn.invoice_delivery_status === 'not_delivered' && canMarkInvoice && (
                <Button variant="primary" isLoading={markInvoiceDeliveredMutation.isPending} onClick={() => markInvoiceDeliveredMutation.mutate()}>
                  {t('status', 'delivered')}
                </Button>
              )}
            </div>
          </DetailCard>
        )}

        <DetailCard title={t('section', 'receivedItems')}>
          <div style={{ gridColumn: '1 / -1' }}>
            <ReadOnlyItemsTable
              items={grn.items ?? []}
              emptyMessage={t('empty', 'noResults')}
              columns={[
                {
                  header: t('col', 'product'),
                  cell: (item) => (
                    <>
                      <div style={{ fontWeight: 'var(--weight-medium)' }}>{item.product?.name || 'N/A'}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.product?.code}</div>
                    </>
                  ),
                },
                { header: t('col', 'unit'),        cell: (item) => <span style={{ color: 'var(--text-secondary)' }}>{item.product?.unit?.toUpperCase() || '—'}</span> },
                { header: t('col', 'orderedQty'),  cell: (item) => item.ordered_quantity },
                { header: t('col', 'receivedQty'), cell: (item) => <span style={{ color: 'var(--color-success)', fontWeight: 'var(--weight-semibold)' }}>{item.received_quantity}</span> },
                { header: t('col', 'rejectedQty'), cell: (item) => <span style={{ color: 'var(--color-error)' }}>{item.rejected_quantity}</span> },
                {
                  header: t('col', 'qualityStatus'),
                  cell: (item) => <Badge variant={QUALITY_STATUS[item.quality_status] ?? 'info'}>{qualityStatusLabels[item.quality_status] || item.quality_status}</Badge>,
                },
                { header: t('col', 'notes'), cell: (item) => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{item.notes || '—'}</span> },
              ]}
            />
          </div>
        </DetailCard>

        {/* Summary stats */}
        <DetailCard title="Summary">
          <DetailField label={t('col', 'qty')} value={<span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)' }}>{grn.total_items || 0}</span>} />
          <DetailField label={t('col', 'receivedQty')} value={<span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-success)' }}>{grn.total_received_quantity || 0}</span>} />
          <DetailField label="Created At" value={new Date(grn.created_at).toLocaleDateString('en-US')} />
        </DetailCard>

      </PageShell>
    </MainLayout>
  );
}
