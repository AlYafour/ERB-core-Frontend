'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MyTask, TaskListItem, TaskPriority } from '@/types';
import { myTasksApi, tasksApi } from '@/lib/api/tasks';
import { PRIORITY_CONFIG, fmtDate, BRAND, BRAND_HEX } from '../shared/constants';

interface Props {
  onClose: () => void;
  onOpenTask?: (id: number) => void;
}

export function TodoPanel({ onClose, onOpenTask }: Props) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [activeSection, setActiveSection] = useState<'personal' | 'assigned' | 'done'>('personal');

  const { data: items = [] } = useQuery<MyTask[]>({
    queryKey: ['my-tasks'],
    queryFn: () => myTasksApi.getAll(),
  });

  // Tasks assigned to me with pending subtasks — surfaces checklists in To-Do
  const { data: assignedWithSubs = [] } = useQuery<TaskListItem[]>({
    queryKey: ['todo-assigned-tasks'],
    queryFn: async () => {
      const raw = await tasksApi.getAll({ scope: 'mine', page_size: 100 });
      const list: TaskListItem[] = Array.isArray(raw) ? raw : (raw as { results?: TaskListItem[] }).results ?? [];
      return list.filter(
        (t) => t.subtasks_total > 0 && t.subtasks_done < t.subtasks_total &&
               !['approved', 'closed', 'rejected'].includes(t.status)
      );
    },
    staleTime: 30_000,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['my-tasks'] });
    qc.invalidateQueries({ queryKey: ['my-tasks-count'] });
  }

  const add = useMutation({
    mutationFn: () => myTasksApi.create({ title: text.trim(), priority }),
    onSuccess: () => { setText(''); invalidate(); },
  });

  const toggle = useMutation({
    mutationFn: (id: number) => myTasksApi.toggle(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['my-tasks'] });
      const prev = qc.getQueryData<MyTask[]>(['my-tasks']);
      qc.setQueryData<MyTask[]>(['my-tasks'], (old = []) =>
        old.map((t) => (t.id === id ? { ...t, is_done: !t.is_done } : t))
      );
      return { prev };
    },
    onError: (_, __, ctx) => {
      if (ctx?.prev) qc.setQueryData(['my-tasks'], ctx.prev);
    },
    onSettled: invalidate,
  });

  const del = useMutation({
    mutationFn: (id: number) => myTasksApi.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['my-tasks'] });
      const prev = qc.getQueryData<MyTask[]>(['my-tasks']);
      qc.setQueryData<MyTask[]>(['my-tasks'], (old = []) => old.filter((t) => t.id !== id));
      return { prev };
    },
    onError: (_, __, ctx) => {
      if (ctx?.prev) qc.setQueryData(['my-tasks'], ctx.prev);
    },
    onSettled: invalidate,
  });

  const pending = items.filter((t) => !t.is_done);
  const done    = items.filter((t) => t.is_done);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        zIndex: 90,
        width: 340,
        background: 'var(--card-bg)',
        borderLeft: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-6px 0 32px rgba(0,0,0,0.1)',
        animation: 'slideInRight 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `${BRAND_HEX}18`,
                border: `1.5px solid ${BRAND_HEX}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>My To-Do</p>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {pending.length + assignedWithSubs.length} pending · {done.length} done
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 18,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#FEF2F2';
              e.currentTarget.style.color = '#EF4444';
              e.currentTarget.style.borderColor = '#FECACA';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Add task input */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) add.mutate(); }}
          placeholder="Add a task, press Enter…"
          style={{
            width: '100%',
            padding: '9px 12px',
            borderRadius: 8,
            border: '1px solid var(--border-subtle)',
            fontSize: 13,
            background: 'var(--surface-subtle)',
            color: 'var(--text-primary)',
            boxSizing: 'border-box',
            outline: 'none',
            marginBottom: 10,
            fontFamily: 'inherit',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = BRAND)}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
        />
        {/* Priority selector */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['high', 'medium', 'low'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              style={{
                flex: 1,
                padding: '5px 0',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                border: `1.5px solid ${priority === p ? PRIORITY_CONFIG[p].color : 'var(--border-subtle)'}`,
                background: priority === p ? PRIORITY_CONFIG[p].bg : 'transparent',
                color: priority === p ? PRIORITY_CONFIG[p].color : 'var(--text-tertiary)',
              }}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 16px' }}>
        {pending.length === 0 && done.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 52 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: '#ECFDF5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>All clear!</p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
              Add a task above to get started
            </p>
          </div>
        ) : (
          <>
            {/* Section tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-subtle)',
                marginBottom: 12,
                marginTop: 4,
              }}
            >
              {(
                [
                  ['personal', `Personal (${pending.length})`],
                  ['assigned', `Tasks (${assignedWithSubs.length})`],
                  ['done',     `Done (${done.length})`],
                ] as [typeof activeSection, string][]
              ).map(([sec, label]) => (
                <button
                  key={sec}
                  onClick={() => setActiveSection(sec)}
                  style={{
                    padding: '7px 10px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: activeSection === sec ? 700 : 400,
                    color: activeSection === sec ? BRAND : 'var(--text-tertiary)',
                    borderBottom: activeSection === sec ? `2px solid ${BRAND}` : '2px solid transparent',
                    marginBottom: -1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Personal To-Do section */}
            {activeSection === 'personal' && (
              pending.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No personal tasks</p>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, opacity: 0.7 }}>
                    Add one above ↑
                  </p>
                </div>
              ) : (
                pending.map((t) => (
                  <TodoItem
                    key={t.id}
                    task={t}
                    onToggle={() => toggle.mutate(t.id)}
                    onDelete={() => del.mutate(t.id)}
                  />
                ))
              )
            )}

            {/* Assigned tasks with pending subtasks */}
            {activeSection === 'assigned' && (
              assignedWithSubs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No tasks with pending checklists</p>
                </div>
              ) : (
                assignedWithSubs.map((t) => (
                  <AssignedTaskItem
                    key={t.id}
                    task={t}
                    onClick={() => onOpenTask?.(t.id)}
                  />
                ))
              )
            )}

            {/* Done section */}
            {activeSection === 'done' && (
              done.length === 0 ? (
                <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', padding: '24px 0' }}>
                  Nothing completed yet
                </p>
              ) : (
                done.map((t) => (
                  <TodoItem
                    key={t.id}
                    task={t}
                    onToggle={() => toggle.mutate(t.id)}
                    onDelete={() => del.mutate(t.id)}
                    done
                  />
                ))
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TodoItem({
  task,
  onToggle,
  onDelete,
  done,
}: {
  task: MyTask;
  onToggle: () => void;
  onDelete: () => void;
  done?: boolean;
}) {
  const prioColor = PRIORITY_CONFIG[task.priority as TaskPriority]?.color || 'var(--border-subtle)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 0',
        borderBottom: '1px solid var(--border-subtle)',
        opacity: done ? 0.55 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        style={{
          width: 20,
          height: 20,
          borderRadius: 5,
          flexShrink: 0,
          cursor: 'pointer',
          border: `2px solid ${done ? '#16A34A' : prioColor}`,
          background: done ? '#16A34A' : 'transparent',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s',
        }}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2,6 5,9 10,3" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            color: done ? 'var(--text-tertiary)' : 'var(--text-primary)',
            textDecoration: done ? 'line-through' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {task.title}
        </p>
        {task.due_date && (
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {fmtDate(task.due_date)}
          </p>
        )}
      </div>

      {/* Priority dot */}
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: prioColor,
          flexShrink: 0,
        }}
        title={task.priority}
      />

      {/* Delete */}
      <button
        onClick={onDelete}
        style={{
          width: 24,
          height: 24,
          borderRadius: 5,
          fontSize: 14,
          color: 'var(--text-tertiary)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'color 0.1s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
      >
        ×
      </button>
    </div>
  );
}

function AssignedTaskItem({ task, onClick }: { task: TaskListItem; onClick: () => void }) {
  const pct = task.subtasks_total > 0
    ? Math.round((task.subtasks_done / task.subtasks_total) * 100)
    : 0;
  const overdue = task.due_date && new Date(task.due_date) < new Date();

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 0',
        borderBottom: '1px solid var(--border-subtle)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
    >
      {/* Indicator dot */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: BRAND_HEX,
          flexShrink: 0,
          marginTop: 4,
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {task.title}
        </p>

        {/* Subtask progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
          <div
            style={{
              flex: 1,
              height: 4,
              borderRadius: 99,
              background: 'var(--border-subtle)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: pct === 100 ? '#16A34A' : BRAND_HEX,
                borderRadius: 99,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>
            {task.subtasks_done}/{task.subtasks_total}
          </span>
        </div>

        {task.due_date && (
          <p
            style={{
              fontSize: 11,
              color: overdue ? '#EF4444' : 'var(--text-tertiary)',
              marginTop: 3,
            }}
          >
            {overdue && '⚠ '}{fmtDate(task.due_date)}
          </p>
        )}
      </div>

      {/* Chevron */}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-tertiary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 3 }}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );
}
