'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { purchaseRequestsApi } from '@/lib/api/purchase-requests';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import RouteGuard from '@/components/auth/RouteGuard';
import { Loader, PageShell } from '@/components/ui';

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IconCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function IconClock({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function IconUser({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconTimer({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="13" r="8" /><polyline points="12 9 12 13 15 16" /><path d="M9 2h6M12 2v2" />
    </svg>
  );
}
function IconFile({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function IconImage({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
function IconExternalLink({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
function IconArrowLeft({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
function IconNote({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

// ─── Stage Config ──────────────────────────────────────────────────────────────

type StageCategory = 'pr' | 'qr' | 'po' | 'grn' | 'invoice';

function getStageCategory(stage: string): StageCategory {
  if (stage.startsWith('pr_')) return 'pr';
  if (stage.startsWith('quotation_') || stage.startsWith('purchase_quotation_') || stage === 'supplier_awarded') return 'qr';
  if (stage.startsWith('lpo_')) return 'po';
  if (stage.startsWith('grn_')) return 'grn';
  if (stage.startsWith('invoice_')) return 'invoice';
  return 'pr';
}

const CATEGORY_COLORS: Record<StageCategory, { accent: string; light: string; label: string }> = {
  pr:      { accent: 'var(--color-primary)', light: 'var(--color-primary-light)',  label: 'Purchase Request' },
  qr:      { accent: '#7C3AED',              light: 'rgba(124,58,237,0.08)',        label: 'Quotation'       },
  po:      { accent: '#0284C7',              light: 'rgba(2,132,199,0.08)',         label: 'Purchase Order'  },
  grn:     { accent: '#0D9488',              light: 'rgba(13,148,136,0.08)',        label: 'Goods Received'  },
  invoice: { accent: '#B45309',              light: 'rgba(180,83,9,0.08)',          label: 'Invoice'         },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  completed:   { color: 'var(--color-success)', bg: 'rgba(58,125,82,0.08)',   label: 'Completed'   },
  in_progress: { color: '#C9943A',              bg: 'rgba(201,148,58,0.08)', label: 'In Progress'  },
  pending:     { color: 'var(--text-tertiary)', bg: 'var(--surface-inset)',   label: 'Pending'     },
  rejected:    { color: 'var(--color-error)',   bg: 'rgba(220,38,38,0.08)',  label: 'Rejected'    },
};

const PR_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: 'Draft',    color: 'var(--text-secondary)', bg: 'var(--surface-inset)'          },
  pending:  { label: 'Pending',  color: '#C9943A',               bg: 'rgba(201,148,58,0.1)'          },
  approved: { label: 'Approved', color: 'var(--color-success)',  bg: 'rgba(58,125,82,0.1)'           },
  rejected: { label: 'Rejected', color: 'var(--color-error)',    bg: 'rgba(220,38,38,0.1)'           },
  revised:  { label: 'Revised',  color: 'var(--color-primary)',  bg: 'var(--color-primary-light)'    },
};

// ─── Small sub-components ──────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      backgroundColor: cfg.color,
      border: '3px solid var(--surface-default)',
      boxShadow: `0 0 0 1px ${cfg.color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', flexShrink: 0,
    }}>
      {status === 'completed' && <IconCheck size={13} />}
      {status === 'rejected'  && <IconX size={13} />}
      {status !== 'completed' && status !== 'rejected' && (
        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#fff', opacity: 0.8 }} />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 'var(--radius-full)',
      fontSize: 11, fontWeight: 'var(--weight-semibold)',
      letterSpacing: '0.04em', textTransform: 'uppercase' as const,
      color: cfg.color, backgroundColor: cfg.bg,
      border: `1px solid ${cfg.color}30`,
    }}>
      {cfg.label}
    </span>
  );
}

function CategoryPill({ stage }: { stage: string }) {
  const cfg = CATEGORY_COLORS[getStageCategory(stage)];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 4,
      fontSize: 10, fontWeight: 'var(--weight-semibold)',
      letterSpacing: '0.05em', textTransform: 'uppercase' as const,
      color: cfg.accent, backgroundColor: cfg.light,
      border: `1px solid ${cfg.accent}25`,
    }}>
      {cfg.label}
    </span>
  );
}

function MetaChip({ icon, label, sub, highlight }: {
  icon: React.ReactNode; label: string; sub?: string; highlight?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span style={{
        fontSize: 'var(--text-sm)',
        color: highlight ? 'var(--color-primary)' : 'var(--text-secondary)',
        fontWeight: highlight ? 'var(--weight-semibold)' : 'var(--weight-normal)',
      }}>
        {label}
        {sub && <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>· {sub}</span>}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4, fontWeight: 'var(--weight-semibold)' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

function SummaryTile({ label, value, highlight }: { label: string; value: string; highlight?: 'success' | 'warn' | 'error' }) {
  const valueColor = highlight === 'success' ? 'var(--color-success)' : highlight === 'warn' ? '#C9943A' : highlight === 'error' ? 'var(--color-error)' : 'var(--text-primary)';
  return (
    <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 6, fontWeight: 'var(--weight-semibold)' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: valueColor }}>
        {value}
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatRole(role: string | null): string {
  if (!role) return '';
  return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatDate(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-AE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function getRelatedUrl(relatedType: string, relatedId: number): string {
  const map: Record<string, string> = {
    purchase_request:   `/purchase-requests/${relatedId}`,
    quotation_request:  `/quotation-requests/${relatedId}`,
    purchase_quotation: `/purchase-quotations/${relatedId}`,
    purchase_order:     `/purchase-orders/${relatedId}`,
    goods_receiving:    `/goods-receiving/${relatedId}`,
    purchase_invoice:   `/purchase-invoices/${relatedId}`,
  };
  return map[relatedType] || '#';
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PurchaseRequestTrackingPage() {
  return (
    <RouteGuard requiredPermission={{ category: 'purchase_request', action: 'view' }} redirectTo="/purchase-requests">
      <TrackingPageContent />
    </RouteGuard>
  );
}

function TrackingPageContent() {
  const params = useParams();
  const id = Number(params.id);

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-request-tracking', id],
    queryFn: () => purchaseRequestsApi.getTrackingTimeline(id),
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="card empty-state"><Loader /><p style={{ color: 'var(--text-secondary)', margin: 0 }}>Loading timeline…</p></div>
      </MainLayout>
    );
  }

  if (error || !data) {
    return (
      <MainLayout>
        <div className="card empty-state">
          <p style={{ color: 'var(--color-error)', margin: 0, marginBottom: 'var(--space-4)' }}>Failed to load timeline.</p>
          <Link href={`/purchase-requests/${id}`} className="btn btn-primary">Back to request</Link>
        </div>
      </MainLayout>
    );
  }

  const { purchase_request, timeline, total_duration } = data;
  const completedCount = timeline.filter(i => i.status === 'completed').length;
  const progressPct = timeline.length > 0 ? Math.round((completedCount / timeline.length) * 100) : 0;
  const prStatusCfg = PR_STATUS_CONFIG[purchase_request.status] || PR_STATUS_CONFIG.draft;

  return (
    <MainLayout>
      <PageShell>

        {/* Header ──────────────────────────────────────────── */}
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <Link href={`/purchase-requests/${id}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
            textDecoration: 'none', marginBottom: 'var(--space-5)',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
          >
            <IconArrowLeft /> Back to purchase request
          </Link>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', margin: 0 }}>
                  Procurement Timeline
                </h1>
                <span style={{
                  padding: '3px 10px', borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)',
                  color: prStatusCfg.color, backgroundColor: prStatusCfg.bg,
                  border: `1px solid ${prStatusCfg.color}30`,
                }}>
                  {prStatusCfg.label}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <code style={{
                  padding: '2px 10px', borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)',
                  color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)',
                }}>
                  {purchase_request.code}
                </code>
                <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                  {purchase_request.title}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
              <Stat label="Total duration" value={total_duration || '—'} />
              <Stat label="Steps completed" value={`${completedCount} / ${timeline.length}`} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 'var(--weight-semibold)' }}>
                  Progress
                </div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 6 }}>
                  {progressPct}%
                </div>
                <div style={{ width: 120, height: 5, backgroundColor: 'var(--surface-inset)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    width: `${progressPct}%`, height: '100%', borderRadius: 99,
                    backgroundColor: progressPct === 100 ? 'var(--color-success)' : 'var(--color-primary)',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Legend ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', paddingLeft: 2 }}>
          {(Object.entries(CATEGORY_COLORS) as [StageCategory, { accent: string; light: string; label: string }][]).map(([key, cfg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: cfg.accent }} />
              {cfg.label}
            </div>
          ))}
        </div>

        {/* Timeline ────────────────────────────────────────── */}
        <div className="card" style={{ padding: 'var(--space-8)' }}>
          <div style={{ position: 'relative', paddingLeft: 44 }}>

            {/* Connector line */}
            <div style={{ position: 'absolute', left: 13, top: 14, bottom: 14, width: 2, backgroundColor: 'var(--border-subtle)', borderRadius: 99 }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: `${progressPct}%`,
                backgroundColor: 'var(--color-success)',
                borderRadius: 99, transition: 'height 0.4s ease',
              }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              {timeline.map((item, index) => {
                const cat = getStageCategory(item.stage);
                const catCfg = CATEGORY_COLORS[cat];
                const relatedUrl = getRelatedUrl(item.related_type, item.related_id);
                const hasFooter = !!item.notes || (item.documents && item.documents.length > 0);

                return (
                  <div key={index} style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ position: 'absolute', left: -44, top: 0 }}>
                      <StatusDot status={item.status} />
                    </div>

                    <div style={{
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border-subtle)',
                      borderLeft: `3px solid ${catCfg.accent}`,
                      backgroundColor: 'var(--card-bg)',
                      overflow: 'hidden',
                    }}>
                      {/* Card header */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        padding: 'var(--space-4) var(--space-5)',
                        gap: 'var(--space-4)', flexWrap: 'wrap',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                            <CategoryPill stage={item.stage} />
                            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: 0 }}>
                              {item.stage_name}
                            </h3>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
                            {item.user && (
                              <MetaChip icon={<IconUser />} label={item.user}
                                sub={item.user_role ? formatRole(item.user_role) : undefined}
                              />
                            )}
                            {item.timestamp && (
                              <MetaChip icon={<IconClock />} label={formatDate(item.timestamp)} />
                            )}
                            {item.duration && (
                              <MetaChip icon={<IconTimer />} label={item.duration} highlight />
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
                          <StatusBadge status={item.status} />
                          {relatedUrl !== '#' && (
                            <Link href={relatedUrl} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 'var(--text-sm)', color: 'var(--color-primary)',
                              textDecoration: 'none', fontWeight: 'var(--weight-medium)',
                              padding: '4px 10px', borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-primary)',
                              transition: 'background-color 0.15s',
                            }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary-light)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                            >
                              View <IconExternalLink />
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Notes / attachments footer */}
                      {hasFooter && (
                        <div style={{
                          borderTop: '1px solid var(--border-subtle)',
                          padding: 'var(--space-3) var(--space-5)',
                          display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
                          backgroundColor: 'var(--surface-inset)',
                        }}>
                          {item.notes && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <span style={{ color: 'var(--text-tertiary)', marginTop: 2, flexShrink: 0 }}><IconNote /></span>
                              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                                {item.notes}
                              </p>
                            </div>
                          )}
                          {item.documents && item.documents.length > 0 && (
                            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                              {item.documents.map((doc, di) => (
                                <a key={di} href={doc.url} target="_blank" rel="noopener noreferrer" style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 6,
                                  padding: '4px 10px', borderRadius: 'var(--radius-md)',
                                  fontSize: 12, color: 'var(--text-primary)',
                                  backgroundColor: 'var(--card-bg)',
                                  border: '1px solid var(--border-subtle)',
                                  textDecoration: 'none', fontWeight: 'var(--weight-medium)',
                                  transition: 'border-color 0.15s',
                                }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
                                >
                                  <span style={{ color: 'var(--text-secondary)' }}>
                                    {doc.type === 'image' ? <IconImage /> : <IconFile />}
                                  </span>
                                  {doc.name}
                                  <span style={{ color: 'var(--text-tertiary)' }}><IconExternalLink size={11} /></span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Summary ─────────────────────────────────────────── */}
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)' }}>
            <SummaryTile label="Current stage" value={timeline[timeline.length - 1]?.stage_name || '—'} />
            <SummaryTile label="Total steps" value={String(timeline.length)} />
            <SummaryTile label="Completed" value={String(completedCount)} highlight="success" />
            <SummaryTile label="Pending" value={String(timeline.filter(i => i.status === 'pending' || i.status === 'in_progress').length)} highlight="warn" />
            <SummaryTile label="Rejected" value={String(timeline.filter(i => i.status === 'rejected').length)} highlight="error" />
            <SummaryTile label="Total duration" value={total_duration || '—'} />
          </div>
        </div>

      </PageShell>
    </MainLayout>
  );
}
