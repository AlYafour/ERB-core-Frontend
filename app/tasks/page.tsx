'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, subTasksApi, taskCommentsApi, myTasksApi } from '@/lib/api/tasks';
import { usersApi } from '@/lib/api/users';
import { useAuth } from '@/lib/hooks/use-auth';
import type {
  TaskListItem, TaskDetail, TaskStatus, TaskPriority, TaskType,
  SubTask, TaskComment, MyTask,
} from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — minimal, professional
// ─────────────────────────────────────────────────────────────────────────────

const STATUS: Record<TaskStatus, { label: string; dot: string }> = {
  draft:       { label: 'Draft',        dot: '#9ca3af' },
  assigned:    { label: 'Assigned',     dot: '#60a5fa' },
  accepted:    { label: 'Accepted',     dot: '#a78bfa' },
  in_progress: { label: 'In Progress',  dot: '#fbbf24' },
  submitted:   { label: 'Submitted',    dot: '#34d399' },
  review:      { label: 'Under Review', dot: '#fb923c' },
  approved:    { label: 'Approved',     dot: '#10b981' },
  rejected:    { label: 'Rejected',     dot: '#f87171' },
  closed:      { label: 'Closed',       dot: '#6b7280' },
};

const PRIORITY: Record<TaskPriority, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#ef4444' },
  high:     { label: 'High',     color: '#f97316' },
  medium:   { label: 'Medium',   color: '#eab308' },
  low:      { label: 'Low',      color: '#9ca3af' },
};

const TYPE_ICON: Record<string, string> = {
  task: '▸', request: '◈', issue: '⚠', followup: '↺',
};

const KANBAN_COLS: TaskStatus[] = ['assigned', 'in_progress', 'review', 'approved'];

// ─────────────────────────────────────────────────────────────────────────────
// Tiny helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(dt: string | null, mode: 'date' | 'datetime' = 'date') {
  if (!dt) return '—';
  const d = new Date(dt);
  if (mode === 'datetime') return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function overdue(task: { due_date: string | null; status: string }) {
  return task.due_date && !['approved', 'closed'].includes(task.status) && new Date(task.due_date) < new Date();
}

function fileSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Micro components
// ─────────────────────────────────────────────────────────────────────────────

function Av({ name, url, size = 24 }: { name: string; url?: string | null; size?: number }) {
  const i = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, flexShrink: 0 }}>{i}</div>;
}

function Dot({ color }: { color: string }) {
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />;
}

function PriBadge({ p }: { p: TaskPriority }) {
  const { label, color } = PRIORITY[p];
  return <span style={{ fontSize: 11, fontWeight: 600, color, letterSpacing: '0.02em' }}>{label}</span>;
}

function StatBadge({ status }: { status: TaskStatus }) {
  const s = STATUS[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
      <Dot color={s.dot} />{s.label}
    </span>
  );
}

function Btn({ children, onClick, variant = 'primary', size = 'sm', disabled }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; disabled?: boolean;
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, cursor: disabled ? 'default' : 'pointer',
    border: 'none', borderRadius: 6, fontWeight: 500, transition: 'opacity 0.1s',
    opacity: disabled ? 0.5 : 1,
    padding: size === 'md' ? '9px 16px' : '6px 12px',
    fontSize: size === 'md' ? 13 : 12,
  };
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#fff' },
    ghost: { background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
    danger: { background: 'transparent', color: '#ef4444', border: '1px solid #fca5a5' },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...styles[variant] }}>{children}</button>;
}

function Input({ value, onChange, placeholder, type = 'text', rows }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; rows?: number;
}) {
  const s: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 6,
    border: '1px solid var(--border)', fontSize: 13,
    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
    boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none',
  };
  return rows
    ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...s, resize: 'vertical' }} />
    : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} style={s} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Kanban card
// ─────────────────────────────────────────────────────────────────────────────

function KanbanCard({ task, onClick }: { task: TaskListItem; onClick: () => void }) {
  const od = overdue(task);
  return (
    <div onClick={onClick} style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '12px', cursor: 'pointer', marginBottom: 6,
      borderLeft: `2px solid ${PRIORITY[task.priority].color}`,
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.borderLeftColor = PRIORITY[task.priority].color; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>{TYPE_ICON[task.task_type]} {task.task_type}</span>
        <PriBadge p={task.priority} />
      </div>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 8 }}>{task.title}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {task.assigned_to_detail && <Av name={task.assigned_to_detail.full_name} url={task.assigned_to_detail.avatar_url} size={20} />}
          {task.subtasks_total > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{task.subtasks_done}/{task.subtasks_total}</span>
          )}
        </div>
        {task.due_date && (
          <span style={{ fontSize: 11, color: od ? '#ef4444' : 'var(--text-tertiary)', fontWeight: od ? 600 : 400 }}>
            {od && '! '}{fmt(task.due_date)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Kanban board
// ─────────────────────────────────────────────────────────────────────────────

function Kanban({ tasks, onClick }: { tasks: TaskListItem[]; onClick: (t: TaskListItem) => void }) {
  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 8 }}>
      {KANBAN_COLS.map(col => {
        const s = STATUS[col];
        const colTasks = tasks.filter(t => t.status === col);
        return (
          <div key={col} style={{ width: 272, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px 10px' }}>
              <Dot color={s.dot} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', borderRadius: 99, padding: '1px 7px', border: '1px solid var(--border)' }}>{colTasks.length}</span>
            </div>
            <div style={{ minHeight: 40 }}>
              {colTasks.map(t => <KanbanCard key={t.id} task={t} onClick={() => onClick(t)} />)}
              {colTasks.length === 0 && <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>Empty</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// List view
// ─────────────────────────────────────────────────────────────────────────────

function ListView({ tasks, onClick }: { tasks: TaskListItem[]; onClick: (t: TaskListItem) => void }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Task', 'Status', 'Priority', 'Assignee', 'Due', 'Progress'].map(h => (
              <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--bg-secondary)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No tasks found</td></tr>
          ) : tasks.map((t, i) => {
            const od = overdue(t);
            return (
              <tr key={t.id} onClick={() => onClick(t)} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '10px 14px', maxWidth: 320 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: PRIORITY[t.priority].color, fontWeight: 600, flexShrink: 0 }}>▌</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{t.title}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{TYPE_ICON[t.task_type]} {t.task_type}</p>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px 14px' }}><StatBadge status={t.status} /></td>
                <td style={{ padding: '10px 14px' }}><PriBadge p={t.priority} /></td>
                <td style={{ padding: '10px 14px' }}>
                  {t.assigned_to_detail
                    ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Av name={t.assigned_to_detail.full_name} url={t.assigned_to_detail.avatar_url} size={22} /><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.assigned_to_detail.full_name}</span></div>
                    : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: od ? '#ef4444' : 'var(--text-secondary)', fontWeight: od ? 600 : 400 }}>{od && '! '}{fmt(t.due_date)}</td>
                <td style={{ padding: '10px 14px', minWidth: 100 }}>
                  {t.subtasks_total > 0 && (
                    <div>
                      <div style={{ height: 3, background: 'var(--border)', borderRadius: 99, marginBottom: 3 }}>
                        <div style={{ height: 3, background: 'var(--accent)', borderRadius: 99, width: `${(t.subtasks_done / t.subtasks_total) * 100}%` }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.subtasks_done}/{t.subtasks_total}</span>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// My Tasks panel
// ─────────────────────────────────────────────────────────────────────────────

function MyTasksPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [priority, setPriority] = useState('medium');

  const { data: tasks = [] } = useQuery<MyTask[]>({
    queryKey: ['my-tasks'],
    queryFn: () => myTasksApi.getAll(),
  });

  const add = useMutation({
    mutationFn: () => myTasksApi.create({ title: text.trim(), priority: priority as 'high' | 'medium' | 'low' }),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['my-tasks'] }); },
  });

  const toggle = useMutation({
    mutationFn: (id: number) => myTasksApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-tasks'] }),
  });

  const del = useMutation({
    mutationFn: (id: number) => myTasksApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-tasks'] }),
  });

  const pending = tasks.filter(t => !t.is_done);
  const done    = tasks.filter(t => t.is_done);

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 90,
      width: 340, background: 'var(--card-bg)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
    }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>My To-Do</h3>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{pending.length} pending</p>
        </div>
        <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>

      {/* Add */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && text.trim()) add.mutate(); }}
          placeholder="Add task and press Enter..." style={{
            width: '100%', padding: '8px 10px', borderRadius: 6,
            border: '1px solid var(--border)', fontSize: 13,
            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            boxSizing: 'border-box', outline: 'none', marginBottom: 8,
          }} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['high', 'medium', 'low'] as const).map(p => (
            <button key={p} onClick={() => setPriority(p)} style={{
              padding: '3px 10px', borderRadius: 99, border: `1px solid ${priority === p ? PRIORITY[p].color : 'var(--border)'}`,
              background: priority === p ? PRIORITY[p].color + '15' : 'transparent',
              fontSize: 11, fontWeight: 600, color: priority === p ? PRIORITY[p].color : 'var(--text-tertiary)',
              cursor: 'pointer',
            }}>{PRIORITY[p].label}</button>
          ))}
          <button onClick={() => text.trim() && add.mutate()} disabled={!text.trim() || add.isPending} style={{
            marginLeft: 'auto', padding: '5px 12px', borderRadius: 6, border: 'none',
            background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>+ Add</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {pending.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <button onClick={() => toggle.mutate(t.id)} style={{
              width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${PRIORITY[t.priority as TaskPriority]?.color || 'var(--border)'}`,
              background: 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} />
            <p style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>{t.title}</p>
            <span style={{ fontSize: 10, fontWeight: 700, color: PRIORITY[t.priority as TaskPriority]?.color || 'var(--text-tertiary)' }}>{(t.priority as string).slice(0, 1).toUpperCase()}</span>
            <button onClick={() => del.mutate(t.id)} style={{ fontSize: 14, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', opacity: 0.5 }}>×</button>
          </div>
        ))}

        {done.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Done ({done.length})</p>
            {done.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)', opacity: 0.5 }}>
                <button onClick={() => toggle.mutate(t.id)} style={{
                  width: 18, height: 18, borderRadius: 4, border: '1.5px solid #10b981',
                  background: '#10b981', cursor: 'pointer', flexShrink: 0, color: '#fff', fontSize: 11,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✓</button>
                <p style={{ flex: 1, fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>{t.title}</p>
                <button onClick={() => del.mutate(t.id)} style={{ fontSize: 14, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>×</button>
              </div>
            ))}
          </div>
        )}

        {tasks.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <p style={{ fontSize: 24, marginBottom: 8 }}>✓</p>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Your to-do list is empty</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Task detail drawer
// ─────────────────────────────────────────────────────────────────────────────

function TaskDrawer({ taskId, onClose }: { taskId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [newSub, setNewSub] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [tab, setTab] = useState<'subtasks' | 'comments' | 'activity'>('subtasks');

  const { data: task, isLoading } = useQuery<TaskDetail>({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.getById(taskId),
  });

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['task', taskId] });
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['task-stats'] });
  };

  const act = useMutation({ mutationFn: (fn: () => Promise<TaskDetail>) => fn(), onSuccess: inv });
  const postComment = useMutation({ mutationFn: (c: string) => taskCommentsApi.create({ task: taskId, content: c }), onSuccess: () => { setComment(''); inv(); } });
  const addSub = useMutation({ mutationFn: (t: string) => subTasksApi.create({ task: taskId, title: t }), onSuccess: () => { setNewSub(''); inv(); } });
  const toggleSub = useMutation({ mutationFn: ({ id, done }: { id: number; done: boolean }) => done ? subTasksApi.complete(id) : subTasksApi.reopen(id), onSuccess: inv });
  const delComment = useMutation({ mutationFn: (id: number) => taskCommentsApi.delete(id), onSuccess: inv });

  if (isLoading || !task) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 660, background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 28, height: 28, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      </div>
    );
  }

  const s = STATUS[task.status];
  const subDone = task.subtasks.filter(x => x.is_completed).length;
  const subPct = task.subtasks.length > 0 ? Math.round((subDone / task.subtasks.length) * 100) : 0;

  const ActionButton = ({ label, fn, color = 'var(--accent)' }: { label: string; fn: () => Promise<TaskDetail>; color?: string }) => (
    <button disabled={act.isPending} onClick={() => act.mutate(fn)} style={{
      padding: '5px 12px', borderRadius: 5, border: `1px solid ${color}20`,
      background: color + '12', color, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    }}>{label}</button>
  );

  const metaRow = (label: string, val: React.ReactNode) => (
    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{val}</div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 660, background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <StatBadge status={task.status} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>·</span>
                <PriBadge p={task.priority} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>·</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{TYPE_ICON[task.task_type]} {task.task_type}</span>
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{task.title}</h2>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '10px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {task.status === 'assigned'                               && <ActionButton label="✓ Accept"   fn={() => tasksApi.accept(task.id)}   color="#8b5cf6" />}
          {['assigned','accepted'].includes(task.status)           && <ActionButton label="▶ Start"    fn={() => tasksApi.start(task.id)}    color="#f59e0b" />}
          {['in_progress','accepted'].includes(task.status)        && <ActionButton label="↑ Submit"   fn={() => tasksApi.submit(task.id)}   color="#3b82f6" />}
          {task.status === 'review'                                 && <ActionButton label="✓ Approve"  fn={() => tasksApi.approve(task.id)}  color="#10b981" />}
          {['rejected','closed','approved'].includes(task.status)  && <ActionButton label="↩ Reopen"   fn={() => tasksApi.reopen(task.id)}   color="#6b7280" />}
          {['review','submitted'].includes(task.status) && !showReject && (
            <button onClick={() => setShowReject(true)} style={{ padding: '5px 12px', borderRadius: 5, border: '1px solid #fca5a580', background: '#ef444412', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✗ Reject</button>
          )}
        </div>

        {/* Reject input */}
        {showReject && (
          <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection..."
              style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #fca5a5', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }} />
            <Btn onClick={() => { if (!rejectReason.trim()) return; act.mutate(() => tasksApi.reject(task.id, rejectReason)); setShowReject(false); setRejectReason(''); }} variant="danger">Confirm</Btn>
            <Btn onClick={() => setShowReject(false)} variant="ghost">Cancel</Btn>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, padding: '20px 24px' }}>

          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 20px', padding: '0 0 20px', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
            {metaRow('Created by', task.created_by_detail ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Av name={task.created_by_detail.full_name} url={task.created_by_detail.avatar_url} size={20} />{task.created_by_detail.full_name}</div> : '—')}
            {metaRow('Assigned to', task.assigned_to_detail ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Av name={task.assigned_to_detail.full_name} url={task.assigned_to_detail.avatar_url} size={20} />{task.assigned_to_detail.full_name}</div> : <span style={{ color: 'var(--text-tertiary)' }}>Unassigned</span>)}
            {metaRow('Due date', <span style={{ color: overdue(task) ? '#ef4444' : 'inherit' }}>{fmt(task.due_date)}</span>)}
            {metaRow('Started', task.started_at ? fmt(task.started_at, 'datetime') : '—')}
            {metaRow('Submitted', task.submitted_at ? fmt(task.submitted_at, 'datetime') : '—')}
            {metaRow('Approved by', task.approved_by_detail ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Av name={task.approved_by_detail.full_name} url={task.approved_by_detail.avatar_url} size={20} />{task.approved_by_detail.full_name}</div> : '—')}
          </div>

          {/* Description */}
          {task.description && (
            <div style={{ marginBottom: 20, padding: '14px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{task.description}</p>
            </div>
          )}

          {/* Rejection reason */}
          {task.rejection_reason && (
            <div style={{ marginBottom: 20, padding: '12px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rejection Reason</p>
              <p style={{ fontSize: 13, color: '#b91c1c' }}>{task.rejection_reason}</p>
            </div>
          )}

          {/* Tabs */}
          <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 16, display: 'flex', gap: 0 }}>
            {([['subtasks', `Sub-tasks (${task.subtasks.length})`], ['comments', `Comments (${task.comments.filter(c => !c.is_system).length})`], ['activity', `Activity (${task.activities.length})`]] as [typeof tab, string][]).map(([v, label]) => (
              <button key={v} onClick={() => setTab(v)} style={{
                padding: '8px 14px', border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 12, fontWeight: tab === v ? 700 : 500,
                color: tab === v ? 'var(--accent)' : 'var(--text-tertiary)',
                borderBottom: tab === v ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1,
              }}>{label}</button>
            ))}
          </div>

          {/* Subtasks tab */}
          {tab === 'subtasks' && (
            <div>
              {task.subtasks.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{subDone}/{task.subtasks.length} done</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{subPct}%</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--border)', borderRadius: 99 }}>
                    <div style={{ height: 3, background: '#10b981', borderRadius: 99, width: `${subPct}%`, transition: 'width 0.3s' }} />
                  </div>
                </div>
              )}
              {task.subtasks.map((s: SubTask) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <button onClick={() => toggleSub.mutate({ id: s.id, done: !s.is_completed })} style={{
                    width: 18, height: 18, borderRadius: 4, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: s.is_completed ? '#10b981' : 'transparent',
                    border: s.is_completed ? '1.5px solid #10b981' : '1.5px solid var(--border)',
                    color: '#fff', fontSize: 11,
                  }}>{s.is_completed ? '✓' : ''}</button>
                  <span style={{ flex: 1, fontSize: 13, color: s.is_completed ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: s.is_completed ? 'line-through' : 'none' }}>{s.title}</span>
                  {s.completed_by_detail && <Av name={s.completed_by_detail.full_name} url={s.completed_by_detail.avatar_url} size={18} />}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input value={newSub} onChange={e => setNewSub(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newSub.trim()) addSub.mutate(newSub.trim()); }}
                  placeholder="Add sub-task..." style={{
                    flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)',
                    fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none',
                  }} />
                <Btn onClick={() => newSub.trim() && addSub.mutate(newSub.trim())} disabled={!newSub.trim()}>Add</Btn>
              </div>
            </div>
          )}

          {/* Comments tab */}
          {tab === 'comments' && (
            <div>
              {task.comments.filter(c => !c.is_system).map((c: TaskComment) => (
                <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  <Av name={c.author_detail.full_name} url={c.author_detail.avatar_url} size={30} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.author_detail.full_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmt(c.created_at, 'datetime')}</span>
                      <button onClick={() => delComment.mutate(c.id)} style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: '0 8px 8px 8px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, border: '1px solid var(--border)' }}>{c.content}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Write a comment..." rows={2}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }} />
                <Btn onClick={() => comment.trim() && postComment.mutate(comment.trim())} disabled={!comment.trim()} variant="primary">Send</Btn>
              </div>
            </div>
          )}

          {/* Activity tab */}
          {tab === 'activity' && (
            <div>
              {task.activities.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', paddingTop: 16 }}>No activity yet.</p>}
              {task.activities.map(a => (
                <div key={a.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <Av name={a.actor_detail.full_name} url={a.actor_detail.avatar_url} size={24} />
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      <strong>{a.actor_detail.full_name}</strong>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{a.action.replace(/_/g, ' ')}</span>
                      {a.details.reason && <span style={{ color: '#ef4444' }}> — {a.details.reason}</span>}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{fmt(a.created_at, 'datetime')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Attachments */}
          {task.attachments.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Attachments ({task.attachments.length})</p>
              {task.attachments.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 7, border: '1px solid var(--border)', marginBottom: 6 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>📎</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.file_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fileSize(a.file_size)}</p>
                  </div>
                  {a.file_url && <a href={a.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Download</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create task drawer
// ─────────────────────────────────────────────────────────────────────────────

function CreateDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', task_type: 'task', priority: 'medium', requires_approval: true, due_date: '' });
  const [assignTo, setAssignTo] = useState('');

  const { data: users = [] } = useQuery({
    queryKey: ['users-mini'],
    queryFn: () => usersApi.getAll({ page_size: 200 }).then(r => r.results || []),
  });

  const mutation = useMutation({
    mutationFn: () => tasksApi.create({
      title: form.title, description: form.description,
      task_type: form.task_type as TaskType, priority: form.priority as TaskPriority,
      requires_approval: form.requires_approval,
      due_date: form.due_date || undefined,
      assigned_to: assignTo ? Number(assignTo) : undefined,
    } as unknown as Partial<TaskDetail>),
    onSuccess: () => { onCreated(); onClose(); },
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 460, background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>New Task</h2>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <Field label="Title">
            <Input value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} placeholder="What needs to be done?" />
          </Field>
          <Field label="Description">
            <Input value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} placeholder="Optional details..." rows={3} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Type">
              <select value={form.task_type} onChange={e => setForm(p => ({ ...p, task_type: e.target.value }))} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                <option value="task">Task</option>
                <option value="request">Request</option>
                <option value="issue">Issue</option>
                <option value="followup">Follow-up</option>
              </select>
            </Field>
            <Field label="Priority">
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
          </div>
          <Field label="Assign to">
            <select value={assignTo} onChange={e => setAssignTo(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}>
              <option value="">— Unassigned —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}</option>)}
            </select>
          </Field>
          <Field label="Due date">
            <input type="datetime-local" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
            <input type="checkbox" checked={form.requires_approval} onChange={e => setForm(p => ({ ...p, requires_approval: e.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Requires approval</span>
          </label>
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button onClick={() => mutation.mutate()} disabled={!form.title.trim() || mutation.isPending} style={{ flex: 1, padding: '9px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !form.title.trim() || mutation.isPending ? 0.6 : 1 }}>
            {mutation.isPending ? 'Creating...' : 'Create Task'}
          </button>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

const SCOPES = [
  { v: '',         label: 'All' },
  { v: 'mine',     label: 'Assigned to me' },
  { v: 'created',  label: 'Created by me' },
  { v: 'team',     label: 'My team' },
  { v: 'watching', label: 'Watching' },
];

export default function TasksPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [view,      setView]      = useState<'kanban' | 'list'>('kanban');
  const [scope,     setScope]     = useState('');
  const [status,    setStatus]    = useState('');
  const [priority,  setPriority]  = useState('');
  const [search,    setSearch]    = useState('');
  const [taskId,    setTaskId]    = useState<number | null>(null);
  const [showNew,   setShowNew]   = useState(false);
  const [showMyTasks, setShowMyTasks] = useState(false);

  const { data: raw, isLoading } = useQuery({
    queryKey: ['tasks', scope, status, priority, search],
    queryFn: () => tasksApi.getAll({
      scope: scope as 'mine' | 'created' | 'team' | 'watching' | undefined || undefined,
      status: status || undefined, priority: priority || undefined,
      search: search || undefined, page_size: 300,
    }),
  });

  const { data: stats } = useQuery({
    queryKey: ['task-stats'],
    queryFn: () => tasksApi.stats(),
  });

  const { data: myTasksCount } = useQuery<number>({
    queryKey: ['my-tasks-count'],
    queryFn: () => myTasksApi.getAll().then(r => r.filter(t => !t.is_done).length),
  });

  const tasks: TaskListItem[] = Array.isArray(raw) ? raw : (raw as { results?: TaskListItem[] })?.results || [];
  const reviewCount = stats?.pending_review ?? 0;
  const overdueCount = stats?.overdue ?? 0;

  const sel = 'style';
  const selStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer' };

  return (
    <MainLayout>
      <div style={{ padding: '20px 24px', minHeight: '100vh', paddingRight: showMyTasks ? 364 : 24, transition: 'padding-right 0.2s' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Tasks</h1>
            {stats && (
              <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
                {overdueCount > 0 && <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{overdueCount} overdue</span>}
                {reviewCount > 0 && <span style={{ fontSize: 12, color: '#f97316', fontWeight: 600 }}>{reviewCount} pending review</span>}
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{stats.my_tasks} assigned to me</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowMyTasks(p => !p)} style={{
              padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)',
              background: showMyTasks ? 'var(--bg-secondary)' : 'transparent',
              color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              My To-Do
              {(myTasksCount ?? 0) > 0 && (
                <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 99, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>{myTasksCount}</span>
              )}
            </button>
            <button onClick={() => setShowNew(true)} style={{
              padding: '7px 16px', borderRadius: 7, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>+ New Task</button>
          </div>
        </div>

        {/* Scope tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 14 }}>
          {SCOPES.map(s => (
            <button key={s.v} onClick={() => setScope(s.v)} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
              background: scope === s.v ? 'var(--accent)' : 'transparent',
              color: scope === s.v ? '#fff' : 'var(--text-secondary)',
              fontWeight: scope === s.v ? 600 : 400,
            }}>{s.label}</button>
          ))}
          {reviewCount > 0 && (
            <button onClick={() => { setScope(''); setStatus('review'); }} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
              background: status === 'review' ? '#f97316' : '#fff7ed',
              color: status === 'review' ? '#fff' : '#c2410c', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>Review <span style={{ background: status === 'review' ? 'rgba(255,255,255,0.3)' : '#fed7aa', borderRadius: 99, padding: '0 5px', fontSize: 11 }}>{reviewCount}</span></button>
          )}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ ...selStyle, width: '100%', paddingLeft: 30, boxSizing: 'border-box' }} />
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-tertiary)' }}>⌕</span>
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)} style={selStyle}>
            <option value="">All statuses</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={priority} onChange={e => setPriority(e.target.value)} style={selStyle}>
            <option value="">All priorities</option>
            {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {(['kanban', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: view === v ? 'var(--accent)' : 'transparent',
                color: view === v ? '#fff' : 'var(--text-secondary)',
              }}>{v === 'kanban' ? 'Board' : 'List'}</button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <div style={{ width: 28, height: 28, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        ) : view === 'kanban'
          ? <Kanban tasks={tasks} onClick={t => setTaskId(t.id)} />
          : <ListView tasks={tasks} onClick={t => setTaskId(t.id)} />
        }
      </div>

      {showMyTasks && <MyTasksPanel onClose={() => setShowMyTasks(false)} />}
      {taskId !== null && <TaskDrawer taskId={taskId} onClose={() => setTaskId(null)} />}
      {showNew && <CreateDrawer onClose={() => setShowNew(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['task-stats'] }); }} />}
    </MainLayout>
  );
}
