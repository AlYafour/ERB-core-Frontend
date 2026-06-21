'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { purchaseQuotationsApi } from '@/lib/api/purchase-quotations';
import { PurchaseQuotation, PurchaseQuotationItem, Supplier } from '@/types';
import PrintTemplate, {
  StatusBadge,
  fmt, fmtDate,
} from '@/components/print/PrintTemplate';
import { PrintControlsBar } from '@/components/print/PrintControlsBar';
import { useTenantInfo } from '@/lib/hooks/use-tenant';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { usePermissions } from '@/lib/hooks/use-permissions';
// stamps are now per-user via stamp_url on the User model
import Image from 'next/image';

const NAVY   = '#1B2A4A';
const STEEL  = '#334155';
const GREY   = '#64748b';
const BORDER = '#cbd5e1';

export default function PrintPQPage() {
  const { id } = useParams<{ id: string }>();
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => { setHasToken(!!localStorage.getItem('access_token')); }, []);

  const { hasPermission, isLoading: permsLoading } = usePermissions();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;
  const canView = isAdmin || (hasPermission('purchase_quotation', 'view') ?? false);

  const { data: tenantData } = useTenantInfo();
  const b = tenantData?.branding;
  const co = {
    name:    b?.company_legal_name || '',
    address: b?.company_address    || '',
    phone:   b?.company_phone      || '',
    email:   b?.company_email      || '',
    trn:     b?.company_trn        || '',
    logo:    b?.logo_url           || '/xerb-logo.svg',
  };

  const { data: pq, isLoading, isError } = useQuery<PurchaseQuotation>({
    queryKey: ['purchase-quotation', id],
    queryFn: () => purchaseQuotationsApi.getById(Number(id)),
    enabled: hasToken && canView,
    retry: 1,
  });

  useEffect(() => {
    if (pq?.quotation_number) document.title = `PQ-${pq.quotation_number}`;
    return () => { document.title = 'ERB Procurement'; };
  }, [pq?.quotation_number]);

  if (!hasToken || isLoading || permsLoading) return <PrintLoader />;
  if (!canView) return <PrintPermissionDenied />;
  if (isError || !pq) return (
    <PrintError msg="Purchase quotation not found. Please make sure you are logged in." />
  );

  const supplier  = typeof pq.supplier === 'object' && pq.supplier ? pq.supplier as Supplier : null;
  const discount  = Number(pq.discount ?? 0);
  const taxAmount = Number(pq.tax_amount ?? 0);
  const subtotal  = Number(pq.subtotal ?? pq.items.reduce((s, i) => s + Number(i.total ?? 0), 0));
  const hasDiscount = discount > 0;

  const signatories = [
    { label: 'Prepared By', name: pq.created_by_name  || '', stamp: (pq as any).created_by_stamp_url  || null },
    { label: 'Checked By',  name: (pq as any).checked_by_name  || '', stamp: (pq as any).checked_by_stamp_url  || null },
    { label: 'Approved By', name: pq.awarded_by_name  || '', stamp: (pq as any).awarded_by_stamp_url  || null },
    { label: 'Supplier',    name: supplier?.name ?? '',       stamp: null },
  ];

  return (
    <div className="print-page-bg"
      style={{ minHeight: '100vh', background: '#f1f5f9',
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

      <PrintControlsBar
        backHref={`/purchase-quotations/${id}`}
        docType="PQ" docTypeColor="#6366f1"
        docNumber={pq.quotation_number} status={pq.status ?? 'pending'}
      />

      {/* ── A4 sheet ── */}
      <div className="print-doc" style={{
        width: '210mm', minHeight: '297mm',
        margin: '12px auto', background: '#fff',
        borderRadius: 4, boxShadow: '0 4px 32px rgba(0,0,0,.15)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div className="print-content" style={{
          padding: '5mm 9mm 4mm', color: NAVY,
          lineHeight: 1.45, flex: 1, display: 'flex', flexDirection: 'column',
        }}>

          {/* ════════════════════════════════════════
              HEADER: Logo | Company Info | PQ Box
              ════════════════════════════════════════ */}
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 14, marginBottom: 6 }}>

            {/* Logo */}
            <div style={{ flexShrink: 0, paddingTop: 2, display: 'flex', alignItems: 'flex-start' }}>
              <Image src={co.logo} alt="Logo" width={64} height={64}
                style={{ objectFit: 'contain', display: 'block' }} priority unoptimized />
            </div>

            {/* Company info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12.5pt', fontWeight: 800, color: NAVY,
                letterSpacing: '-.3px', lineHeight: 1.2 }}>{co.name}</div>
              <div style={{ fontSize: '7.5pt', color: GREY, marginTop: 2, lineHeight: 1.6 }}>
                {co.address} &nbsp;·&nbsp; {co.phone} &nbsp;·&nbsp; {co.email}
              </div>
              <div style={{ fontSize: '7.5pt', color: GREY }}>TRN: {co.trn}</div>

              {/* Project chip */}
              {pq.project_name && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: '#f8fafc', border: `1px solid ${BORDER}`,
                    borderLeft: `3px solid ${NAVY}`, borderRadius: '0 4px 4px 0',
                    padding: '3px 9px', fontSize: '7.5pt',
                  }}>
                    <span style={{ color: GREY, fontWeight: 600 }}>Project</span>
                    <span style={{ fontWeight: 700, color: NAVY }}>{pq.project_name}</span>
                    {pq.project_code && (
                      <span style={{ background: NAVY, color: '#fff',
                        borderRadius: 3, padding: '0 5px', fontSize: '6.5pt', fontWeight: 700 }}>
                        {pq.project_code}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* PQ Number Box */}
            <div style={{ flexShrink: 0, display: 'flex' }}>
              <div style={{
                background: '#6366f1', borderRadius: 8,
                padding: '10px 16px', display: 'flex', flexDirection: 'column',
                justifyContent: 'space-between', textAlign: 'center', minWidth: 155,
              }}>
                <div style={{ fontSize: '6pt', fontWeight: 700, letterSpacing: '1.5px',
                  textTransform: 'uppercase', color: 'rgba(255,255,255,.7)', marginBottom: 3 }}>
                  PURCHASE QUOTATION
                </div>
                <div style={{ fontSize: '17pt', fontWeight: 800, color: '#fff',
                  lineHeight: 1.1, letterSpacing: '-.5px', marginBottom: 8 }}>
                  {pq.quotation_number}
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,.2)', paddingTop: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    gap: 12, fontSize: '7.5pt', color: 'rgba(255,255,255,.75)', marginBottom: 3 }}>
                    <span>Date</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{fmtDate(pq.quotation_date)}</span>
                  </div>
                  {pq.valid_until && (
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                      gap: 12, fontSize: '7.5pt', color: 'rgba(255,255,255,.75)', marginBottom: 3 }}>
                      <span>Valid Until</span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{fmtDate(pq.valid_until)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    gap: 12, fontSize: '7.5pt', color: 'rgba(255,255,255,.75)', alignItems: 'center' }}>
                    <span>Status</span>
                    <StatusBadge status={pq.status ?? 'pending'} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Indigo divider ── */}
          <div style={{ height: 2, background: '#6366f1', borderRadius: 1, margin: '5px 0 7px' }} />

          {/* ════════════════════════════════════════
              SUPPLIER + QUOTATION DETAILS — side by side
              ════════════════════════════════════════ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 7 }}>

            {/* Supplier */}
            <div>
              <div style={{ fontSize: '6pt', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '.6px', color: GREY, marginBottom: 1 }}>Supplier</div>
              {supplier ? (
                <div style={{ fontSize: '9pt', lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 700, fontSize: '10.5pt', color: NAVY }}>
                    {supplier.business_name || supplier.name}
                  </div>
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

            {/* Quotation details */}
            <div>
              <div style={{ fontSize: '6pt', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '.6px', color: GREY, marginBottom: 1 }}>Quotation Details</div>
              <table style={{ width: '100%', borderCollapse: 'collapse',
                border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden', fontSize: '8.5pt' }}>
                <tbody>
                  {([
                    ['Quotation Date', fmtDate(pq.quotation_date)],
                    ...(pq.valid_until ? [['Valid Until', fmtDate(pq.valid_until)]] : []),
                    ['Payment Terms',  pq.payment_terms || '—'],
                    ['Delivery',       pq.delivery_method === 'pickup' ? 'Ex-Works / Pickup' : 'Delivery to Site'],
                    ...(pq.quotation_request_code ? [['QR Reference', pq.quotation_request_code]] : []),
                    ...(pq.purchase_request_code  ? [['PR Reference', pq.purchase_request_code]]  : []),
                  ] as [string, string][]).map(([lbl, val], i, arr) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff',
                      borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <td style={{ padding: '4px 10px', color: GREY, fontWeight: 600,
                        fontSize: '7pt', textTransform: 'uppercase', letterSpacing: '.3px', width: 95 }}>{lbl}</td>
                      <td style={{ padding: '4px 10px', color: NAVY, fontWeight: 500 }}>{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ════════════════════════════════════════
              ITEMS TABLE
              ════════════════════════════════════════ */}
          <div style={{ fontSize: '8pt', fontWeight: 700, letterSpacing: '.8px',
            textTransform: 'uppercase', color: STEEL, borderBottom: `1.5px solid #6366f1`,
            paddingBottom: 2, marginBottom: 4 }}>Quoted Items</div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', marginBottom: 4 }}>
            <thead>
              <tr style={{ background: '#6366f1', color: '#fff' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '6.5pt', fontWeight: 700,
                  letterSpacing: '.5px', textTransform: 'uppercase', width: 24 }}>#</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '6.5pt', fontWeight: 700,
                  letterSpacing: '.5px', textTransform: 'uppercase' }}>Description</th>
                <th style={{ padding: '6px 8px', textAlign: 'center', fontSize: '6.5pt', fontWeight: 700,
                  letterSpacing: '.5px', textTransform: 'uppercase', width: 42 }}>Unit</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '6.5pt', fontWeight: 700,
                  letterSpacing: '.5px', textTransform: 'uppercase', width: 50 }}>Qty</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '6.5pt', fontWeight: 700,
                  letterSpacing: '.5px', textTransform: 'uppercase', width: 75 }}>Unit Price</th>
                {hasDiscount && (
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '6.5pt', fontWeight: 700,
                    letterSpacing: '.5px', textTransform: 'uppercase', width: 50 }}>Disc%</th>
                )}
                <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '6.5pt', fontWeight: 700,
                  letterSpacing: '.5px', textTransform: 'uppercase', width: 80 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {pq.items.map((item: PurchaseQuotationItem, idx: number) => (
                <tr key={item.id ?? idx} style={{
                  borderBottom: '1px solid #f1f5f9',
                  background: idx % 2 === 0 ? '#fff' : '#fafafa',
                }}>
                  <td style={{ padding: '5px 8px', textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                  <td style={{ padding: '5px 8px' }}>
                    <div style={{ fontWeight: 600, color: NAVY, lineHeight: 1.3 }}>
                      {item.product?.name ?? `Item #${item.product_id}`}
                    </div>
                    {item.product?.code && (
                      <div style={{ fontSize: '7pt', color: '#94a3b8', marginTop: 1 }}>{item.product.code}</div>
                    )}
                    {item.notes && (
                      <div style={{ fontSize: '7.5pt', color: '#777', marginTop: 1 }}>{item.notes}</div>
                    )}
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                    {item.product?.unit?.toUpperCase() || '—'}
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{fmt(item.quantity, 2)}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>AED {fmt(item.unit_price)}</td>
                  {hasDiscount && (
                    <td style={{ padding: '5px 8px', textAlign: 'right' }}>{fmt(item.discount ?? 0, 1)}%</td>
                  )}
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>
                    AED {fmt(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* ════════════════════════════════════════
              TOTALS
              ════════════════════════════════════════ */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
            <div style={{ width: 240, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px',
                fontSize: '8pt', background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: GREY }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>AED {fmt(subtotal)}</span>
              </div>
              {hasDiscount && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px',
                  fontSize: '8pt', background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: GREY }}>Discount</span>
                  <span style={{ fontWeight: 600, color: '#dc2626' }}>− AED {fmt(discount)}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px',
                  fontSize: '8pt', background: hasDiscount ? '#fafafa' : '#fff',
                  borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: GREY }}>
                    {Number(pq.tax_rate) > 0 ? `VAT (${pq.tax_rate}%)` : 'VAT'}
                  </span>
                  <span style={{ fontWeight: 600 }}>AED {fmt(taxAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between',
                padding: '8px 12px', background: '#6366f1', color: '#fff',
                fontSize: '10pt', fontWeight: 800 }}>
                <span>TOTAL</span>
                <span>AED {fmt(Number(pq.total))}</span>
              </div>
            </div>
          </div>

          {/* Terms / Notes */}
          {(pq.payment_terms || pq.delivery_terms) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
              padding: '6px 12px', background: '#f8fafc', border: `1px solid ${BORDER}`,
              borderRadius: 6, marginBottom: 6 }}>
              {pq.payment_terms && (
                <div>
                  <div style={{ fontSize: '6pt', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '.6px', color: GREY, marginBottom: 1 }}>Payment Terms</div>
                  <div style={{ fontSize: '8.5pt', color: NAVY }}>{pq.payment_terms}</div>
                </div>
              )}
              {pq.delivery_terms && (
                <div>
                  <div style={{ fontSize: '6pt', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '.6px', color: GREY, marginBottom: 1 }}>Delivery Terms</div>
                  <div style={{ fontSize: '8.5pt', color: NAVY }}>{pq.delivery_terms}</div>
                </div>
              )}
            </div>
          )}

          {pq.notes && (
            <div style={{
              background: '#f8fafc', border: `1px solid ${BORDER}`,
              borderLeft: `3px solid ${STEEL}`, borderRadius: '0 4px 4px 0',
              padding: '5px 11px', fontSize: '8pt', color: NAVY,
              margin: '4px 0 6px', lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 700, color: STEEL, marginRight: 4 }}>Notes:</span>{pq.notes}
            </div>
          )}

          {/* ════════════════════════════════════════
              AUTHORIZATION
              ════════════════════════════════════════ */}
          <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid', marginTop: 6 }}>

            <div style={{ fontSize: '8pt', fontWeight: 700, letterSpacing: '.8px',
              textTransform: 'uppercase', color: STEEL, borderBottom: `1.5px solid #6366f1`,
              paddingBottom: 3, marginBottom: 8 }}>Authorization</div>

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
                      <Image src={s.stamp} alt="stamp" width={80} height={80}
                        style={{ objectFit: 'contain', opacity: 0.78, transform: 'rotate(-8deg)' }}
                        unoptimized priority />
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
              <span style={{ whiteSpace: 'nowrap' }}>{co.name} &nbsp;·&nbsp; {co.address}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function PrintLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontFamily: 'Inter,sans-serif', color: '#888' }}>
      Loading…
    </div>
  );
}
function PrintError({ msg }: { msg: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontFamily: 'Inter,sans-serif', color: '#ef4444' }}>
      {msg}
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
