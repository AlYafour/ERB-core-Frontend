'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subcontractorsApi } from '@/lib/api/subcontractors';
import { Button, Badge, PageHeader, PageShell } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';
import { CERTIFICATE_STATUS } from '@/lib/utils/status-colors';

type Tab = 'info' | 'items' | 'attachments';

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

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 16px', fontSize: 'var(--text-sm)',
      fontWeight: active ? 600 : 500,
      color: active ? 'var(--brand)' : 'var(--text-secondary)',
      background: 'none', border: 'none',
      borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent',
      cursor: 'pointer', transition: 'color 120ms, border-color 120ms',
    }}>
      {label}
    </button>
  );
}

function AmountRow({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBlock: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontWeight: highlight ? 700 : 500, color: highlight ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
        AED {Number(value).toLocaleString()}
      </span>
    </div>
  );
}

export default function CertificateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<Tab>('info');
  const queryClient = useQueryClient();

  const { data: cert, isLoading, error } = useQuery({
    queryKey: ['subcon-cert', id],
    queryFn: () => subcontractorsApi.certificates.getOne(Number(id)),
  });

  const { data: items } = useQuery({
    queryKey: ['cert-items', id],
    queryFn: () => subcontractorsApi.certificates.getItems(Number(id)),
    enabled: tab === 'items',
  });

  const { data: attachments } = useQuery({
    queryKey: ['cert-attachments', id],
    queryFn: () => subcontractorsApi.attachments.listForCertificate(Number(id)),
    enabled: tab === 'attachments',
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['subcon-cert', id] });

  const submitMutation = useMutation({
    mutationFn: () => subcontractorsApi.certificates.submit(Number(id)),
    onSuccess: () => { invalidate(); toast('Certificate submitted', 'success'); },
    onError: () => toast('Failed to submit', 'error'),
  });

  const reviewMutation = useMutation({
    mutationFn: () => subcontractorsApi.certificates.review(Number(id), {}),
    onSuccess: () => { invalidate(); toast('Certificate reviewed', 'success'); },
    onError: () => toast('Failed to review', 'error'),
  });

  const approveMutation = useMutation({
    mutationFn: () => subcontractorsApi.certificates.approve(Number(id), {}),
    onSuccess: () => { invalidate(); toast('Certificate approved', 'success'); },
    onError: () => toast('Failed to approve', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => subcontractorsApi.certificates.reject(Number(id), { reason }),
    onSuccess: () => { invalidate(); toast('Certificate rejected', 'info'); },
    onError: () => toast('Failed to reject', 'error'),
  });

  if (isLoading) return <MainLayout><PageShell><div className="card empty-state"><p>Loading...</p></div></PageShell></MainLayout>;
  if (error || !cert) return <MainLayout><PageShell><div className="card empty-state"><p style={{ color: 'var(--status-error)' }}>Certificate not found.</p></div></PageShell></MainLayout>;

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
            <div style={{ display: 'flex', gap: 8 }}>
              {cert.status === 'draft' && (
                <Button variant="primary" size="sm" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                  Submit
                </Button>
              )}
              {cert.status === 'submitted' && (
                <Button variant="primary" size="sm" onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending}>
                  Mark Under Review
                </Button>
              )}
              {(cert.status === 'under_review' || cert.status === 'reviewed') && (
                <>
                  <Button variant="primary" size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                    Approve
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => {
                    const reason = prompt('Rejection reason:');
                    if (reason) rejectMutation.mutate(reason);
                  }}>
                    Reject
                  </Button>
                </>
              )}
              {cert.status === 'approved' && (
                <Link href={`/subcontractors/payments/new?certificate=${id}&contract=${cert.contract}`}>
                  <Button variant="primary" size="sm">Create Payment</Button>
                </Link>
              )}
            </div>
          }
        />

        {/* Financial summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
          <div className="card">
            <div className="info-section-title">Certificate Summary</div>
            <AmountRow label="Gross Claimed"          value={cert.gross_claimed_amount} />
            <AmountRow label="Gross Approved"         value={cert.gross_approved_amount} />
            <AmountRow label="Previous Certified"     value={cert.previous_approved_amount} />
          </div>
          <div className="card">
            <div className="info-section-title">Payment Breakdown</div>
            <AmountRow label="Gross Approved"         value={cert.gross_approved_amount} />
            <AmountRow label="Retention Deduction"    value={cert.retention_amount} />
            <AmountRow label="Advance Deduction"      value={cert.advance_deduction} />
            {Number(cert.other_deductions) > 0 && (
              <AmountRow label="Other Deductions"     value={cert.other_deductions} />
            )}
            <AmountRow label="Net Payable"            value={cert.net_payable_amount} highlight />
          </div>
        </div>

        {/* Status + workflow */}
        <div className="card" style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Badge variant={CERTIFICATE_STATUS[cert.status] ?? 'default'}>
            {STATUS_LABEL[cert.status]}
          </Badge>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            <span>{cert.certificate_date}</span>
            {cert.period_from && cert.period_to && (
              <span style={{ marginLeft: 12 }}>Period: {cert.period_from} → {cert.period_to}</span>
            )}
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            {cert.subcontractor_name} · {cert.contract_no}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid var(--border-default)', marginBottom: 'var(--space-4)', display: 'flex', gap: 0 }}>
          <TabBtn label="General Info"  active={tab === 'info'}        onClick={() => setTab('info')} />
          <TabBtn label="Measurements"  active={tab === 'items'}       onClick={() => setTab('items')} />
          <TabBtn label="Attachments"   active={tab === 'attachments'} onClick={() => setTab('attachments')} />
        </div>

        {/* Tab: Info */}
        {tab === 'info' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
            <div className="card">
              <div className="info-section-title">Certificate Details</div>
              <InfoRow label="Certificate No."   value={cert.certificate_no} />
              <InfoRow label="Contract"          value={cert.contract_no} />
              <InfoRow label="Subcontractor"     value={cert.subcontractor_name} />
              <InfoRow label="Project"           value={cert.project_name} />
              <InfoRow label="Certificate Date"  value={cert.certificate_date} />
              <InfoRow label="Period From"        value={cert.period_from} />
              <InfoRow label="Period To"          value={cert.period_to} />
            </div>
            <div className="card">
              <div className="info-section-title">Workflow</div>
              <InfoRow label="Status"            value={STATUS_LABEL[cert.status]} />
              <InfoRow label="Submitted By"      value={cert.submitted_by_name} />
              <InfoRow label="Reviewed By"       value={cert.reviewed_by_name} />
              <InfoRow label="Approved By"       value={cert.approved_by_name} />
              <InfoRow label="Review Date"       value={cert.review_date} />
              <InfoRow label="Approval Date"     value={cert.approval_date} />
              {cert.review_notes && <InfoRow label="Review Notes" value={cert.review_notes} />}
              {cert.rejection_reason && <InfoRow label="Rejection Reason" value={cert.rejection_reason} />}
            </div>
          </div>
        )}

        {/* Tab: Measurements */}
        {tab === 'items' && (
          <div className="card">
            <div className="info-section-title">Measurement Items</div>
            {!items?.length ? (
              <div className="empty-state"><p>No measurement items.</p></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Unit</th>
                    <th style={{ textAlign: 'right' }}>Contract Qty</th>
                    <th style={{ textAlign: 'right' }}>Previous</th>
                    <th style={{ textAlign: 'right' }}>Claimed</th>
                    <th style={{ textAlign: 'right' }}>Approved</th>
                    <th style={{ textAlign: 'right' }}>Total to Date</th>
                    <th style={{ textAlign: 'right' }}>Remaining</th>
                    <th style={{ textAlign: 'right' }}>Amount (AED)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{item.item_name}</div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{item.unit}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{Number(item.contract_quantity).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>{Number(item.previous_approved_quantity).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{Number(item.contractor_claimed_quantity).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--status-success)', fontWeight: 600 }}>{Number(item.engineer_approved_quantity).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{Number(item.total_approved_quantity).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: Number(item.remaining_quantity) <= 0 ? 'var(--status-error)' : 'var(--text-secondary)' }}>
                        {Number(item.remaining_quantity).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>
                        {Number(item.current_approved_amount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'right', fontWeight: 600 }}>Total Approved</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                      {items.reduce((sum, i) => sum + Number(i.current_approved_amount), 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}

        {/* Tab: Attachments */}
        {tab === 'attachments' && (
          <div className="card">
            <div className="info-section-title">Attachments</div>
            {!attachments?.length ? (
              <div className="empty-state"><p>No attachments.</p></div>
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
                    <a href={a.file} target="_blank" rel="noreferrer">
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
