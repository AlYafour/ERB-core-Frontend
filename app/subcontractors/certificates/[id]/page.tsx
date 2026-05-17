'use client';

import { use, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subcontractorsApi } from '@/lib/api/subcontractors';
import { Button, Badge, PageHeader, PageShell } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';
import { CERTIFICATE_STATUS } from '@/lib/utils/status-colors';

type Tab = 'info' | 'items' | 'attachments';
const CERT_TABS: Tab[] = ['info', 'items', 'attachments'];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review',
  reviewed: 'Reviewed', approved: 'Approved', rejected: 'Rejected',
  paid: 'Paid', cancelled: 'Cancelled',
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
  const [engineerQtys, setEngineerQtys] = useState<Record<number, string>>({});
  const [qtysInitialized, setQtysInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: cert, isLoading, error } = useQuery({
    queryKey: ['subcon-cert', id],
    queryFn: () => subcontractorsApi.certificates.getOne(numericId),
    enabled: !isNaN(numericId) && numericId > 0,
  });

  // Auto-load items when status is submitted (engineer needs to review)
  const { data: items } = useQuery({
    queryKey: ['cert-items', id],
    queryFn: () => subcontractorsApi.certificates.getItems(numericId),
    enabled: (tab === 'items' || cert?.status === 'submitted') && !isNaN(numericId) && numericId > 0,
  });

  const { data: attachments } = useQuery({
    queryKey: ['cert-attachments', id],
    queryFn: () => subcontractorsApi.attachments.listForCertificate(numericId),
    enabled: tab === 'attachments' && !isNaN(numericId) && numericId > 0,
  });

  // Initialize engineer qtys once items load
  useEffect(() => {
    if (items && !qtysInitialized) {
      const init: Record<number, string> = {};
      items.forEach(item => { init[item.id] = String(item.engineer_approved_quantity); });
      setEngineerQtys(init);
      setQtysInitialized(true);
    }
  }, [items, qtysInitialized]);

  const invalidateCert  = () => queryClient.invalidateQueries({ queryKey: ['subcon-cert', id] });
  const invalidateItems = () => queryClient.invalidateQueries({ queryKey: ['cert-items', id] });

  const submitMutation = useMutation({
    mutationFn: () => subcontractorsApi.certificates.submit(numericId),
    onSuccess: () => { invalidateCert(); toast('Certificate submitted for review', 'success'); },
    onError: () => toast('Failed to submit', 'error'),
  });

  const buildItemsPayload = () => (items ?? []).map(item => ({
    boq_item: item.boq_item,
    contractor_claimed_quantity: item.contractor_claimed_quantity,
    engineer_approved_quantity: engineerQtys[item.id] ?? '0',
  }));

  const saveItemsMutation = useMutation({
    mutationFn: () => subcontractorsApi.certificates.saveItems(numericId, buildItemsPayload()),
    onSuccess: () => { invalidateItems(); toast('Measurements saved', 'success'); },
    onError: () => toast('Failed to save measurements', 'error'),
  });

  // Mark Reviewed = save engineer qtys first, then call review endpoint
  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (items && items.length > 0) {
        await subcontractorsApi.certificates.saveItems(numericId, buildItemsPayload());
      }
      return subcontractorsApi.certificates.review(numericId, {});
    },
    onSuccess: () => {
      invalidateCert();
      invalidateItems();
      setQtysInitialized(false); // re-init qtys from fresh data
      toast('Certificate marked as reviewed', 'success');
    },
    onError: () => toast('Failed to mark reviewed', 'error'),
  });

  const approveMutation = useMutation({
    mutationFn: () => subcontractorsApi.certificates.approve(numericId, {}),
    onSuccess: () => { invalidateCert(); toast('Certificate approved', 'success'); },
    onError: () => toast('Failed to approve', 'error'),
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

  const isSubmitted  = cert.status === 'submitted';
  const isReviewed   = cert.status === 'reviewed';
  const isApproved   = cert.status === 'approved';
  const isDraft      = cert.status === 'draft';
  const isRejected   = cert.status === 'rejected';
  const canReject    = isReviewed;
  const canApprove   = isReviewed;

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
              {isSubmitted && (
                <Button variant="secondary" size="sm" onClick={() => setTab('items')}>
                  Enter Measurements →
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
                <Link href={`/subcontractors/payments/new?certificate=${id}&contract=${cert.contract}&amount=${cert.net_payable_amount}`}>
                  <Button variant="primary" size="sm">Create Payment</Button>
                </Link>
              )}
            </div>
          }
        />

        {/* Rejection modal */}
        <RejectModal
          open={rejectOpen}
          onClose={() => setRejectOpen(false)}
          onConfirm={reason => rejectMutation.mutate(reason)}
          isPending={rejectMutation.isPending}
        />

        {/* Financial summary cards */}
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
            badge={isSubmitted ? '!' : undefined} />
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
              {isSubmitted && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="secondary" size="sm"
                    onClick={() => saveItemsMutation.mutate()}
                    disabled={saveItemsMutation.isPending || reviewMutation.isPending}>
                    {saveItemsMutation.isPending ? 'Saving...' : 'Save Measurements'}
                  </Button>
                  <Button variant="primary" size="sm"
                    onClick={() => reviewMutation.mutate()}
                    disabled={reviewMutation.isPending || saveItemsMutation.isPending}>
                    {reviewMutation.isPending ? 'Submitting...' : 'Submit Engineer Review'}
                  </Button>
                </div>
              )}
            </div>

            {isSubmitted && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(59,130,246,0.08)', borderRadius: 6, border: '1px solid rgba(59,130,246,0.2)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Enter approved quantities for each item, then click <strong>Submit Engineer Review</strong>.
              </div>
            )}

            {!items?.length ? (
              <div className="empty-state"><p>No measurement items.</p></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Unit</th>
                      <th style={{ textAlign: 'right' }}>Contract Qty</th>
                      <th style={{ textAlign: 'right' }}>Rate (AED)</th>
                      <th style={{ textAlign: 'right' }}>Previous</th>
                      <th style={{ textAlign: 'right' }}>Claimed</th>
                      <th style={{ textAlign: 'right', color: isSubmitted ? 'var(--brand)' : undefined }}>
                        {isSubmitted ? 'Approved Qty ✎' : 'Approved Qty'}
                      </th>
                      <th style={{ textAlign: 'right' }}>Total to Date</th>
                      <th style={{ textAlign: 'right' }}>Remaining</th>
                      <th style={{ textAlign: 'right' }}>Amount (AED)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const approvedQty = isSubmitted
                        ? Number(engineerQtys[item.id] ?? '0')
                        : Number(item.engineer_approved_quantity);
                      const amount = approvedQty * Number(item.unit_rate);
                      const remaining = Number(item.remaining_quantity);

                      return (
                        <tr key={item.id} style={{ verticalAlign: 'middle' }}>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{item.item_name}</div>
                          </td>
                          <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.unit}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                            {Number(item.contract_quantity).toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                            {Number(item.unit_rate).toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
                            {Number(item.previous_approved_quantity).toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                            {Number(item.contractor_claimed_quantity).toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isSubmitted ? (
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={engineerQtys[item.id] ?? '0'}
                                onChange={e => setEngineerQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                                style={{
                                  width: 90, textAlign: 'right', fontFamily: 'monospace',
                                  border: '1px solid var(--brand)', borderRadius: 4,
                                  padding: '3px 6px', fontSize: 'var(--text-sm)',
                                  background: 'var(--bg-input)', color: 'var(--text-primary)',
                                }}
                              />
                            ) : (
                              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--status-success)' }}>
                                {Number(item.engineer_approved_quantity).toLocaleString()}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                            {isSubmitted
                              ? (Number(item.previous_approved_quantity) + approvedQty).toLocaleString()
                              : Number(item.total_approved_quantity).toLocaleString()
                            }
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: remaining <= 0 ? 'var(--status-error)' : 'var(--text-secondary)' }}>
                            {isSubmitted
                              ? (Number(item.contract_quantity) - Number(item.previous_approved_quantity) - approvedQty).toLocaleString()
                              : remaining.toLocaleString()
                            }
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>
                            {isSubmitted
                              ? amount.toLocaleString(undefined, { minimumFractionDigits: 2 })
                              : Number(item.current_approved_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'right', fontWeight: 600, padding: '8px 12px' }}>
                        Total Approved
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, padding: '8px 12px' }}>
                        AED {isSubmitted
                          ? items.reduce((sum, item) => sum + Number(engineerQtys[item.id] ?? 0) * Number(item.unit_rate), 0)
                              .toLocaleString(undefined, { minimumFractionDigits: 2 })
                          : items.reduce((sum, i) => sum + Number(i.current_approved_amount), 0)
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
