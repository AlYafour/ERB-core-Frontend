'use client';

import { StatusBadge } from '@/components/print/PrintTemplate';

interface PrintControlsBarProps {
  backHref: string;
  docType: string;
  docTypeColor: string;
  docNumber: string | null | undefined;
  status?: string;
}

const NAVY   = '#1a1a2e';
const BORDER = '#e2e8f0';
const BG     = '#f8fafc';

const PRINT_SVG = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9"/>
    <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
    <rect x="6" y="14" width="12" height="8"/>
  </svg>
);

const DOWNLOAD_SVG = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const BACK_SVG = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M5 12l7-7M5 12l7 7"/>
  </svg>
);

export function PrintControlsBar({ backHref, docType, docTypeColor, docNumber, status }: PrintControlsBarProps) {
  return (
    <div
      className="print-controls-bar"
      style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 16px', gap: 8,
        background: '#fff', borderBottom: `1px solid ${BORDER}`,
        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
        minHeight: 42,
      }}
    >
      {/* Left: back + chip + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <a
          href={backHref}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 6,
            border: `1px solid ${BORDER}`, background: BG,
            color: '#374151', fontSize: 11, fontWeight: 600, textDecoration: 'none',
          }}
        >
          {BACK_SVG} Back
        </a>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 8px 2px 7px', borderRadius: 5,
          background: BG, border: `1px solid ${BORDER}`,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: docTypeColor }}>
            {docType}
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, color: NAVY, letterSpacing: '-0.3px' }}>
            {docNumber}
          </span>
        </div>

        {status && <StatusBadge status={status} />}
      </div>

      {/* Right: print + download */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          onClick={() => window.print()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '5px 12px', borderRadius: 6,
            border: `1px solid ${BORDER}`, background: BG,
            color: '#374151', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {PRINT_SVG} Print
        </button>
        <button
          onClick={() => window.print()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 14px', borderRadius: 6,
            background: NAVY, color: '#fff',
            border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            letterSpacing: '.2px',
          }}
        >
          {DOWNLOAD_SVG} Download PDF
        </button>
      </div>
    </div>
  );
}
