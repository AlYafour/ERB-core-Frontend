'use client';

import { type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { quotationRequestsApi } from '@/lib/api/quotation-requests';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { Button, PageShell } from '@/components/ui';
import { ReadOnlyItemsTable } from '@/components/procurement/ReadOnlyItemsTable';
import { DocLoadState } from '@/components/procurement/shared/DocLoadState';
import { StickyDocBar } from '@/components/procurement/shared/StickyDocBar';

export default function QuotationRequestDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const { data: qr, isLoading } = useQuery({
    queryKey: ['quotation-requests', id],
    queryFn: () => quotationRequestsApi.getById(id),
  });

  if (isLoading) return <DocLoadState type="loading" />;
  if (!qr)       return <DocLoadState type="not-found" message="Quotation Request not found." />;

  const supplier = typeof qr.supplier === 'object' && qr.supplier ? qr.supplier as { business_name?: string; name?: string } : null;
  const pr       = typeof qr.purchase_request === 'object' && qr.purchase_request ? qr.purchase_request as { id: number; code?: string } : null;
  const prId     = typeof qr.purchase_request === 'number' ? qr.purchase_request : pr?.id;

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <MainLayout>
      <PageShell>

        {/* ── Sticky action bar ── */}
        <StickyDocBar
          docTypeLabel="Quotation Request"
          docNumber={`QR-${qr.id}`}
          statusVariant="info"
          statusLabel="Open"
        >
          <Link href={`/purchase-quotations/new?quotation_request_id=${qr.id}`}>
            <Button variant="primary" size="sm">+ Quotation</Button>
          </Link>
        </StickyDocBar>

        {/* ── Document chain ── */}
        {prId && (
          <div className="proc-chain">
            <Link href={`/purchase-requests/${prId}`} className="proc-chain-pill">
              <span className="proc-chain-pill-type">Purchase Request</span>
              <span className="proc-chain-pill-num">{pr?.code || `PR-${prId}`}</span>
            </Link>
            <span className="proc-chain-arrow">→</span>
            <div className="proc-chain-pill" style={{ borderColor: 'var(--brand)', background: 'var(--brand-subtle)' }}>
              <span className="proc-chain-pill-type" style={{ color: 'var(--brand)' }}>Quotation Request</span>
              <span className="proc-chain-pill-num" style={{ color: 'var(--brand)' }}>QR-{qr.id}</span>
            </div>
          </div>
        )}

        {/* ── QR info ── */}
        <div className="card">
          <div className="proc-section-head">
            <h3 className="proc-section-title">Quotation Request Information</h3>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{fmt(qr.created_at)}</span>
          </div>
          <div className="proc-info-grid">
            {supplier && <ProcField label="Supplier" value={supplier.business_name || supplier.name || '—'} />}
            {prId && (
              <ProcField label="Purchase Request" value={
                <Link href={`/purchase-requests/${prId}`} style={{ color: 'var(--brand)', fontWeight: 'var(--weight-semibold)', textDecoration: 'none' }}>
                  {pr?.code || `PR-${prId}`} ↗
                </Link>
              } />
            )}
            <ProcField label="Created By" value={qr.created_by_name || '—'} />
            <ProcField label="Created At" value={fmt(qr.created_at)} />
          </div>
          {qr.notes && (
            <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
              <ProcField label="Notes" value={qr.notes} />
            </div>
          )}
        </div>

        {/* ── Items ── */}
        <div className="card">
          <div className="proc-section-head">
            <h3 className="proc-section-title">
              Requested Items
              <span className="proc-section-count">{(qr.items ?? []).length}</span>
            </h3>
          </div>
          <ReadOnlyItemsTable
            items={qr.items ?? []}
            columns={[
              {
                header: 'Product',
                cell: (item: { product?: { name?: string; code?: string }; product_id?: number }) => (
                  <div>
                    <div className="cell-product-name">{item.product?.name || `Product #${item.product_id}`}</div>
                    {item.product?.code && <div className="cell-product-code">{item.product.code}</div>}
                  </div>
                ),
              },
              {
                header: 'Qty',
                align: 'center' as const,
                cell: (item: { quantity?: number }) => <span style={{ fontWeight: 'var(--weight-semibold)' }}>{item.quantity}</span>,
              },
              {
                header: 'Unit',
                align: 'center' as const,
                cell: (item: { unit?: string; product?: { unit?: string } }) => (
                  <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                    {(item.unit || item.product?.unit || '—').toUpperCase()}
                  </span>
                ),
              },
              {
                header: 'Notes',
                cell: (item: { notes?: string }) => <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.notes || '—'}</span>,
              },
            ]}
          />
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
