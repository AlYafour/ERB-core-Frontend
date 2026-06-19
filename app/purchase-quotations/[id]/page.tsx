'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseQuotationsApi } from '@/lib/api/purchase-quotations';
import MainLayout from '@/components/layout/MainLayout';
import { Button, Badge, PageHeader, PageShell } from '@/components/ui';
import DetailCard, { DetailField } from '@/components/ui/DetailCard';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils/format';
import LinkedDocumentsSection from '@/components/features/LinkedDocumentsSection';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { useProcPermissions } from '@/lib/hooks/use-proc-permissions';
import { canAwardQuotation, canCreatePurchaseOrder } from '@/lib/utils/workflow-guards';
import { useT } from '@/lib/i18n/useT';
import { ReadOnlyItemsTable } from '@/components/procurement/ReadOnlyItemsTable';
import { FinancialSummary } from '@/components/procurement/shared/FinancialSummary';
import { DocLoadState } from '@/components/procurement/shared/DocLoadState';
import { PQ_STATUS } from '@/lib/utils/status-colors';
import { PQ_LABEL } from '@/lib/constants/status-labels';

function resolveSupplierName(supplier: any): string {
  if (!supplier) return 'N/A';
  if (typeof supplier === 'object') {
    return supplier.business_name || supplier.name || supplier.contact_person || 'N/A';
  }
  return `Supplier #${supplier}`;
}

export default function PurchaseQuotationDetailPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { isAdmin, can } = useProcPermissions();

  const canAward   = can('purchase_quotation', 'award');
  const canReject  = can('purchase_quotation', 'reject');
  const canConvert = can('purchase_order', 'create');

  const { data: quotation, isLoading } = useQuery({
    queryKey: ['purchase-quotations', id],
    queryFn: () => purchaseQuotationsApi.getById(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchase-quotations'] });
    queryClient.invalidateQueries({ queryKey: ['pending-count'] });
  };

  const awardMutation = useMutation({
    mutationFn: () => purchaseQuotationsApi.award(id),
    onSuccess: () => { invalidate(); toast('Quotation awarded!', 'success'); },
    onError: (err: any) => toast(getApiError(err, 'Failed to award quotation'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => purchaseQuotationsApi.reject(id),
    onSuccess: () => { invalidate(); toast('Quotation rejected', 'info'); },
    onError: (err: any) => toast(getApiError(err, 'Failed to reject quotation'), 'error'),
  });

  if (isLoading) return <DocLoadState type="loading" />;
  if (!quotation)  return <DocLoadState type="not-found" message="Quotation not found." />;

  const status = quotation.status || 'pending';
  const supplierName = resolveSupplierName(quotation.supplier);

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          backHref="/purchase-quotations"
          title={`Quotation: ${quotation.quotation_number}`}
          description="View quotation details and pricing"
          breadcrumbs={[{ label: t('page', 'purchaseQuotations'), href: '/purchase-quotations' }, { label: quotation.quotation_number }]}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge variant={PQ_STATUS[status] ?? 'info'}>{PQ_LABEL[status] || status}</Badge>
            </div>
          }
        />

        <LinkedDocumentsSection
          documents={{
            purchaseRequest: quotation.quotation_request && typeof quotation.quotation_request === 'object' && quotation.quotation_request.purchase_request
              ? (typeof quotation.quotation_request.purchase_request === 'object' ? quotation.quotation_request.purchase_request : { id: quotation.quotation_request.purchase_request })
              : null,
            quotationRequest: quotation.quotation_request && typeof quotation.quotation_request === 'object'
              ? { id: quotation.quotation_request.id }
              : quotation.quotation_request ? { id: quotation.quotation_request } : null,
            purchaseQuotation: { id: quotation.id, quotation_number: quotation.quotation_number },
          }}
        />

        <DetailCard title="Quotation Information">
          {(quotation.project_name || quotation.project_code) && (
            <DetailField
              label="Project"
              value={
                <div>
                  <div style={{ fontWeight: 'var(--weight-semibold)' }}>{quotation.project_name}</div>
                  {quotation.project_code && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{quotation.project_code}</div>}
                </div>
              }
            />
          )}
          <DetailField label={t('col', 'supplier')} value={supplierName} />
          <DetailField label="Quotation Date" value={new Date(quotation.quotation_date).toLocaleDateString('en-US')} />
          <DetailField label="Valid Until" value={quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString('en-US') : 'Not set'} />
          {quotation.awarded_by_name && (
            <DetailField label="Awarded By" value={quotation.awarded_by_name} />
          )}
          {quotation.awarded_at && (
            <DetailField label="Awarded At" value={new Date(quotation.awarded_at).toLocaleDateString('en-US')} />
          )}
          {quotation.payment_terms && (
            <DetailField label="Payment Terms" value={quotation.payment_terms} span={3} />
          )}
          {quotation.delivery_terms && (
            <DetailField label="Delivery Terms" value={quotation.delivery_terms} span={3} />
          )}
          {quotation.notes && (
            <DetailField label={t('col', 'notes')} value={quotation.notes} span={3} />
          )}
        </DetailCard>

        <DetailCard title={t('col', 'product')}>
          <div style={{ gridColumn: '1 / -1' }}>
            <ReadOnlyItemsTable
              items={quotation.items}
              columns={[
                {
                  header: t('col', 'product'),
                  cell: (item) => {
                    const name = typeof item.product === 'object' && item.product ? item.product.name : `Product #${item.product_id}`;
                    const code = typeof item.product === 'object' && item.product ? item.product.code : '';
                    return (
                      <>
                        <div style={{ fontWeight: 'var(--weight-medium)' }}>{name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{code}</div>
                      </>
                    );
                  },
                },
                { header: t('col', 'unit'), cell: (item) => <span style={{ color: 'var(--text-secondary)' }}>{(typeof item.product === 'object' && item.product ? item.product.unit : null)?.toUpperCase() || '—'}</span> },
                { header: t('col', 'quantity'), cell: (item) => item.quantity },
                { header: t('col', 'unitPrice'), cell: (item) => <span style={{ color: 'var(--text-secondary)' }}>{formatPrice(Number(item.unit_price))}</span> },
                { header: 'Disc %', cell: (item) => <span style={{ color: 'var(--text-secondary)' }}>{item.discount || 0}%</span> },
                { header: 'Tax %', cell: (item) => <span style={{ color: 'var(--text-secondary)' }}>{(item as any).tax_rate || (item as any).tax || 0}%</span> },
                { header: t('col', 'total'), cell: (item) => <span style={{ fontWeight: 'var(--weight-semibold)' }}>{formatPrice(Number(item.total))}</span> },
              ]}
            />
          </div>
        </DetailCard>

        <DetailCard title="Financial Summary">
          <div style={{ gridColumn: '1 / -1' }}>
            <FinancialSummary
              rows={[
                { label: 'Subtotal', value: quotation.subtotal },
                { label: 'Discount', value: quotation.discount, variant: 'discount', prefix: '- ', hidden: !Number(quotation.discount) },
                { label: 'Tax', value: quotation.tax_amount, hidden: !Number(quotation.tax_amount) },
              ]}
              total={quotation.total}
            />
          </div>
        </DetailCard>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          {status === 'pending' && (canAward || canReject) && (
            <>
              {canAward && !quotation.has_awarded_quotation && (
                <Button
                  variant="success"
                  isLoading={awardMutation.isPending}
                  onClick={() => {
                    const guard = canAwardQuotation(status, quotation.valid_until ?? undefined, canAward);
                    if (!guard.canProceed) { toast(guard.reason || 'Cannot award', 'error'); return; }
                    awardMutation.mutate();
                  }}
                >
                  {t('btn', 'approve')}
                </Button>
              )}
              {quotation.has_awarded_quotation && (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-warning)', margin: 0 }}>
                  This PR already has an awarded quotation.
                </p>
              )}
              {canReject && (
                <Button variant="destructive" isLoading={rejectMutation.isPending} onClick={() => rejectMutation.mutate()}>
                  {t('btn', 'reject')}
                </Button>
              )}
            </>
          )}
          {status === 'awarded' && canConvert && (
            <Button
              variant="primary"
              onClick={() => {
                const guard = canCreatePurchaseOrder(status);
                if (!guard.canProceed) { toast(guard.reason || 'Cannot create PO', 'error'); return; }
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
