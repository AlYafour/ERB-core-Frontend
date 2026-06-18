'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseQuotationsApi } from '@/lib/api/purchase-quotations';
import MainLayout from '@/components/layout/MainLayout';
import { Button, PageShell } from '@/components/ui';
import PageHeader from '@/components/ui/PageHeader';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils/format';
import LinkedDocumentsSection from '@/components/features/LinkedDocumentsSection';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
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
      const message = getApiError(error, 'Failed to award quotation');
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
      const message = getApiError(error, 'Failed to reject quotation');
      toast(message, 'error');
    },
  });

  const { hasPermission } = usePermissions();
  
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;
  // Procurement Officer cannot award - only Procurement Manager and Admins can award
  const canAward = isAdmin || ((hasPermission('purchase_quotation', 'award') ?? false) &&
                   user?.role !== 'procurement_officer' &&
                   user?.role === 'procurement_manager');
  const canReject = isAdmin || (hasPermission('purchase_quotation', 'reject') ?? false);
  // Only Procurement Officer and Admins can convert awarded quotations to LPO
  const canConvert = isAdmin ||
                     (hasPermission('purchase_order', 'convert') ?? false) ||
                     (hasPermission('purchase_order', 'create') ?? false) ||
                     (user?.role === 'procurement_officer');

  if (isLoading) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('btn', 'loading')}</p>
        </div>
      </MainLayout>
    );
  }

  if (!quotation) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{t('empty', 'notFound')}</p>
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
      <PageShell>
        {/* Header */}
        <PageHeader
          backHref="/purchase-quotations"
          title={`Quotation: ${quotation.quotation_number}`}
          description="View quotation details and pricing"
          breadcrumbs={[{ label: t('page', 'purchaseQuotations'), href: '/purchase-quotations' }, { label: quotation.quotation_number }]}
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
            gap: 'var(--space-4)',
          }}>
            {(quotation.project_name || quotation.project_code) && (
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--space-2)',
                }}>
                  Project
                </label>
                <p style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: 0 }}>
                  {quotation.project_name}
                </p>
                {quotation.project_code && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, fontFamily: 'monospace' }}>
                    {quotation.project_code}
                  </p>
                )}
              </div>
            )}
            <div>
              <label style={{
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-2)',
              }}>
                {t('col', 'supplier')}
              </label>
              <p style={{ 
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {supplierName}
              </p>
            </div>
            <div>
              <label style={{ 
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-2)',
              }}>
                Quotation Date
              </label>
              <p style={{ 
                fontSize: 'var(--text-base)',
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {new Date(quotation.quotation_date).toLocaleDateString('en-US')}
              </p>
            </div>
            <div>
              <label style={{ 
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-2)',
              }}>
                Valid Until
              </label>
              <p style={{ 
                fontSize: 'var(--text-base)',
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
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--space-2)',
                }}>
                  Payment Terms
                </label>
                <p style={{ 
                  fontSize: 'var(--text-base)',
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
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--space-2)',
                }}>
                  Delivery Terms
                </label>
                <p style={{ 
                  fontSize: 'var(--text-base)',
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
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--space-2)',
                }}>
                  {t('col', 'notes')}
                </label>
                <p style={{
                  fontSize: 'var(--text-base)',
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
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--space-2)',
                }}>
                  Awarded By
                </label>
                <p style={{ 
                  fontSize: 'var(--text-base)',
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
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-medium)',
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--space-2)',
                }}>
                  Awarded At
                </label>
                <p style={{ 
                  fontSize: 'var(--text-base)',
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
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-primary)',
            margin: 0,
            marginBottom: 'var(--space-4)',
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
                            fontWeight: 'var(--weight-medium)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {productName}
                        </div>
                        <div
                          style={{
                            fontSize: 'var(--text-xs)',
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
                            fontWeight: 'var(--weight-semibold)',
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
            <div style={{ width: '256px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 'var(--text-sm)',
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                <span style={{ 
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--text-primary)',
                }}>
                  {formatPrice(Number(quotation.subtotal || 0))}
                </span>
              </div>
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 'var(--text-sm)',
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>Discount:</span>
                <span style={{ 
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--text-primary)',
                }}>
                  {formatPrice(Number(quotation.discount || 0))}
                </span>
              </div>
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 'var(--text-sm)',
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tax:</span>
                <span style={{ 
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--text-primary)',
                }}>
                  {formatPrice(Number(quotation.tax_amount || 0))}
                </span>
              </div>
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                borderTop: `1px solid var(--border-subtle)`,
                paddingTop: 'var(--space-2)',
                fontSize: 'var(--text-base)',
              }}>
                <span style={{
                  fontWeight: 'var(--weight-bold)',
                  color: 'var(--text-primary)',
                }}>
                  {t('col', 'total')}:
                </span>
                <span style={{ 
                  fontWeight: 'var(--weight-bold)',
                  color: 'var(--text-primary)',
                }}>
                  {formatPrice(Number(quotation.total || 0))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions - Unified */}
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {quotationStatus === 'pending' && (canAward || canReject) && (
            <>
              {canAward && !quotation.has_awarded_quotation && (
                <Button
                  variant="success"
                  disabled={awardMutation.isPending || quotation.has_awarded_quotation}
                  isLoading={awardMutation.isPending}
                  onClick={() => {
                    const guard = canAwardQuotation(quotationStatus, quotation.valid_until ?? undefined, canAward);
                    if (!guard.canProceed) { toast(guard.reason || 'Cannot award quotation', 'error'); return; }
                    if (quotation.has_awarded_quotation) { toast('This Purchase Request already has an awarded quotation.', 'error'); return; }
                    awardMutation.mutate();
                  }}
                >
                  {t('btn', 'approve')}
                </Button>
              )}
              {quotation.has_awarded_quotation && (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-warning)', margin: 0 }}>
                  This Purchase Request already has an awarded quotation. Cannot award another quotation.
                </p>
              )}
              {canReject && (
                <Button
                  variant="destructive"
                  disabled={rejectMutation.isPending}
                  isLoading={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate()}
                >
                  {t('btn', 'reject')}
                </Button>
              )}
            </>
          )}
          {quotationStatus === 'awarded' && canConvert && (
            <Button
              variant="primary"
              onClick={() => {
                const guard = canCreatePurchaseOrder(quotationStatus);
                if (!guard.canProceed) { toast(guard.reason || 'Cannot create purchase order', 'error'); return; }
                router.push(`/purchase-orders/new?purchase_quotation_id=${id}`);
              }}
            >
              Convert to Purchase Order (LPO)
            </Button>
          )}
        </div>
      </PageShell>
    </MainLayout>
  );
}
