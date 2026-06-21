'use client';

import { ProcField } from '@/components/procurement/shared/ProcField';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotationRequestsApi } from '@/lib/api/quotation-requests';
import { purchaseQuotationsApi } from '@/lib/api/purchase-quotations';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { Button, Badge, PageShell } from '@/components/ui';
import { ReadOnlyItemsTable } from '@/components/procurement/ReadOnlyItemsTable';
import { DocLoadState } from '@/components/procurement/shared/DocLoadState';
import { StickyDocBar } from '@/components/procurement/shared/StickyDocBar';
import { fmtDate, formatPrice } from '@/lib/utils/format';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { PQ_STATUS } from '@/lib/utils/status-colors';

export default function QuotationRequestDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const canAward = isTenantAdmin || isPlatformAdmin;

  const { data: qr, isLoading } = useQuery({
    queryKey: ['quotation-requests', id],
    queryFn: () => quotationRequestsApi.getById(id),
  });

  const { data: pqsData } = useQuery({
    queryKey: ['purchase-quotations', { quotation_request: id }],
    queryFn: () => purchaseQuotationsApi.getAll({ page: 1, page_size: 50, quotation_request: id }),
    enabled: !!id,
    staleTime: 30_000,
  });
  const pqs = pqsData?.results ?? [];

  const awardMutation = useMutation({
    mutationFn: (pqId: number) => purchaseQuotationsApi.award(pqId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-quotations'] });
      toast('Quotation awarded.', 'success');
    },
    onError: (err: any) => toast(err?.response?.data?.error || 'Award failed.', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (pqId: number) => purchaseQuotationsApi.reject(pqId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-quotations'] });
      toast('Quotation rejected.', 'info');
    },
    onError: (err: any) => toast(err?.response?.data?.error || 'Reject failed.', 'error'),
  });

  const handleAward = async (pqId: number, supplierName: string) => {
    const ok = await confirm(`Award quotation from "${supplierName}"? This will lock the supplier selection.`);
    if (ok) awardMutation.mutate(pqId);
  };

  const handleReject = async (pqId: number) => {
    const ok = await confirm('Reject this quotation?');
    if (ok) rejectMutation.mutate(pqId);
  };

  if (isLoading) return <DocLoadState type="loading" />;
  if (!qr)       return <DocLoadState type="not-found" message="Quotation Request not found." />;

  const supplier = typeof qr.supplier === 'object' && qr.supplier ? qr.supplier as { business_name?: string; name?: string } : null;
  const pr       = typeof qr.purchase_request === 'object' && qr.purchase_request ? qr.purchase_request as { id: number; code?: string } : null;
  const prId     = typeof qr.purchase_request === 'number' ? qr.purchase_request : pr?.id;



  const chainNode = prId ? (
    <>
      <Link href={`/purchase-requests/${prId}`} className="proc-bar-chain-step">
        {pr?.code || `PR-${prId}`}
      </Link>
      <span className="proc-bar-chain-arrow">→</span>
      <span className="proc-bar-chain-current">QR-{qr.id}</span>
    </>
  ) : null;

  return (
    <MainLayout>
      <PageShell compact>

        {/* ── Sticky action bar with inline chain ── */}
        <StickyDocBar
          backHref="/quotation-requests"
          docTypeLabel="Quotation Request"
          docNumber={`QR-${qr.id}`}
          statusVariant="info"
          statusLabel="Open"
          chain={chainNode}
        >
          <Link href={`/purchase-quotations/new?quotation_request_id=${qr.id}`}>
            <Button variant="primary" size="sm">+ Quotation</Button>
          </Link>
        </StickyDocBar>

        {/* ── Two-column: QR info left / items right ── */}
        <div className="proc-detail-split">

          {/* LEFT: QR information */}
          <div className="proc-detail-info">
            <div className="card">
              <div className="proc-section-head">
                <h3 className="proc-section-title">QR Information</h3>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{fmtDate(qr.created_at)}</span>
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
                <ProcField label="Created At" value={fmtDate(qr.created_at)} />
                {qr.notes && <ProcField label="Notes" value={qr.notes} />}
              </div>
            </div>
          </div>

          {/* RIGHT: Requested items */}
          <div className="proc-detail-products">
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
          </div>

        </div>

        {/* ── Submitted Purchase Quotations ── */}
        <div className="card" style={{ marginTop: 'var(--space-4)' }}>
          <div className="proc-section-head">
            <h3 className="proc-section-title">
              Submitted Quotations
              {pqs.length > 0 && <span className="proc-section-count">{pqs.length}</span>}
            </h3>
          </div>
          {pqs.length === 0 ? (
            <p style={{ margin: 'var(--space-3) 0 0', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>No quotations submitted for this RFQ yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['#', 'Supplier', 'Quotation #', 'Date', 'Valid Until', 'Total', 'Status', ''].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-secondary)', fontWeight: 'var(--weight-medium)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pqs.map((pq: any, idx: number) => {
                    const supplierName = typeof pq.supplier === 'object' ? (pq.supplier?.business_name || pq.supplier?.name || '—') : '—';
                    return (
                      <tr key={pq.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--text-tertiary)' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 'var(--weight-medium)' }}>{supplierName}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <Link href={`/purchase-quotations/${pq.id}`} style={{ color: 'var(--brand)' }}>
                            {pq.quotation_number || `PQ-${pq.id}`}
                          </Link>
                        </td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{fmtDate(pq.quotation_date)}</td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{fmtDate(pq.valid_until)}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 'var(--weight-semibold)' }}>{formatPrice(pq.total)}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <Badge variant={PQ_STATUS[pq.status] ?? 'default'} size="sm">
                            {pq.status?.charAt(0).toUpperCase() + pq.status?.slice(1)}
                          </Badge>
                        </td>
                        <td style={{ padding: '8px 10px', display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                          {canAward && pq.status === 'pending' && (
                            <>
                              <Button variant="primary" size="sm"
                                isLoading={awardMutation.isPending}
                                disabled={awardMutation.isPending || rejectMutation.isPending}
                                onClick={() => handleAward(pq.id, supplierName)}>
                                Award
                              </Button>
                              <Button variant="secondary" size="sm"
                                isLoading={rejectMutation.isPending}
                                disabled={awardMutation.isPending || rejectMutation.isPending}
                                onClick={() => handleReject(pq.id)}>
                                Reject
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </PageShell>
    </MainLayout>
  );
}

