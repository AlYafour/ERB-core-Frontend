'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, PageHeader } from '@/components/ui';
import { approvalsApi } from '@/lib/api/approvals';

const DOC_LINK: Record<string, (id: number) => string> = {
  purchaserequest: id => `/purchase-requests/${id}`,
  purchaseorder:   id => `/purchase-orders/${id}`,
};

const DOC_LABEL: Record<string, string> = {
  purchaserequest: 'Purchase Request',
  purchaseorder:   'Purchase Order',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function MyApprovalsPage() {
  const router = useRouter();

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['my-pending-approvals'],
    queryFn: approvalsApi.getMyPending,
    refetchInterval: 30_000,
  });

  const inp: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '16px 20px', borderRadius: 12,
    background: 'var(--card-bg)', border: '1px solid var(--card-border)',
    cursor: 'pointer', transition: 'border-color 150ms',
  };

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="My Approvals"
          description="Documents waiting for your action"
          breadcrumbs={[{ label: 'My Approvals' }]}
        />

        {isLoading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : pending.length === 0 ? (
          <div style={{
            padding: '60px 24px', textAlign: 'center',
            background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
              All caught up
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
              No documents waiting for your approval
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map((inst: any) => {
              const model = inst.content_type_model ?? '';
              const link  = DOC_LINK[model]?.(inst.object_id) ?? null;
              const label = DOC_LABEL[model] ?? inst.request_type_name ?? 'Document';
              const steps = inst.policy_snapshot?.steps ?? [];
              const total = steps.filter((s: any) => !s.sod_skipped).length;

              return (
                <div
                  key={inst.id}
                  style={inp}
                  onClick={() => link && router.push(link)}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--card-border)'; }}
                >
                  {/* Left: dot */}
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--status-warning)', flexShrink: 0 }} />

                  {/* Center: info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Submitted by <strong>{inst.submitted_by_name ?? inst.submitted_by}</strong>
                      {' · '}{timeAgo(inst.submitted_at)}
                      {' · '}Step {inst.current_step} of {total}
                    </div>
                  </div>

                  {/* Right: arrow */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              );
            })}
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
}
