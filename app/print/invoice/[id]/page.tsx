'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { purchaseInvoicesApi } from '@/lib/api/purchase-invoices';
import { PurchaseInvoice, PurchaseInvoiceItem, PurchaseOrder, Supplier } from '@/types';
import PrintTemplate, {
  SectionTitle, InfoGrid, SignatureRow, NotesBox, StatusBadge,
  fmt, fmtDate,
} from '@/components/print/PrintTemplate';

const NAVY   = '#1a1a2e';
const ORANGE = '#f97316';
const GREY   = '#64748b';
const LIGHT  = '#f8fafc';
const BORDER = '#e2e8f0';

function toWords(n: number): string {
  if (!n || isNaN(n)) return 'Zero Dirhams Only';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function h(x: number): string {
    if (x < 20) return ones[x];
    if (x < 100) return tens[Math.floor(x/10)] + (x%10 ? ' '+ones[x%10] : '');
    return ones[Math.floor(x/100)]+' Hundred'+(x%100 ? ' and '+h(x%100) : '');
  }
  const d = Math.floor(n);
  const f = Math.round((n - d) * 100);
  let r = '';
  if (d >= 1000000) r += h(Math.floor(d/1000000))+' Million ';
  if (d >= 1000)    r += h(Math.floor((d%1000000)/1000))+' Thousand ';
  r += h(d % 1000);
  r = r.trim() + ' Dirhams';
  if (f > 0) r += ` and ${h(f)} Fils`;
  return r + ' Only';
}

export default function PrintInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => { setHasToken(!!localStorage.getItem('access_token')); }, []);

  const { data: invoice, isLoading, isError } = useQuery<PurchaseInvoice>({
    queryKey: ['purchase-invoice', id],
    queryFn: () => purchaseInvoicesApi.getById(Number(id)),
    enabled: hasToken,
    retry: 1,
  });

  if (!hasToken || isLoading) return <PrintLoader />;
  if (isError || !invoice) return <PrintError msg="Purchase invoice not found. Please make sure you are logged in." />;

  const po       = typeof invoice.purchase_order === 'object' && invoice.purchase_order ? invoice.purchase_order as PurchaseOrder : null;
  const supplier = po && typeof po.supplier === 'object' && po.supplier ? po.supplier as Supplier : null;

  const subtotal   = Number(invoice.subtotal   ?? 0);
  const discount   = Number(invoice.discount   ?? 0);
  const taxAmount  = Number(invoice.tax_amount ?? 0);
  const total      = Number(invoice.total      ?? 0);
  const paidAmount = Number(invoice.paid_amount ?? 0);
  const remaining  = Number(invoice.remaining_amount ?? (total - paidAmount));

  return (
    <div className="print-page-bg" style={{ minHeight: '100vh', background: '#e8ecf0', fontFamily: "'Inter','Cairo','Segoe UI',sans-serif", fontSize: '12px' }}>

      <style>{`
        @media print {
          .print-page-bg { background: white !important; }
          .print-controls-bar { display: none !important; }
          .print-doc {
            margin: 0 !important;
            width: 100% !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            height: 100vh !important;
            min-height: 100vh !important;
          }
        }
      `}</style>

      {/* ── Controls ── */}
      <div className="print-controls-bar" style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 32px',
        background: '#fff', borderBottom: `1px solid ${BORDER}`,
        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: NAVY }}>Invoice — {invoice.invoice_number}</span>
          <StatusBadge status={invoice.status} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.print()} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 16px', borderRadius: 6, border: `1px solid ${BORDER}`,
            background: LIGHT, color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>🖨 Print / Save PDF</button>
          <button onClick={() => window.close()} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb',
            background: 'transparent', color: '#9ca3af', fontSize: 12, cursor: 'pointer',
          }}>✕ Close</button>
        </div>
      </div>

      {/* ── A4 Sheet ── */}
      <div className="print-doc" style={{
        width: '210mm', minHeight: '297mm',
        margin: '12px auto', background: '#fff',
        borderRadius: 4, boxShadow: '0 4px 32px rgba(0,0,0,.15)',
        display: 'flex', flexDirection: 'column',
      }}>
        <PrintTemplate
          docType="PURCHASE INVOICE"
          docNumber={invoice.invoice_number}
          date={invoice.invoice_date}
          status={invoice.status}
        >
          {/* ── Supplier + Invoice info ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <SectionTitle>Supplier</SectionTitle>
              {supplier ? (
                <div style={{ fontSize: '9.5pt', lineHeight: 1.7 }}>
                  <div style={{ fontWeight: 700, fontSize: '11pt', color: NAVY }}>{supplier.business_name || supplier.name}</div>
                  {supplier.contact_person && <div style={{ color: GREY }}>{supplier.contact_person}</div>}
                  {supplier.phone && <div style={{ color: GREY }}>Tel: {supplier.phone}</div>}
                  {supplier.email && <div style={{ color: GREY }}>{supplier.email}</div>}
                  {(supplier.city || supplier.country) && <div style={{ color: GREY }}>{[supplier.city, supplier.country].filter(Boolean).join(', ')}</div>}
                  {supplier.trn && <div style={{ marginTop: 2, color: '#94a3b8', fontSize: '8.5pt' }}>TRN: {supplier.trn}</div>}
                </div>
              ) : <div style={{ color: '#94a3b8' }}>—</div>}
            </div>
            <div>
              <SectionTitle>Invoice Information</SectionTitle>
              <InfoGrid rows={[
                ['Invoice No.',    invoice.invoice_number],
                ['Invoice Date',   fmtDate(invoice.invoice_date)],
                ['Due Date',       fmtDate(invoice.due_date)],
                ['LPO Reference',  po?.order_number ?? '—'],
                ['Payment Method', invoice.payment_method || '—'],
                ['Approved By',    invoice.approved_by_name || '—'],
                ['Prepared By',    invoice.created_by_name  || '—'],
                ['Status',         <StatusBadge key="s" status={invoice.status} />],
              ]} />
            </div>
          </div>

          {/* ── Items ── */}
          <SectionTitle>Invoice Items</SectionTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: 4 }}>
            <thead>
              <tr style={{ background: NAVY, color: '#fff' }}>
                {[
                  { label: '#',          align: 'center', width: 28  },
                  { label: 'Description'                              },
                  { label: 'Unit',       align: 'center', width: 45  },
                  { label: 'Qty',        align: 'right',  width: 55  },
                  { label: 'Unit Price', align: 'right',  width: 75  },
                  ...(discount > 0 ? [{ label: 'Disc%', align: 'right', width: 55 }] : []),
                  { label: 'Amount',     align: 'right',  width: 80  },
                ].map((h, i) => (
                  <th key={i} style={{ padding: '8px 10px', textAlign: (h.align as any) ?? 'left', fontSize: '7.5pt', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', width: h.width }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item: PurchaseInvoiceItem, idx: number) => (
                <tr key={item.id ?? idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '7px 10px', textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <div style={{ fontWeight: 600, color: NAVY, lineHeight: 1.3 }}>{item.product?.name ?? `Item #${item.product_id}`}</div>
                    {item.product?.code && <div style={{ fontSize: '7.5pt', color: '#94a3b8', marginTop: 1 }}>{item.product.code}</div>}
                    {item.notes && <div style={{ fontSize: '8pt', color: '#777', marginTop: 1 }}>{item.notes}</div>}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>{item.product?.unit || '—'}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{fmt(item.quantity, 2)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>AED {fmt(item.unit_price)}</td>
                  {discount > 0 && <td style={{ padding: '7px 10px', textAlign: 'right' }}>{fmt(item.discount ?? 0, 1)}%</td>}
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>AED {fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Totals ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, marginBottom: 8 }}>
            <div style={{ width: 280, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px', fontSize: '9pt', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                <span style={{ color: GREY, fontWeight: 500 }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>AED {fmt(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px', fontSize: '9pt', borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
                  <span style={{ color: GREY, fontWeight: 500 }}>Discount</span>
                  <span style={{ fontWeight: 600, color: '#dc2626' }}>− AED {fmt(discount)}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px', fontSize: '9pt', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                  <span style={{ color: GREY, fontWeight: 500 }}>VAT ({invoice.tax_rate ?? 5}%)</span>
                  <span style={{ fontWeight: 600 }}>AED {fmt(taxAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', background: NAVY, color: '#fff', fontSize: '11pt', fontWeight: 800 }}>
                <span>TOTAL</span>
                <span>AED {fmt(total)}</span>
              </div>
              {paidAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px', fontSize: '9pt', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
                  <span style={{ color: '#10b981', fontWeight: 500 }}>Paid</span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>AED {fmt(paidAmount)}</span>
                </div>
              )}
              {remaining > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px', fontSize: '9pt', background: '#fff' }}>
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>Balance Due</span>
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>AED {fmt(remaining)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Amount in words ── */}
          <div style={{
            background: LIGHT, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${NAVY}`,
            borderRadius: '0 6px 6px 0', padding: '8px 14px',
            fontSize: '9pt', color: NAVY, fontStyle: 'italic', margin: '10px 0', lineHeight: 1.5,
          }}>
            <span style={{ fontStyle: 'normal', fontWeight: 700, fontSize: '7.5pt', textTransform: 'uppercase', letterSpacing: '.5px', color: GREY, marginRight: 8 }}>
              Amount in Words
            </span>
            {toWords(total)}
          </div>

          {/* ── Payment details ── */}
          {(invoice.payment_date || invoice.payment_reference) && (
            <>
              <SectionTitle>Payment Details</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '8px 0', padding: '10px 14px', background: LIGHT, border: `1px solid ${BORDER}`, borderRadius: 6 }}>
                {invoice.payment_date && (
                  <div>
                    <div style={{ fontSize: '7.5pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: GREY, marginBottom: 3 }}>Payment Date</div>
                    <div style={{ fontSize: '9pt', color: NAVY, lineHeight: 1.5 }}>{fmtDate(invoice.payment_date)}</div>
                  </div>
                )}
                {invoice.payment_method && (
                  <div>
                    <div style={{ fontSize: '7.5pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: GREY, marginBottom: 3 }}>Payment Method</div>
                    <div style={{ fontSize: '9pt', color: NAVY, lineHeight: 1.5 }}>{invoice.payment_method}</div>
                  </div>
                )}
                {invoice.payment_reference && (
                  <div>
                    <div style={{ fontSize: '7.5pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: GREY, marginBottom: 3 }}>Payment Reference</div>
                    <div style={{ fontSize: '9pt', color: NAVY, lineHeight: 1.5 }}>{invoice.payment_reference}</div>
                  </div>
                )}
              </div>
            </>
          )}

          {invoice.rejection_reason && <NotesBox label="Rejection Reason" text={invoice.rejection_reason} />}
          <NotesBox text={invoice.notes} />

          <div style={{ flex: 1 }} />

          {/* ── Signatures ── */}
          <SectionTitle>Authorization</SectionTitle>
          <SignatureRow signatories={[
            { label: 'Prepared By', name: invoice.created_by_name || '' },
            { label: 'Checked By',  name: '' },
            { label: 'Approved By', name: invoice.approved_by_name || '' },
            { label: 'Supplier',    name: '' },
          ]} />
        </PrintTemplate>
      </div>

    </div>
  );
}

function PrintLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,sans-serif', color: '#888' }}>
      Loading…
    </div>
  );
}
function PrintError({ msg }: { msg: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,sans-serif', color: '#ef4444' }}>
      {msg}
    </div>
  );
}
