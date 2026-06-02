'use client';

import type { CSSProperties } from 'react';
import type { TaskListItem } from '@/types';
import { TaskAvatar } from '../shared/TaskAvatar';
import { TYPE_LABEL, PRIORITY_CONFIG, STATUS_CONFIG, fmtDate, isOverdue } from '../shared/constants';

interface Props {
  task: TaskListItem;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

export function BoardCard({ task, onClick, onDragStart }: Props) {
  const od = isOverdue(task);
  const prio = PRIORITY_CONFIG[task.priority];
  const statusCfg = STATUS_CONFIG[task.status];
  const progress = task.subtasks_total > 0
    ? Math.round((task.subtasks_done / task.subtasks_total) * 100)
    : null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={
        {
          background: 'var(--card-bg)',
          borderRadius: 10,
          border: '1px solid var(--border-subtle)',
          borderLeft: `3px solid ${prio.color}`,
          padding: '12px 14px 11px',
          cursor: 'pointer',
          transition: 'box-shadow 0.15s, transform 0.15s, border-color 0.15s',
          userSelect: 'none',
          position: 'relative',
          boxShadow: 'var(--shadow-xs)',
        } as CSSProperties
      }
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.10)';
        e.currentTarget.style.borderColor = 'var(--border-default)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
      }}
    >
      {/* Top row: Type chip + Priority badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          background: 'var(--surface-subtle)',
          border: '1px solid var(--border-subtle)',
          padding: '2px 6px',
          borderRadius: 4,
          lineHeight: 1.6,
        }}>
          {TYPE_LABEL[task.task_type]}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: prio.color,
          background: prio.bg,
          padding: '2px 7px',
          borderRadius: 99,
          letterSpacing: '0.03em',
          lineHeight: 1.6,
        }}>
          {prio.label}
        </span>
      </div>

      {/* Title */}
      <p style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-primary)',
        lineHeight: 1.45,
        marginBottom: progress !== null ? 10 : 12,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {task.title}
      </p>

      {/* Subtask progress */}
      {progress !== null && (
        <div style={{ marginBottom: 11 }}>
          <div style={{
            height: 3,
            background: 'var(--surface-inset)',
            borderRadius: 99,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: progress === 100 ? '#16A34A' : 'var(--brand)',
              borderRadius: 99,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>
            {task.subtasks_done}/{task.subtasks_total} subtasks
          </p>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Assignee */}
        {task.assigned_to_detail ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
            <TaskAvatar
              name={task.assigned_to_detail.full_name}
              url={task.assigned_to_detail.avatar_url}
              size={20}
            />
            <span style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {task.assigned_to_detail.full_name.split(' ')[0]}
            </span>
          </div>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}>
            <span style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              border: '1.5px dashed var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Unassigned</span>
          </div>
        )}

        {/* Right side meta icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          {task.comments_count > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, color: 'var(--text-tertiary)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {task.comments_count}
            </span>
          )}
          {task.attachments_count > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, color: 'var(--text-tertiary)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
              {task.attachments_count}
            </span>
          )}
          {task.due_date && (
            <span style={{
              fontSize: 10,
              fontWeight: od ? 700 : 400,
              color: od ? '#EF4444' : 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}>
              {od ? (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              ) : (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              )}
              {fmtDate(task.due_date)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
