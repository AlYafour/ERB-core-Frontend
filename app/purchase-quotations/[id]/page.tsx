'use client';

import { type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseQuotationsApi } from '@/lib/api/purchase-quotations';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { Button, PageShell } from '@/components/ui';
import { formatPrice } from '@/lib/utils/format';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { useProcPermissions } from '@/lib/hooks/use-proc-permissions';
import { canAwardQuotation, canCreatePurchaseOrder } from '@/lib/utils/workflow-guards';
import { useT } from '@/lib/i18n/useT';
import { ReadOnlyItemsTable } from '@/components/procurement/ReadOnlyItemsTable';
import { FinancialSummary } from '@/components/procurement/shared/FinancialSummary';
import { DocLoadState } from '@/components/procurement/shared/DocLoadState';
import { StickyDocBar } from '@/components/procurement/shared/StickyDocBar';
import { PQ_STATUS } from '@/lib/utils/status-colors';
import { PQ_LABEL } from '@/lib/constants/status-labels';

function resolveSupplierName(supplier: unknown): string {
  if (!supplier) return 'N/A';
  if (typeof supplier === 'object' && supplier !== null) {
    const s = supplier as { business_name?: string; name?: string; contact_person?: string };
    return s.business_name || s.name || s.contact_person || 'N/A';
  }
  return `Supplier #${supplier}`;
}

export default function PurchaseQuotationDetailPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { can } = useProcPermissions();

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
    onError: (err: unknown) => toast(getApiError(err, 'Failed to award quotation'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => purchaseQuotationsApi.reject(id),
    onSuccess: () => { invalidate(); toast('Quotation rejected', 'info'); },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to reject quotation'), 'error'),
  });

  if (isLoading) return <DocLoadState type="loading" />;
  if (!quotation) return <DocLoadState type="not-found" message="Quotation not found." />;

  const status       = quotation.status || 'pending';
  const supplierName = resolveSupplierName(quotation.supplier);
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const qrRef  = quotation.quotation_request && typeof quotation.quotation_request === 'object' ? quotation.quotation_request : quotation.quotation_request ? { id: quotation.quotation_request } : null;
  const prRef  = qrRef && typeof qrRef === 'object' && (qrRef as { purchase_request?: unknown }).purchase_request
    ? (() => { const pr = (qrRef as { purchase_request: unknown }).purchase_request; return typeof pr === 'object' ? pr as { id: number; code?: string } : { id: pr as number }; })()
    : null;

  const chainNode = (prRef || qrRef) ? (
    <>
      {prRef && (
        <Link href={`/purchase-requests/${(prRef as { id: number }).id}`} className="proc-bar-chain-step">
          {(prRef as { code?: string }).code || `PR-${(prRef as { id: number }).id}`}
        </Link>
      )}
      {prRef && <span className="proc-bar-chain-arrow">→</span>}
      {qrRef && (
        <Link href={`/quotation-requests/${(qrRef as { id: number }).id}`} className="proc-bar-chain-step">
          QR-{(qrRef as { id: number }).id}
        </Link>
      )}
      {qrRef && <span className="proc-bar-chain-arrow">→</span>}
      <span className="proc-bar-chain-current">{quotation.quotation_number}</span>
    </>
  ) : null;

  return (
    <MainLayout>
      <PageShell compact>

        {/* ── Sticky action bar with inline chain ── */}
        <StickyDocBar
          docTypeLabel="Purchase Quotation"
          docNumber={quotation.quotation_number}
          statusVariant={PQ_STATUS[status] ?? 'info'}
          statusLabel={PQ_LABEL[status] || status}
          chain={chainNode}
        >
          <Button variant="secondary" size="sm" onClick={() => window.open(`/print/pq/${id}`, '_blank')}>Print</Button>

          {status === 'pending' && (canAward || canReject) && (
            <>
              {quotation.has_awarded_quotation && (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--status-warning)', background: 'var(--status-warning-bg)', border: '1px solid var(--status-warning-border)', borderRadius: 6, padding: '3px 8px' }}>
                  PR already awarded
                </span>
              )}
              {canReject && (
                <Button variant="destructive" size="sm" isLoading={rejectMutation.isPending} onClick={() => rejectMutation.mutate()}>
                  {t('btn', 'reject')}
                </Button>
              )}
              {canAward && !quotation.has_awarded_quotation && (
                <Button variant="success" size="sm" isLoading={awardMutation.isPending}
                  onClick={() => {
                    const guard = canAwardQuotation(status, quotation.valid_until ?? undefined, canAward);
                    if (!guard.canProceed) { toast(guard.reason || 'Cannot award', 'error'); return; }
                    awardMutation.mutate();
                  }}
                >
                  Award Supplier
                </Button>
              )}
            </>
          )}

          {status === 'awarded' && canConvert && (
            <Button variant="primary" size="sm"
              onClick={() => {
                const guard = canCreatePurchaseOrder(status);
                if (!guard.canProceed) { toast(guard.reason || 'Cannot create PO', 'error'); return; }
                router.push(`/purchase-orders/new?purchase_quotation_id=${id}`);
              }}
            >
              Convert → LPO
            </Button>
          )}
        </StickyDocBar>

        {/* ── Two-column: info left / products right ── */}
        <div className="proc-detail-split">

          {/* ── LEFT: Quotation Information ── */}
          <div className="proc-detail-info">
            <div className="card" style={{ height: '100%' }}>
              <div className="proc-section-head">
                <h3 className="proc-section-title">Quotation Information</h3>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{fmt(quotation.quotation_date)}</span>
              </div>
              <div className="proc-info-grid">
                <ProcField label={t('col', 'supplier')} value={supplierName} />
                <ProcField label="Quotation Date" value={fmt(quotation.quotation_date)} />
                <ProcField label="Valid Until" value={quotation.valid_until ? fmt(quotation.valid_until) : <span className="proc-info-value--empty">Not set</span>} />
                {quotation.awarded_by_name && <ProcField label="Awarded By" value={quotation.awarded_by_name} />}
                {quotation.awarded_at && <ProcField label="Awarded At" value={fmt(quotation.awarded_at)} />}
                {(quotation.project_name || quotation.project_code) && (
                  <ProcField label="Project" value={
                    <div>
                      <div style={{ fontWeight: 'var(--weight-medium)' }}>{quotation.project_name}</div>
                      {quotation.project_code && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{quotation.project_code}</div>}
                    </div>
                  } />
                )}
              </div>
              {(quotation.payment_terms || quotation.delivery_terms || quotation.notes) && (
                <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {quotation.payment_terms && <ProcField label="Payment Terms" value={quotation.payment_terms} />}
                  {quotation.delivery_terms && <ProcField label="Delivery Terms" value={quotation.delivery_terms} />}
                  {quotation.notes && <ProcField label={t('col', 'notes')} value={quotation.notes} />}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Products + Totals ── */}
          <div className="proc-detail-products">
            <div className="card">
              <div className="proc-section-head">
                <h3 className="proc-section-title">
                  Products
                  <span className="proc-section-count">{quotation.items.length}</span>
                </h3>
              </div>
              <ReadOnlyItemsTable
                items={quotation.items}
                columns={[
                  {
                    header: t('col', 'product'),
                    cell: (item) => (
                      <div>
                        <div className="cell-product-name">{item.product?.name ?? `Product #${item.product_id}`}</div>
                        {item.product?.code && <div className="cell-product-code">{item.product.code}</div>}
                      </div>
                    ),
                  },
                  { header: t('col', 'unit'),      align: 'center', cell: (item) => <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>{item.product?.unit?.toUpperCase() || '—'}</span> },
                  { header: t('col', 'quantity'),  align: 'center', cell: (item) => <span style={{ fontWeight: 'var(--weight-semibold)' }}>{item.quantity}</span> },
                  { header: t('col', 'unitPrice'), align: 'right',  cell: (item) => <span style={{ fontFamily: 'monospace' }}>{formatPrice(Number(item.unit_price))}</span> },
                  { header: 'Disc %',              align: 'center', cell: (item) => item.discount ? <span style={{ color: 'var(--status-error)', fontWeight: 600 }}>{item.discount}%</span> : <span style={{ color: 'var(--text-tertiary)' }}>—</span> },
                  { header: 'Tax %',               align: 'center', cell: (item) => (item.tax_rate || item.tax) ? <span style={{ color: 'var(--text-secondary)' }}>{item.tax_rate || item.tax}%</span> : <span style={{ color: 'var(--text-tertiary)' }}>—</span> },
                  { header: t('col', 'total'),     align: 'right',  cell: (item) => <span className="col-total">{formatPrice(Number(item.total))}</span> },
                ]}
              />
              <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
                <FinancialSummary
                  rows={[
                    { label: 'Subtotal', value: quotation.subtotal },
                    { label: `Discount (${quotation.discount}%)`, value: quotation.discount, variant: 'discount', prefix: '– ', hidden: !Number(quotation.discount) },
                    { label: 'Tax',      value: quotation.tax_amount, hidden: !Number(quotation.tax_amount) },
                  ]}
                  total={quotation.total}
                />
              </div>
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
