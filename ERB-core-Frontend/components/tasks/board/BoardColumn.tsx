'use client';

import { useState } from 'react';
import type { TaskListItem, TaskStatus } from '@/types';
import { STATUS_CONFIG } from '../shared/constants';
import { BoardCard } from './BoardCard';

interface Props {
  status: TaskStatus;
  tasks: TaskListItem[];
  onCardClick: (id: number) => void;
  onDrop: (taskId: number, targetStatus: TaskStatus, fromStatus: TaskStatus) => void;
  onAddClick?: () => void;
}

export function BoardColumn({ status, tasks, onCardClick, onDrop, onAddClick }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const cfg = STATUS_CONFIG[status];

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const taskId = Number(e.dataTransfer.getData('taskId'));
        const fromStatus = e.dataTransfer.getData('fromStatus') as TaskStatus;
        if (taskId && fromStatus !== status) onDrop(taskId, status, fromStatus);
      }}
      style={{
        width: 288,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 14,
        background: isDragOver ? `${cfg.color}07` : 'var(--surface-subtle)',
        border: isDragOver ? `2px solid ${cfg.color}50` : '2px solid transparent',
        transition: 'background 0.15s, border-color 0.15s',
        padding: '12px 10px 10px',
        minHeight: 160,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '0 2px' }}>
        {/* Status indicator */}
        <span style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: cfg.color,
          flexShrink: 0,
          boxShadow: `0 0 0 2px ${cfg.color}25`,
        }} />
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-primary)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          flex: 1,
        }}>
          {cfg.label}
        </span>
        {/* Count badge */}
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: tasks.length > 0 ? cfg.color : 'var(--text-tertiary)',
          background: tasks.length > 0 ? cfg.bg : 'transparent',
          border: `1px solid ${tasks.length > 0 ? cfg.border : 'var(--border-subtle)'}`,
          padding: '1px 8px',
          borderRadius: 99,
          minWidth: 24,
          textAlign: 'center',
          lineHeight: '18px',
        }}>
          {tasks.length}
        </span>
      </div>

      {/* Cards list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {tasks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '32px 16px',
            borderRadius: 10,
            border: `1.5px dashed ${isDragOver ? cfg.color : 'var(--border-subtle)'}`,
            color: isDragOver ? cfg.color : 'var(--text-tertiary)',
            fontSize: 12,
            transition: 'border-color 0.15s, color 0.15s',
            background: isDragOver ? `${cfg.color}05` : 'transparent',
          }}>
            {isDragOver ? (
              <span style={{ fontWeight: 600 }}>Drop here</span>
            ) : (
              <span>No tasks</span>
            )}
          </div>
        ) : (
          tasks.map((t) => (
            <BoardCard
              key={t.id}
              task={t}
              onClick={() => onCardClick(t.id)}
              onDragStart={(e) => {
                e.dataTransfer.setData('taskId', String(t.id));
                e.dataTransfer.setData('fromStatus', t.status);
                e.dataTransfer.effectAllowed = 'move';
              }}
            />
          ))
        )}
      </div>

      {/* Add task button */}
      {onAddClick && (
        <button
          onClick={onAddClick}
          style={{
            marginTop: 10,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px dashed var(--border-subtle)',
            background: 'transparent',
            color: 'var(--text-tertiary)',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = cfg.color;
            e.currentTarget.style.color = cfg.color;
            e.currentTarget.style.background = cfg.bg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
            e.currentTarget.style.color = 'var(--text-tertiary)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add task
        </button>
      )}
    </div>
  );
}
