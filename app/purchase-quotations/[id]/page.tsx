'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseQuotationsApi } from '@/lib/api/purchase-quotations';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils/format';
import LinkedDocumentsSection from '@/components/ui/LinkedDocumentsSection';
import { toast } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { canAwardQuotation, canCreatePurchaseOrder } from '@/lib/utils/workflow-guards';
import { useT } from '@/lib/i18n/useT';

const statusColors: Record<string, string> = {
  pending: 'badge-warning',
  awarded: 'badge-success',
  rejected: 'badge-error',
  expired: 'badge-info',
};

export default function PurchaseQuotationDetailPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const statusLabels: Record<string, string> = {
    pending: t('status', 'pending'),
    awarded: t('status', 'awarded'),
    rejected: t('status', 'rejected'),
    expired: t('status', 'expired'),
  };
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: quotation, isLoading } = useQuery({
    queryKey: ['purchase-quotations', id],
    queryFn: () => purchaseQuotationsApi.getById(id),
  });

  const awardMutation = useMutation({
    mutationFn: () => purchaseQuotationsApi.award(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      toast('Quotation awarded successfully!', 'success');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to award quotation';
      toast(message, 'error');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => purchaseQuotationsApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      toast('Quotation rejected', 'info');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to reject quotation';
      toast(message, 'error');
    },
  });

  const { hasPermission } = usePermissions();
  
  // Permission checks - Superuser has all permissions
  const isSuperuser = user?.is_superuser ?? false;
  // Procurement Officer cannot award - only Procurement Manager, Super Admin, and Superuser can award
  const canAward = isSuperuser || ((hasPermission('purchase_quotation', 'award') ?? false) &&
                   user?.role !== 'procurement_officer' &&
                   (user?.role === 'procurement_manager' || user?.role === 'super_admin'));
  const canReject = isSuperuser || (hasPermission('purchase_quotation', 'reject') ?? false);
  // Only Procurement Officer, Super Admin, and Superuser can convert awarded quotations to LPO
  // Procurement Manager should NOT be able to create LPO - this is Procurement Officer's responsibility
  const canConvert = isSuperuser || 
                     (hasPermission('purchase_order', 'convert') ?? false) ||
                     (hasPermission('purchase_order', 'create') ?? false) ||
                     (user?.role === 'procurement_officer') ||
                     (user?.role === 'super_admin');

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

  if (!quotation) {
    return (
      <MainLayout>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
          <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-12)' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('empty', 'notFound')}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  const supplierName =
    typeof quotation.supplier === 'object' && quotation.supplier !== null
      ? quotation.supplier.business_name ||
        quotation.supplier.name ||
        quotation.supplier.contact_person ||
        'N/A'
      : typeof quotation.supplier === 'number'
      ? `Supplier #${quotation.supplier}`
      : 'N/A';
  const quotationStatus: string = quotation.status || 'pending';

  return (
    <MainLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
        {/* Header */}
        <PageHeader
          backHref="/purchase-quotations"
          backLabel={`${t('btn', 'back')} ${t('page', 'purchaseQuotations')}`}
          title={`Quotation: ${quotation.quotation_number}`}
          subtitle="View quotation details and pricing"
          status={quotationStatus}
          statusColors={statusColors}
          statusLabels={statusLabels}
        />

        {/* Linked Documents */}
        <LinkedDocumentsSection
          documents={{
            purchaseRequest: quotation.quotation_request && typeof quotation.quotation_request === 'object' && quotation.quotation_request.purchase_request
              ? (typeof quotation.quotation_request.purchase_request === 'object' ? quotation.quotation_request.purchase_request : { id: quotation.quotation_request.purchase_request })
              : null,
            quotationRequest: quotation.quotation_request && typeof quotation.quotation_request === 'object'
              ? { id: quotation.quotation_request.id }
              : quotation.quotation_request
              ? { id: quotation.quotation_request }
              : null,
            purchaseQuotation: { id: quotation.id, quotation_number: quotation.quotation_number },
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
                {t('col', 'supplier')}
              </label>
              <p style={{ 
                fontSize: 'var(--font-base)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {supplierName}
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
                Quotation Date
              </label>
              <p style={{ 
                fontSize: 'var(--font-base)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {new Date(quotation.quotation_date).toLocaleDateString('en-US')}
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
                Valid Until
              </label>
              <p style={{ 
                fontSize: 'var(--font-base)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {quotation.valid_until
                  ? new Date(quotation.valid_until).toLocaleDateString('en-US')
                  : 'Not set'}
              </p>
            </div>
            {quotation.payment_terms && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ 
                  display: 'block',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--spacing-2)',
                }}>
                  Payment Terms
                </label>
                <p style={{ 
                  fontSize: 'var(--font-base)',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}>
                  {quotation.payment_terms}
                </p>
              </div>
            )}
            {quotation.delivery_terms && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ 
                  display: 'block',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--spacing-2)',
                }}>
                  Delivery Terms
                </label>
                <p style={{ 
                  fontSize: 'var(--font-base)',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}>
                  {quotation.delivery_terms}
                </p>
              </div>
            )}
            {quotation.notes && (
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
                  {quotation.notes}
                </p>
              </div>
            )}
            {quotation.awarded_by_name && (
              <div>
                <label style={{ 
                  display: 'block',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--spacing-2)',
                }}>
                  Awarded By
                </label>
                <p style={{ 
                  fontSize: 'var(--font-base)',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}>
                  {quotation.awarded_by_name}
                </p>
              </div>
            )}
            {quotation.awarded_at && (
              <div>
                <label style={{ 
                  display: 'block',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--spacing-2)',
                }}>
                  Awarded At
                </label>
                <p style={{ 
                  fontSize: 'var(--font-base)',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}>
                  {new Date(quotation.awarded_at).toLocaleDateString('en-US')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Items Section - Unified */}
        <div className="card">
          <h3 style={{ 
            fontSize: 'var(--font-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--text-primary)',
            margin: 0,
            marginBottom: 'var(--spacing-4)',
          }}>
            {t('col', 'product')}
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{t('col', 'product')}</th>
                  <th>{t('col', 'unit')}</th>
                  <th>{t('col', 'quantity')}</th>
                  <th>{t('col', 'unitPrice')}</th>
                  <th>Disc</th>
                  <th>Tax</th>
                  <th>{t('col', 'total')}</th>
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((item) => {
                  const productName =
                    typeof item.product === 'object' && item.product
                      ? item.product.name
                      : `Product #${item.product_id}`;
                  const productCode =
                    typeof item.product === 'object' && item.product
                      ? item.product.code
                      : '';
                  return (
                    <tr key={item.id ?? `${item.product_id}-${item.quantity}`}>
                      <td>
                        <div
                          style={{
                            fontWeight: 'var(--font-weight-medium)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {productName}
                        </div>
                        <div
                          style={{
                            fontSize: 'var(--font-xs)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {productCode}
                        </div>
                      </td>
                      <td>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {(typeof item.product === 'object' && item.product ? item.product.unit : null)?.toUpperCase() || '—'}
                        </div>
                      </td>
                      <td>
                        <div style={{ color: 'var(--text-primary)' }}>{item.quantity}</div>
                      </td>
                      <td>
                        <div style={{ color: 'var(--text-secondary)' }}>{formatPrice(Number(item.unit_price))}</div>
                      </td>
                      <td>
                        <div style={{ color: 'var(--text-secondary)' }}>{item.discount || 0}%</div>
                      </td>
                      <td>
                        <div style={{ color: 'var(--text-secondary)' }}>{item.tax_rate || item.tax || 0}%</div>
                      </td>
                      <td>
                        <div
                          style={{
                            fontWeight: 'var(--font-weight-semibold)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {formatPrice(Number(item.total))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary - Unified */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '256px', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 'var(--font-sm)',
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                <span style={{ 
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--text-primary)',
                }}>
                  {formatPrice(Number(quotation.subtotal || 0))}
                </span>
              </div>
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 'var(--font-sm)',
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>Discount:</span>
                <span style={{ 
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--text-primary)',
                }}>
                  {formatPrice(Number(quotation.discount || 0))}
                </span>
              </div>
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 'var(--font-sm)',
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tax:</span>
                <span style={{ 
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--text-primary)',
                }}>
                  {formatPrice(Number(quotation.tax_amount || 0))}
                </span>
              </div>
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                borderTop: `1px solid var(--border-primary)`,
                paddingTop: 'var(--spacing-2)',
                fontSize: 'var(--font-base)',
              }}>
                <span style={{
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--text-primary)',
                }}>
                  {t('col', 'total')}:
                </span>
                <span style={{ 
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--text-primary)',
                }}>
                  {formatPrice(Number(quotation.total || 0))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions - Unified */}
        <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
          {quotationStatus === 'pending' && (canAward || canReject) && (
            <>
              {canAward && !quotation.has_awarded_quotation && (
                <button
                  onClick={() => {
                    const guard = canAwardQuotation(
                      quotationStatus,
                      quotation.valid_until ?? undefined,
                      canAward
                    );
                    // canAward is already passed from hasPermission check
                    if (!guard.canProceed) {
                      toast(guard.reason || 'Cannot award quotation', 'error');
                      return;
                    }
                    // Check if PR already has an awarded quotation
                    if (quotation.has_awarded_quotation) {
                      toast('This Purchase Request already has an awarded quotation. Cannot award another quotation for the same PR.', 'error');
                      return;
                    }
                    awardMutation.mutate();
                  }}
                  disabled={awardMutation.isPending || quotation.has_awarded_quotation}
                  className="btn btn-success"
                  title={
                    quotation.has_awarded_quotation 
                      ? 'This Purchase Request already has an awarded quotation' 
                      : !canAward 
                        ? 'You do not have permission to award' 
                        : ''
                  }
                >
                  {awardMutation.isPending ? t('btn', 'loading') : t('btn', 'approve')}
                </button>
              )}
              {quotation.has_awarded_quotation && (
                <p style={{ 
                  fontSize: 'var(--font-sm)', 
                  color: 'var(--color-warning)', 
                  margin: 0 
                }}>
                  This Purchase Request already has an awarded quotation. Cannot award another quotation.
                </p>
              )}
              {canReject && (
                <button
                  onClick={() => rejectMutation.mutate()}
                  disabled={rejectMutation.isPending}
                  className="btn btn-destructive"
                  title={!canReject ? 'You do not have permission to reject' : ''}
                >
                  {rejectMutation.isPending ? t('btn', 'loading') : t('btn', 'reject')}
                </button>
              )}
            </>
          )}
          {quotationStatus === 'awarded' && canConvert && (
            <button
              onClick={() => {
                const guard = canCreatePurchaseOrder(quotationStatus);
                if (!guard.canProceed) {
                  toast(guard.reason || 'Cannot create purchase order', 'error');
                  return;
                }
                router.push(`/purchase-orders/new?purchase_quotation_id=${id}`);
              }}
              className="btn btn-primary"
              title={!canConvert ? 'You do not have permission to convert to PO' : ''}
            >
              Convert to Purchase Order (LPO)
            </button>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
