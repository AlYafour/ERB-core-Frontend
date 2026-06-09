'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { goodsReceivingApi, GoodsReceivedNote, GRNItem } from '@/lib/api/goods-receiving';
import { PurchaseOrder, Supplier } from '@/types';
import { fmt, fmtDate, StatusBadge } from '@/components/print/PrintTemplate';
import { useTenantBranding } from '@/lib/hooks/use-tenant';

const NAVY   = '#1B2A4A';
const STEEL  = '#334155';
const GREY   = '#64748b';
const LIGHT  = '#f8fafc';
const BORDER = '#cbd5e1';

const QUALITY_COLOR: Record<string, string> = {
  good: '#15803d', damaged: '#b45309', defective: '#b91c1c', missing: '#6b7280',
};
const QUALITY_LABEL: Record<string, string> = {
  good: 'Good', damaged: 'Damaged', defective: 'Defective', missing: 'Missing',
};

function InfoLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: '6pt', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.6px', color: GREY, marginBottom: 1 }}>
      {text}
    </div>
  );
}

const USER_STAMPS: Record<string, string> = {
  abdel: '/stamps/abdo-stamp.svg',
  sayed: '/stamps/sayed-stamp.svg',
  noura: '/stamps/noura-stamp.svg',
  saif:  '/stamps/saif-stamp.svg',
};
function resolveStamp(u: string | null | undefined): string | null {
  if (!u) return null;
  const k = u.toLowerCase();
  for (const name of Object.keys(USER_STAMPS)) {
    if (k.includes(name)) return USER_STAMPS[name];
  }
  return null;
}

export default function PrintGRNPage() {
  const { id } = useParams<{ id: string }>();
  const [hasToken, setHasToken] = useState(false);
  const { data: branding } = useTenantBranding();

  const company = {
    name:    branding?.company_legal_name || '',
    address: branding?.company_address    || '',
    phone:   branding?.company_phone      || '',
    email:   branding?.company_email      || '',
    trn:     branding?.company_trn        || '',
    logo:    branding?.logo_url           || '',
  };

  useEffect(() => { setHasToken(!!localStorage.getItem('access_token')); }, []);

  const { data: grn, isLoading, isError } = useQuery<GoodsReceivedNote>({
    queryKey: ['grn', id],
    queryFn:  () => goodsReceivingApi.getById(Number(id)),
    enabled:  hasToken,
    retry: 1,
  });

  useEffect(() => {
    if (grn?.grn_number) document.title = `GRN-${grn.grn_number}`;
    return () => { document.title = 'ERB Procurement'; };
  }, [grn?.grn_number]);

  if (!hasToken || isLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter,sans-serif', color: '#888' }}>Loading…</div>
  );
  if (isError || !grn) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter,sans-serif', color: '#ef4444' }}>
      Goods received note not found. Please make sure you are logged in.
    </div>
  );

  const po       = typeof grn.purchase_order === 'object' && grn.purchase_order ? grn.purchase_order as PurchaseOrder : null;
  const supplier = po && typeof po.supplier === 'object' && po.supplier ? po.supplier as Supplier : null;

  const totalOrdered  = grn.items.reduce((s, i) => s + Number(i.ordered_quantity  ?? 0), 0);
  const totalReceived = grn.items.reduce((s, i) => s + Number(i.received_quantity  ?? 0), 0);
  const totalRejected = grn.items.reduce((s, i) => s + Number(i.rejected_quantity  ?? 0), 0);

  const signatories = [
    { label: 'Received By',   name: grn.received_by_name ?? '', stamp: resolveStamp(grn.received_by_name) },
    { label: 'Inspected By',  name: '',                          stamp: null },
    { label: 'Store Keeper',  name: '',                          stamp: null },
    { label: 'Supplier Rep.', name: '',                          stamp: null },
  ];

  return (
    <div className="print-page-bg"
      style={{ minHeight: '100vh', background: '#dde3ea',
        fontFamily: "'Inter','Cairo','Segoe UI',sans-serif", fontSize: '11px' }}>

      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { width: 210mm; height: 297mm; }
          .print-page-bg { background: white !important; padding: 0 !important; margin: 0 !important; }
          .print-controls-bar { display: none !important; }
          .print-doc {
            margin: 0 !important;
            width: 210mm !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            height: 297mm !important;
            min-height: 297mm !important;
          }
          .print-content {
            height: calc(297mm - 10mm) !important;
          }
        }
      `}</style>

      {/* ── Control bar ── */}
      <div className="print-controls-bar" style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 32px', background: '#fff', borderBottom: `1px solid ${BORDER}`,
        boxShadow: '0 1px 4px rgba(0,0,0,.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: NAVY }}>GRN — {grn.grn_number}</span>
          <StatusBadge status={grn.status} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => window.print()} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 18px', borderRadius: 6, background: NAVY, color: '#fff',
            border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '.2px',
          }}>⬇ Download PDF</button>
          <button onClick={() => window.print()} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', borderRadius: 6, border: `1px solid ${BORDER}`,
            background: LIGHT, color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>🖨 Print</button>
          <button onClick={() => window.close()} style={{
            padding: '7px 12px', borderRadius: 6, border: '1px solid #e5e7eb',
            background: 'transparent', color: '#9ca3af', fontSize: 12, cursor: 'pointer',
          }}>✕</button>
        </div>
      </div>

      {/* ── A4 sheet ── */}
      <div className="print-doc" style={{
        width: '210mm', minHeight: '297mm',
        margin: '12px auto', background: '#fff',
        borderRadius: 4, boxShadow: '0 4px 32px rgba(0,0,0,.15)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div className="print-content" style={{ padding: '5mm 9mm 4mm', color: NAVY, lineHeight: 1.45, flex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* ════════════ HEADER ════════════ */}
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 14, marginBottom: 6 }}>

            {/* Logo */}
            <div style={{ flexShrink: 0, paddingTop: 2, display: 'flex', alignItems: 'flex-start' }}>
              {company.logo
                ? <img src={company.logo} alt="Logo" style={{ width: 64, height: 64, objectFit: 'contain', display: 'block' }} />
                : <div style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: GREY, fontSize: '9pt', fontWeight: 700 }}>LOGO</div>
              }
            </div>

            {/* Company + project chips */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12.5pt', fontWeight: 800, color: NAVY, letterSpacing: '-.3px', lineHeight: 1.2 }}>{company.name}</div>
              <div style={{ fontSize: '7.5pt', color: GREY, marginTop: 2, lineHeight: 1.6 }}>
                {company.address} &nbsp;·&nbsp; {company.phone} &nbsp;·&nbsp; {company.email}
              </div>
              <div style={{ fontSize: '7.5pt', color: GREY }}>TRN: {company.trn}</div>

              {(po?.project_name || po?.pr_created_by_name) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                  {po.project_name && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: LIGHT, border: `1px solid ${BORDER}`,
                      borderLeft: `3px solid ${NAVY}`, borderRadius: '0 4px 4px 0',
                      padding: '3px 9px', fontSize: '7.5pt',
                    }}>
                      <span style={{ color: GREY, fontWeight: 600 }}>Project</span>
                      <span style={{ fontWeight: 700, color: NAVY }}>{po.project_name}</span>
                      {po.project_code && (
                        <span style={{ background: NAVY, color: '#fff', borderRadius: 3, padding: '0 5px', fontSize: '6.5pt', fontWeight: 700 }}>
                          {po.project_code}
                        </span>
                      )}
                    </div>
                  )}
                  {po.pr_created_by_name && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: LIGHT, border: `1px solid ${BORDER}`,
                      borderLeft: `3px solid ${STEEL}`, borderRadius: '0 4px 4px 0',
                      padding: '3px 9px', fontSize: '7.5pt',
                    }}>
                      <span style={{ color: GREY, fontWeight: 600 }}>Engineer</span>
                      <span style={{ fontWeight: 700, color: NAVY }}>{po.pr_created_by_name}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* GRN Number Box */}
            <div style={{ flexShrink: 0, display: 'flex' }}>
              <div style={{
                background: NAVY, borderRadius: 8,
                padding: '10px 16px', display: 'flex', flexDirection: 'column',
                justifyContent: 'space-between', textAlign: 'center', minWidth: 155,
              }}>
                <div style={{ fontSize: '6pt', fontWeight: 700, letterSpacing: '1.5px',
                  textTransform: 'uppercase', color: 'rgba(255,255,255,.6)', marginBottom: 3 }}>
                  GOODS RECEIVED NOTE
                </div>
                <div style={{ fontSize: '17pt', fontWeight: 800, color: '#fff',
                  lineHeight: 1.1, letterSpacing: '-.5px', marginBottom: 8 }}>
                  {grn.grn_number}
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,.2)', paddingTop: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    gap: 12, fontSize: '7.5pt', color: 'rgba(255,255,255,.75)', marginBottom: 3 }}>
                    <span>Date</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{fmtDate(grn.receipt_date)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    gap: 12, fontSize: '7.5pt', color: 'rgba(255,255,255,.75)', alignItems: 'center' }}>
                    <span>Status</span>
                    <StatusBadge status={grn.status} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Navy divider ── */}
          <div style={{ height: 2, background: NAVY, borderRadius: 1, margin: '5px 0 7px' }} />

          {/* ════════════ SUPPLIER + RECEIPT INFO ════════════ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 7 }}>

            {/* Supplier */}
            <div>
              <InfoLabel text="Supplier" />
              {supplier ? (
                <div style={{ fontSize: '9pt', lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 700, fontSize: '10.5pt', color: NAVY }}>{supplier.business_name || supplier.name}</div>
                  {supplier.contact_person && <div style={{ color: GREY }}>{supplier.contact_person}</div>}
                  {supplier.phone && <div style={{ color: GREY }}>Tel: {supplier.phone}</div>}
                  {supplier.email && <div style={{ color: GREY }}>{supplier.email}</div>}
                  {(supplier.city || supplier.country) && (
                    <div style={{ color: GREY }}>{[supplier.city, supplier.country].filter(Boolean).join(', ')}</div>
                  )}
                  {supplier.trn && <div style={{ color: '#94a3b8', fontSize: '8pt' }}>TRN: {supplier.trn}</div>}
                </div>
              ) : <div style={{ color: '#94a3b8' }}>—</div>}
            </div>

            {/* Receipt details */}
            <div>
              <InfoLabel text="Receipt Details" />
              <table style={{ width: '100%', borderCollapse: 'collapse',
                border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden', fontSize: '8.5pt' }}>
                <tbody>
                  {([
                    ['GRN Number',    grn.grn_number],
                    ['Receipt Date',  fmtDate(grn.receipt_date)],
                    ['LPO Reference', po?.order_number ?? '—'],
                    ['Received By',   grn.received_by_name ?? '—'],
                    ['Inv. Delivery', grn.invoice_delivery_status === 'delivered' ? 'Delivered to Office' : 'Not Delivered'],
                    ...(po?.payment_terms ? [['Payment Terms', po.payment_terms]] : []),
                  ] as [string, string][]).map(([lbl, val], i, arr) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff',
                      borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <td style={{ padding: '4px 10px', color: GREY, fontWeight: 600,
                        fontSize: '7pt', textTransform: 'uppercase', letterSpacing: '.3px', width: 90 }}>{lbl}</td>
                      <td style={{ padding: '4px 10px', color: NAVY, fontWeight: 500 }}>{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ════════════ ITEMS TABLE ════════════ */}
          <div style={{ fontSize: '8pt', fontWeight: 700, letterSpacing: '.8px',
            textTransform: 'uppercase', color: STEEL, borderBottom: `1.5px solid ${NAVY}`,
            paddingBottom: 2, marginBottom: 4 }}>Received Items</div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', marginBottom: 4 }}>
            <thead>
              <tr style={{ background: NAVY, color: '#fff' }}>
                {[
                  { label: '#',        align: 'center', width: 24 },
                  { label: 'Product / Material' },
                  { label: 'Unit',     align: 'center', width: 42 },
                  { label: 'Ordered',  align: 'right',  width: 58 },
                  { label: 'Received', align: 'right',  width: 62 },
                  { label: 'Rejected', align: 'right',  width: 58 },
                  { label: 'Quality',  align: 'center', width: 70 },
                  { label: 'Remarks',  width: 80 },
                ].map((h, i) => (
                  <th key={i} style={{ padding: '6px 8px', textAlign: (h.align as any) ?? 'left',
                    fontSize: '6.5pt', fontWeight: 700, letterSpacing: '.5px',
                    textTransform: 'uppercase', width: h.width }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grn.items.map((item: GRNItem, idx: number) => (
                <tr key={item.id ?? idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '5px 8px', textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                  <td style={{ padding: '5px 8px' }}>
                    <div style={{ fontWeight: 600, color: NAVY, lineHeight: 1.3 }}>{item.product?.name ?? `Product #${item.product_id}`}</div>
                    {item.product?.code && <div style={{ fontSize: '7pt', color: '#94a3b8', marginTop: 1 }}>{item.product.code}</div>}
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'center' }}>{item.product?.unit?.toUpperCase() || '—'}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{fmt(item.ordered_quantity, 2)}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{fmt(item.received_quantity, 2)}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', color: Number(item.rejected_quantity) > 0 ? '#ef4444' : '#888' }}>
                    {fmt(item.rejected_quantity, 2)}
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 7px', borderRadius: 4,
                      fontSize: '7pt', fontWeight: 700,
                      color: QUALITY_COLOR[item.quality_status] ?? GREY,
                      border: `1px solid ${QUALITY_COLOR[item.quality_status] ?? GREY}`,
                      background: '#fff',
                    }}>
                      {QUALITY_LABEL[item.quality_status] ?? item.quality_status}
                    </span>
                  </td>
                  <td style={{ padding: '5px 8px', fontSize: '8pt', color: '#555' }}>{item.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc', borderTop: `2px solid ${NAVY}` }}>
                <td colSpan={3} style={{ padding: '6px 8px', fontWeight: 700, fontSize: '8pt', color: STEEL, textTransform: 'uppercase', letterSpacing: '.4px' }}>Totals</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(totalOrdered, 2)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{fmt(totalReceived, 2)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: totalRejected > 0 ? '#ef4444' : '#888' }}>{fmt(totalRejected, 2)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>

          {/* ── Summary chips ── */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
            {[
              { label: 'Total Items',        value: String(grn.items.length),  color: NAVY },
              { label: 'Total Ordered Qty',  value: fmt(totalOrdered,  0),     color: GREY },
              { label: 'Total Received Qty', value: fmt(totalReceived, 0),     color: '#10b981' },
              { label: 'Total Rejected Qty', value: fmt(totalRejected, 0),     color: totalRejected > 0 ? '#ef4444' : '#9ca3af' },
            ].map((s, i) => (
              <div key={i} style={{
                flex: 1, background: LIGHT, border: `1px solid ${BORDER}`,
                borderRadius: 6, padding: '5px 8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '6.5pt', color: GREY, marginBottom: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>{s.label}</div>
                <div style={{ fontSize: '11pt', fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {grn.notes && (
            <div style={{
              background: LIGHT, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${STEEL}`,
              borderRadius: '0 4px 4px 0', padding: '5px 11px',
              fontSize: '8pt', color: NAVY, marginBottom: 6, lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 700, color: STEEL, marginRight: 4 }}>Notes:</span>{grn.notes}
            </div>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* ════════════ AUTHORIZATION ════════════ */}
          <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid', marginTop: 6 }}>
            <div style={{ fontSize: '8pt', fontWeight: 700, letterSpacing: '.8px',
              textTransform: 'uppercase', color: STEEL, borderBottom: `1.5px solid ${NAVY}`,
              paddingBottom: 3, marginBottom: 8 }}>Acknowledgement</div>

            <div style={{ display: 'flex', border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
              {signatories.map((s, i) => (
                <div key={i} style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  height: 115,
                  borderRight: i < signatories.length - 1 ? `1px solid ${BORDER}` : 'none',
                  background: i % 2 === 0 ? '#fafafa' : '#fff',
                }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {s.stamp && (
                      <img src={s.stamp} alt="stamp"
                        style={{ width: 80, height: 80, objectFit: 'contain', opacity: 0.78, transform: 'rotate(-8deg)' }} />
                    )}
                  </div>
                  <div style={{ flexShrink: 0, padding: '0 6px 7px', textAlign: 'center' }}>
                    <div style={{ height: 1, background: BORDER, marginBottom: 4 }} />
                    <div style={{ fontSize: '5.5pt', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '.6px', color: GREY }}>{s.label}</div>
                    <div style={{ fontSize: '7pt', fontWeight: 600, color: NAVY, marginTop: 2, minHeight: 12 }}>
                      {s.name || ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 10, paddingTop: 7, borderTop: `1px solid ${BORDER}`,
              fontSize: '6.5pt', color: '#94a3b8', gap: 12 }}>
              <span>This document is computer-generated and valid without a handwritten signature unless otherwise stated.</span>
              <span style={{ whiteSpace: 'nowrap' }}>{company.name} · {company.address}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
