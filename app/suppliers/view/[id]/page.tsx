'use client';

/**
 * Supplier detail — standard shell (PageHeader + card sections + ProcField),
 * tabbed: Overview | Invoices | Purchase Orders | Statement.
 * Statement reads the accounting AP subledger for the supplier.
 */

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { suppliersApi } from '@/lib/api/suppliers';
import { purchaseInvoicesApi } from '@/lib/api/purchase-invoices';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { accountingApi } from '@/lib/api/accounting';
import { formatPrice, fmtDate } from '@/lib/utils/format';
import { Badge, Button, PageHeader } from '@/components/ui';
import { ProcField } from '@/components/procurement/shared/ProcField';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell } from '@/components/ui';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { INVOICE_STATUS } from '@/lib/utils/status-colors';

type Tab = 'overview' | 'invoices' | 'orders' | 'statement';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',  label: 'Overview' },
  { key: 'invoices',  label: 'Invoices' },
  { key: 'orders',    label: 'Purchase Orders' },
  { key: 'statement', label: 'Statement' },
];

const TH: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: 'var(--text-xs)',
  color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = {
  padding: '8px 10px', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--border-subtle)',
};
const TDR: React.CSSProperties = { ...TD, textAlign: 'right', fontFamily: 'monospace' };

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [tab, setTab] = useState<Tab>('overview');
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;

  const { data: supplier, isLoading } = useQuery({
    queryKey: ['suppliers', id],
    queryFn: () => suppliersApi.getById(id),
  });

  if (isLoading) {
    return (
      <MainLayout><PageShell>
        <div className="animate-pulse" style={{ height: 40, width: 320, background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 12 }} />
        <div className="animate-pulse" style={{ height: 300, background: 'var(--bg-secondary)', borderRadius: 8 }} />
      </PageShell></MainLayout>
    );
  }
  if (!supplier) {
    return (
      <MainLayout><PageShell>
        <PageHeader title="Supplier not found" breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Suppliers', href: '/suppliers' }, { label: 'Not found' }]} backHref="/suppliers" />
      </PageShell></MainLayout>
    );
  }

  const name = supplier.business_name || supplier.name || 'Unnamed Supplier';

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={name}
          description={supplier.supplier_number ? `Supplier ${supplier.supplier_number}` : 'Supplier'}
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Suppliers', href: '/suppliers' }, { label: name }]}
          backHref="/suppliers"
          actions={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Badge variant={supplier.is_active ? 'success' : 'error'}>
                {supplier.is_active ? 'Active' : 'Inactive'}
              </Badge>
              {isAdmin && <Link href={`/suppliers/${id}`}><Button variant="edit" size="sm">Edit</Button></Link>}
            </div>
          }
        />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 'var(--text-sm)', fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? 'var(--brand)' : 'var(--text-secondary)',
              borderBottom: `2px solid ${tab === t.key ? 'var(--brand)' : 'transparent'}`,
              marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>

        {tab === 'overview'  && <OverviewTab supplier={supplier} />}
        {tab === 'invoices'  && <InvoicesTab supplierId={id} onOpen={i => router.push(`/purchase-invoices/${i}`)} />}
        {tab === 'orders'    && <OrdersTab supplierId={id} onOpen={i => router.push(`/purchase-orders/${i}`)} />}
        {tab === 'statement' && <StatementTab supplierId={id} />}
      </PageShell>
    </MainLayout>
  );
}

function OverviewTab({ supplier }: { supplier: any }) {
  return (
    <>
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="proc-section-head"><h3 className="proc-section-title">Business &amp; Contact</h3></div>
        <div className="proc-info-grid">
          <ProcField label="Business Name" value={supplier.business_name || supplier.name} />
          <ProcField label="Supplier Number" value={<span style={{ fontFamily: 'monospace' }}>{supplier.supplier_number || '—'}</span>} />
          <ProcField label="Currency" value={supplier.currency || 'AED'} />
          <ProcField label="Contact Person" value={supplier.contact_person} />
          <ProcField label="Email" value={supplier.email} />
          <ProcField label="Phone" value={supplier.phone} />
          <ProcField label="Mobile" value={supplier.mobile} />
          <ProcField label="Telephone" value={supplier.telephone} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="proc-section-head"><h3 className="proc-section-title">Address</h3></div>
        <div className="proc-info-grid">
          <ProcField label="Street Address" value={supplier.street_address_1} />
          <ProcField label="Street Address 2" value={supplier.street_address_2} />
          <ProcField label="City" value={supplier.city} />
          <ProcField label="State / Province" value={supplier.state} />
          <ProcField label="Postal Code" value={supplier.postal_code} />
          <ProcField label="Country" value={supplier.country} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="proc-section-head"><h3 className="proc-section-title">Tax &amp; Banking</h3></div>
        <div className="proc-info-grid">
          <ProcField label="TRN" value={
            supplier.trn
              ? <span style={{ fontFamily: 'monospace' }}>{supplier.trn}</span>
              : <span style={{ color: 'var(--status-warning)', fontWeight: 600 }}>Missing — required for VAT</span>
          } />
          <ProcField label="Tax ID" value={supplier.tax_id ? <span style={{ fontFamily: 'monospace' }}>{supplier.tax_id}</span> : undefined} />
          <ProcField label="Bank Name" value={supplier.bank_name} />
          <ProcField label="Bank Account" value={supplier.bank_account ? <span style={{ fontFamily: 'monospace' }}>{supplier.bank_account}</span> : undefined} />
        </div>
      </div>

      {supplier.notes && (
        <div className="card">
          <div className="proc-section-head"><h3 className="proc-section-title">Notes</h3></div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{supplier.notes}</p>
        </div>
      )}
    </>
  );
}

function SummaryBar({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
      {items.map(([label, value]) => (
        <span key={label} style={{ color: 'var(--text-secondary)' }}>
          {label}: <b style={{ color: 'var(--text-primary)' }}>{value}</b>
        </span>
      ))}
    </div>
  );
}

function InvoicesTab({ supplierId, onOpen }: { supplierId: number; onOpen: (id: number) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['supplier-invoices', supplierId],
    queryFn: () => purchaseInvoicesApi.getAll({ supplier: supplierId, page_size: 200 } as any),
  });
  const rows: any[] = (data as any)?.results ?? [];
  const total = rows.reduce((s, i) => s + Number(i.total || 0), 0);
  const paid = rows.reduce((s, i) => s + Number(i.paid_amount || 0), 0);

  return (
    <div className="card">
      <div className="proc-section-head"><h3 className="proc-section-title">Invoices ({rows.length})</h3></div>
      <SummaryBar items={[['Total', formatPrice(total)], ['Paid', formatPrice(paid)], ['Outstanding', formatPrice(total - paid)]]} />
      {isLoading ? <div style={{ color: 'var(--text-secondary)' }}>Loading…</div> : rows.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>No invoices for this supplier yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Invoice #', 'LPO', 'Date', 'Total', 'Paid', 'Status', ''].map((h, i) =>
              <th key={h || i} style={{ ...TH, textAlign: ['Total', 'Paid'].includes(h) ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(inv => (
                <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(inv.id)}>
                  <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 600 }}>{inv.invoice_number}</td>
                  <td style={{ ...TD, fontFamily: 'monospace' }}>{typeof inv.purchase_order === 'object' ? inv.purchase_order?.order_number : '—'}</td>
                  <td style={TD}>{fmtDate(inv.invoice_date)}</td>
                  <td style={TDR}>{formatPrice(Number(inv.total || 0))}</td>
                  <td style={TDR}>{formatPrice(Number(inv.paid_amount || 0))}</td>
                  <td style={TD}><Badge variant={INVOICE_STATUS[inv.status] ?? 'default'}>{inv.status}</Badge></td>
                  <td style={{ ...TD, color: 'var(--brand)', fontWeight: 600 }}>Open ↗</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrdersTab({ supplierId, onOpen }: { supplierId: number; onOpen: (id: number) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['supplier-orders', supplierId],
    queryFn: () => purchaseOrdersApi.getAll({ supplier: supplierId, page_size: 200 }),
  });
  const rows: any[] = (data as any)?.results ?? [];
  const total = rows.reduce((s, o) => s + Number(o.total || 0), 0);

  return (
    <div className="card">
      <div className="proc-section-head"><h3 className="proc-section-title">Purchase Orders ({rows.length})</h3></div>
      <SummaryBar items={[['Total Value', formatPrice(total)]]} />
      {isLoading ? <div style={{ color: 'var(--text-secondary)' }}>Loading…</div> : rows.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>No purchase orders for this supplier yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['LPO #', 'Date', 'Cost Code', 'Total', 'Status', ''].map((h, i) =>
              <th key={h || i} style={{ ...TH, textAlign: h === 'Total' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(o => (
                <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(o.id)}>
                  <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 600 }}>{o.order_number}</td>
                  <td style={TD}>{fmtDate(o.order_date)}</td>
                  <td style={{ ...TD, fontFamily: 'monospace' }}>{typeof o.cost_code === 'object' ? o.cost_code?.excel_code : '—'}</td>
                  <td style={TDR}>{formatPrice(Number(o.total || 0))}</td>
                  <td style={TD}><Badge variant="info">{o.status}</Badge></td>
                  <td style={{ ...TD, color: 'var(--brand)', fontWeight: 600 }}>Open ↗</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatementTab({ supplierId }: { supplierId: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['supplier-statement', supplierId],
    queryFn: () => accountingApi.supplierStatement(String(supplierId)),
    retry: false,
  });
  const stmt: any = data;
  const rows: any[] = stmt?.rows ?? [];

  return (
    <div className="card">
      <div className="proc-section-head"><h3 className="proc-section-title">Account Statement (AP subledger)</h3></div>
      {isLoading ? <div style={{ color: 'var(--text-secondary)' }}>Loading…</div>
        : error ? <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            No accounting statement available (accounting may be inactive or no posted entries yet).
          </div>
        : (
        <>
          <SummaryBar items={[
            ['Opening', formatPrice(Number(stmt?.opening_balance || 0))],
            ['Closing (we owe)', formatPrice(Number(stmt?.closing_balance || 0))],
          ]} />
          {rows.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
              No posted movements. Entries appear here once the supplier's journal entries are posted to the ledger.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Date', 'Journal', 'Description', 'Debit', 'Credit', 'Balance'].map(h =>
                  <th key={h} style={{ ...TH, textAlign: ['Debit', 'Credit', 'Balance'].includes(h) ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td style={TD}>{r.date}</td>
                      <td style={{ ...TD, fontFamily: 'monospace' }}>{r.journal_number || '—'}</td>
                      <td style={TD}>{r.description || r.event_code || '—'}</td>
                      <td style={TDR}>{Number(r.debit) ? formatPrice(Number(r.debit)) : '—'}</td>
                      <td style={TDR}>{Number(r.credit) ? formatPrice(Number(r.credit)) : '—'}</td>
                      <td style={{ ...TDR, fontWeight: 700 }}>{formatPrice(Number(r.balance || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
