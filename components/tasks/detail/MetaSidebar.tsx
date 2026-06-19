'use client';

import type { TaskDetail, TaskStatus } from '@/types';
import { STATUS_CONFIG, PRIORITY_CONFIG, TYPE_LABEL, fmtDate, isOverdue } from '../shared/constants';
import { UserRow } from './_shared';

interface Props {
  task: TaskDetail;
  onStatusChange?: (s: TaskStatus) => void;
  onPriorityChange: (p: TaskDetail['priority']) => void;
  changingMeta: boolean;
}

export function MetaSidebar({ task, onPriorityChange, changingMeta }: Props) {
  const od = isOverdue(task);
  const statusCfg = STATUS_CONFIG[task.status];

  return (
    <aside className="task-meta-sidebar">

      {/* Status — read-only badge; changes via workflow action buttons only */}
      <div>
        <p className="meta-label">Status</p>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          border: `1.5px solid ${statusCfg.border}`,
          background: statusCfg.bg, color: statusCfg.color,
          userSelect: 'none',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: statusCfg.color, flexShrink: 0,
          }} />
          {statusCfg.label}
        </span>
        <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '4px 0 0', fontStyle: 'italic' }}>
          Changes automatically via actions below
        </p>
      </div>

      {/* Priority */}
      <div>
        <p className="meta-label">Priority</p>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['critical', 'high', 'medium', 'low'] as const).map((p) => {
            const pc = PRIORITY_CONFIG[p];
            const active = task.priority === p;
            return (
              <button
                key={p}
                onClick={() => onPriorityChange(p)}
                disabled={changingMeta}
                className="task-workflow-btn"
                style={{
                  flex: 1, padding: '5px 0', fontSize: 9, textTransform: 'capitalize',
                  border: `1.5px solid ${active ? pc.color : 'var(--border-subtle)'}`,
                  background: active ? pc.bg : 'transparent',
                  color: active ? pc.color : 'var(--text-tertiary)',
                }}
              >
                {p === 'critical' ? 'Crit' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Assignee */}
      <div>
        <p className="meta-label">Assignee</p>
        {task.assigned_to_detail ? (
          <UserRow
            name={task.assigned_to_detail.full_name}
            url={task.assigned_to_detail.avatar_url}
          />
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', margin: 0 }}>
            Unassigned
          </p>
        )}
      </div>

      {/* Type */}
      <div>
        <p className="meta-label">Type</p>
        <span className="task-type-badge">{TYPE_LABEL[task.task_type]}</span>
      </div>

      {/* Due date */}
      <div>
        <p className="meta-label">Due Date</p>
        {task.due_date ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            fontSize: 12, fontWeight: od ? 700 : 500,
            color: od ? 'var(--status-error)' : 'var(--text-primary)',
            background: od ? 'var(--status-error-bg)' : 'transparent',
            padding: od ? '4px 8px' : '0',
            borderRadius: od ? 6 : 0,
          }}>
            {fmtDate(task.due_date, 'dt')}
          </span>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', margin: 0 }}>
            No due date
          </p>
        )}
      </div>

      {/* Approval */}
      {task.requires_approval && (
        <div>
          <p className="meta-label">Approval</p>
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: 'var(--task-assigned-bg)',
            border: '1px solid var(--task-assigned-border)',
            color: 'var(--task-assigned)',
          }}>
            Required
          </span>
        </div>
      )}

      {/* Created by */}
      <div>
        <p className="meta-label">Created by</p>
        {task.created_by_detail ? (
          <UserRow
            name={task.created_by_detail.full_name}
            url={task.created_by_detail.avatar_url}
            sub={fmtDate(task.created_at, 'dt')}
          />
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>
        )}
      </div>

      {/* Timeline */}
      {(task.started_at || task.submitted_at || task.approved_by_detail) && (
        <div>
          <p className="meta-label">Timeline</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {task.started_at && (
              <div>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: 0 }}>Started</p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, margin: 0 }}>
                  {fmtDate(task.started_at, 'dt')}
                </p>
              </div>
            )}
            {task.submitted_at && (
              <div>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: 0 }}>Submitted</p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, margin: 0 }}>
                  {fmtDate(task.submitted_at, 'dt')}
                </p>
              </div>
            )}
            {task.approved_by_detail && (
              <div>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: 0 }}>Approved by</p>
                <UserRow
                  name={task.approved_by_detail.full_name}
                  url={task.approved_by_detail.avatar_url}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
