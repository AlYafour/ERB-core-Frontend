'use client';

import type { CSSProperties } from 'react';
import type { TaskListItem } from '@/types';
import { TaskAvatar } from '../shared/TaskAvatar';
import { PriorityBar } from '../shared/PriorityBar';
import { StatusBadge } from '../shared/StatusBadge';
import { TYPE_LABEL, PRIORITY_CONFIG, fmtDate, isOverdue } from '../shared/constants';

interface Props {
  task: TaskListItem;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

export function BoardCard({ task, onClick, onDragStart }: Props) {
  const od = isOverdue(task);
  const accentColor = PRIORITY_CONFIG[task.priority].color;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={
        {
          '--k-accent': accentColor,
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid var(--border-subtle)',
          borderLeft: `3px solid ${accentColor}`,
          background: 'var(--card-bg)',
          cursor: 'pointer',
          transition: 'all 0.15s',
          userSelect: 'none',
        } as CSSProperties
      }
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {TYPE_LABEL[task.task_type]}
        </span>
        <PriorityBar priority={task.priority} />
      </div>

      {/* Title */}
      <p
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          lineHeight: 1.4,
          marginBottom: 10,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {task.title}
      </p>

      {/* Subtasks progress */}
      {task.subtasks_total > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              height: 3,
              background: 'var(--surface-subtle)',
              borderRadius: 99,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: 3,
                background: '#16A34A',
                borderRadius: 99,
                width: `${Math.round((task.subtasks_done / task.subtasks_total) * 100)}%`,
                transition: 'width 0.3s',
              }}
            />
          </div>
          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>
            {task.subtasks_done}/{task.subtasks_total} sub-tasks
          </p>
        </div>
      )}

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {task.assigned_to_detail && (
            <TaskAvatar
              name={task.assigned_to_detail.full_name}
              url={task.assigned_to_detail.avatar_url}
              size={22}
            />
          )}
          {task.comments_count > 0 && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 11,
                color: 'var(--text-tertiary)',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {task.comments_count}
            </span>
          )}
        </div>

        {task.due_date && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: od ? '#EF4444' : 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            {od && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            {fmtDate(task.due_date)}
          </span>
        )}
      </div>
    </div>
  );
}
