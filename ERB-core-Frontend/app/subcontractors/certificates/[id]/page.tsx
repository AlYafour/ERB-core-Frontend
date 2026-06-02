'use client';

import React, { use, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subcontractorsApi } from '@/lib/api/subcontractors';
import { Button, Badge, PageHeader, PageShell } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { CERTIFICATE_STATUS } from '@/lib/utils/status-colors';

type Tab = 'info' | 'items' | 'attachments';
const CERT_TABS: Tab[] = ['info', 'items', 'attachments'];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review',
  reviewed: 'Reviewed', approved: 'Approved', gm_approved: 'GM Approved',
  rejected: 'Rejected', paid: 'Paid', cancelled: 'Cancelled',
};

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', paddingBlock: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ width: 200, flexShrink: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function TabBtn({ label, active, onClick, badge }: { label: string; active: boolean; onClick: () => void; badge?: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '8px 16px', fontSize: 'var(--text-sm)',
      fontWeight: active ? 600 : 500,
      color: active ? 'var(--brand)' : 'var(--text-secondary)',
      background: 'none', border: 'none',
      borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent',
      cursor: 'pointer', transition: 'color 120ms, border-color 120ms',
    }}>
      {label}
      {badge && (
        <span style={{ background: 'var(--brand)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 6px' }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function AmountRow({ label, value, highlight, warn }: { label: string; value: string | number; highlight?: boolean; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBlock: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{
        fontFamily: 'monospace',
        fontWeight: highlight ? 700 : 500,
        color: warn ? 'var(--status-error)' : highlight ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}>
        AED {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
}

function RejectModal({
  open, onClose, onConfirm, isPending,
}: { open: boolean; onClose: () => void; onConfirm: (reason: string) => void; isPending: boolean }) {
  const [reason, setReason] = useState('');
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="card" style={{ width: 440, padding: 24 }}>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 12 }}>Rejection Reason</div>
        <textarea
          autoFocus
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={4}
          placeholder="Enter the reason for rejection..."
          style={{ width: '100%', resize: 'vertical', borderRadius: 6, border: '1px solid var(--border-default)', padding: '8px 10px', fontSize: 'var(--text-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary" size="sm"
            disabled={!reason.trim() || isPending}
            onClick={() => onConfirm(reason.trim())}
            style={{ background: 'var(--status-error)', borderColor: 'var(--status-error)' }}
          >
            {isPending ? 'Rejecting...' : 'Reject'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: 90, textAlign: 'right', fontFamily: 'monospace',
  border: '1px solid var(--brand)', borderRadius: 4,
  padding: '3px 6px', fontSize: 'var(--text-sm)',
  background: 'var(--bg-input)', color: 'var(--text-primary)',
};

export default function CertificateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const numericId = Number(id);
  const [tab, setTabState] = useState<Tab>('info');
  useEffect(() => {
    const h = window.location.hash.replace('#', '') as Tab;
    if (CERT_TABS.includes(h)) setTabState(h);
  }, []);
  const setTab = (t: Tab) => { setTabState(t); history.replaceState(null, '', `#${t}`); };

  const [rejectOpen, setRejectOpen] = useState(false);

  // Per-item quantity states (keyed by certificate item id)
  const [engineerQtys,       setEngineerQtys]       = useState<Record<number, string>>({});
  const [claimedQtys,        setClaimedQtys]         = useState<Record<number, string>>({});
  const [managerApprovedQtys,setManagerApprovedQtys] = useState<Record<number, string>>({});

  // Per-location engineer qty for breakdown items: { certItemId: { location: qty } }
  const [breakdownEngQty, setBreakdownEngQty] = useState<Record<number, Record<string, string>>>({});

  const [qtysInitialized, setQtysInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient  = useQueryClient();

  const { data: cert, isLoading, error } = useQuery({
    queryKey: ['subcon-cert', id],
    queryFn: () => subcontractorsApi.certificates.getOne(numericId),
    enabled: !isNaN(numericId) && numericId > 0,
  });

  const { data: items } = useQuery({
    queryKey: ['cert-items', id],
    queryFn: () => subcontractorsApi.certificates.getItems(numericId),
    enabled: (tab === 'items' || ['draft','submitted','reviewed'].includes(cert?.status ?? '')) && !isNaN(numericId) && numericId > 0,
  });

  const hasCertItems = (items?.length ?? 0) > 0;

  const { data: fallbackBoqItems } = useQuery({
    queryKey: ['cert-boq-fallback', cert?.contract],
    queryFn: () => subcontractorsApi.boqItems.list(cert!.contract as number),
    enabled: ['draft','submitted','reviewed'].includes(cert?.status ?? '') && items !== undefined && !hasCertItems && !!cert?.contract,
  });

  const { data: attachments } = useQuery({
    queryKey: ['cert-attachments', id],
    queryFn: () => subcontractorsApi.attachments.listForCertificate(numericId),
    enabled: tab === 'attachments' && !isNaN(numericId) && numericId > 0,
  });

  useEffect(() => {
    if (qtysInitialized) return;
    if (items && items.length > 0) {
      const eng: Record<number, string>     = {};
      const claimed: Record<number, string> = {};
      const mgr: Record<number, string>     = {};
      const brkEng: Record<number, Record<string, string>> = {};
      items.forEach(item => {
        eng[item.id]     = String(item.engineer_approved_quantity);
        claimed[item.id] = String(item.contractor_claimed_quantity);
        mgr[item.id]     = String(item.engineer_approved_quantity);
        if (item.breakdowns && item.breakdowns.length > 0) {
          brkEng[item.id] = {};
          item.breakdowns.forEach(bd => {
            brkEng[item.id][bd.location] = String(bd.engineer_quantity);
          });
        }
      });
      setEngineerQtys(eng);
      setClaimedQtys(claimed);
      setManagerApprovedQtys(mgr);
      setBreakdownEngQty(brkEng);
      setQtysInitialized(true);
    } else if (fallbackBoqItems && fallbackBoqItems.length > 0) {
      const eng: Record<number, string>     = {};
      const claimed: Record<number, string> = {};
      const mgr: Record<number, string>     = {};
      fallbackBoqItems.forEach(item => { eng[item.id] = '0'; claimed[item.id] = '0'; mgr[item.id] = '0'; });
      setEngineerQtys(eng);
      setClaimedQtys(claimed);
      setManagerApprovedQtys(mgr);
      setQtysInitialized(true);
    }
  }, [items, fallbackBoqItems, qtysInitialized]);

  const invalidateCert  = () => queryClient.invalidateQueries({ queryKey: ['subcon-cert', id] });
  const invalidateItems = () => queryClient.invalidateQueries({ queryKey: ['cert-items', id] });

  const isDraft      = cert?.status === 'draft';
  const isSubmitted  = cert?.status === 'submitted';
  const isReviewed   = cert?.status === 'reviewed';
  const isApproved   = cert?.status === 'approved';
  const isGmApproved = cert?.status === 'gm_approved';
  const canEditItems = isDraft || isSubmitted || isReviewed;
  const canApprove   = isReviewed;

  // Build items payload to send to bulk_save
  const buildItemsPayload = () => {
    if (hasCertItems) {
      return (items ?? []).map(item => {
        const hasBreakdowns = (item.breakdowns?.length ?? 0) > 0;

        if (isDraft) {
          // Draft: site engineer can edit claimed qty for non-breakdown items only
          if (hasBreakdowns) {
            return {
              boq_item: item.boq_item,
              contractor_claimed_quantity: item.contractor_claimed_quantity,
              engineer_approved_quantity: '0',
              // No breakdowns key → backend preserves existing breakdown records
            };
          }
          return {
            boq_item: item.boq_item,
            contractor_claimed_quantity: claimedQtys[item.id] ?? item.contractor_claimed_quantity,
            engineer_approved_quantity: '0',
          };
        }

        if (isSubmitted) {
          // Submitted: office engineer enters approved qty per location (or per item)
          if (hasBreakdowns) {
            const bds = item.breakdowns!.map(bd => ({
              location: bd.location,
              contractor_quantity: bd.contractor_quantity,
              engineer_quantity: (breakdownEngQty[item.id] ?? {})[bd.location] ?? String(bd.engineer_quantity),
            }));
            const engTotal = bds.reduce((s, bd) => s + (parseFloat(bd.engineer_quantity) || 0), 0);
            return {
              boq_item: item.boq_item,
              contractor_claimed_quantity: item.contractor_claimed_quantity,
              engineer_approved_quantity: String(engTotal),
              breakdowns: bds,
            };
          }
          return {
            boq_item: item.boq_item,
            contractor_claimed_quantity: item.contractor_claimed_quantity,
            engineer_approved_quantity: engineerQtys[item.id] ?? item.engineer_approved_quantity ?? '0',
          };
        }

        if (isReviewed) {
          // Reviewed: manager approves a total per item (no per-location changes)
          return {
            boq_item: item.boq_item,
            contractor_claimed_quantity: item.contractor_claimed_quantity,
            engineer_approved_quantity: managerApprovedQtys[item.id] ?? item.engineer_approved_quantity ?? '0',
          };
        }

        return {
          boq_item: item.boq_item,
          contractor_claimed_quantity: item.contractor_claimed_quantity,
          engineer_approved_quantity: item.engineer_approved_quantity,
        };
      });
    }

    // Fallback: building items fresh from BOQ (no saved cert items yet)
    return (fallbackBoqItems ?? []).map(item => ({
      boq_item: item.id,
      contractor_claimed_quantity: claimedQtys[item.id] ?? '0',
      engineer_approved_quantity: engineerQtys[item.id] ?? '0',
    }));
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = buildItemsPayload();
      if (payload.length > 0) {
        await subcontractorsApi.certificates.saveItems(numericId, payload);
      }
      return subcontractorsApi.certificates.submit(numericId);
    },
    onSuccess: () => { invalidateCert(); invalidateItems(); setQtysInitialized(false); toast('Submitted for review', 'success'); },
    onError: (err) => toast(getApiError(err, 'Failed to submit'), 'error'),
  });

  const saveItemsMutation = useMutation({
    mutationFn: () => subcontractorsApi.certificates.saveItems(numericId, buildItemsPayload()),
    onSuccess: () => { invalidateItems(); setQtysInitialized(false); toast('Measurements saved', 'success'); },
    onError: (err) => toast(getApiError(err, 'Failed to save measurements'), 'error'),
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const payload = buildItemsPayload();
      if (payload.length > 0) {
        await subcontractorsApi.certificates.saveItems(numericId, payload);
      }
      return subcontractorsApi.certificates.review(numericId, {});
    },
    onSuccess: () => {
      invalidateCert(); invalidateItems(); setQtysInitialized(false);
      toast('Certificate marked as reviewed', 'success');
    },
    onError: (err) => toast(getApiError(err, 'Failed to mark reviewed'), 'error'),
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildItemsPayload();
      if (payload.length > 0) {
        await subcontractorsApi.certificates.saveItems(numericId, payload);
      }
      return subcontractorsApi.certificates.approve(numericId, {});
    },
    onSuccess: () => { invalidateCert(); invalidateItems(); toast('Certificate approved by manager', 'success'); },
    onError: (err) => toast(getApiError(err, 'Failed to approve'), 'error'),
  });

  const gmApproveMutation = useMutation({
    mutationFn: () => subcontractorsApi.certificates.gmApprove(numericId),
    onSuccess: () => { invalidateCert(); toast('GM approval confirmed — ready for payment', 'success'); },
    onError: (err) => toast(getApiError(err, 'Failed to approve'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => subcontractorsApi.certificates.reject(numericId, { reason }),
    onSuccess: () => { invalidateCert(); setRejectOpen(false); toast('Certificate rejected', 'info'); },
    onError: () => toast('Failed to reject', 'error'),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('certificate', String(numericId));
      fd.append('document_type', 'general');
      return subcontractorsApi.attachments.upload(fd);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cert-attachments', id] }); toast('File uploaded', 'success'); },
    onError: () => toast('Upload failed', 'error'),
  });

  if (isNaN(numericId) || numericId <= 0) return (
    <MainLayout><PageShell><div className="card empty-state"><p style={{ color: 'var(--status-error)' }}>Invalid certificate ID.</p></div></PageShell></MainLayout>
  );
  if (isLoading) return (
    <MainLayout><PageShell><div className="card empty-state"><p>Loading...</p></div></PageShell></MainLayout>
  );
  if (error || !cert) return (
    <MainLayout><PageShell><div className="card empty-state"><p style={{ color: 'var(--status-error)' }}>Certificate not found.</p></div></PageShell></MainLayout>
  );

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={`IPC ${cert.certificate_no}`}
          breadcrumbs={[
            { label: 'Subcontractors', href: '/subcontractors' },
            { label: 'Certificates', href: '/subcontractors/certificates' },
            { label: cert.certificate_no },
          ]}
          actions={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {isDraft && (
                <Button variant="primary" size="sm" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                  {submitMutation.isPending ? 'Submitting...' : 'Submit for Review'}
                </Button>
              )}
              {canEditItems && (
                <Button variant="secondary" size="sm" onClick={() => setTab('items')}>
                  {isDraft ? 'Edit Measurements →' : 'Enter Measurements →'}
                </Button>
              )}
              {canApprove && (
                <>
                  <Button variant="primary" size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                    {approveMutation.isPending ? 'Approving...' : 'Approve'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setRejectOpen(true)}>
                    Reject
                  </Button>
                </>
              )}
              {isApproved && (
                <Button variant="primary" size="sm" onClick={() => gmApproveMutation.mutate()} disabled={gmApproveMutation.isPending}>
                  {gmApproveMutation.isPending ? 'Approving...' : 'GM Approve'}
                </Button>
              )}
              {isGmApproved && (
                <Link href={`/subcontractors/payments/new?certificate=${id}&contract=${cert.contract}&amount=${cert.net_payable_amount}`}>
                  <Button variant="primary" size="sm">Create Payment</Button>
                </Link>
              )}
            </div>
          }
        />

        <RejectModal
          open={rejectOpen}
          onClose={() => setRejectOpen(false)}
          onConfirm={reason => rejectMutation.mutate(reason)}
          isPending={rejectMutation.isPending}
        />

        {/* Financial summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
          <div className="card">
            <div className="info-section-title">Certificate Summary</div>
            <AmountRow label="Gross Claimed"       value={cert.gross_claimed_amount} />
            <AmountRow label="Gross Approved"      value={cert.gross_approved_amount} />
            <AmountRow label="Previously Certified" value={cert.previous_approved_amount} />
          </div>
          <div className="card">
            <div className="info-section-title">Payment Breakdown</div>
            <AmountRow label="Gross Approved"      value={cert.gross_approved_amount} />
            <AmountRow label="Retention (−)"       value={cert.retention_amount} warn={Number(cert.retention_amount) > 0} />
            <AmountRow label="Advance Recovery (−)" value={cert.advance_deduction} warn={Number(cert.advance_deduction) > 0} />
            {Number(cert.other_deductions) > 0 && (
              <AmountRow label="Other Deductions (−)" value={cert.other_deductions} warn />
            )}
            <AmountRow label="Net Payable" value={cert.net_payable_amount} highlight />
          </div>
        </div>

        {/* Status bar */}
        <div className="card" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <Badge variant={CERTIFICATE_STATUS[cert.status] ?? 'default'}>
            {STATUS_LABEL[cert.status]}
          </Badge>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {cert.certificate_date}
            {cert.period_from && cert.period_to && (
              <span style={{ marginLeft: 12 }}>Period: {cert.period_from} → {cert.period_to}</span>
            )}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            {cert.subcontractor_name} · {cert.contract_no}
          </span>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid var(--border-default)', marginBottom: 'var(--space-4)', display: 'flex', gap: 0 }}>
          <TabBtn label="General Info"  active={tab === 'info'}        onClick={() => setTab('info')} />
          <TabBtn label="Measurements"  active={tab === 'items'}       onClick={() => setTab('items')}
            badge={(isSubmitted || isReviewed) ? '!' : undefined} />
          <TabBtn label="Attachments"   active={tab === 'attachments'} onClick={() => setTab('attachments')} />
        </div>

        {/* ── Tab: General Info ── */}
        {tab === 'info' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
            <div className="card">
              <div className="info-section-title">Certificate Details</div>
              <InfoRow label="Certificate No." value={cert.certificate_no} />
              <InfoRow label="Contract"        value={cert.contract_no} />
              <InfoRow label="Subcontractor"   value={cert.subcontractor_name} />
              <InfoRow label="Project"         value={cert.project_name} />
              <InfoRow label="Date"            value={cert.certificate_date} />
              <InfoRow label="Period From"     value={cert.period_from} />
              <InfoRow label="Period To"       value={cert.period_to} />
              {cert.lump_sum_claimed_pct != null && (
                <InfoRow label="Claimed %" value={`${cert.lump_sum_claimed_pct}%`} />
              )}
              {cert.lump_sum_approved_pct != null && (
                <InfoRow label="Approved %" value={`${cert.lump_sum_approved_pct}%`} />
              )}
              {cert.notes && <InfoRow label="Notes" value={cert.notes} />}
            </div>
            <div className="card">
              <div className="info-section-title">Workflow</div>
              <InfoRow label="Status"          value={STATUS_LABEL[cert.status]} />
              <InfoRow label="Submitted By"    value={cert.submitted_by_name} />
              <InfoRow label="Reviewed By"     value={cert.reviewed_by_name} />
              <InfoRow label="Review Date"     value={cert.review_date} />
              {cert.review_notes && <InfoRow label="Review Notes" value={cert.review_notes} />}
              <InfoRow label="Approved By"     value={cert.approved_by_name} />
              <InfoRow label="Approval Date"   value={cert.approval_date} />
              {cert.rejection_reason && (
                <InfoRow label="Rejection Reason" value={cert.rejection_reason} />
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Measurements ── */}
        {tab === 'items' && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="info-section-title" style={{ marginBottom: 0 }}>Measurement Items</div>
              {canEditItems && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="secondary" size="sm"
                    onClick={() => saveItemsMutation.mutate()}
                    disabled={saveItemsMutation.isPending || reviewMutation.isPending}>
                    {saveItemsMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                  {isSubmitted && (
                    <Button variant="primary" size="sm"
                      onClick={() => reviewMutation.mutate()}
                      disabled={reviewMutation.isPending || saveItemsMutation.isPending}>
                      {reviewMutation.isPending ? 'Submitting...' : 'Submit Engineer Review'}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {isDraft && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(245,158,11,0.08)', borderRadius: 6, border: '1px solid rgba(245,158,11,0.3)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Edit claimed quantities, then <strong>Save</strong>. Submit for review when ready.
              </div>
            )}

            {isSubmitted && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ padding: '8px 12px', background: 'rgba(59,130,246,0.08)', borderRadius: 6, border: '1px solid rgba(59,130,246,0.2)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Enter engineer-approved quantities per location, then click <strong>Submit Engineer Review</strong>.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>Quick fill Eng Qty:</span>
                  <Button variant="secondary" size="sm" onClick={() => {
                    const eng: Record<number, string> = {};
                    const brkEng: Record<number, Record<string, string>> = {};
                    (items ?? []).forEach(item => {
                      eng[item.id] = String(item.contractor_claimed_quantity);
                      if (item.breakdowns && item.breakdowns.length > 0) {
                        brkEng[item.id] = {};
                        item.breakdowns.forEach(bd => {
                          brkEng[item.id][bd.location] = String(bd.contractor_quantity);
                        });
                      }
                    });
                    setEngineerQtys(eng);
                    setBreakdownEngQty(brkEng);
                  }}>
                    ← Accept Site Qty (الموقع)
                  </Button>
                </div>
              </div>
            )}

            {isReviewed && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', borderRadius: 6, border: '1px solid rgba(245,158,11,0.3)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Choose which quantities to approve, then click <strong>Approve</strong> in the header — quantities are saved automatically.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>Quick fill Approved Qty:</span>
                  <Button variant="secondary" size="sm" onClick={() => {
                    const qtys: Record<number, string> = {};
                    items?.forEach(item => { qtys[item.id] = String(item.contractor_claimed_quantity); });
                    setManagerApprovedQtys(qtys);
                  }}>← Site Qty (الموقع)</Button>
                  <Button variant="secondary" size="sm" onClick={() => {
                    const qtys: Record<number, string> = {};
                    items?.forEach(item => { qtys[item.id] = String(item.engineer_approved_quantity); });
                    setManagerApprovedQtys(qtys);
                  }}>← Eng Qty (الهندسي)</Button>
                </div>
              </div>
            )}

            {/* ── Fallback: no saved items, show BOQ items ── */}
            {!hasCertItems && canEditItems && fallbackBoqItems && fallbackBoqItems.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Unit</th>
                      <th style={{ textAlign: 'right' }}>Rate (AED)</th>
                      <th style={{ textAlign: 'right', color: 'var(--brand)' }}>{isDraft ? 'Claimed ✎' : 'Approved ✎'}</th>
                      <th style={{ textAlign: 'right' }}>Amount (AED)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fallbackBoqItems.map(boqItem => {
                      const qtyMap    = isDraft ? claimedQtys : engineerQtys;
                      const setQtyMap = isDraft ? setClaimedQtys : setEngineerQtys;
                      const qty    = Number(qtyMap[boqItem.id] ?? '0');
                      const amount = qty * Number(boqItem.unit_rate);
                      return (
                        <tr key={boqItem.id} style={{ verticalAlign: 'middle' }}>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{boqItem.item_name}</div>
                            {boqItem.item_code && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{boqItem.item_code}</div>}
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{boqItem.unit || '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{Number(boqItem.unit_rate).toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number" min="0" step="any"
                              value={qtyMap[boqItem.id] ?? '0'}
                              onChange={e => setQtyMap(prev => ({ ...prev, [boqItem.id]: e.target.value }))}
                              style={inputStyle}
                            />
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: amount > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                            {amount > 0 ? amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600, padding: '8px 12px' }}>Total</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, padding: '8px 12px' }}>
                        AED {fallbackBoqItems.reduce((sum, item) => {
                          const qtyMap = isDraft ? claimedQtys : engineerQtys;
                          return sum + Number(qtyMap[item.id] ?? 0) * Number(item.unit_rate);
                        }, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

            ) : !hasCertItems ? (
              <div className="empty-state"><p>No measurement items.</p></div>

            ) : (
              /* ── Main measurements table ── */
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Unit</th>
                      <th style={{ textAlign: 'right' }}>BOQ Qty</th>
                      <th style={{ textAlign: 'right' }}>Rate (AED)</th>
                      <th style={{ textAlign: 'right' }}>Previous</th>
                      <th style={{ textAlign: 'right', color: isDraft ? 'var(--brand)' : undefined }}>
                        Site Qty{isDraft ? ' ✎' : ''}
                      </th>
                      <th style={{ textAlign: 'right', color: isSubmitted ? 'var(--brand)' : undefined }}>
                        Eng Qty{isSubmitted ? ' ✎' : ''}
                      </th>
                      <th style={{ textAlign: 'right', color: isReviewed ? 'var(--brand)' : undefined }}>
                        {isReviewed ? 'Approved ✎' : 'Approved'}
                      </th>
                      <th style={{ textAlign: 'right' }}>Variation</th>
                      <th style={{ textAlign: 'right' }}>Value (AED)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(items ?? []).map(item => {
                      const hasBreakdowns = (item.breakdowns?.length ?? 0) > 0;

                      /* ── Items WITH per-location breakdowns ── */
                      if (hasBreakdowns) {
                        const siteTotal = item.breakdowns!.reduce((s, bd) => s + Number(bd.contractor_quantity), 0);
                        const liveEngTotal = isSubmitted
                          ? item.breakdowns!.reduce((s, bd) => {
                              const v = (breakdownEngQty[item.id] ?? {})[bd.location] ?? String(bd.engineer_quantity);
                              return s + (parseFloat(v) || 0);
                            }, 0)
                          : Number(item.engineer_approved_quantity);
                        const approvedQty = isReviewed
                          ? Number(managerApprovedQtys[item.id] ?? item.engineer_approved_quantity ?? '0')
                          : Number(item.engineer_approved_quantity);
                        const variation = siteTotal - (isReviewed ? approvedQty : liveEngTotal);
                        const value = isReviewed
                          ? approvedQty * Number(item.unit_rate)
                          : liveEngTotal * Number(item.unit_rate);

                        return (
                          <React.Fragment key={item.id}>
                            {/* Header row for this item */}
                            <tr style={{ background: 'var(--surface-secondary)', borderTop: '2px solid var(--border-subtle)' }}>
                              <td style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                                {item.item_name}
                                <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 6 }}>
                                  (per location)
                                </span>
                              </td>
                              <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.unit}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
                                {Number(item.contract_quantity) > 0 ? Number(item.contract_quantity).toLocaleString() : '—'}
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                {Number(item.unit_rate).toLocaleString()}
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
                                {Number(item.previous_approved_quantity) > 0 ? Number(item.previous_approved_quantity).toLocaleString() : '—'}
                              </td>
                              {/* Site total */}
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                                {siteTotal.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                              </td>
                              {/* Eng total (live sum of per-location inputs when isSubmitted) */}
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: isSubmitted ? 'var(--brand)' : undefined }}>
                                {liveEngTotal.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                              </td>
                              {/* Approved — editable by manager in isReviewed */}
                              <td style={{ textAlign: 'right' }}>
                                {isReviewed ? (
                                  <input
                                    type="number" min="0" step="any"
                                    value={managerApprovedQtys[item.id] ?? '0'}
                                    onChange={e => setManagerApprovedQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                                    style={inputStyle}
                                  />
                                ) : (
                                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: isApproved || isGmApproved ? 'var(--status-success)' : undefined }}>
                                    {approvedQty.toLocaleString()}
                                  </span>
                                )}
                              </td>
                              {/* Variation */}
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 500,
                                color: variation > 0 ? 'var(--status-warning)' : variation < 0 ? 'var(--status-error)' : 'var(--text-tertiary)',
                              }}>
                                {variation !== 0
                                  ? (variation > 0 ? '+' : '') + variation.toLocaleString(undefined, { maximumFractionDigits: 3 })
                                  : '—'}
                              </td>
                              {/* Value */}
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>
                                {value > 0 ? value.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                              </td>
                            </tr>

                            {/* Per-location sub-rows */}
                            {item.breakdowns!.map((bd, bi) => {
                              const isLast = bi === item.breakdowns!.length - 1;
                              const borderStyle = isLast ? '2px solid var(--border-subtle)' : '1px solid var(--border-subtle)';
                              const locEngVal = (breakdownEngQty[item.id] ?? {})[bd.location] ?? String(bd.engineer_quantity);
                              return (
                                <tr key={`${item.id}-bd-${bi}`}>
                                  {/* Location label spanning 5 columns */}
                                  <td colSpan={5} style={{
                                    paddingLeft: 28, paddingTop: 5, paddingBottom: 5,
                                    fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
                                    borderBottom: borderStyle,
                                  }}>
                                    <span style={{ color: 'var(--text-tertiary)', marginRight: 6, fontSize: 11 }}>↳</span>
                                    {bd.location}
                                  </td>
                                  {/* Contractor qty — read-only */}
                                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', borderBottom: borderStyle }}>
                                    {Number(bd.contractor_quantity).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                  </td>
                                  {/* Engineer qty — editable when isSubmitted */}
                                  <td style={{ textAlign: 'right', borderBottom: borderStyle }}>
                                    {isSubmitted ? (
                                      <input
                                        type="number" min="0" step="any"
                                        value={locEngVal}
                                        onChange={e => setBreakdownEngQty(prev => ({
                                          ...prev,
                                          [item.id]: { ...(prev[item.id] ?? {}), [bd.location]: e.target.value },
                                        }))}
                                        style={{ ...inputStyle, width: 80 }}
                                      />
                                    ) : (
                                      <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                                        {Number(bd.engineer_quantity).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                      </span>
                                    )}
                                  </td>
                                  {/* Approved / Variation / Value — empty in sub-rows */}
                                  <td colSpan={3} style={{ borderBottom: borderStyle }} />
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      }

                      /* ── Items WITHOUT breakdowns — single row ── */
                      const siteQty = isDraft
                        ? Number(claimedQtys[item.id] ?? item.contractor_claimed_quantity)
                        : Number(item.contractor_claimed_quantity);
                      const engQty = isSubmitted
                        ? Number(engineerQtys[item.id] ?? '0')
                        : Number(item.engineer_approved_quantity);
                      const approvedQty = isReviewed
                        ? Number(managerApprovedQtys[item.id] ?? item.engineer_approved_quantity ?? '0')
                        : Number(item.engineer_approved_quantity);
                      const variation = siteQty - (isReviewed ? approvedQty : engQty);
                      const value = isDraft
                        ? siteQty * Number(item.unit_rate)
                        : isReviewed
                        ? approvedQty * Number(item.unit_rate)
                        : engQty * Number(item.unit_rate);

                      return (
                        <tr key={item.id} style={{ verticalAlign: 'middle' }}>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{item.item_name}</div>
                          </td>
                          <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.unit}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
                            {Number(item.contract_quantity) > 0 ? Number(item.contract_quantity).toLocaleString() : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                            {Number(item.unit_rate).toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
                            {Number(item.previous_approved_quantity) > 0
                              ? Number(item.previous_approved_quantity).toLocaleString()
                              : '—'}
                          </td>
                          {/* Site Qty — editable in draft */}
                          <td style={{ textAlign: 'right' }}>
                            {isDraft ? (
                              <input
                                type="number" min="0" step="any"
                                value={claimedQtys[item.id] ?? '0'}
                                onChange={e => setClaimedQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                                style={inputStyle}
                              />
                            ) : (
                              <span style={{ fontFamily: 'monospace' }}>{siteQty.toLocaleString()}</span>
                            )}
                          </td>
                          {/* Eng Qty — editable in submitted */}
                          <td style={{ textAlign: 'right' }}>
                            {isSubmitted ? (
                              <input
                                type="number" min="0" step="any"
                                value={engineerQtys[item.id] ?? '0'}
                                onChange={e => setEngineerQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                                style={inputStyle}
                              />
                            ) : (
                              <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                {Number(item.engineer_approved_quantity).toLocaleString()}
                              </span>
                            )}
                          </td>
                          {/* Approved Qty — editable in reviewed */}
                          <td style={{ textAlign: 'right' }}>
                            {isReviewed ? (
                              <input
                                type="number" min="0" step="any"
                                value={managerApprovedQtys[item.id] ?? '0'}
                                onChange={e => setManagerApprovedQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                                style={inputStyle}
                              />
                            ) : (
                              <span style={{ fontFamily: 'monospace', fontWeight: 600,
                                color: isApproved || isGmApproved ? 'var(--status-success)' : undefined }}>
                                {approvedQty.toLocaleString()}
                              </span>
                            )}
                          </td>
                          {/* Variation = Site − Eng/Approved */}
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 500,
                            color: variation > 0 ? 'var(--status-warning)' : variation < 0 ? 'var(--status-error)' : 'var(--text-tertiary)',
                          }}>
                            {variation !== 0
                              ? (variation > 0 ? '+' : '') + variation.toLocaleString(undefined, { maximumFractionDigits: 3 })
                              : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>
                            {canEditItems
                              ? value.toLocaleString(undefined, { minimumFractionDigits: 2 })
                              : Number(item.current_approved_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{ padding: '8px 12px' }} />
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, padding: '8px 4px', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {(items ?? []).reduce((sum, item) => {
                          const sq = isDraft ? Number(claimedQtys[item.id] ?? item.contractor_claimed_quantity) : Number(item.contractor_claimed_quantity);
                          return sum + sq * Number(item.unit_rate);
                        }, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, padding: '8px 4px', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {(items ?? []).reduce((sum, item) => {
                          const hasBreakdowns = (item.breakdowns?.length ?? 0) > 0;
                          let eq: number;
                          if (isSubmitted && hasBreakdowns) {
                            eq = item.breakdowns!.reduce((s, bd) => {
                              const v = (breakdownEngQty[item.id] ?? {})[bd.location] ?? String(bd.engineer_quantity);
                              return s + (parseFloat(v) || 0);
                            }, 0);
                          } else {
                            eq = isSubmitted ? Number(engineerQtys[item.id] ?? 0) : Number(item.engineer_approved_quantity);
                          }
                          return sum + eq * Number(item.unit_rate);
                        }, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={2} style={{ textAlign: 'right', fontWeight: 600, padding: '8px 12px', fontSize: 'var(--text-sm)' }}>
                        Total Approved
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, padding: '8px 12px' }}>
                        AED {isDraft
                          ? (items ?? []).reduce((sum, item) => sum + Number(claimedQtys[item.id] ?? item.contractor_claimed_quantity) * Number(item.unit_rate), 0)
                              .toLocaleString(undefined, { minimumFractionDigits: 2 })
                          : isSubmitted
                          ? (items ?? []).reduce((sum, item) => {
                              const hasBreakdowns = (item.breakdowns?.length ?? 0) > 0;
                              let eq: number;
                              if (hasBreakdowns) {
                                eq = item.breakdowns!.reduce((s, bd) => {
                                  const v = (breakdownEngQty[item.id] ?? {})[bd.location] ?? String(bd.engineer_quantity);
                                  return s + (parseFloat(v) || 0);
                                }, 0);
                              } else {
                                eq = Number(engineerQtys[item.id] ?? item.engineer_approved_quantity ?? 0);
                              }
                              return sum + eq * Number(item.unit_rate);
                            }, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
                          : isReviewed
                          ? (items ?? []).reduce((sum, item) => sum + Number(managerApprovedQtys[item.id] ?? item.engineer_approved_quantity ?? 0) * Number(item.unit_rate), 0)
                              .toLocaleString(undefined, { minimumFractionDigits: 2 })
                          : (items ?? []).reduce((sum, i) => sum + Number(i.current_approved_amount), 0)
                              .toLocaleString(undefined, { minimumFractionDigits: 2 })
                        }
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Attachments ── */}
        {tab === 'attachments' && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="info-section-title" style={{ marginBottom: 0 }}>Attachments</div>
              <Button variant="secondary" size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}>
                {uploadMutation.isPending ? 'Uploading...' : '+ Upload File'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) { uploadMutation.mutate(file); e.target.value = ''; }
                }}
              />
            </div>

            {!attachments?.length ? (
              <div className="empty-state"><p>No attachments yet. Upload files to document this certificate.</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {attachments.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{a.file_name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {a.document_type} · {a.uploaded_by_name} · {new Date(a.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <a href={a.file_url ?? a.file} target="_blank" rel="noreferrer">
                      <Button variant="view" size="sm">Download</Button>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
}
