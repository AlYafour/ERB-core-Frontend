'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subcontractorsApi } from '@/lib/api/subcontractors';
import { Button, Badge, PageHeader, PageShell } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';
import { CONTRACT_STATUS, CERTIFICATE_STATUS, PAYMENT_STATUS } from '@/lib/utils/status-colors';

type Tab = 'info' | 'boq' | 'certificates' | 'payments' | 'attachments' | 'log';

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', under_review: 'Under Review', approved: 'Approved',
  active: 'Active', on_hold: 'On Hold', completed: 'Completed',
  closed: 'Closed', terminated: 'Terminated',
};

const CERT_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review',
  reviewed: 'Reviewed', approved: 'Approved', rejected: 'Rejected',
  paid: 'Paid', cancelled: 'Cancelled',
};

function InfoRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === null || value === undefined || value === '') return null;
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', paddingBlock: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ width: 200, flexShrink: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>
        {label}
      </span>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{display}</span>
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

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<Tab>('info');
  const queryClient = useQueryClient();

  const { data: contract, isLoading, error } = useQuery({
    queryKey: ['subcon-contract', id],
    queryFn: () => subcontractorsApi.contracts.getOne(Number(id)),
  });

  const { data: boqItems } = useQuery({
    queryKey: ['boq-items', id],
    queryFn: () => subcontractorsApi.boqItems.list(Number(id)),
    enabled: tab === 'boq',
  });

  const { data: certsData } = useQuery({
    queryKey: ['subcon-certs', id],
    queryFn: () => subcontractorsApi.certificates.list({ contract: id, page_size: 50 }),
    enabled: tab === 'certificates',
  });

  const { data: paymentsData } = useQuery({
    queryKey: ['subcon-payments-contract', id],
    queryFn: () => subcontractorsApi.payments.list({ contract: id, page_size: 50 }),
    enabled: tab === 'payments',
  });

  const { data: attachments } = useQuery({
    queryKey: ['subcon-contract-attachments', id],
    queryFn: () => subcontractorsApi.attachments.listForContract(Number(id)),
    enabled: tab === 'attachments',
  });

  const { data: activityLog } = useQuery({
    queryKey: ['subcon-activity', 'contract', id],
    queryFn: () => subcontractorsApi.activityLogs.list({ entity_type: 'contract', entity_id: Number(id) }),
    enabled: tab === 'log',
  });

  const submitMutation = useMutation({
    mutationFn: () => subcontractorsApi.contracts.submit(Number(id)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subcon-contract', id] }); toast('Contract submitted for review', 'success'); },
    onError: () => toast('Failed to submit contract', 'error'),
  });

  const approveMutation = useMutation({
    mutationFn: () => subcontractorsApi.contracts.approve(Number(id), {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subcon-contract', id] }); toast('Contract approved', 'success'); },
    onError: () => toast('Failed to approve contract', 'error'),
  });

  const closeMutation = useMutation({
    mutationFn: () => subcontractorsApi.contracts.close(Number(id)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subcon-contract', id] }); toast('Contract closed', 'success'); },
    onError: () => toast('Failed to close contract', 'error'),
  });

  if (isLoading) return <MainLayout><PageShell><div className="card empty-state"><p>Loading...</p></div></PageShell></MainLayout>;
  if (error || !contract) return <MainLayout><PageShell><div className="card empty-state"><p style={{ color: 'var(--status-error)' }}>Contract not found.</p></div></PageShell></MainLayout>;

  const fmt = (v: string | number) => `AED ${Number(v).toLocaleString()}`;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={`${contract.contract_no} — ${contract.contract_title}`}
          breadcrumbs={[
            { label: 'Subcontractors', href: '/subcontractors' },
            { label: 'Contracts', href: '/subcontractors/contracts' },
            { label: contract.contract_no },
          ]}
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              {contract.contract_status === 'draft' && (
                <Button variant="primary" size="sm" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                  Submit for Review
                </Button>
              )}
              {contract.contract_status === 'under_review' && (
                <Button variant="primary" size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                  Approve
                </Button>
              )}
              {(contract.contract_status === 'approved' || contract.contract_status === 'active') && (
                <>
                  <Link href={`/subcontractors/certificates/new?contract=${id}`}>
                    <Button variant="primary" size="sm">+ New Certificate</Button>
                  </Link>
                  <Button variant="secondary" size="sm" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
                    Close Contract
                  </Button>
                </>
              )}
            </div>
          }
        />

        {/* Financial summary row */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
          <StatCard label="Contract Value"       value={fmt(contract.contract_value)} />
          <StatCard label="Approved to Date"     value={fmt(contract.total_approved_to_date)} />
          <StatCard label="Paid to Date"         value={fmt(contract.total_paid_to_date)} />
          <StatCard label="Retention Balance"    value={fmt(contract.retention_balance)} />
          <StatCard label="Remaining Balance"    value={fmt(contract.remaining_balance)} />
          <div className="card" style={{ flex: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
            <Badge variant={CONTRACT_STATUS[contract.contract_status] ?? 'default'}>
              {CONTRACT_STATUS_LABEL[contract.contract_status]}
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid var(--border-default)', marginBottom: 'var(--space-4)', display: 'flex', gap: 0 }}>
          <TabBtn label="General Info"    active={tab === 'info'}         onClick={() => setTab('info')} />
          <TabBtn label="BOQ"             active={tab === 'boq'}          onClick={() => setTab('boq')} />
          <TabBtn label="Certificates"    active={tab === 'certificates'} onClick={() => setTab('certificates')} />
          <TabBtn label="Payments"        active={tab === 'payments'}     onClick={() => setTab('payments')} />
          <TabBtn label="Attachments"     active={tab === 'attachments'}  onClick={() => setTab('attachments')} />
          <TabBtn label="Activity Log"    active={tab === 'log'}          onClick={() => setTab('log')} />
        </div>

        {/* Tab: Info */}
        {tab === 'info' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
            <div className="card">
              <div className="info-section-title">Contract Details</div>
              <InfoRow label="Contract Number"  value={contract.contract_no} />
              <InfoRow label="Title"            value={contract.contract_title} />
              <InfoRow label="Subcontractor"    value={contract.subcontractor_name} />
              <InfoRow label="Start Date"       value={contract.start_date} />
              <InfoRow label="End Date"         value={contract.end_date} />
              <InfoRow label="Contract Value"   value={fmt(contract.contract_value)} />
            </div>
            <div className="card">
              <div className="info-section-title">Financial Settings</div>
              <InfoRow label="Retention Enabled"        value={contract.retention_enabled} />
              {contract.retention_enabled && (
                <InfoRow label="Retention %"            value={`${contract.retention_percentage}%`} />
              )}
              <InfoRow label="Advance Payment Enabled"  value={contract.advance_payment_enabled} />
              {contract.advance_payment_enabled && (
                <>
                  <InfoRow label="Advance Amount"       value={fmt(contract.advance_payment_amount)} />
                  <InfoRow label="Recovery Method"      value={contract.advance_recovery_method.replace('_', ' ')} />
                  {contract.advance_recovery_method === 'percentage' && (
                    <InfoRow label="Recovery %"         value={`${contract.advance_recovery_percentage}%`} />
                  )}
                </>
              )}
            </div>
            {contract.scope_of_work && (
              <div className="card">
                <div className="info-section-title">Scope of Work</div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  {contract.scope_of_work}
                </p>
              </div>
            )}
            {contract.payment_terms && (
              <div className="card">
                <div className="info-section-title">Payment Terms</div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  {contract.payment_terms}
                </p>
              </div>
            )}
            {(contract.review_notes || contract.rejection_reason) && (
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <div className="info-section-title">Review Notes</div>
                {contract.review_notes && <InfoRow label="Review Notes"      value={contract.review_notes} />}
                {contract.rejection_reason && <InfoRow label="Rejection Reason" value={contract.rejection_reason} />}
              </div>
            )}
          </div>
        )}

        {/* Tab: BOQ */}
        {tab === 'boq' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div className="info-section-title" style={{ margin: 0 }}>Bill of Quantities</div>
            </div>
            {!boqItems?.length ? (
              <div className="empty-state"><p>No BOQ items yet.</p></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Code</th>
                    <th>Item Name</th>
                    <th>Unit</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Rate (AED)</th>
                    <th style={{ textAlign: 'right' }}>Total (AED)</th>
                    <th style={{ textAlign: 'right' }}>Approved</th>
                    <th style={{ textAlign: 'right' }}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {boqItems.map((item, i) => (
                    <tr key={item.id}>
                      <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>{i + 1}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{item.item_code || '—'}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{item.item_name}</div>
                        {item.description && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.description}</div>}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{item.unit}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{Number(item.contract_quantity).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{Number(item.unit_rate).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>{Number(item.total_amount).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--status-success)' }}>{Number(item.approved_quantity_to_date).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{Number(item.remaining_quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, fontSize: 'var(--text-sm)' }}>Total</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                      {boqItems.reduce((sum, i) => sum + Number(i.total_amount), 0).toLocaleString()}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}

        {/* Tab: Certificates */}
        {tab === 'certificates' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div className="info-section-title" style={{ margin: 0 }}>Progress Certificates (IPC)</div>
              {(contract.contract_status === 'approved' || contract.contract_status === 'active') && (
                <Link href={`/subcontractors/certificates/new?contract=${id}`}>
                  <Button variant="primary" size="sm">+ New Certificate</Button>
                </Link>
              )}
            </div>
            {!certsData?.results?.length ? (
              <div className="empty-state"><p>No certificates issued yet.</p></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>IPC No.</th>
                    <th>Date</th>
                    <th>Period</th>
                    <th style={{ textAlign: 'right' }}>Gross Approved</th>
                    <th style={{ textAlign: 'right' }}>Retention</th>
                    <th style={{ textAlign: 'right' }}>Net Payable</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {certsData.results.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{c.certificate_no}</td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{c.certificate_date}</td>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {c.period_from && c.period_to ? `${c.period_from} → ${c.period_to}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>AED {Number(c.gross_approved_amount).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>AED {Number(c.retention_amount).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>AED {Number(c.net_payable_amount).toLocaleString()}</td>
                      <td><Badge variant={CERTIFICATE_STATUS[c.status] ?? 'default'}>{CERT_STATUS_LABEL[c.status]}</Badge></td>
                      <td>
                        <Link href={`/subcontractors/certificates/${c.id}`}>
                          <Button variant="view" size="sm">View</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab: Payments */}
        {tab === 'payments' && (
          <div className="card">
            <div className="info-section-title">Payments</div>
            {!paymentsData?.results?.length ? (
              <div className="empty-state"><p>No payments recorded yet.</p></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Payment No.</th>
                    <th>Date</th>
                    <th>Certificate</th>
                    <th style={{ textAlign: 'right' }}>Gross</th>
                    <th style={{ textAlign: 'right' }}>Net Paid</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsData.results.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{p.payment_no}</td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{p.payment_date}</td>
                      <td style={{ fontSize: 'var(--text-xs)', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>{p.certificate_no || '—'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>AED {Number(p.gross_amount).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>AED {Number(p.net_paid_amount).toLocaleString()}</td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{p.payment_method?.replace('_', ' ') || '—'}</td>
                      <td><Badge variant={PAYMENT_STATUS[p.status] ?? 'default'}>{p.status}</Badge></td>
                      <td>
                        <Link href={`/subcontractors/payments/${p.id}`}>
                          <Button variant="view" size="sm">View</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab: Attachments */}
        {tab === 'attachments' && (
          <div className="card">
            <div className="info-section-title">Attachments</div>
            {!attachments?.length ? (
              <div className="empty-state"><p>No attachments yet.</p></div>
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

        {/* Tab: Activity Log */}
        {tab === 'log' && (
          <div className="card">
            <div className="info-section-title">Activity Log</div>
            {!activityLog?.results?.length ? (
              <div className="empty-state"><p>No activity recorded.</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {activityLog.results.map(entry => (
                  <div key={entry.id} style={{ display: 'flex', gap: 'var(--space-3)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', flexShrink: 0, width: 130 }}>
                      {new Date(entry.created_at).toLocaleString()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{entry.action}</div>
                      {entry.description && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{entry.description}</div>}
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>by {entry.actor_name}</div>
                    </div>
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
