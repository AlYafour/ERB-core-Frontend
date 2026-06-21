'use client';

import Image from 'next/image';
import { useTenantInfo } from '@/lib/hooks/use-tenant';

/* ─── Company constants (static fallback) ──────────────────────── */
export const COMPANY = {
  name:    'AL YAFOUR GEN. CONT. & TRANSPORT LLC.',
  address: 'Abu Dhabi, United Arab Emirates',
  phone:   '+971 50 622 2469',
  email:   'info@alyafour.ae',
  trn:     '100393252000003',
  logo:    '/logo.png',
};

const NAVY   = '#1a1a2e';
const ORANGE = '#f97316';
const GREY   = '#64748b';
const LIGHT  = '#f8fafc';
const BORDER = '#e2e8f0';

/* ─── Helpers ───────────────────────────────────────────────────── */
export function fmt(n: number | string | null | undefined, decimals = 2) {
  const v = Number(n ?? 0);
  return isNaN(v) ? '0.00' : v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
export function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ─── Status badge ──────────────────────────────────────────────── */
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending:   { bg: '#fffbeb', text: '#b45309', border: '#fcd34d' },
  approved:  { bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
  rejected:  { bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5' },
  draft:     { bg: '#f8fafc', text: '#475569', border: '#cbd5e1' },
  partial:   { bg: '#eff6ff', text: '#1d4ed8', border: '#93c5fd' },
  completed: { bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
  cancelled: { bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5' },
  paid:      { bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
};

export function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status?.toLowerCase()] ?? STATUS_COLORS.draft;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 4,
      fontSize: '7.5pt',
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      backgroundColor: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
    }}>
      {status}
    </span>
  );
}

/* ─── Print template shell ──────────────────────────────────────── */
interface PrintTemplateProps {
  docType:   string;
  docNumber: string;
  date:      string;
  status:    string;
  children:  React.ReactNode;
  footer?:   React.ReactNode;
}

export default function PrintTemplate({ docType, docNumber, date, status, children, footer }: PrintTemplateProps) {
  const { data: tenantData } = useTenantInfo();
  const logoSrc = (tenantData as any)?.branding?.logo_url || COMPANY.logo;

  return (
    <div style={{ padding: '6mm 10mm 5mm', fontFamily: "'Inter','Cairo','Segoe UI',sans-serif", fontSize: '10pt', color: NAVY, lineHeight: 1.45, flex: 1, display: 'flex', flexDirection: 'column' }}>

      {/* ── HEADER ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={{ width: 80, verticalAlign: 'middle' }}>
              <Image
                src={logoSrc}
                alt="Logo"
                width={72}
                height={72}
                style={{ objectFit: 'contain', display: 'block' }}
                priority
                unoptimized
              />
            </td>
            <td style={{ verticalAlign: 'middle', paddingLeft: 14 }}>
              <div style={{ fontSize: '13pt', fontWeight: 800, color: NAVY, letterSpacing: '-.3px', lineHeight: 1.2 }}>{COMPANY.name}</div>
              <div style={{ fontSize: '8pt', color: GREY, marginTop: 2 }}>{COMPANY.address}</div>
              <div style={{ fontSize: '8pt', color: GREY, marginTop: 1 }}>{COMPANY.phone} &nbsp;·&nbsp; {COMPANY.email}</div>
              <div style={{ fontSize: '8pt', color: GREY, marginTop: 1 }}>TRN: {COMPANY.trn}</div>
            </td>
            <td style={{ verticalAlign: 'top', textAlign: 'right', width: 190 }}>
              <div style={{
                background: LIGHT, border: `1px solid ${BORDER}`,
                borderRadius: 8, padding: '10px 14px', display: 'inline-block', textAlign: 'right', minWidth: 165,
              }}>
                <div style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: ORANGE, marginBottom: 3 }}>
                  {docType}
                </div>
                <div style={{ fontSize: '16pt', fontWeight: 800, color: NAVY, lineHeight: 1.1, letterSpacing: '-.5px', marginBottom: 6 }}>
                  {docNumber}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '8.5pt', marginTop: 3 }}>
                  <span style={{ color: GREY, fontWeight: 500, whiteSpace: 'nowrap' }}>Date</span>
                  <span style={{ fontWeight: 600 }}>{fmtDate(date)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '8.5pt', marginTop: 3, alignItems: 'center' }}>
                  <span style={{ color: GREY, fontWeight: 500 }}>Status</span>
                  <StatusBadge status={status} />
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Divider ── */}
      <div style={{ height: 3, background: `linear-gradient(90deg,${ORANGE} 0%,#fb923c 60%,${BORDER} 100%)`, margin: '7px 0 10px', borderRadius: 2 }} />

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>

      {/* ── FOOTER ── */}
      {footer ?? <DefaultFooter />}
    </div>
  );
}

/* ─── Section title ─────────────────────────────────────────────── */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '9pt', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase',
      color: ORANGE, borderBottom: `1.5px solid #fed7aa`, paddingBottom: 4, margin: '16px 0 10px',
    }}>
      {children}
    </div>
  );
}

/* ─── Info grid ─────────────────────────────────────────────────── */
export function InfoGrid({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', marginBottom: 4 }}>
      {rows.map(([label, value], i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'baseline', gap: 0,
          padding: '6px 12px', minHeight: 28,
          background: i % 2 === 0 ? '#fafafa' : '#fff',
          borderBottom: i < rows.length - 1 ? `1px solid #f1f5f9` : 'none',
        }}>
          <span style={{ fontSize: '7.5pt', fontWeight: 600, color: GREY, width: 110, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '.3px' }}>
            {label}
          </span>
          <span style={{ fontSize: '9pt', color: NAVY, fontWeight: 500, flex: 1 }}>
            {value ?? '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Notes box ─────────────────────────────────────────────────── */
export function NotesBox({ label = 'Notes', text }: { label?: string; text?: string | null }) {
  if (!text) return null;
  return (
    <div style={{
      background: '#fffbeb', border: `1px solid #fed7aa`, borderLeft: `3px solid ${ORANGE}`,
      borderRadius: '0 6px 6px 0', padding: '8px 12px',
      fontSize: '9pt', color: '#78350f', margin: '12px 0', lineHeight: 1.55,
    }}>
      <span style={{ fontWeight: 700, color: '#c2410c', marginRight: 4 }}>{label}:</span> {text}
    </div>
  );
}

/* ─── Totals box ────────────────────────────────────────────────── */
export function TotalsBox({ rows, total }: { rows: [string, string][]; total?: [string, string] }) {
  return (
    <div style={{ marginLeft: 'auto', width: 280, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', marginTop: 12 }}>
      {rows.map(([label, value], i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 14px', fontSize: '9pt',
          borderBottom: `1px solid #f1f5f9`,
          background: '#fafafa',
        }}>
          <span style={{ color: GREY, fontWeight: 500 }}>{label}</span>
          <span style={{ fontWeight: 600 }}>{value}</span>
        </div>
      ))}
      {total && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '9px 14px', background: NAVY, color: '#fff', fontSize: '11pt', fontWeight: 800,
        }}>
          <span>{total[0]}</span>
          <span>{total[1]}</span>
        </div>
      )}
    </div>
  );
}

/* ─── Totals wrapper (for invoice/grn pages using className) ─────── */
export function TotalsWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, marginBottom: 4 }}>
      {children}
    </div>
  );
}

/* ─── Amount in words ───────────────────────────────────────────── */
export function AmountInWords({ total, label = 'Amount in Words' }: { total: string; label?: string }) {
  return (
    <div style={{
      background: LIGHT, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${NAVY}`,
      borderRadius: '0 6px 6px 0', padding: '8px 14px',
      fontSize: '9pt', color: NAVY, fontStyle: 'italic', margin: '10px 0', lineHeight: 1.5,
    }}>
      <span style={{ fontStyle: 'normal', fontWeight: 700, fontSize: '7.5pt', textTransform: 'uppercase', letterSpacing: '.5px', color: GREY, marginRight: 8 }}>
        {label}
      </span>
      {total}
    </div>
  );
}

/* ─── Terms grid ────────────────────────────────────────────────── */
export function TermsGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
      margin: '8px 0', padding: '10px 14px',
      background: LIGHT, border: `1px solid ${BORDER}`, borderRadius: 6,
    }}>
      {children}
    </div>
  );
}

export function TermsItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '7.5pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: GREY, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: '9pt', color: NAVY, lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

/* ─── Print table ───────────────────────────────────────────────── */
export function PrintTable({ headers, children, footer }: {
  headers: { label: string; align?: 'left' | 'center' | 'right'; width?: number }[];
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: 4 }}>
      <thead>
        <tr style={{ background: NAVY, color: '#fff' }}>
          {headers.map((h, i) => (
            <th key={i} style={{
              padding: '8px 10px',
              textAlign: h.align ?? 'left',
              fontSize: '7.5pt', fontWeight: 700,
              letterSpacing: '.5px', textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              width: h.width,
            }}>
              {h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
      {footer && <tfoot>{footer}</tfoot>}
    </table>
  );
}

/* ─── Signature row ─────────────────────────────────────────────── */
export function SignatureRow({ signatories }: { signatories: { label: string; name?: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: 0, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
      {signatories.map((s, i) => (
        <div key={i} style={{
          flex: 1, padding: '14px 12px 10px', textAlign: 'center',
          borderRight: i < signatories.length - 1 ? `1px solid ${BORDER}` : 'none',
          background: '#fafafa',
        }}>
          <div style={{ height: 1, background: '#94a3b8', margin: '32px 0 8px' }} />
          <div style={{ fontSize: '7.5pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: GREY }}>{s.label}</div>
          {s.name && <div style={{ fontSize: '9pt', fontWeight: 600, color: NAVY, marginTop: 3 }}>{s.name}</div>}
        </div>
      ))}
    </div>
  );
}

/* ─── Default footer ────────────────────────────────────────────── */
function DefaultFooter() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 10, borderTop: `1px solid ${BORDER}`, fontSize: '7pt', color: '#94a3b8', gap: 16 }}>
      <span>This document is computer-generated and valid without a handwritten signature unless otherwise stated.</span>
      <span>{COMPANY.name} &nbsp;·&nbsp; {COMPANY.address}</span>
    </div>
  );
}
