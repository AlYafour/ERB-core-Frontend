'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery } from '@tanstack/react-query';
import { subcontractorsApi } from '@/lib/api/subcontractors';
import { Button, Badge, PageHeader, PageShell } from '@/components/ui';
import { SUBCON_STATUS, CONTRACT_STATUS } from '@/lib/utils/status-colors';

const STATUS_LABEL: Record<string, string> = { active: 'Active', inactive: 'Inactive' };

type Tab = 'info' | 'contracts' | 'attachments';

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div style={{
      display: 'flex', gap: 'var(--space-3)',
      paddingBlock: 'var(--space-2)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <span style={{ width: 180, flexShrink: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>
        {label}
      </span>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        fontSize: 'var(--text-sm)',
        fontWeight: active ? 600 : 500,
        color: active ? 'var(--brand)' : 'var(--text-secondary)',
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'color 120ms, border-color 120ms',
      }}
    >
      {label}
    </button>
  );
}

export default function SubcontractorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<Tab>('info');

  const { data: sub, isLoading, error } = useQuery({
    queryKey: ['subcontractor', id],
    queryFn: () => subcontractorsApi.getOne(Number(id)),
  });

  const { data: contractsData } = useQuery({
    queryKey: ['subcontractor-contracts', id],
    queryFn: () => subcontractorsApi.contracts.list({ subcontractor: id, page_size: 50 }),
    enabled: tab === 'contracts',
  });

  const { data: attachments } = useQuery({
    queryKey: ['subcontractor-attachments', id],
    queryFn: () => subcontractorsApi.attachments.listForSubcontractor(Number(id)),
    enabled: tab === 'attachments',
  });

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={sub?.company_name ?? 'Subcontractor Details'}
          breadcrumbs={[
            { label: 'Subcontractors', href: '/subcontractors' },
            { label: sub?.company_name ?? 'Details' },
          ]}
          actions={
            <Link href={`/subcontractors/contracts/new?subcontractor=${id}`}>
              <Button variant="primary">+ New Contract</Button>
            </Link>
          }
        />

        {isLoading ? (
          <div className="card empty-state"><p style={{ color: 'var(--text-secondary)' }}>Loading...</p></div>
        ) : error || !sub ? (
          <div className="card empty-state"><p style={{ color: 'var(--status-error)' }}>Failed to load subcontractor.</p></div>
        ) : (
          <>
            {/* Summary banner */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
              <div style={{
                width: 56, height: 56, borderRadius: 12,
                background: 'var(--brand-subtle)', color: 'var(--brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, flexShrink: 0,
              }}>
                {sub.company_name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {sub.company_name}
                </div>
                {sub.trade_type_name && (
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{sub.trade_type_name}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <Badge variant={SUBCON_STATUS[sub.status] ?? 'default'}>{STATUS_LABEL[sub.status]}</Badge>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Active Contracts</div>
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{sub.active_contracts_count}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Total Value</div>
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {sub.total_contract_value ? `AED ${Number(sub.total_contract_value).toLocaleString()}` : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ borderBottom: '1px solid var(--border-default)', marginBottom: 'var(--space-4)', display: 'flex', gap: 0 }}>
              <TabBtn label="General Info"  active={tab === 'info'}        onClick={() => setTab('info')} />
              <TabBtn label="Contracts"     active={tab === 'contracts'}   onClick={() => setTab('contracts')} />
              <TabBtn label="Attachments"   active={tab === 'attachments'} onClick={() => setTab('attachments')} />
            </div>

            {/* Tab: Info */}
            {tab === 'info' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
                <div className="card">
                  <div className="info-section-title">Contact Information</div>
                  <InfoRow label="Contact Person"  value={sub.contact_person} />
                  <InfoRow label="Mobile"          value={sub.mobile} />
                  <InfoRow label="Email"           value={sub.email} />
                  <InfoRow label="Address"         value={sub.address} />
                </div>
                <div className="card">
                  <div className="info-section-title">Legal Information</div>
                  <InfoRow label="Trade Type"           value={sub.trade_type_name} />
                  <InfoRow label="Commercial License"   value={sub.commercial_license} />
                  <InfoRow label="VAT / TRN Number"     value={sub.vat_number} />
                  <InfoRow label="Status"               value={STATUS_LABEL[sub.status]} />
                </div>
                {sub.notes && (
                  <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <div className="info-section-title">Notes</div>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{sub.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Contracts */}
            {tab === 'contracts' && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                  <div className="info-section-title" style={{ margin: 0 }}>Contracts</div>
                  <Link href={`/subcontractors/contracts/new?subcontractor=${id}`}>
                    <Button variant="primary" size="sm">+ New Contract</Button>
                  </Link>
                </div>
                {!contractsData?.results?.length ? (
                  <div className="empty-state"><p>No contracts yet.</p></div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Contract No.</th>
                        <th>Title</th>
                        <th>Value</th>
                        <th>Status</th>
                        <th>Start Date</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {contractsData.results.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{c.contract_no}</td>
                          <td>{c.contract_title}</td>
                          <td style={{ fontFamily: 'monospace' }}>AED {Number(c.contract_value).toLocaleString()}</td>
                          <td><Badge variant={CONTRACT_STATUS[c.contract_status] ?? 'default'}>{c.contract_status.replace('_', ' ')}</Badge></td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{c.start_date ?? '—'}</td>
                          <td>
                            <Link href={`/subcontractors/contracts/${c.id}`}>
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
          </>
        )}
      </PageShell>
    </MainLayout>
  );
}
