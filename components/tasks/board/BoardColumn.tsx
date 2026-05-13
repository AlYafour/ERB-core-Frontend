'use client';

import { useState } from 'react';
import type { TaskListItem, TaskStatus } from '@/types';
import { STATUS_CONFIG } from '../shared/constants';
import { BoardCard } from './BoardCard';

interface Props {
  status: TaskStatus;
  tasks: TaskListItem[];
  onCardClick: (id: number) => void;
  onDrop: (taskId: number, targetStatus: TaskStatus) => void;
}

export function BoardColumn({ status, tasks, onCardClick, onDrop }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const { label, color } = STATUS_CONFIG[status];

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = Number(e.dataTransfer.getData('taskId'));
    const fromStatus = e.dataTransfer.getData('fromStatus') as TaskStatus;
    if (taskId && fromStatus !== status) {
      onDrop(taskId, status);
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        width: 280,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 12,
        border: isDragOver ? `2px dashed ${color}` : '2px dashed transparent',
        background: isDragOver ? `${color}08` : 'transparent',
        transition: 'all 0.15s',
        minHeight: 100,
      }}
    >
      {/* Column Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 0 12px 2px',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-primary)',
            flex: 1,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 22,
            height: 22,
            borderRadius: 99,
            background: tasks.length > 0 ? `${color}18` : 'var(--surface-subtle)',
            color: tasks.length > 0 ? color : 'var(--text-tertiary)',
            fontSize: 11,
            fontWeight: 700,
            padding: '0 6px',
          }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {tasks.map((t) => (
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
        ))}
        {tasks.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '28px 16px',
              borderRadius: 10,
              border: `1.5px dashed ${color}30`,
              color: 'var(--text-tertiary)',
              fontSize: 12,
            }}
          >
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}
