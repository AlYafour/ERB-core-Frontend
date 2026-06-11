'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { PurchaseOrder, PurchaseOrderItem, PurchaseRequest, Supplier } from '@/types';
import { fmt, fmtDate, StatusBadge } from '@/components/print/PrintTemplate';
import { useTenantBranding } from '@/lib/hooks/use-tenant';

function toWords(n: number): string {
  if (!n || isNaN(n) || n <= 0) return 'Zero Dirhams Only';
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

const NAVY   = '#1B2A4A';
const STEEL  = '#334155';
const GREY   = '#64748b';
const LIGHT  = '#f8fafc';
const BORDER = '#cbd5e1';

/* ── tiny label above a value ── */
function InfoLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize:'6pt', fontWeight:700, textTransform:'uppercase',
      letterSpacing:'.6px', color:GREY, marginBottom:1 }}>
      {text}
    </div>
  );
}

export default function PrintLPOPage() {
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

  const { data: po, isLoading, isError } = useQuery<PurchaseOrder>({
    queryKey: ['purchase-order', id],
    queryFn: () => purchaseOrdersApi.getById(Number(id)),
    enabled: hasToken,
    retry: 1,
  });

  useEffect(() => {
    if (po?.order_number) document.title = `LPO-${po.order_number}`;
    return () => { document.title = 'ERB Procurement'; };
  }, [po?.order_number]);

  if (!hasToken || isLoading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'Inter,sans-serif', color:'#888' }}>Loading…</div>
  );
  if (isError || !po) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'Inter,sans-serif', color:'#ef4444' }}>
      Purchase order not found. Please make sure you are logged in.
    </div>
  );

  const supplier   = typeof po.supplier === 'object' && po.supplier ? po.supplier as Supplier : null;
  const pr         = typeof po.purchase_request === 'object' && po.purchase_request ? po.purchase_request as PurchaseRequest : null;
  const discount            = Number(po.discount           ?? 0);
  const transportationCharge = Number(po.transportation_charge ?? 0);
  const hasDiscount          = discount > 0;
  const hasTransportation    = transportationCharge > 0;
  const transportVatIncluded = (po as any).transport_vat_included ?? true;

  // subtotal = sum of per-item (qty × unit_price × (1 − disc%)) — excl. VAT
  const subtotal = po.items.reduce((sum, item) => {
    const s = Number(item.quantity) * Number(item.unit_price);
    const d = s * ((Number(item.discount) || 0) / 100);
    return sum + s - d;
  }, 0);
  // totalVat covers both per-item VAT and any transport VAT — works regardless of where VAT is stored
  const totalVat = Math.max(0, Number(po.total) - subtotal + discount - transportationCharge);

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

  const signatories = [
    { label: 'Requested By', name: po.pr_created_by_name        || '',        stamp: resolveStamp(po.pr_created_by_name) },
    { label: 'Checked By',  name: po.quotation_created_by_name || 'Noura',   stamp: resolveStamp(po.quotation_created_by_name) ?? '/stamps/noura-stamp.svg' },
    { label: 'Approved By', name: po.approved_by_name          || 'Saif',    stamp: resolveStamp(po.approved_by_name)          ?? '/stamps/saif-stamp.svg'  },
    { label: 'Supplier',    name: supplier?.name ?? '',                       stamp: null },
  ];

  return (
    <div className="print-page-bg"
      style={{ minHeight:'100vh', background:'#dde3ea',
        fontFamily:"'Inter','Cairo','Segoe UI',sans-serif", fontSize:'11px' }}>

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

      {/* ── Control bar (hidden on print) ── */}
      <div className="print-controls-bar" style={{
        position:'sticky', top:0, zIndex:100,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'8px 32px', background:'#fff', borderBottom:`1px solid ${BORDER}`,
        boxShadow:'0 1px 4px rgba(0,0,0,.07)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontWeight:700, fontSize:14, color:NAVY }}>LPO — {po.order_number}</span>
          <StatusBadge status={po.status} />
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={() => window.print()} style={{
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'7px 18px', borderRadius:6, background:NAVY, color:'#fff',
            border:'none', fontSize:12, fontWeight:700, cursor:'pointer', letterSpacing:'.2px',
          }}>⬇ Download PDF</button>
          <button onClick={() => window.print()} style={{
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'7px 16px', borderRadius:6, border:`1px solid ${BORDER}`,
            background:LIGHT, color:'#374151', fontSize:12, fontWeight:600, cursor:'pointer',
          }}>🖨 Print</button>
          <button onClick={() => window.close()} style={{
            padding:'7px 12px', borderRadius:6, border:`1px solid #e5e7eb`,
            background:'transparent', color:'#9ca3af', fontSize:12, cursor:'pointer',
          }}>✕</button>
        </div>
      </div>

      {/* ── A4 sheet ── */}
      <div className="print-doc" style={{
        width:'210mm', minHeight:'297mm',
        margin:'12px auto', background:'#fff',
        borderRadius:4, boxShadow:'0 4px 32px rgba(0,0,0,.15)',
        display:'flex', flexDirection:'column',
      }}>
        <div className="print-content" style={{ padding:'5mm 9mm 4mm', color:NAVY, lineHeight:1.45, flex:1, display:'flex', flexDirection:'column' }}>

          {/* ════════════════════════════════════════
              HEADER: Logo | Company + Info | LPO Box
              ════════════════════════════════════════ */}
          <div style={{ display:'flex', alignItems:'stretch', gap:14, marginBottom:6 }}>

            {/* Logo */}
            <div style={{ flexShrink:0, paddingTop:2, display:'flex', alignItems:'flex-start' }}>
              {company.logo
                ? <img src={company.logo} alt="Logo" style={{ width:64, height:64, objectFit:'contain', display:'block' }} />
                : <div style={{ width:64, height:64, display:'flex', alignItems:'center', justifyContent:'center', background:'#f1f5f9', color:GREY, fontSize:'9pt', fontWeight:700 }}>LOGO</div>
              }
            </div>

            {/* Company + project/engineer/costcode */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'12.5pt', fontWeight:800, color:NAVY,
                letterSpacing:'-.3px', lineHeight:1.2 }}>{company.name}</div>
              <div style={{ fontSize:'7.5pt', color:GREY, marginTop:2, lineHeight:1.6 }}>
                {company.address} &nbsp;·&nbsp; {company.phone} &nbsp;·&nbsp; {company.email}
              </div>
              <div style={{ fontSize:'7.5pt', color:GREY }}>TRN: {company.trn}</div>

              {/* Project / Engineer / Cost Code — compact chips row */}
              {(po.project_name || po.pr_created_by_name || po.cost_code) && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:7 }}>
                  {po.project_name && (
                    <div style={{
                      display:'flex', alignItems:'center', gap:5,
                      background:LIGHT, border:`1px solid ${BORDER}`,
                      borderLeft:`3px solid ${NAVY}`, borderRadius:'0 4px 4px 0',
                      padding:'3px 9px', fontSize:'7.5pt',
                    }}>
                      <span style={{ color:GREY, fontWeight:600 }}>Project</span>
                      <span style={{ fontWeight:700, color:NAVY }}>{po.project_name}</span>
                      {po.project_code && (
                        <span style={{ background:NAVY, color:'#fff',
                          borderRadius:3, padding:'0 5px', fontSize:'6.5pt', fontWeight:700 }}>
                          {po.project_code}
                        </span>
                      )}
                      {po.project_location && (
                        <span style={{ color:GREY }}>· {po.project_location}</span>
                      )}
                    </div>
                  )}
                  {po.pr_created_by_name && (
                    <div style={{
                      display:'flex', alignItems:'center', gap:5,
                      background:LIGHT, border:`1px solid ${BORDER}`,
                      borderLeft:`3px solid ${STEEL}`, borderRadius:'0 4px 4px 0',
                      padding:'3px 9px', fontSize:'7.5pt',
                    }}>
                      <span style={{ color:GREY, fontWeight:600 }}>Engineer</span>
                      <span style={{ fontWeight:700, color:NAVY }}>{po.pr_created_by_name}</span>
                      {po.pr_created_by_phone && (
                        <span style={{ color:GREY }}>· {po.pr_created_by_phone}</span>
                      )}
                    </div>
                  )}
                  {po.cost_code && (
                    <div style={{
                      display:'flex', alignItems:'center', gap:5,
                      background:LIGHT, border:`1px solid ${BORDER}`,
                      borderLeft:`3px solid ${GREY}`, borderRadius:'0 4px 4px 0',
                      padding:'3px 9px', fontSize:'7.5pt',
                    }}>
                      <span style={{ color:GREY, fontWeight:600 }}>Cost Code</span>
                      <span style={{ fontWeight:700, color:NAVY }}>{po.cost_code.excel_code}</span>
                      <span style={{ color:GREY }}>· {po.cost_code.description.slice(0,50)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* LPO Number Box */}
            <div style={{ flexShrink:0, display:'flex' }}>
              <div style={{
                background:NAVY, borderRadius:8,
                padding:'10px 16px', display:'flex', flexDirection:'column',
                justifyContent:'space-between', textAlign:'center', minWidth:155,
              }}>
                <div style={{ fontSize:'6pt', fontWeight:700, letterSpacing:'1.5px',
                  textTransform:'uppercase', color:'rgba(255,255,255,.6)', marginBottom:3 }}>
                  LOCAL PURCHASE ORDER
                </div>
                <div style={{ fontSize:'17pt', fontWeight:800, color:'#fff',
                  lineHeight:1.1, letterSpacing:'-.5px', marginBottom:8 }}>
                  {po.order_number}
                </div>
                <div style={{ borderTop:'1px solid rgba(255,255,255,.2)', paddingTop:6 }}>
                  <div style={{ display:'flex', justifyContent:'space-between',
                    gap:12, fontSize:'7.5pt', color:'rgba(255,255,255,.75)', marginBottom:3 }}>
                    <span>Date</span>
                    <span style={{ color:'#fff', fontWeight:600 }}>{fmtDate(po.order_date)}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between',
                    gap:12, fontSize:'7.5pt', color:'rgba(255,255,255,.75)', alignItems:'center' }}>
                    <span>Status</span>
                    <StatusBadge status={po.status} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Navy divider ── */}
          <div style={{ height:2, background:NAVY, borderRadius:1, margin:'5px 0 7px' }} />

          {/* ════════════════════════════════════════
              SUPPLIER + ORDER INFO — side by side
              ════════════════════════════════════════ */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:7 }}>

            {/* Supplier */}
            <div>
              <InfoLabel text="Supplier" />
              {supplier ? (
                <div style={{ fontSize:'9pt', lineHeight:1.6 }}>
                  <div style={{ fontWeight:700, fontSize:'10.5pt', color:NAVY }}>
                    {supplier.business_name || supplier.name}
                  </div>
                  {supplier.contact_person && <div style={{ color:GREY }}>{supplier.contact_person}</div>}
                  {supplier.phone && <div style={{ color:GREY }}>Tel: {supplier.phone}</div>}
                  {supplier.email && <div style={{ color:GREY }}>{supplier.email}</div>}
                  {(supplier.city || supplier.country) && (
                    <div style={{ color:GREY }}>{[supplier.city, supplier.country].filter(Boolean).join(', ')}</div>
                  )}
                  {supplier.trn && <div style={{ color:'#94a3b8', fontSize:'8pt' }}>TRN: {supplier.trn}</div>}
                </div>
              ) : <div style={{ color:'#94a3b8' }}>—</div>}
            </div>

            {/* Order details */}
            <div>
              <InfoLabel text="Order Details" />
              <table style={{ width:'100%', borderCollapse:'collapse',
                border:`1px solid ${BORDER}`, borderRadius:6, overflow:'hidden', fontSize:'8.5pt' }}>
                <tbody>
                  {([
                    ['Order Date',    fmtDate(po.order_date)],
                    ['Delivery Date', fmtDate(po.delivery_date)],
                    ['Payment Terms', po.payment_terms || '—'],
                    ['Delivery',      po.delivery_method === 'pickup' ? 'Ex-Works / Pickup' : 'Delivery to Site'],
                    ...(pr ? [['PR Reference', pr.code]] : []),
                    ...(pr?.required_by ? [['Required By', fmtDate(pr.required_by)]] : []),
                  ] as [string,string][]).map(([lbl, val], i, arr) => (
                    <tr key={i} style={{ background: i%2===0 ? '#fafafa' : '#fff',
                      borderBottom: i < arr.length-1 ? `1px solid #f1f5f9` : 'none' }}>
                      <td style={{ padding:'4px 10px', color:GREY, fontWeight:600,
                        fontSize:'7pt', textTransform:'uppercase', letterSpacing:'.3px', width:90 }}>{lbl}</td>
                      <td style={{ padding:'4px 10px', color:NAVY, fontWeight:500 }}>{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ════════════════════════════════════════
              ITEMS TABLE
              ════════════════════════════════════════ */}
          <div style={{ fontSize:'8pt', fontWeight:700, letterSpacing:'.8px',
            textTransform:'uppercase', color:STEEL, borderBottom:`1.5px solid ${NAVY}`,
            paddingBottom:2, marginBottom:4 }}>Order Items</div>

          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'8.5pt', marginBottom:4 }}>
            <thead>
              <tr style={{ background:NAVY, color:'#fff' }}>
                <th style={{ padding:'6px 8px', textAlign:'left', fontSize:'6.5pt', fontWeight:700,
                  letterSpacing:'.5px', textTransform:'uppercase', width:24 }}>#</th>
                <th style={{ padding:'6px 8px', textAlign:'left', fontSize:'6.5pt', fontWeight:700,
                  letterSpacing:'.5px', textTransform:'uppercase' }}>Description</th>
                <th style={{ padding:'6px 8px', textAlign:'center', fontSize:'6.5pt', fontWeight:700,
                  letterSpacing:'.5px', textTransform:'uppercase', width:42 }}>Unit</th>
                <th style={{ padding:'6px 8px', textAlign:'right', fontSize:'6.5pt', fontWeight:700,
                  letterSpacing:'.5px', textTransform:'uppercase', width:50 }}>Qty</th>
                <th style={{ padding:'6px 8px', textAlign:'right', fontSize:'6.5pt', fontWeight:700,
                  letterSpacing:'.5px', textTransform:'uppercase', width:75 }}>Unit Price</th>
                {hasDiscount && (
                  <th style={{ padding:'6px 8px', textAlign:'right', fontSize:'6.5pt', fontWeight:700,
                    letterSpacing:'.5px', textTransform:'uppercase', width:44 }}>Disc%</th>
                )}
                <th style={{ padding:'6px 8px', textAlign:'right', fontSize:'6.5pt', fontWeight:700,
                  letterSpacing:'.5px', textTransform:'uppercase', width:78 }}>Excl. VAT</th>
                <th style={{ padding:'6px 8px', textAlign:'right', fontSize:'6.5pt', fontWeight:700,
                  letterSpacing:'.5px', textTransform:'uppercase', width:68 }}>VAT</th>
                <th style={{ padding:'6px 8px', textAlign:'right', fontSize:'6.5pt', fontWeight:700,
                  letterSpacing:'.5px', textTransform:'uppercase', width:82 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item: PurchaseOrderItem, idx: number) => {
                const iExcl = Number(item.quantity) * Number(item.unit_price) * (1 - (Number(item.discount) || 0) / 100);
                const iVat  = Number(item.total) - iExcl;
                return (
                  <tr key={item.id ?? idx} style={{
                    borderBottom:`1px solid #f1f5f9`,
                    background: idx%2===0 ? '#fff' : '#fafafa',
                  }}>
                    <td style={{ padding:'5px 8px', textAlign:'center', color:'#94a3b8' }}>{idx+1}</td>
                    <td style={{ padding:'5px 8px' }}>
                      <div style={{ fontWeight:600, color:NAVY, lineHeight:1.3 }}>
                        {item.product?.name ?? `Item #${item.product_id}`}
                      </div>
                      {item.product?.code && (
                        <div style={{ fontSize:'7pt', color:'#94a3b8', marginTop:1 }}>{item.product.code}</div>
                      )}
                      {item.notes && (
                        <div style={{ fontSize:'7.5pt', color:'#777', marginTop:1 }}>{item.notes}</div>
                      )}
                    </td>
                    <td style={{ padding:'5px 8px', textAlign:'center' }}>{(item.unit || item.product?.unit)?.toUpperCase() || '—'}</td>
                    <td style={{ padding:'5px 8px', textAlign:'right' }}>{fmt(item.quantity, 2)}</td>
                    <td style={{ padding:'5px 8px', textAlign:'right' }}>AED {fmt(item.unit_price)}</td>
                    {hasDiscount && (
                      <td style={{ padding:'5px 8px', textAlign:'right' }}>{fmt(item.discount ?? 0, 1)}%</td>
                    )}
                    <td style={{ padding:'5px 8px', textAlign:'right' }}>AED {fmt(iExcl)}</td>
                    <td style={{ padding:'5px 8px', textAlign:'right', color: iVat > 0 ? '#64748b' : '#cbd5e1' }}>
                      {iVat > 0 ? `AED ${fmt(iVat)}` : '—'}
                    </td>
                    <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:600 }}>AED {fmt(Number(item.total))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Spacer — pushes totals/terms/auth to page bottom */}
          <div style={{ flex:1 }} />

          {/* ════════════════════════════════════════
              TOTALS + AMOUNT IN WORDS — side by side
              ════════════════════════════════════════ */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end',
            gap:14, marginBottom:5 }}>

            {/* Amount in words */}
            <div style={{
              flex:1, background:LIGHT, border:`1px solid ${BORDER}`,
              borderLeft:`3px solid ${NAVY}`, borderRadius:'0 6px 6px 0',
              padding:'7px 12px', fontSize:'8.5pt', color:NAVY, lineHeight:1.5,
            }}>
              <div style={{ fontSize:'6pt', fontWeight:700, textTransform:'uppercase',
                letterSpacing:'.6px', color:GREY, marginBottom:3 }}>Amount in Words</div>
              <div style={{ fontStyle:'italic' }}>{toWords(Number(po.total))}</div>
            </div>

            {/* Totals box */}
            <div style={{ width:255, border:`1px solid ${BORDER}`, borderRadius:8, overflow:'hidden', flexShrink:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'4px 12px', fontSize:'8pt', background:'#fafafa', borderBottom:`1px solid #f1f5f9` }}>
                <div>
                  <div style={{ color:GREY }}>Subtotal</div>
                  <div style={{ fontSize:'6pt', color:'#94a3b8', fontStyle:'italic' }}>excl. VAT</div>
                </div>
                <span style={{ fontWeight:600 }}>AED {fmt(subtotal)}</span>
              </div>
              {hasDiscount && (
                <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 12px',
                  fontSize:'8pt', background:'#fff', borderBottom:`1px solid #f1f5f9` }}>
                  <span style={{ color:GREY }}>Discount</span>
                  <span style={{ fontWeight:600, color:'#dc2626' }}>− AED {fmt(discount)}</span>
                </div>
              )}
              {hasTransportation && (
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'4px 12px', fontSize:'8pt', background:'#fafafa', borderBottom:`1px solid #f1f5f9` }}>
                  <div>
                    <div style={{ color:GREY }}>Transportation</div>
                    <div style={{ fontSize:'6pt', color:'#94a3b8', fontStyle:'italic' }}>
                      {transportVatIncluded ? 'VAT applicable' : 'excl. VAT'}
                    </div>
                  </div>
                  <span style={{ fontWeight:600 }}>AED {fmt(transportationCharge)}</span>
                </div>
              )}
              {totalVat > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'4px 12px', fontSize:'8pt', background:'#fff', borderBottom:`1px solid #f1f5f9` }}>
                  <div>
                    <div style={{ color:GREY }}>VAT</div>
                    <div style={{ fontSize:'6pt', color:'#94a3b8', fontStyle:'italic' }}>5%</div>
                  </div>
                  <span style={{ fontWeight:600 }}>AED {fmt(totalVat)}</span>
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'8px 12px', background:NAVY, color:'#fff', fontSize:'10pt', fontWeight:800 }}>
                <div>
                  <div>TOTAL</div>
                  <div style={{ fontSize:'6pt', fontWeight:400, opacity:.7, fontStyle:'italic' }}>incl. VAT</div>
                </div>
                <span>AED {fmt(Number(po.total))}</span>
              </div>
            </div>
          </div>

          {/* Terms / Notes — compact */}
          {(po.payment_terms || po.delivery_terms) && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10,
              padding:'6px 12px', background:LIGHT, border:`1px solid ${BORDER}`,
              borderRadius:6, marginBottom:6 }}>
              {po.payment_terms && (
                <div>
                  <InfoLabel text="Payment Terms" />
                  <div style={{ fontSize:'8.5pt', color:NAVY }}>{po.payment_terms}</div>
                </div>
              )}
              {po.delivery_terms && (
                <div>
                  <InfoLabel text="Delivery Terms" />
                  <div style={{ fontSize:'8.5pt', color:NAVY }}>{po.delivery_terms}</div>
                </div>
              )}
            </div>
          )}

          {po.terms_and_conditions && (
            <div style={{ fontSize:'8pt', color:'#555', lineHeight:1.6, marginBottom:6 }}>
              {po.terms_and_conditions}
            </div>
          )}

          {po.notes && (
            <div style={{
              background:LIGHT, border:`1px solid ${BORDER}`, borderLeft:`3px solid ${STEEL}`,
              borderRadius:'0 4px 4px 0', padding:'5px 11px',
              fontSize:'8pt', color:NAVY, margin:'4px 0 6px', lineHeight:1.5,
            }}>
              <span style={{ fontWeight:700, color:STEEL, marginRight:4 }}>Notes:</span>{po.notes}
            </div>
          )}

          {/* ════════════════════════════════════════
              AUTHORIZATION + FOOTER — never split
              ════════════════════════════════════════ */}
          <div style={{ breakInside:'avoid', pageBreakInside:'avoid', marginTop:6 }}>

            <div style={{ fontSize:'8pt', fontWeight:700, letterSpacing:'.8px',
              textTransform:'uppercase', color:STEEL, borderBottom:`1.5px solid ${NAVY}`,
              paddingBottom:3, marginBottom:8 }}>Authorization</div>

            <div style={{ display:'flex', border:`1px solid ${BORDER}`, borderRadius:8, overflow:'hidden' }}>
              {signatories.map((s, i) => (
                <div key={i} style={{
                  flex:1, display:'flex', flexDirection:'column',
                  height:115,
                  borderRight: i < signatories.length - 1 ? `1px solid ${BORDER}` : 'none',
                  background: i%2===0 ? '#fafafa' : '#fff',
                }}>
                  {/* Stamp — centred in the top area */}
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                    {s.stamp && (
                      <img src={s.stamp} alt="stamp"
                        style={{ width:80, height:80, objectFit:'contain', opacity:0.78, transform:'rotate(-8deg)' }} />
                    )}
                  </div>
                  {/* Label + name — pinned to bottom, same height for all */}
                  <div style={{ flexShrink:0, padding:'0 6px 7px', textAlign:'center' }}>
                    <div style={{ height:1, background:BORDER, marginBottom:4 }} />
                    <div style={{ fontSize:'5.5pt', fontWeight:700, textTransform:'uppercase',
                      letterSpacing:'.6px', color:GREY }}>{s.label}</div>
                    <div style={{ fontSize:'7pt', fontWeight:600, color:NAVY, marginTop:2, minHeight:12 }}>
                      {s.name || ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
              marginTop:10, paddingTop:7, borderTop:`1px solid ${BORDER}`,
              fontSize:'6.5pt', color:'#94a3b8', gap:12 }}>
              <span>This document is computer-generated and valid without a handwritten signature unless otherwise stated.</span>
              <span style={{ whiteSpace:'nowrap' }}>{company.name} · {company.address}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
