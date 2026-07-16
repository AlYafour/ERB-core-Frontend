'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { suppliersApi } from '@/lib/api/suppliers';
import { purchaseInvoicesApi } from '@/lib/api/purchase-invoices';
import { formatPrice, fmtDate } from '@/lib/utils/format';
import { Badge } from '@/components/ui';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import EntityHeader from '@/components/ui/EntityHeader';
import { PageShell } from '@/components/ui';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { useT } from '@/lib/i18n/useT';

function Field({ label, value, mono, full }: { label: string; value?: string | null; mono?: boolean; full?: boolean }) {
  return (
    <div className={full ? 'info-full' : undefined}>
      <div className="info-label">{label}</div>
      <div className={mono ? 'info-value-mono' : 'info-value'}>{value || '—'}</div>
    </div>
  );
}

export default function SupplierDetailPage() {
  const t = useT();
  const params = useParams();
  const id = Number(params.id);
  const { user } = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;

  const { data: supplier, isLoading } = useQuery({
    queryKey: ['suppliers', id],
    queryFn: () => suppliersApi.getById(id),
  });

  if (isLoading) {
    return (
      <MainLayout>
        <PageShell>
          <div className="card animate-pulse" style={{ height: 120 }} />
          <div className="card animate-pulse" style={{ height: 320 }} />
        </PageShell>
      </MainLayout>
    );
  }

  if (!supplier) {
    return (
      <MainLayout>
        <PageShell>
          <div className="card empty-state">
            <p className="empty-state-title">{t('empty', 'notFound')}</p>
          </div>
        </PageShell>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageShell>
        <EntityHeader
          title={supplier.business_name || supplier.name || 'Unnamed Supplier'}
          subtitle={supplier.supplier_number || undefined}
          image={supplier.image_url || supplier.image}
          imageAlt={supplier.business_name || supplier.name || 'Supplier'}
          entityType="supplier"
          statusBadge={supplier.is_active ? t('status', 'active') : t('status', 'inactive')}
          statusVariant={supplier.is_active ? 'success' : 'error'}
          backHref="/suppliers"
          backLabel={`${t('btn', 'back')} ${t('page', 'suppliers')}`}
          actions={
            isAdmin ? (
              <Link href={`/suppliers/${id}`} className="btn btn-edit">
                {t('btn', 'edit')}
              </Link>
            ) : undefined
          }
        />

        {/* Single consolidated detail card */}
        <div className="card">

          {/* Business & Contact */}
          <div className="info-section-title">Business & Contact</div>
          <div className="info-grid">
            <Field label="Business Name" value={supplier.business_name || supplier.name} />
            <Field label="Supplier Number" value={supplier.supplier_number} mono />
            <Field label="Currency" value={supplier.currency} />
            <Field label="Contact Person" value={supplier.contact_person} />
            <Field label="First Name" value={supplier.first_name} />
            <Field label="Last Name" value={supplier.last_name} />
          </div>

          {/* Contact Details */}
          <div className="info-section">
            <div className="info-section-title">Contact Details</div>
            <div className="info-grid">
              <Field label="Email" value={supplier.email} />
              <Field label="Phone" value={supplier.phone} />
              <Field label="Mobile" value={supplier.mobile} />
              <Field label="Telephone" value={supplier.telephone} />
            </div>
          </div>

          {/* Address */}
          <div className="info-section">
            <div className="info-section-title">Address</div>
            <div className="info-grid">
              {supplier.street_address_1 && <Field label="Street Address" value={supplier.street_address_1} full />}
              {supplier.street_address_2 && <Field label="Street Address 2" value={supplier.street_address_2} full />}
              <Field label="City" value={supplier.city} />
              <Field label="State / Province" value={supplier.state} />
              <Field label="Postal Code" value={supplier.postal_code} />
              <Field label="Country" value={supplier.country} />
            </div>
          </div>

          {/* Tax & Banking */}
          {(supplier.trn || supplier.tax_id || supplier.bank_name || supplier.bank_account) && (
            <div className="info-section">
              <div className="info-section-title">Tax & Banking</div>
              <div className="info-grid">
                {supplier.trn        && <Field label="TRN" value={supplier.trn} mono />}
                {supplier.tax_id     && <Field label="Tax ID" value={supplier.tax_id} mono />}
                {supplier.bank_name  && <Field label="Bank Name" value={supplier.bank_name} />}
                {supplier.bank_account && <Field label="Bank Account" value={supplier.bank_account} mono />}
              </div>
            </div>
          )}

          {/* Notes */}
          {supplier.notes && (
            <div className="info-section">
              <div className="info-section-title">Notes</div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
                {supplier.notes}
              </p>
            </div>
          )}
        </div>

        <SupplierInvoices supplierId={Number(params.id)} />
      </PageShell>
    </MainLayout>
  );
}

const INV_BADGE: Record<string, 'success' | 'info' | 'default' | 'warning' | 'error'> = {
  draft: 'default', pending: 'warning', approved: 'info',
  paid: 'success', rejected: 'error', cancelled: 'error',
};

function SupplierInvoices({ supplierId }: { supplierId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['supplier-invoices', supplierId],
    queryFn: () => purchaseInvoicesApi.getAll({ supplier: supplierId, page_size: 200 } as any),
  });
  const invoices: any[] = (data as any)?.results ?? (Array.isArray(data) ? data : []);
  const total = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
  const paid = invoices.reduce((s, i) => s + Number(i.paid_amount || 0), 0);

  const TD: React.CSSProperties = {
    padding: '7px 10px', fontSize: 'var(--text-sm)',
    borderBottom: '1px solid var(--border-subtle)',
  };
  const TH: React.CSSProperties = {
    ...TD, textAlign: 'left', color: 'var(--text-secondary)',
    fontSize: 'var(--text-xs)', textTransform: 'uppercase',
  };

  return (
    <div className="card" style={{ marginTop: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="info-section-title" style={{ margin: 0 }}>
          Invoices ({invoices.length})
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Total: <b style={{ color: 'var(--text-primary)' }}>{formatPrice(total)}</b>
          <span style={{ marginInlineStart: 14 }}>Paid: <b style={{ color: 'var(--status-success)' }}>{formatPrice(paid)}</b></span>
          <span style={{ marginInlineStart: 14 }}>Outstanding: <b style={{ color: 'var(--status-warning, #b45309)' }}>{formatPrice(total - paid)}</b></span>
        </div>
      </div>
      {isLoading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Loading…</div>
      ) : invoices.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>No invoices for this supplier yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Invoice #', 'LPO', 'Date', 'Total', 'Paid', 'Status', ''].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: any) => (
                <tr key={inv.id}>
                  <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 600 }}>{inv.invoice_number}</td>
                  <td style={{ ...TD, fontFamily: 'monospace' }}>
                    {typeof inv.purchase_order === 'object' ? inv.purchase_order?.order_number : `#${inv.purchase_order_id ?? ''}`}
                  </td>
                  <td style={TD}>{fmtDate(inv.invoice_date)}</td>
                  <td style={{ ...TD, textAlign: 'right', fontFamily: 'monospace' }}>{formatPrice(Number(inv.total || 0))}</td>
                  <td style={{ ...TD, textAlign: 'right', fontFamily: 'monospace' }}>{formatPrice(Number(inv.paid_amount || 0))}</td>
                  <td style={TD}><Badge variant={INV_BADGE[inv.status] ?? 'default'}>{inv.status}</Badge></td>
                  <td style={TD}>
                    <Link href={`/purchase-invoices/${inv.id}`} style={{ color: 'var(--brand)', fontWeight: 600, textDecoration: 'none' }}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

