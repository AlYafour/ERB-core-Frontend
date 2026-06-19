'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { quotationRequestsApi } from '@/lib/api/quotation-requests';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import DetailCard, { DetailField } from '@/components/ui/DetailCard';
import { Button, PageHeader, PageShell } from '@/components/ui';
import { ReadOnlyItemsTable } from '@/components/procurement/ReadOnlyItemsTable';
import { DocLoadState } from '@/components/procurement/shared/DocLoadState';

export default function QuotationRequestDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const { data: qr, isLoading } = useQuery({
    queryKey: ['quotation-requests', id],
    queryFn: () => quotationRequestsApi.getById(id),
  });

  if (isLoading) return <DocLoadState type="loading" />;
  if (!qr)       return <DocLoadState type="not-found" message="Quotation Request not found." />;

  const supplier = typeof qr.supplier === 'object' ? qr.supplier : null;
  const pr       = typeof qr.purchase_request === 'object' ? qr.purchase_request : null;
  const prId     = typeof qr.purchase_request === 'number' ? qr.purchase_request : pr?.id;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={`Quotation Request #${qr.id}`}
          description={new Date(qr.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          breadcrumbs={[{ label: 'Quotation Requests', href: '/quotation-requests' }, { label: `#${qr.id}` }]}
          actions={
            <Link href={`/purchase-quotations/new?quotation_request_id=${qr.id}`}>
              <Button variant="primary">Create Quotation</Button>
            </Link>
          }
        />

        <DetailCard title="Quotation Request Information">
          {supplier && <DetailField label="Supplier" value={supplier.business_name || supplier.name} />}
          {prId && (
            <DetailField
              label="Purchase Request"
              value={
                <Link href={`/purchase-requests/${prId}`} style={{ color: 'var(--text-brand)', textDecoration: 'underline' }}>
                  {pr?.code || `PR #${prId}`}
                </Link>
              }
            />
          )}
          <DetailField label="Created By" value={qr.created_by_name} />
          <DetailField label="Created At" value={new Date(qr.created_at).toLocaleDateString('en-US')} />
          {qr.notes && <DetailField label="Notes" value={qr.notes} span={3} />}
        </DetailCard>

        <DetailCard title="Items">
          <div style={{ gridColumn: '1 / -1' }}>
            <ReadOnlyItemsTable
              items={qr.items}
              columns={[
                {
                  header: 'Product',
                  cell: (item: any) => (
                    <>
                      <div style={{ fontWeight: 'var(--weight-medium)' }}>{item.product?.name || `Product #${item.product_id}`}</div>
                      {item.product?.code && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.product.code}</div>}
                    </>
                  ),
                },
                { header: 'Quantity', cell: (item: any) => item.quantity },
                { header: 'Unit',     cell: (item: any) => <span style={{ color: 'var(--text-secondary)' }}>{item.unit || item.product?.unit || '—'}</span> },
                { header: 'Notes',    cell: (item: any) => <span style={{ color: 'var(--text-secondary)' }}>{item.notes || '—'}</span> },
              ]}
            />
          </div>
        </DetailCard>
      </PageShell>
    </MainLayout>
  );
}
