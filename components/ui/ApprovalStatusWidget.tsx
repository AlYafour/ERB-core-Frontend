'use client';

import { type ApprovalStatus } from '@/lib/api/approvals';

interface Props {
  approvalStatus: ApprovalStatus | null | undefined;
}

const ACTION_LABEL: Record<string, string> = {
  APPROVE: 'Approved',
  REJECT:  'Rejected',
  ESCALATE:'Escalated',
  COMMENT: 'Comment',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:  { label: 'Pending Approval', color: 'var(--color-warning, #b45309)', bg: '#fef3c7',                    border: '#fcd34d' },
  approved: { label: 'Approved',         color: '#10b981',                        bg: 'rgba(16,185,129,0.1)',       border: 'rgba(16,185,129,0.3)' },
  rejected: { label: 'Rejected',         color: '#ef4444',                        bg: 'rgba(239,68,68,0.1)',        border: 'rgba(239,68,68,0.3)' },
  cancelled:{ label: 'Cancelled',        color: 'var(--text-muted)',              bg: 'var(--surface-subtle)',      border: 'var(--border-default)' },
};

export function ApprovalStatusWidget({ approvalStatus }: Props) {
  if (!approvalStatus) return null;

  const cfg = STATUS_CONFIG[approvalStatus.status] ?? STATUS_CONFIG.pending;

  return (
    <div style={{
      border: `1px solid ${cfg.border}`,
      borderRadius: 12,
      padding: '16px 20px',
      background: cfg.bg,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: cfg.color }}>{cfg.label}</span>
          {approvalStatus.policy_name && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>via {approvalStatus.policy_name}</span>
          )}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Step {approvalStatus.current_step} of {approvalStatus.total_steps}
        </span>
      </div>

      {/* Step progress dots */}
      {approvalStatus.total_steps > 1 && (
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: approvalStatus.total_steps }, (_, i) => {
            const stepNum    = i + 1;
            const isCompleted = stepNum < approvalStatus.current_step || approvalStatus.status === 'approved';
            const isCurrent  = stepNum === approvalStatus.current_step && approvalStatus.status === 'pending';
            return (
              <div key={i} style={{
                width: 28, height: 6, borderRadius: 3,
                background: isCompleted ? '#10b981' : isCurrent ? cfg.color : 'var(--border-default)',
                transition: 'background 200ms',
              }} />
            );
          })}
        </div>
      )}

      {/* Action history */}
      {approvalStatus.actions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {approvalStatus.actions.map((action, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{
                padding: '1px 7px', borderRadius: 8, fontSize: 11, fontWeight: 600, flexShrink: 0,
                background: action.action === 'APPROVE' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                color: action.action === 'APPROVE' ? '#10b981' : '#ef4444',
              }}>
                {ACTION_LABEL[action.action] ?? action.action}
              </span>
              <span>
                <strong>{action.actor_username}</strong> — Step {action.step_order}
                {action.comment && <span style={{ color: 'var(--text-muted)' }}> · "{action.comment}"</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
