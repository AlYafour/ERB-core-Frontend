'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { quotationRequestsApi } from '@/lib/api/quotation-requests';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import DetailCard, { DetailField } from '@/components/ui/DetailCard';
import { Button, PageHeader, PageShell } from '@/components/ui';
import { useAuth } from '@/lib/hooks/use-auth';

export default function QuotationRequestDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { user } = useAuth();

  const { data: qr, isLoading } = useQuery({
    queryKey: ['quotation-requests', id],
    queryFn: () => quotationRequestsApi.getById(id),
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Loading...</p>
        </div>
      </MainLayout>
    );
  }

  if (!qr) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Quotation Request not found</p>
        </div>
      </MainLayout>
    );
  }

  const supplier = typeof qr.supplier === 'object' ? qr.supplier : null;
  const pr = typeof qr.purchase_request === 'object' ? qr.purchase_request : null;
  const prId = typeof qr.purchase_request === 'number' ? qr.purchase_request : pr?.id;

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
          {supplier && (
            <DetailField label="Supplier" value={supplier.business_name || supplier.name} />
          )}
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
          {qr.notes && (
            <DetailField label="Notes" value={qr.notes} span={3} />
          )}
        </DetailCard>

        <DetailCard title="Items">
          <div style={{ gridColumn: '1 / -1', overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {qr.items.map((item, idx) => {
                  type QRItem = { id?: number; product?: { name?: string }; product_id?: number; quantity?: number; unit?: string; notes?: string };
                  const row = item as QRItem;
                  return (
                    <tr key={row.id ?? idx}>
                      <td>{row.product?.name || `Product #${row.product_id}`}</td>
                      <td>{row.quantity}</td>
                      <td>{row.unit || '—'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{row.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DetailCard>
      </PageShell>
    </MainLayout>
  );
}
