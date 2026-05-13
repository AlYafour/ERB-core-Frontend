'use client';

import { Document, Page, Text, View, StyleSheet, Font, Image, pdf } from '@react-pdf/renderer';
import { PurchaseRequest, PurchaseRequestItem } from '@/types';

// ── Styles ──────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1a1a1a',
    padding: '14mm 14mm 10mm 14mm',
    backgroundColor: '#fff',
  },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  logo: { width: 60, height: 36, objectFit: 'contain' },
  companyBlock: { flex: 1, paddingLeft: 12 },
  companyName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#f97316', marginBottom: 2 },
  companySub: { fontSize: 7.5, color: '#555', lineHeight: 1.5 },
  docBox: { border: '2pt solid #f97316', borderRadius: 4, padding: '8 12', minWidth: 140, alignItems: 'flex-start' },
  docTypeLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#f97316', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 },
  docNumber: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#1a1a1a', marginBottom: 4 },
  docMetaRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 2 },
  docMetaKey: { fontSize: 7.5, color: '#888' },
  docMetaVal: { fontSize: 7.5, color: '#1a1a1a' },
  // Divider
  divider: { height: 2, backgroundColor: '#f97316', marginVertical: 8, borderRadius: 1 },
  // Section title
  sectionTitle: {
    fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#f97316',
    letterSpacing: 1, textTransform: 'uppercase',
    borderBottom: '1pt solid #fed7aa', paddingBottom: 3, marginBottom: 6, marginTop: 10,
  },
  // Info grid
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  infoRow: { flexDirection: 'row', width: '50%', paddingVertical: 2 },
  infoLabel: { fontSize: 8, color: '#777', width: 90 },
  infoValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1a1a1a', flex: 1 },
  // Badge
  badgeApproved: { backgroundColor: '#d1fae5', color: '#065f46', borderRadius: 3, padding: '1 6', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  badgePending:  { backgroundColor: '#fef3c7', color: '#92400e', borderRadius: 3, padding: '1 6', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  badgeRejected: { backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: 3, padding: '1 6', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  badgeDraft:    { backgroundColor: '#f3f4f6', color: '#374151', borderRadius: 3, padding: '1 6', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  // Table
  table: { marginTop: 4, marginBottom: 4 },
  tableHead: { flexDirection: 'row', backgroundColor: '#1a1a1a', padding: '5 6' },
  tableHeadCell: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#fff' },
  tableRow: { flexDirection: 'row', padding: '5 6', borderBottom: '0.5pt solid #e5e7eb' },
  tableRowEven: { backgroundColor: '#f9fafb' },
  tableCell: { fontSize: 8, color: '#1a1a1a' },
  tableCellBold: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1a1a1a' },
  tableCellSub: { fontSize: 7, color: '#888', marginTop: 1 },
  // Notes
  notes: { backgroundColor: '#fff7ed', borderLeft: '3pt solid #f97316', padding: '5 8', marginTop: 6, borderRadius: 2 },
  notesLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#f97316', marginBottom: 2 },
  notesText: { fontSize: 8, color: '#333' },
  // Signatures
  sigRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 8 },
  sigCell: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  sigLine: { borderTop: '1.5pt solid #1a1a1a', width: '80%', marginBottom: 5 },
  sigLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#333' },
  sigName: { fontSize: 7.5, color: '#666', marginTop: 2 },
  // Footer
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 6, borderTop: '0.5pt solid #e5e7eb' },
  footerText: { fontSize: 7, color: '#aaa' },
});

// ── Helpers ──────────────────────────────────────────────────────────
function fmt(n: number | string | null | undefined, decimals = 2) {
  const v = Number(n ?? 0);
  return isNaN(v) ? '0.00' : v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function Badge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  const style = s === 'approved' ? S.badgeApproved : s === 'pending' ? S.badgePending : s === 'rejected' ? S.badgeRejected : S.badgeDraft;
  return <Text style={style}>{status?.toUpperCase()}</Text>;
}

// ── PDF Document ─────────────────────────────────────────────────────
function PRDocument({ pr }: { pr: PurchaseRequest }) {
  const project = typeof pr.project === 'object' && pr.project ? pr.project : null;

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ── HEADER */}
        <View style={S.header}>
          <Image src="/logo.png" style={S.logo} />
          <View style={S.companyBlock}>
            <Text style={S.companyName}>AL YAFOUR CONSTRUCTION L.L.C</Text>
            <Text style={S.companySub}>Abu Dhabi, United Arab Emirates</Text>
            <Text style={S.companySub}>+971 2 000 0000 · info@alyafour.ae</Text>
            <Text style={S.companySub}>TRN: 100123456700003</Text>
          </View>
          <View style={S.docBox}>
            <Text style={S.docTypeLabel}>PURCHASE REQUEST</Text>
            <Text style={S.docNumber}>{pr.code}</Text>
            <View style={S.docMetaRow}>
              <Text style={S.docMetaKey}>Date</Text>
              <Text style={S.docMetaVal}>{fmtDate(pr.request_date)}</Text>
            </View>
            <View style={S.docMetaRow}>
              <Text style={S.docMetaKey}>Status</Text>
              <Badge status={pr.status} />
            </View>
          </View>
        </View>

        <View style={S.divider} />

        {/* ── REQUEST DETAILS */}
        <Text style={S.sectionTitle}>Request Details</Text>
        <View style={S.infoGrid}>
          <View style={S.infoRow}><Text style={S.infoLabel}>Title</Text><Text style={S.infoValue}>{pr.title}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Request Date</Text><Text style={S.infoValue}>{fmtDate(pr.request_date)}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Required By</Text><Text style={S.infoValue}>{fmtDate(pr.required_by)}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Project</Text><Text style={S.infoValue}>{project ? `${project.code} – ${project.name}` : (pr.project_code || '—')}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Requested By</Text><Text style={S.infoValue}>{pr.created_by_name || '—'}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Approved By</Text><Text style={S.infoValue}>{pr.approved_by_name || '—'}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Approved At</Text><Text style={S.infoValue}>{fmtDate(pr.approved_at)}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Status</Text><Badge status={pr.status} /></View>
        </View>

        {/* ── ITEMS */}
        <Text style={S.sectionTitle}>Requested Items</Text>
        <View style={S.table}>
          <View style={S.tableHead}>
            <Text style={[S.tableHeadCell, { width: 20 }]}>#</Text>
            <Text style={[S.tableHeadCell, { flex: 1 }]}>Product / Material</Text>
            <Text style={[S.tableHeadCell, { width: 45, textAlign: 'center' }]}>Unit</Text>
            <Text style={[S.tableHeadCell, { width: 45, textAlign: 'center' }]}>Qty</Text>
            <Text style={[S.tableHeadCell, { width: 80 }]}>Project Site</Text>
            <Text style={[S.tableHeadCell, { width: 90 }]}>Reason / Specs</Text>
          </View>
          {pr.items.map((item: PurchaseRequestItem, idx: number) => (
            <View key={idx} style={[S.tableRow, idx % 2 === 1 ? S.tableRowEven : {}]}>
              <Text style={[S.tableCell, { width: 20, color: '#888' }]}>{idx + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={S.tableCellBold}>{item.product?.name ?? `Product #${item.product_id}`}</Text>
                {item.product?.code && <Text style={S.tableCellSub}>{item.product.code}</Text>}
              </View>
              <Text style={[S.tableCell, { width: 45, textAlign: 'center' }]}>{item.unit || item.product?.unit || '—'}</Text>
              <Text style={[S.tableCellBold, { width: 45, textAlign: 'center' }]}>{fmt(item.quantity, 0)}</Text>
              <Text style={[S.tableCell, { width: 80 }]}>{item.project_site || '—'}</Text>
              <Text style={[S.tableCell, { width: 90, color: '#555' }]}>{item.reason || item.notes || '—'}</Text>
            </View>
          ))}
          {/* Footer row */}
          <View style={[S.tableRow, { borderTop: '1pt solid #e5e7eb', backgroundColor: '#f9fafb' }]}>
            <Text style={[S.tableCell, { width: 20 }]} />
            <Text style={[S.tableCell, { flex: 1 }]} />
            <Text style={[S.tableCell, { width: 45 }]} />
            <Text style={[S.tableCellBold, { width: 45, textAlign: 'center' }]}>{pr.items.length}</Text>
            <Text style={[S.tableCell, { width: 80, color: '#888' }]}>Total items</Text>
            <Text style={[S.tableCell, { width: 90 }]} />
          </View>
        </View>

        {pr.notes ? (
          <View style={S.notes}>
            <Text style={S.notesLabel}>Notes</Text>
            <Text style={S.notesText}>{pr.notes}</Text>
          </View>
        ) : null}

        {/* ── SIGNATURES */}
        <Text style={S.sectionTitle}>Authorization</Text>
        <View style={S.sigRow}>
          {[
            { label: 'Requested By', name: pr.created_by_name },
            { label: 'Reviewed By',  name: '' },
            { label: 'Approved By',  name: pr.approved_by_name || '' },
          ].map((s, i) => (
            <View key={i} style={S.sigCell}>
              <View style={S.sigLine} />
              <Text style={S.sigLabel}>{s.label}</Text>
              {s.name ? <Text style={S.sigName}>{s.name}</Text> : null}
            </View>
          ))}
        </View>

        {/* ── FOOTER */}
        <View style={S.footer}>
          <Text style={S.footerText}>This document is computer-generated and valid without a handwritten signature unless otherwise stated.</Text>
          <Text style={S.footerText}>AL YAFOUR CONSTRUCTION L.L.C · Abu Dhabi, UAE</Text>
        </View>

      </Page>
    </Document>
  );
}

// ── Export function ──────────────────────────────────────────────────
export async function downloadPRPdf(pr: PurchaseRequest) {
  const blob = await pdf(<PRDocument pr={pr} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PR-${pr.code}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
