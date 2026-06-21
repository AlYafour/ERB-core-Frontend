'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { PurchaseOrder, PurchaseRequest, Supplier } from '@/types';
import { fmt, fmtDate, StatusBadge, COMPANY } from '@/components/print/PrintTemplate';
import { PrintControlsBar } from '@/components/print/PrintControlsBar';
import Image from 'next/image';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { poItemBreakdown } from '@/lib/utils/po-item-totals';
import { buildLineRows } from '@/components/procurement/shared/POLineItemsTable';
import { USER_STAMPS, resolveStamp } from '@/lib/utils/stamps';

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

  useEffect(() => { setHasToken(!!localStorage.getItem('access_token')); }, []);

  const { hasPermission, isLoading: permsLoading } = usePermissions();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;
  const canView = isAdmin || (hasPermission('purchase_order', 'view') ?? false);

  const { data: po, isLoading, isError } = useQuery<PurchaseOrder>({
    queryKey: ['purchase-order', id],
    queryFn: () => purchaseOrdersApi.getById(Number(id)),
    enabled: hasToken && canView,
    retry: 1,
  });

  useEffect(() => {
    if (po?.order_number) document.title = `LPO-${po.order_number}`;
    return () => { document.title = 'ERB Procurement'; };
  }, [po?.order_number]);

  if (!hasToken || isLoading || permsLoading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'Inter,sans-serif', color:'#888' }}>Loading…</div>
  );
  if (!canView) return <PrintPermissionDenied />;
  if (isError || !po) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'Inter,sans-serif', color:'#ef4444' }}>
      Purchase order not found. Please make sure you are logged in.
    </div>
  );

  const supplier   = typeof po.supplier === 'object' && po.supplier ? po.supplier as Supplier : null;
  const pr         = typeof po.purchase_request === 'object' && po.purchase_request ? po.purchase_request as PurchaseRequest : null;
  const discount   = Number(po.discount  ?? 0);
  const hasDiscount = discount > 0;

  const { itemsSubtotal: itemsOnly, itemsVat: itemTaxAmount } = poItemBreakdown(po.items);
  const transportCharge  = Number(po.transportation_charge) || 0;
  const chargesVat       = Number(po.charges_vat) || 0;
  const taxAmount        = Number(po.tax_amount) || 0;
  const hasExplicitTax   = Number(po.tax_rate) > 0;
  const transportVat     = hasExplicitTax ? 0 : Math.max(0, taxAmount - chargesVat);
  const charges          = po.charges ?? [];
  const chargesSum       = charges.reduce((s, c) => s + Number(c.total), 0);
  const subtotal         = itemsOnly + chargesSum;
  const combinedVat      = itemTaxAmount + transportVat + chargesVat + (hasExplicitTax ? taxAmount : 0);
  const vatPct           = hasExplicitTax
    ? Number(po.tax_rate)
    : itemTaxAmount > 0 && itemsOnly > 0
      ? Math.round((itemTaxAmount / itemsOnly) * 100)
      : 0;

  const signatories = [
    { label: 'Prepared By', name: po.pr_created_by_name        || '',        stamp: resolveStamp(po.pr_created_by_name) },
    { label: 'Checked By',  name: po.quotation_created_by_name || 'Noura',   stamp: resolveStamp(po.quotation_created_by_name) ?? '/stamps/noura-stamp.svg' },
    { label: 'Approved By', name: po.approved_by_name          || 'Saif',    stamp: resolveStamp(po.approved_by_name)          ?? '/stamps/saif-stamp.svg'  },
    { label: 'Supplier',    name: supplier?.name ?? '',                       stamp: null },
  ];

  return (
    <div className="print-page-bg"
      style={{ minHeight:'100vh', background:'#f1f5f9',
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

      <PrintControlsBar
        backHref={`/purchase-orders/${id}`}
        docType="LPO" docTypeColor="#f97316"
        docNumber={po.order_number} status={po.status}
      />

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
              <Image src={COMPANY.logo} alt="Logo" width={64} height={64}
                style={{ objectFit:'contain', display:'block' }} priority unoptimized />
            </div>

            {/* Company + project/engineer/costcode */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'12.5pt', fontWeight:800, color:NAVY,
                letterSpacing:'-.3px', lineHeight:1.2 }}>{COMPANY.name}</div>
              <div style={{ fontSize:'7.5pt', color:GREY, marginTop:2, lineHeight:1.6 }}>
                {COMPANY.address} &nbsp;·&nbsp; {COMPANY.phone} &nbsp;·&nbsp; {COMPANY.email}
              </div>
              <div style={{ fontSize:'7.5pt', color:GREY }}>TRN: {COMPANY.trn}</div>

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
              UNIFIED LINE ITEMS TABLE (items + charges)
              ════════════════════════════════════════ */}
          {(() => {
            const rows = buildLineRows(po.items, charges, chargesVat);
            const pTH: React.CSSProperties = { padding:'6px 8px', fontSize:'6.5pt', fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase' as const, color:'#fff' };
            const pTD: React.CSSProperties = { padding:'5px 8px', borderBottom:'1px solid #f1f5f9' };
            const totalExcl = rows.reduce((s, r) => s + r.exclVat,   0);
            const totalVat  = rows.reduce((s, r) => s + r.vat,       0);
            const totalIncl = rows.reduce((s, r) => s + r.totalIncl, 0);
            return (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'8.5pt', marginBottom:4 }}>
                <thead>
                  <tr style={{ background:NAVY }}>
                    <th style={{ ...pTH, textAlign:'left', width:22 }}>#</th>
                    <th style={{ ...pTH, textAlign:'left' }}>Description</th>
                    <th style={{ ...pTH, textAlign:'center', width:40 }}>Unit</th>
                    <th style={{ ...pTH, textAlign:'right', width:48 }}>Qty</th>
                    <th style={{ ...pTH, textAlign:'right', width:70 }}>Unit Price</th>
                    <th style={{ ...pTH, textAlign:'right', width:80 }}>Excl. VAT</th>
                    <th style={{ ...pTH, textAlign:'right', width:72 }}>VAT</th>
                    <th style={{ ...pTH, textAlign:'right', width:90 }}>Total incl. VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.num} style={{ background: idx%2===0 ? '#fff' : '#fafafa' }}>
                      <td style={{ ...pTD, textAlign:'center', color:'#94a3b8' }}>{row.num}</td>
                      <td style={pTD}>
                        <div style={{ fontWeight:600, color:NAVY, lineHeight:1.3 }}>{row.description}</div>
                        {row.code  && <div style={{ fontSize:'7pt',   color:'#94a3b8', marginTop:1 }}>{row.code}</div>}
                        {row.notes && <div style={{ fontSize:'7.5pt', color:'#777',    marginTop:1 }}>{row.notes}</div>}
                      </td>
                      <td style={{ ...pTD, textAlign:'center' }}>{row.unit?.toUpperCase() || '—'}</td>
                      <td style={{ ...pTD, textAlign:'right' }}>{fmt(row.qty, 2)}</td>
                      <td style={{ ...pTD, textAlign:'right' }}>AED {fmt(row.unitPrice)}</td>
                      <td style={{ ...pTD, textAlign:'right', color:GREY }}>AED {fmt(row.exclVat)}</td>
                      <td style={{ ...pTD, textAlign:'right', color: row.vat > 0 ? '#92400e' : '#94a3b8' }}>
                        {row.vat > 0 ? `AED ${fmt(row.vat)}` : '—'}
                      </td>
                      <td style={{ ...pTD, textAlign:'right', fontWeight:600, color:NAVY }}>AED {fmt(row.totalIncl)}</td>
                    </tr>
                  ))}
                </tbody>
                {rows.length > 1 && (
                  <tfoot>
                    <tr style={{ borderTop:`1.5px solid ${BORDER}`, background:'#f8fafc' }}>
                      <td colSpan={5} style={{ padding:'5px 8px', fontSize:'7pt', fontWeight:700, color:STEEL, textTransform:'uppercase', letterSpacing:'.3px', textAlign:'right' }}>Totals</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:700, color:GREY }}>AED {fmt(totalExcl)}</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:700, color:'#92400e' }}>{totalVat > 0 ? `AED ${fmt(totalVat)}` : '—'}</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:800, color:NAVY }}>AED {fmt(totalIncl)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            );
          })()}

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
            <div style={{ width:240, border:`1px solid ${BORDER}`, borderRadius:8, overflow:'hidden', flexShrink:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 12px',
                fontSize:'8pt', background:'#fafafa', borderBottom:`1px solid #f1f5f9` }}>
                <span style={{ color:GREY }}>Subtotal</span>
                <span style={{ fontWeight:600 }}>AED {fmt(subtotal)}</span>
              </div>
              {hasDiscount && (
                <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 12px',
                  fontSize:'8pt', background:'#fff', borderBottom:`1px solid #f1f5f9` }}>
                  <span style={{ color:GREY }}>Discount</span>
                  <span style={{ fontWeight:600, color:'#dc2626' }}>− AED {fmt(discount)}</span>
                </div>
              )}
              {transportCharge > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 12px',
                  fontSize:'8pt', background:'#fafafa', borderBottom:`1px solid #f1f5f9` }}>
                  <span style={{ color:GREY }}>Transportation</span>
                  <span style={{ fontWeight:600 }}>AED {fmt(transportCharge)}</span>
                </div>
              )}
              {combinedVat > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 12px',
                  fontSize:'8pt', background:'#fff', borderBottom:`1px solid #f1f5f9` }}>
                  <span style={{ color:GREY }}>{vatPct > 0 ? `VAT (${vatPct}%)` : 'VAT'}</span>
                  <span style={{ fontWeight:600 }}>AED {fmt(combinedVat)}</span>
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between',
                padding:'8px 12px', background:NAVY, color:'#fff', fontSize:'10pt', fontWeight:800 }}>
                <span>TOTAL</span>
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
                      <Image src={s.stamp} alt="stamp" width={80} height={80}
                        style={{ objectFit:'contain', opacity:0.78, transform:'rotate(-8deg)' }}
                        unoptimized priority />
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
              <span style={{ whiteSpace:'nowrap' }}>{COMPANY.name} · {COMPANY.address}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function PrintPermissionDenied() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontFamily: 'Inter,sans-serif', textAlign: 'center',
      color: '#374151' }}>
      <div>
        <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Access Denied</div>
        <div style={{ color: '#6b7280', fontSize: '14px' }}>You don&apos;t have permission to view this document.</div>
      </div>
    </div>
  );
}
