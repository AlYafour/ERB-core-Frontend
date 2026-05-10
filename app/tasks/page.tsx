'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, subTasksApi, taskCommentsApi, taskAttachmentsApi } from '@/lib/api/tasks';
import { usersApi } from '@/lib/api/users';
import type { TaskListItem, TaskDetail, TaskStatus, TaskPriority, SubTask, TaskComment } from '@/types';
import { useT } from '@/lib/i18n/useT';

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TaskStatus, { en: string; ar: string; color: string }> = {
  draft:       { en: 'Draft',        ar: 'مسودة',       color: '#6b7280' },
  assigned:    { en: 'Assigned',     ar: 'مُسندة',      color: '#3b82f6' },
  accepted:    { en: 'Accepted',     ar: 'مقبولة',      color: '#8b5cf6' },
  in_progress: { en: 'In Progress',  ar: 'قيد التنفيذ', color: '#f59e0b' },
  submitted:   { en: 'Submitted',    ar: 'مُقدَّمة',    color: '#06b6d4' },
  review:      { en: 'Under Review', ar: 'قيد المراجعة',color: '#f97316' },
  approved:    { en: 'Approved',     ar: 'مُعتمدة',     color: '#10b981' },
  rejected:    { en: 'Rejected',     ar: 'مرفوضة',      color: '#ef4444' },
  closed:      { en: 'Closed',       ar: 'مغلقة',       color: '#9ca3af' },
};

const PRIORITY_LABELS: Record<TaskPriority, { en: string; ar: string; color: string; bg: string }> = {
  critical: { en: 'Critical', ar: 'حرج',    color: '#ef4444', bg: '#fef2f2' },
  high:     { en: 'High',     ar: 'عالية',  color: '#f97316', bg: '#fff7ed' },
  medium:   { en: 'Medium',   ar: 'متوسطة', color: '#f59e0b', bg: '#fffbeb' },
  low:      { en: 'Low',      ar: 'منخفضة', color: '#6b7280', bg: '#f9fafb' },
};

const TYPE_LABELS: Record<string, string> = {
  task:     '📋 Task',
  request:  '📝 Request',
  issue:    '🐛 Issue',
  followup: '🔄 Follow-up',
};

const KANBAN_COLUMNS: TaskStatus[] = ['assigned', 'accepted', 'in_progress', 'review', 'approved'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(dt: string | null) {
  if (!dt) return '';
  return new Date(dt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function isOverdue(task: TaskListItem) {
  if (!task.due_date) return false;
  if (['approved', 'closed'].includes(task.status)) return false;
  return new Date(task.due_date) < new Date();
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({ user, size = 28 }: { user: { full_name: string; avatar_url: string | null }; size?: number }) {
  const initials = user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt={user.full_name} width={size} height={size}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--accent)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, flexShrink: 0,
    }}>{initials}</div>
  );
}

// ── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status, lang }: { status: TaskStatus; lang: 'en' | 'ar' }) {
  const s = STATUS_LABELS[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: s.color + '20', color: s.color, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
      {lang === 'ar' ? s.ar : s.en}
    </span>
  );
}

// ── Priority Badge ─────────────────────────────────────────────────────────────

function PriorityBadge({ priority, lang }: { priority: TaskPriority; lang: 'en' | 'ar' }) {
  const p = PRIORITY_LABELS[priority];
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: p.bg, color: p.color, whiteSpace: 'nowrap',
    }}>{lang === 'ar' ? p.ar : p.en}</span>
  );
}

// ── Task Card (Kanban) ─────────────────────────────────────────────────────────

function TaskCard({ task, lang, onClick }: { task: TaskListItem; lang: 'en' | 'ar'; onClick: () => void }) {
  const overdue = isOverdue(task);
  return (
    <div onClick={onClick} style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
      borderLeft: `3px solid ${PRIORITY_LABELS[task.priority].color}`,
      transition: 'box-shadow 0.15s', marginBottom: 8,
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{TYPE_LABELS[task.task_type]}</span>
        <PriorityBadge priority={task.priority} lang={lang} />
      </div>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.4 }}>
        {task.title}
      </p>
      {task.due_date && (
        <p style={{ fontSize: 11, color: overdue ? '#ef4444' : 'var(--text-tertiary)', marginBottom: 8 }}>
          {overdue ? '⚠️ ' : '📅 '}{formatDate(task.due_date)}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {task.assigned_to_detail && <Avatar user={task.assigned_to_detail} size={22} />}
          {task.subtasks_total > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              ✅ {task.subtasks_done}/{task.subtasks_total}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
          {task.comments_count > 0 && <span>💬 {task.comments_count}</span>}
          {task.attachments_count > 0 && <span>📎 {task.attachments_count}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Kanban Board ───────────────────────────────────────────────────────────────

function KanbanBoard({ tasks, lang, onCardClick }: {
  tasks: TaskListItem[]; lang: 'en' | 'ar'; onCardClick: (t: TaskListItem) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
      {KANBAN_COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col);
        const s = STATUS_LABELS[col];
        return (
          <div key={col} style={{
            minWidth: 260, maxWidth: 300, flexShrink: 0,
            background: 'var(--bg-secondary)', borderRadius: 12,
            padding: '12px', border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: s.color }}>{lang === 'ar' ? s.ar : s.en}</span>
              <span style={{
                background: s.color + '20', color: s.color,
                borderRadius: 99, padding: '1px 8px', fontSize: 12, fontWeight: 700,
              }}>{colTasks.length}</span>
            </div>
            <div>
              {colTasks.map(t => (
                <TaskCard key={t.id} task={t} lang={lang} onClick={() => onCardClick(t)} />
              ))}
              {colTasks.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  No tasks
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── List Row ───────────────────────────────────────────────────────────────────

function ListRow({ task, lang, onClick }: { task: TaskListItem; lang: 'en' | 'ar'; onClick: () => void }) {
  const overdue = isOverdue(task);
  return (
    <tr onClick={onClick} style={{ cursor: 'pointer', transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <td style={{ padding: '10px 12px' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{task.title}</p>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{TYPE_LABELS[task.task_type]}</p>
        </div>
      </td>
      <td style={{ padding: '10px 12px' }}>
        <StatusBadge status={task.status} lang={lang} />
      </td>
      <td style={{ padding: '10px 12px' }}>
        <PriorityBadge priority={task.priority} lang={lang} />
      </td>
      <td style={{ padding: '10px 12px' }}>
        {task.assigned_to_detail ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Avatar user={task.assigned_to_detail} size={24} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{task.assigned_to_detail.full_name}</span>
          </div>
        ) : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>}
      </td>
      <td style={{ padding: '10px 12px', fontSize: 12, color: overdue ? '#ef4444' : 'var(--text-secondary)' }}>
        {overdue ? '⚠️ ' : ''}{formatDate(task.due_date)}
      </td>
      <td style={{ padding: '10px 12px' }}>
        {task.subtasks_total > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 80 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)' }}>
              <span>{task.subtasks_done}/{task.subtasks_total}</span>
              <span>{Math.round((task.subtasks_done / task.subtasks_total) * 100)}%</span>
            </div>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 99 }}>
              <div style={{
                height: 4, borderRadius: 99, background: 'var(--accent)',
                width: `${(task.subtasks_done / task.subtasks_total) * 100}%`,
              }} />
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Task Detail Drawer ─────────────────────────────────────────────────────────

function TaskDetailDrawer({ taskId, onClose, lang, queryClient }: {
  taskId: number; onClose: () => void; lang: 'en' | 'ar';
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [comment, setComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');

  const { data: task, isLoading } = useQuery<TaskDetail>({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.getById(taskId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const actionMutation = useMutation({
    mutationFn: (fn: () => Promise<TaskDetail>) => fn(),
    onSuccess: invalidate,
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => taskCommentsApi.create({ task: taskId, content }),
    onSuccess: () => { setComment(''); invalidate(); },
  });

  const subtaskMutation = useMutation({
    mutationFn: (title: string) => subTasksApi.create({ task: taskId, title }),
    onSuccess: () => { setNewSubtask(''); invalidate(); },
  });

  const subtaskToggle = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      done ? subTasksApi.complete(id) : subTasksApi.reopen(id),
    onSuccess: invalidate,
  });

  const deleteComment = useMutation({
    mutationFn: (id: number) => taskCommentsApi.delete(id),
    onSuccess: invalidate,
  });

  if (isLoading || !task) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.4)',
      }}>
        <div style={{ width: '100%', maxWidth: 680, background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
        </div>
      </div>
    );
  }

  const canAccept    = task.status === 'assigned';
  const canStart     = ['assigned', 'accepted'].includes(task.status);
  const canSubmit    = ['in_progress', 'accepted'].includes(task.status);
  const canApprove   = task.status === 'review';
  const canReject    = ['review', 'submitted'].includes(task.status);
  const canReopen    = ['rejected', 'closed', 'approved'].includes(task.status);
  const canClose     = !['closed', 'draft'].includes(task.status);

  const subtasksDone = task.subtasks.filter(s => s.is_completed).length;
  const subtaskPct   = task.subtasks.length > 0 ? Math.round((subtasksDone / task.subtasks.length) * 100) : 0;

  const actionBtn = (label: string, color: string, fn: () => Promise<TaskDetail>, disabled = false) => (
    <button disabled={disabled || actionMutation.isPending} onClick={() => actionMutation.mutate(fn)} style={{
      padding: '6px 14px', borderRadius: 7, border: 'none', cursor: disabled ? 'default' : 'pointer',
      background: disabled ? 'var(--border)' : color, color: disabled ? 'var(--text-tertiary)' : '#fff',
      fontSize: 12, fontWeight: 600, opacity: actionMutation.isPending ? 0.7 : 1,
    }}>{label}</button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: '100%', maxWidth: 700, background: 'var(--card-bg)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              <StatusBadge status={task.status} lang={lang} />
              <PriorityBadge priority={task.priority} lang={lang} />
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '2px 8px', background: 'var(--bg-secondary)', borderRadius: 99 }}>
                {TYPE_LABELS[task.task_type]}
              </span>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{task.title}</h2>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, border: 'none', background: 'var(--bg-secondary)', cursor: 'pointer',
            color: 'var(--text-secondary)', flexShrink: 0, fontSize: 18,
          }}>×</button>
        </div>

        {/* Actions row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {canAccept  && actionBtn('✓ Accept',    '#8b5cf6', () => tasksApi.accept(task.id))}
          {canStart   && actionBtn('▶ Start',     '#f59e0b', () => tasksApi.start(task.id))}
          {canSubmit  && actionBtn('↑ Submit',    '#06b6d4', () => tasksApi.submit(task.id))}
          {canApprove && actionBtn('✓ Approve',   '#10b981', () => tasksApi.approve(task.id))}
          {canReject  && !showReject && (
            <button onClick={() => setShowReject(true)} style={{
              padding: '6px 14px', borderRadius: 7, border: '1px solid #ef4444',
              background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}>✗ Reject</button>
          )}
          {canReopen  && actionBtn('↩ Reopen',   '#6b7280', () => tasksApi.reopen(task.id))}
          {canClose && !['approved', 'closed'].includes(task.status) &&
            actionBtn('■ Close', '#1f2937', () => tasksApi.close(task.id))}
        </div>

        {/* Reject reason */}
        {showReject && (
          <div style={{ padding: '12px 24px', background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#991b1b', marginBottom: 6 }}>Rejection Reason</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Enter reason..." style={{
                  flex: 1, padding: '6px 10px', borderRadius: 7, border: '1px solid #fca5a5',
                  fontSize: 13, background: '#fff', color: 'var(--text-primary)',
                }} />
              <button onClick={() => {
                if (!rejectReason.trim()) return;
                actionMutation.mutate(() => tasksApi.reject(task.id, rejectReason));
                setShowReject(false); setRejectReason('');
              }} style={{
                padding: '6px 14px', borderRadius: 7, border: 'none',
                background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>Confirm</button>
              <button onClick={() => setShowReject(false)} style={{
                padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12,
              }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>

          {/* Meta grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
            {[
              ['Created by',   task.created_by_detail ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Avatar user={task.created_by_detail} size={22} /><span style={{ fontSize: 13 }}>{task.created_by_detail.full_name}</span></div> : '—'],
              ['Assigned to',  task.assigned_to_detail ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Avatar user={task.assigned_to_detail} size={22} /><span style={{ fontSize: 13 }}>{task.assigned_to_detail.full_name}</span></div> : <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Unassigned</span>],
              ['Due date',     <span style={{ fontSize: 13, color: (task.due_date && !['approved','closed'].includes(task.status) && new Date(task.due_date) < new Date()) ? '#ef4444' : 'var(--text-primary)' }}>{formatDate(task.due_date)}</span>],
              ['Started at',   <span style={{ fontSize: 13 }}>{task.started_at ? `${formatDate(task.started_at)} ${formatTime(task.started_at)}` : '—'}</span>],
              ['Submitted at', <span style={{ fontSize: 13 }}>{task.submitted_at ? `${formatDate(task.submitted_at)} ${formatTime(task.submitted_at)}` : '—'}</span>],
              ['Closed at',    <span style={{ fontSize: 13 }}>{task.closed_at ? `${formatDate(task.closed_at)} ${formatTime(task.closed_at)}` : '—'}</span>],
              ['Approved by',  task.approved_by_detail ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Avatar user={task.approved_by_detail} size={22} /><span style={{ fontSize: 13 }}>{task.approved_by_detail.full_name}</span></div> : '—'],
              ['Requires approval', <span style={{ fontSize: 13 }}>{task.requires_approval ? '✅ Yes' : '❌ No'}</span>],
            ].map(([label, val]) => (
              <div key={String(label)}>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label as string}</p>
                <div style={{ color: 'var(--text-primary)' }}>{val as React.ReactNode}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          {task.description && (
            <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</p>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{task.description}</p>
            </div>
          )}

          {/* Rejection reason */}
          {task.rejection_reason && (
            <div style={{ padding: '12px', background: '#fef2f2', borderRadius: 8, margin: '12px 0', border: '1px solid #fecaca' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>Rejection Reason</p>
              <p style={{ fontSize: 13, color: '#b91c1c' }}>{task.rejection_reason}</p>
            </div>
          )}

          {/* Sub-tasks */}
          <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Sub-tasks {task.subtasks.length > 0 && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400 }}>({subtasksDone}/{task.subtasks.length} · {subtaskPct}%)</span>}
              </p>
            </div>
            {task.subtasks.length > 0 && (
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, marginBottom: 10 }}>
                <div style={{ height: 4, borderRadius: 99, background: '#10b981', width: `${subtaskPct}%`, transition: 'width 0.3s' }} />
              </div>
            )}
            {task.subtasks.map((s: SubTask) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
                borderBottom: '1px solid var(--border)',
              }}>
                <input type="checkbox" checked={s.is_completed}
                  onChange={() => subtaskToggle.mutate({ id: s.id, done: !s.is_completed })}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                <span style={{
                  fontSize: 13, flex: 1, color: s.is_completed ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  textDecoration: s.is_completed ? 'line-through' : 'none',
                }}>{s.title}</span>
                {s.completed_by_detail && (
                  <Avatar user={s.completed_by_detail} size={18} />
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newSubtask.trim()) subtaskMutation.mutate(newSubtask.trim()); }}
                placeholder="Add subtask..." style={{
                  flex: 1, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)',
                  fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                }} />
              <button onClick={() => newSubtask.trim() && subtaskMutation.mutate(newSubtask.trim())}
                disabled={!newSubtask.trim() || subtaskMutation.isPending}
                style={{
                  padding: '6px 14px', borderRadius: 7, border: 'none',
                  background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>+</button>
            </div>
          </div>

          {/* Attachments */}
          {task.attachments.length > 0 && (
            <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                Attachments <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400 }}>({task.attachments.length})</span>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {task.attachments.map(a => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 20 }}>📎</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.file_name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fileSizeLabel(a.file_size)} · {a.uploaded_by_detail.full_name}</p>
                    </div>
                    {a.file_url && (
                      <a href={a.file_url} target="_blank" rel="noopener noreferrer" style={{
                        padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                        fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none',
                      }}>Download</a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs: Comments / Activity */}
          <div style={{ padding: '16px 0 0' }}>
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
              {(['details', 'activity'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: 13, fontWeight: activeTab === tab ? 700 : 500,
                  color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
                  borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -1,
                }}>
                  {tab === 'details' ? `💬 Comments (${task.comments.filter(c => !c.is_system).length})` : `📋 Activity (${task.activities.length})`}
                </button>
              ))}
            </div>

            {activeTab === 'details' && (
              <div>
                {task.comments.filter(c => !c.is_system).map((c: TaskComment) => (
                  <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <Avatar user={c.author_detail} size={30} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.author_detail.full_name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDate(c.created_at)} {formatTime(c.created_at)}</span>
                        <button onClick={() => deleteComment.mutate(c.id)} style={{
                          marginLeft: 'auto', fontSize: 11, color: '#ef4444', background: 'none',
                          border: 'none', cursor: 'pointer', padding: '0 4px',
                        }}>✕</button>
                      </div>
                      <div style={{
                        padding: '10px 12px', background: 'var(--bg-secondary)',
                        borderRadius: '0 8px 8px 8px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5,
                      }}>{c.content}</div>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <textarea value={comment} onChange={e => setComment(e.target.value)}
                    placeholder="Write a comment..." rows={2}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                      resize: 'vertical', fontFamily: 'inherit',
                    }} />
                  <button onClick={() => comment.trim() && commentMutation.mutate(comment.trim())}
                    disabled={!comment.trim() || commentMutation.isPending}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: 'none', alignSelf: 'flex-end',
                      background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    }}>Send</button>
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <div>
                {task.activities.map(a => (
                  <div key={a.id} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                    <Avatar user={a.actor_detail} size={26} />
                    <div>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                        <strong>{a.actor_detail.full_name}</strong>{' '}
                        <span style={{ color: 'var(--text-secondary)' }}>{a.action.replace(/_/g, ' ')}</span>
                        {a.details.reason && <span style={{ color: '#ef4444' }}> — {a.details.reason}</span>}
                        {a.details.note && <span style={{ color: 'var(--text-secondary)' }}> — {a.details.note}</span>}
                      </span>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{formatDate(a.created_at)} {formatTime(a.created_at)}</p>
                    </div>
                  </div>
                ))}
                {task.activities.length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0' }}>No activity yet</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create Task Drawer ─────────────────────────────────────────────────────────

function CreateTaskDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: '', description: '', task_type: 'task', priority: 'medium',
    requires_approval: true, due_date: '',
  });

  const { data: users } = useQuery({
    queryKey: ['users-mini'],
    queryFn: () => usersApi.getAll({ page_size: 200 }).then(r => r.results || []),
  });

  const [assignTo, setAssignTo] = useState('');

  const mutation = useMutation({
    mutationFn: () => tasksApi.create({
      title: form.title,
      description: form.description,
      task_type: form.task_type as TaskType,
      priority: form.priority as TaskPriority,
      requires_approval: form.requires_approval,
      due_date: form.due_date || undefined,
      assigned_to: assignTo ? Number(assignTo) : undefined,
    } as unknown as Partial<TaskDetail>),
    onSuccess: () => { onCreated(); onClose(); },
  });

  const field = (label: string, node: React.ReactNode) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</label>
      {node}
    </div>
  );

  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)',
    fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: '100%', maxWidth: 480, background: 'var(--card-bg)',
        display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>New Task</h2>
          <button onClick={onClose} style={{
            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 7, border: 'none', background: 'var(--bg-secondary)', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 18,
          }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {field('Title *', (
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Task title" style={inputStyle} />
          ))}
          {field('Description', (
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description..." rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {field('Type', (
              <select value={form.task_type} onChange={e => setForm(p => ({ ...p, task_type: e.target.value }))} style={inputStyle}>
                <option value="task">Task</option>
                <option value="request">Request</option>
                <option value="issue">Issue</option>
                <option value="followup">Follow-up</option>
              </select>
            ))}
            {field('Priority', (
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={inputStyle}>
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">⚪ Low</option>
              </select>
            ))}
          </div>
          {field('Assign to', (
            <select value={assignTo} onChange={e => setAssignTo(e.target.value)} style={inputStyle}>
              <option value="">— Unassigned —</option>
              {users && users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                </option>
              ))}
            </select>
          ))}
          {field('Due date', (
            <input type="datetime-local" value={form.due_date}
              onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} style={inputStyle} />
          ))}
          {field('Requires approval', (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.requires_approval}
                onChange={e => setForm(p => ({ ...p, requires_approval: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Needs manager approval before closing</span>
            </label>
          ))}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button onClick={() => mutation.mutate()} disabled={!form.title.trim() || mutation.isPending} style={{
            flex: 1, padding: '10px', borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            opacity: !form.title.trim() || mutation.isPending ? 0.6 : 1,
          }}>{mutation.isPending ? 'Creating...' : 'Create Task'}</button>
          <button onClick={onClose} style={{
            padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const t = useT();
  const lang = 'en';
  const qc = useQueryClient();

  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [scope, setScope] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: tasksRaw, isLoading } = useQuery({
    queryKey: ['tasks', scope, statusFilter, priorityFilter, search],
    queryFn: () => tasksApi.getAll({
      scope: scope as 'mine' | 'created' | 'team' | 'watching' | undefined || undefined,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      search: search || undefined,
      page_size: 200,
    }),
  });

  const { data: stats } = useQuery({
    queryKey: ['task-stats'],
    queryFn: () => tasksApi.stats(),
  });

  const tasks: TaskListItem[] = Array.isArray(tasksRaw)
    ? tasksRaw
    : (tasksRaw as { results?: TaskListItem[] })?.results || [];

  const statCards = stats ? [
    { label: 'My Tasks',       value: stats.my_tasks,            color: '#3b82f6' },
    { label: 'Created by me',  value: stats.created_by_me,       color: '#8b5cf6' },
    { label: 'Pending review', value: stats.pending_review,      color: '#f97316' },
    { label: 'Overdue',        value: stats.overdue,             color: '#ef4444' },
    { label: 'Done this month',value: stats.completed_this_month,color: '#10b981' },
  ] : [];

  return (
    <MainLayout>
      <div style={{ padding: '20px 24px', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>Task Management</h1>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={() => setShowCreate(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: 9, border: 'none',
            background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>+ New Task</button>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {statCards.map(s => (
              <div key={s.label} style={{
                flex: '1 1 140px', background: 'var(--card-bg)',
                border: '1px solid var(--border)', borderRadius: 10,
                padding: '14px 16px', borderTop: `3px solid ${s.color}`,
              }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</p>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
        }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-tertiary)' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks..." style={{
                width: '100%', padding: '7px 10px 7px 32px', borderRadius: 7,
                border: '1px solid var(--border)', fontSize: 13,
                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                boxSizing: 'border-box',
              }} />
          </div>

          {/* Scope */}
          <select value={scope} onChange={e => setScope(e.target.value)} style={{
            padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)',
            fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)',
          }}>
            <option value="">All Tasks</option>
            <option value="mine">My Tasks</option>
            <option value="created">Created by me</option>
            <option value="team">Team Tasks</option>
            <option value="watching">Watching</option>
          </select>

          {/* Status */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
            padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)',
            fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)',
          }}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.en}</option>
            ))}
          </select>

          {/* Priority */}
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} style={{
            padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)',
            fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)',
          }}>
            <option value="">All Priorities</option>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.en}</option>
            ))}
          </select>

          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden', marginLeft: 'auto' }}>
            {(['kanban', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 13,
                background: view === v ? 'var(--accent)' : 'transparent',
                color: view === v ? '#fff' : 'var(--text-secondary)',
                fontWeight: view === v ? 600 : 400,
              }}>{v === 'kanban' ? '📊 Kanban' : '☰ List'}</button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div className="animate-spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
          </div>
        ) : view === 'kanban' ? (
          <KanbanBoard tasks={tasks} lang={lang} onCardClick={t => setSelectedTaskId(t.id)} />
        ) : (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  {['Task', 'Status', 'Priority', 'Assignee', 'Due Date', 'Progress'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>No tasks found</td></tr>
                ) : tasks.map(t => (
                  <ListRow key={t.id} task={t} lang={lang} onClick={() => setSelectedTaskId(t.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawers */}
      {selectedTaskId && (
        <TaskDetailDrawer
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          lang={lang}
          queryClient={qc}
        />
      )}
      {showCreate && (
        <CreateTaskDrawer
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['tasks'] })}
        />
      )}
    </MainLayout>
  );
}
