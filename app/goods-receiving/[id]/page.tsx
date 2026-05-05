'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goodsReceivingApi } from '@/lib/api/goods-receiving';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils/format';
import LinkedDocumentsSection from '@/components/ui/LinkedDocumentsSection';
import { canCreateInvoice } from '@/lib/utils/workflow-guards';
import { toast } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Button } from '@/components/ui';
import Image from 'next/image';
import { useT } from '@/lib/i18n/useT';

const statusColors: Record<string, string> = {
  draft: 'badge-info',
  partial: 'badge-warning',
  completed: 'badge-success',
  cancelled: 'badge-error',
};

const qualityStatusColors: Record<string, string> = {
  good: 'badge-success',
  damaged: 'badge-error',
  defective: 'badge-error',
  missing: 'badge-warning',
};

export default function GRNDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const t = useT();
  const statusLabels: Record<string, string> = {
    draft: t('status', 'draft'),
    partial: t('status', 'partial'),
    completed: t('status', 'completed'),
    cancelled: t('status', 'cancelled'),
  };
  const qualityStatusLabels: Record<string, string> = {
    good: t('status', 'good'),
    damaged: t('status', 'damaged'),
    defective: t('status', 'defective'),
    missing: t('empty', 'notFound'),
  };
  
  // Check if user can mark invoice as delivered (Procurement Officer or Super Admin)
  const isSuperuser = user?.is_superuser ?? false;
  const canMarkInvoice = isSuperuser || 
    (user?.role === 'procurement_officer' && 
     (hasPermission('goods_receiving', 'update') ?? false));
  
  // Check if user can create invoice - Site Engineer should NOT be able to create invoice
  const canCreateInvoicePerm = isSuperuser || 
    ((hasPermission('purchase_invoice', 'create') ?? false) &&
     user?.role !== 'site_engineer');

  const { data: grn, isLoading } = useQuery({
    queryKey: ['goods-receiving', id],
    queryFn: () => goodsReceivingApi.getById(id),
  });

  const markInvoiceDeliveredMutation = useMutation({
    mutationFn: () => goodsReceivingApi.markInvoiceDelivered(id),
    onSuccess: () => {
      toast('Invoice marked as delivered to office', 'success');
      queryClient.invalidateQueries({ queryKey: ['goods-receiving', id] });
    },
    onError: (error: any) => {
      toast(error?.response?.data?.error || 'Failed to mark invoice as delivered', 'error');
    },
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
          <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-12)' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('btn', 'loading')}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!grn) {
    return (
      <MainLayout>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
          <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-12)' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('empty', 'notFound')}</p>
            <Link href="/goods-receiving" style={{ marginTop: 'var(--spacing-4)', display: 'inline-block' }}>
              <Button variant="primary">{t('btn', 'back')} {t('page', 'goodsReceiving')}</Button>
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  const purchaseOrder = typeof grn.purchase_order === 'object' ? grn.purchase_order : null;

  return (
    <MainLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
        {/* Header */}
        <PageHeader
          backHref="/goods-receiving"
          backLabel={`${t('btn', 'back')} ${t('page', 'goodsReceiving')}`}
          title={`GRN: ${grn.grn_number}`}
          subtitle={t('page', 'grnSubtitle')}
          status={grn.status}
          statusColors={statusColors}
          statusLabels={statusLabels}
          actions={[
            { label: `🖨 ${t('btn', 'printGRN')}`, variant: 'print', onClick: () => window.open(`/print/grn/${id}`, '_blank') },
          ]}
        />

        {/* Linked Documents */}
        <LinkedDocumentsSection
          documents={{
            purchaseOrder: purchaseOrder ? { id: purchaseOrder.id, order_number: purchaseOrder.order_number } : null,
            grn: { id: grn.id, grn_number: grn.grn_number },
          }}
        />

        {/* Details Card - Unified */}
        <div className="card">
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 'var(--spacing-4)',
          }}>
            <div>
              <label style={{ 
                display: 'block',
                fontSize: 'var(--font-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-2)',
              }}>
                {t('page', 'purchaseOrders')}
              </label>
              <p style={{ 
                fontSize: 'var(--font-base)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--text-primary)',
                margin: 0,
                marginBottom: 'var(--spacing-1)',
              }}>
                {purchaseOrder?.order_number || 'N/A'}
              </p>
              {purchaseOrder && (
                <Link
                  href={`/purchase-orders/${purchaseOrder.id}`}
                  style={{ 
                    fontSize: 'var(--font-sm)',
                    color: 'var(--text-primary)',
                    textDecoration: 'underline',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--brand-orange)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                >
                  {t('btn', 'view')} {t('page', 'purchaseOrders')}
                </Link>
              )}
            </div>
            <div>
              <label style={{ 
                display: 'block',
                fontSize: 'var(--font-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-2)',
              }}>
                {t('field', 'receiptDate')}
              </label>
              <p style={{ 
                fontSize: 'var(--font-base)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {new Date(grn.receipt_date).toLocaleDateString('en-US')}
              </p>
            </div>
            <div>
              <label style={{ 
                display: 'block',
                fontSize: 'var(--font-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-2)',
              }}>
                {t('col', 'createdBy')}
              </label>
              <p style={{ 
                fontSize: 'var(--font-base)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {grn.received_by_name || 'N/A'}
              </p>
            </div>
            {grn.notes && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ 
                  display: 'block',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--spacing-2)',
                }}>
                  {t('col', 'notes')}
                </label>
                <p style={{ 
                  fontSize: 'var(--font-base)',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}>
                  {grn.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Material Images and Invoice Section */}
        {((grn.material_images && grn.material_images.length > 0) || grn.supplier_invoice_file_url || grn.invoice_delivery_status) ? (
          <div className="card">
            <h3 style={{ 
              fontSize: 'var(--font-lg)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--text-primary)',
              margin: 0,
              marginBottom: 'var(--spacing-4)',
            }}>
              {t('section', 'receiptInfo')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
              {/* Material Images */}
              {grn.material_images && grn.material_images.length > 0 && (
                <div>
                  <label style={{ 
                    display: 'block',
                    fontSize: 'var(--font-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--text-secondary)',
                    marginBottom: 'var(--spacing-2)',
                  }}>
                    {t('section', 'receiptInfo')}
                  </label>
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
                    {grn.material_images.map((imageObj: any, index: number) => (
                      <div key={imageObj.id || index} style={{ position: 'relative', width: '150px', height: '150px' }}>
                        <img
                          src={imageObj.image_url || imageObj.image}
                          alt={`Material ${index + 1}`}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover', 
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          onClick={() => window.open(imageObj.image_url || imageObj.image, '_blank')}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Supplier Invoice */}
              {grn.supplier_invoice_file_url && (
                <div>
                  <label style={{ 
                    display: 'block',
                    fontSize: 'var(--font-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--text-secondary)',
                    marginBottom: 'var(--spacing-2)',
                  }}>
                    {t('col', 'supplier')}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                    {grn.supplier_invoice_file_url.endsWith('.pdf') ? (
                      <a href={grn.supplier_invoice_file_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="primary">{t('btn', 'view')} PDF</Button>
                      </a>
                    ) : (
                      <img
                        src={grn.supplier_invoice_file_url}
                        alt="Supplier Invoice"
                        style={{ 
                          maxWidth: '300px', 
                          maxHeight: '300px', 
                          objectFit: 'contain', 
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                        onClick={() => window.open(grn.supplier_invoice_file_url!, '_blank')}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Invoice Delivery Status */}
              <div>
                <label style={{ 
                  display: 'block',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--spacing-2)',
                }}>
                  {t('col', 'invoiceDelivery')}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                  <span className={`badge ${grn.invoice_delivery_status === 'delivered' ? 'badge-success' : 'badge-warning'}`}>
                    {grn.invoice_delivery_status === 'delivered' 
                      ? t('status', 'delivered')
                      : t('status', 'notDelivered')}
                  </span>
                  {grn.invoice_delivery_status === 'not_delivered' && canMarkInvoice && (
                    <Button
                      variant="primary"
                      onClick={() => markInvoiceDeliveredMutation.mutate()}
                      disabled={markInvoiceDeliveredMutation.isPending}
                    >
                      {markInvoiceDeliveredMutation.isPending ? t('btn', 'loading') : t('status', 'delivered')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Items Section - Unified */}
        <div className="card">
          <h3 style={{ 
            fontSize: 'var(--font-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--text-primary)',
            margin: 0,
            marginBottom: 'var(--spacing-4)',
          }}>
            {t('section', 'receivedItems')}
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{t('col', 'product')}</th>
                  <th>{t('col', 'unit')}</th>
                  <th>{t('col', 'orderedQty')}</th>
                  <th>{t('col', 'receivedQty')}</th>
                  <th>{t('col', 'rejectedQty')}</th>
                  <th>{t('col', 'qualityStatus')}</th>
                  <th>{t('col', 'notes')}</th>
                </tr>
              </thead>
              <tbody>
                {grn.items && grn.items.length > 0 ? (
                  grn.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ 
                          fontWeight: 'var(--font-weight-medium)',
                          color: 'var(--text-primary)',
                        }}>
                          {item.product?.name || 'N/A'}
                        </div>
                        <div style={{ 
                          fontSize: 'var(--font-xs)',
                          color: 'var(--text-secondary)',
                        }}>
                          {item.product?.code || ''}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{item.product?.unit?.toUpperCase() || '—'}</td>
                      <td>
                        <div style={{ color: 'var(--text-primary)' }}>{item.ordered_quantity}</div>
                      </td>
                      <td>
                        <div style={{ 
                          color: 'var(--color-success)',
                          fontWeight: 'var(--font-weight-semibold)',
                        }}>
                          {item.received_quantity}
                        </div>
                      </td>
                      <td>
                        <div style={{ color: 'var(--color-error)' }}>{item.rejected_quantity}</div>
                      </td>
                      <td>
                        <span className={`badge ${qualityStatusColors[item.quality_status] || 'badge-info'}`}>
                          {qualityStatusLabels[item.quality_status] || item.quality_status}
                        </span>
                      </td>
                      <td>
                        <div style={{ 
                          fontSize: 'var(--font-sm)',
                          color: 'var(--text-secondary)',
                        }}>
                          {item.notes || '-'}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ 
                      textAlign: 'center',
                      color: 'var(--text-secondary)',
                      padding: 'var(--spacing-4)',
                    }}>
                      {t('empty', 'noResults')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary - Unified */}
        <div className="card">
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 'var(--spacing-4)',
          }}>
            <div>
              <label style={{ 
                display: 'block',
                fontSize: 'var(--font-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-2)',
              }}>
                {t('col', 'qty')}
              </label>
              <p style={{ 
                fontSize: 'var(--font-2xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {grn.total_items || 0}
              </p>
            </div>
            <div>
              <label style={{ 
                display: 'block',
                fontSize: 'var(--font-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-2)',
              }}>
                {t('col', 'receivedQty')}
              </label>
              <p style={{ 
                fontSize: 'var(--font-2xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-success)',
                margin: 0,
              }}>
                {grn.total_received_quantity || 0}
              </p>
            </div>
            <div>
              <label style={{ 
                display: 'block',
                fontSize: 'var(--font-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-2)',
              }}>
                Created At
              </label>
              <p style={{ 
                fontSize: 'var(--font-base)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {new Date(grn.created_at).toLocaleDateString('en-US')}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          {grn.invoices && grn.invoices.length > 0 ? (
            <Link href={`/purchase-invoices/${grn.invoices[0].id}`}>
              <Button variant="primary">View Invoice</Button>
            </Link>
          ) : (
            purchaseOrder && purchaseOrder.status === 'approved' && canCreateInvoicePerm && (
              <Button
                variant="primary"
                onClick={() => {
                  const guard = canCreateInvoice(purchaseOrder.status);
                  if (!guard.canProceed) { toast(guard.reason || 'Cannot create invoice', 'error'); return; }
                  if (guard.warning && !confirm(guard.warning + '\n\nDo you want to continue?')) return;
                  router.push(`/purchase-invoices/new?purchase_order_id=${purchaseOrder.id}&grn_id=${id}`);
                }}
              >
                Create Invoice
              </Button>
            )
          )}
        </div>
      </div>
    </MainLayout>
  );
}

