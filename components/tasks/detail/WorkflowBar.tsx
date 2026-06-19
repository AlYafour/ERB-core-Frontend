'use client';

import type { TaskDetail, TaskStatus } from '@/types';
import { STATUS_CONFIG } from '../shared/constants';
import { tasksApi } from '@/lib/api/tasks';

interface Props {
  task: TaskDetail;
  busy: boolean;
  currentUserId?: number;
  showRejectBox: boolean;
  rejectionReason: string;
  onRejectionChange: (v: string) => void;
  onToggleReject: () => void;
  onAct: (fn: () => Promise<TaskDetail>) => void;
  onReject: () => void;
  onCancelReject: () => void;
}

interface ActionButton {
  label: string;
  targetStatus: TaskStatus;
  fn: () => void;
}

function buildActions(
  task: TaskDetail,
  currentUserId: number | undefined,
  onAct: Props['onAct'],
): ActionButton[] {
  const s = task.status;
  const actions: ActionButton[] = [];

  const isAssignee = !!currentUserId && task.assigned_to === currentUserId;
  const isCreator  = !!currentUserId && task.created_by === currentUserId;
  // Can act as reviewer: creator, or any user if unassigned (task has no assignee)
  const canReview  = isCreator || !task.assigned_to;

  // ── Assignee actions ───────────────────────────────────────────────────
  // "Start Working" replaces the old two-step Accept+Start.
  // Backend already handles starting directly from 'assigned' status.
  if (['assigned', 'accepted'].includes(s) && (isAssignee || !task.assigned_to))
    actions.push({
      label: 'Start Working',
      targetStatus: 'in_progress',
      fn: () => onAct(() => tasksApi.start(task.id)),
    });

  if (['in_progress', 'accepted'].includes(s) && (isAssignee || !task.assigned_to))
    actions.push({
      label: 'Submit for Review',
      targetStatus: 'review',
      fn: () => onAct(() => tasksApi.submit(task.id)),
    });

  // ── Reviewer/creator actions ───────────────────────────────────────────
  if (s === 'review' && canReview)
    actions.push({
      label: 'Approve',
      targetStatus: 'approved',
      fn: () => onAct(() => tasksApi.approve(task.id)),
    });

  if (['rejected', 'closed', 'approved'].includes(s))
    actions.push({
      label: 'Reopen',
      targetStatus: 'in_progress',
      fn: () => onAct(() => tasksApi.reopen(task.id)),
    });

  if (s === 'approved' && canReview)
    actions.push({
      label: 'Close Task',
      targetStatus: 'closed',
      fn: () => onAct(() => tasksApi.close(task.id)),
    });

  return actions;
}

export function WorkflowBar({
  task, busy, currentUserId, showRejectBox, rejectionReason,
  onRejectionChange, onToggleReject, onAct, onReject, onCancelReject,
}: Props) {
  const actions = buildActions(task, currentUserId, onAct);
  const isCreator  = !!currentUserId && task.created_by === currentUserId;
  const canReview  = isCreator || !task.assigned_to;
  const canReject  = task.status === 'review' && canReview;

  if (actions.length === 0 && !canReject) return null;

  return (
    <div style={{ flexShrink: 0 }}>
      <div className="task-workflow-bar">
        <span className="task-workflow-bar__label">Actions</span>

        {actions.map((b) => {
          const cfg = STATUS_CONFIG[b.targetStatus];
          return (
            <button
              key={b.label}
              disabled={busy}
              onClick={b.fn}
              className="task-workflow-btn"
              style={{
                border: `1.5px solid ${cfg.border}`,
                background: cfg.bg,
                color: cfg.color,
              }}
            >
              {b.label}
            </button>
          );
        })}

        {canReject && !showRejectBox && (
          <button
            onClick={onToggleReject}
            className="task-workflow-btn"
            style={{
              border: `1.5px solid var(--task-rejected-border)`,
              background: 'var(--task-rejected-bg)',
              color: 'var(--task-rejected)',
            }}
          >
            Reject
          </button>
        )}
      </div>

      {showRejectBox && (
        <div className="task-reject-box">
          <input
            value={rejectionReason}
            onChange={(e) => onRejectionChange(e.target.value)}
            placeholder="State the rejection reason…"
            autoFocus
            className="task-input"
            style={{ flex: 1, border: '1.5px solid var(--task-rejected-border)' }}
          />
          <button
            onClick={onReject}
            disabled={!rejectionReason.trim()}
            className="task-btn task-btn--primary"
            style={{ padding: '8px 16px', opacity: rejectionReason.trim() ? 1 : 0.5 }}
          >
            Confirm
          </button>
          <button
            onClick={onCancelReject}
            className="task-btn task-btn--secondary"
            style={{ padding: '8px 14px' }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
