'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { purchaseRequestsApi } from '@/lib/api/purchase-requests';
import { PurchaseRequest, PurchaseRequestItem } from '@/types';
import PrintTemplate, {
  SectionTitle, InfoGrid, SignatureRow, NotesBox, StatusBadge,
  COMPANY, fmt, fmtDate,
} from '@/components/print/PrintTemplate';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { usePermissions } from '@/lib/hooks/use-permissions';

const NAVY   = '#1a1a2e';
const GREY   = '#64748b';

export default function PrintPRPage() {
  const { id } = useParams<{ id: string }>();
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => { setHasToken(!!localStorage.getItem('access_token')); }, []);

  const { hasPermission, isLoading: permsLoading } = usePermissions();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;
  const canView = isAdmin || (hasPermission('purchase_request', 'view') ?? false);

  const { data: pr, isLoading, isError } = useQuery<PurchaseRequest>({
    queryKey: ['purchase-request', id],
    queryFn: () => purchaseRequestsApi.getById(Number(id)),
    enabled: hasToken && canView,
    retry: 1,
  });

  if (!hasToken || isLoading || permsLoading) return <PrintLoader />;
  if (!canView) return <PrintPermissionDenied />;
  if (isError || !pr) return <PrintError msg="Purchase request not found. Please make sure you are logged in." />;

  const project = typeof pr.project === 'object' && pr.project ? pr.project : null;

  return (
    <div className="print-page-bg" style={{ minHeight: '100vh', background: '#e8ecf0', fontFamily: "'Inter','Cairo','Segoe UI',sans-serif", fontSize: '12px' }}>

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
        }
      `}</style>

      {/* ── Controls (hidden on print) ── */}
      <div className="print-controls-bar" style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', rowGap: 6,
        padding: '8px 20px',
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 1px 6px rgba(0,0,0,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', rowGap: 4 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 10px 3px 8px', borderRadius: 6,
            background: '#f8fafc', border: '1px solid #e2e8f0',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#f97316' }}>PR</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: NAVY, letterSpacing: '-0.3px' }}>{pr.code}</span>
          </div>
          <StatusBadge status={pr.status} />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => window.print()} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 6,
            background: NAVY, color: '#fff',
            border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            letterSpacing: '0.01em',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print / PDF
          </button>
          <button onClick={() => window.close()} style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '6px 10px', borderRadius: 6,
            background: 'transparent', color: '#94a3b8',
            border: '1px solid #e2e8f0', fontSize: 12, cursor: 'pointer',
          }}>✕</button>
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
          docType="PURCHASE REQUEST"
          docNumber={pr.code}
          date={pr.request_date}
          status={pr.status}
        >
          {/* ── Request Info ── */}
          <SectionTitle>Request Details</SectionTitle>
          <InfoGrid rows={[
            ['Title',        pr.title],
            ['Request Date', fmtDate(pr.request_date)],
            ['Required By',  fmtDate(pr.required_by)],
            ['Project',      project ? `${project.code} – ${project.name}` : (pr.project_code || '—')],
            ['Requested By', pr.created_by_name],
            ['Approved By',  pr.approved_by_name || '—'],
            ['Approved At',  fmtDate(pr.approved_at)],
            ['Status',       <StatusBadge key="s" status={pr.status} />],
          ]} />

          {pr.rejection_reason && (
            <NotesBox label="Rejection Reason" text={pr.rejection_reason} />
          )}

          {/* ── Items ── */}
          <SectionTitle>Requested Items</SectionTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: 4 }}>
            <thead>
              <tr style={{ background: NAVY, color: '#fff' }}>
                {[
                  { label: '#',               align: 'center', width: 30  },
                  { label: 'Product / Material',                          },
                  { label: 'Unit',            align: 'center', width: 55  },
                  { label: 'Qty',             align: 'center', width: 60  },
                  { label: 'Project Site',                     width: 110 },
                  { label: 'Reason / Specs'                               },
                ].map((h, i) => (
                  <th key={i} style={{ padding: '8px 10px', textAlign: (h.align as any) ?? 'left', fontSize: '7.5pt', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', width: h.width }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pr.items.map((item: PurchaseRequestItem, idx: number) => (
                <tr key={item.id ?? idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '7px 10px', textAlign: 'center', color: '#888' }}>{idx + 1}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <div style={{ fontWeight: 600, color: NAVY, lineHeight: 1.3 }}>{item.product?.name ?? `Product #${item.product_id}`}</div>
                    {item.product?.code && <div style={{ fontSize: '7.5pt', color: '#94a3b8', marginTop: 1 }}>{item.product.code}</div>}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>{item.unit || item.product?.unit || '—'}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600 }}>{fmt(item.quantity, 0)}</td>
                  <td style={{ padding: '7px 10px' }}>{item.project_site || '—'}</td>
                  <td style={{ padding: '7px 10px', fontSize: '8.5pt', color: '#555' }}>{item.reason || item.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                <td colSpan={3} style={{ padding: '7px 10px' }} />
                <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700, fontSize: '8.5pt', color: GREY }}>{pr.items.length}</td>
                <td colSpan={2} style={{ padding: '7px 10px', color: '#888', fontSize: '8.5pt' }}>Total items</td>
              </tr>
            </tfoot>
          </table>

          <NotesBox text={pr.notes} />

          <div style={{ flex: 1 }} />

          {/* ── Signatures ── */}
          <SectionTitle>Authorization</SectionTitle>
          <SignatureRow signatories={[
            { label: 'Requested By', name: pr.created_by_name },
            { label: 'Reviewed By',  name: '' },
            { label: 'Approved By',  name: pr.approved_by_name || '' },
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
