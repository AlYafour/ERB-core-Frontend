'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, subTasksApi, taskCommentsApi, myTasksApi } from '@/lib/api/tasks';
import { usersApi } from '@/lib/api/users';
import type {
  TaskListItem, TaskDetail, TaskStatus, TaskPriority, TaskType,
  SubTask, TaskComment, MyTask,
} from '@/types';

// ─── constants ────────────────────────────────────────────────────────────────

const STATUS: Record<TaskStatus, { label: string; dot: string }> = {
  draft:       { label: 'Draft',         dot: '#9ca3af' },
  assigned:    { label: 'Assigned',      dot: '#60a5fa' },
  accepted:    { label: 'Accepted',      dot: '#a78bfa' },
  in_progress: { label: 'In Progress',   dot: '#fbbf24' },
  submitted:   { label: 'Submitted',     dot: '#34d399' },
  review:      { label: 'Under Review',  dot: '#fb923c' },
  approved:    { label: 'Approved',      dot: '#10b981' },
  rejected:    { label: 'Rejected',      dot: '#f87171' },
  closed:      { label: 'Closed',        dot: '#6b7280' },
};

const PRIORITY: Record<TaskPriority, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#ef4444' },
  high:     { label: 'High',     color: '#f97316' },
  medium:   { label: 'Medium',   color: '#eab308' },
  low:      { label: 'Low',      color: '#9ca3af' },
};

const TYPE_LABEL: Record<string, string> = {
  task: 'Task', request: 'Request', issue: 'Issue', followup: 'Follow-up',
};

const KANBAN_COLS: TaskStatus[] = ['assigned', 'in_progress', 'review', 'approved'];

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(dt: string | null, mode: 'date' | 'dt' = 'date') {
  if (!dt) return '—';
  const d = new Date(dt);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  if (mode === 'dt') return date + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return date;
}
function isOverdue(t: { due_date: string | null; status: string }) {
  return t.due_date && !['approved', 'closed'].includes(t.status) && new Date(t.due_date) < new Date();
}
function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

// ─── micro ui ─────────────────────────────────────────────────────────────────

function Av({ name, url, size = 26 }: { name: string; url?: string | null; size?: number }) {
  const i = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, flexShrink: 0 }}>{i}</div>;
}

function StatusPill({ s }: { s: TaskStatus }) {
  const { label, dot } = STATUS[s];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 99, background: dot + '18', fontSize: 11, fontWeight: 600, color: dot, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, display: 'inline-block' }} />
      {label}
    </span>
  );
}

function PrioIcon({ p }: { p: TaskPriority }) {
  const { color } = PRIORITY[p];
  return <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} title={PRIORITY[p].label} />;
}

// ─── kanban card ──────────────────────────────────────────────────────────────

function KCard({ t, onClick }: { t: TaskListItem; onClick: () => void }) {
  const od = isOverdue(t);
  return (
    <div onClick={onClick} style={{
      background: 'var(--card-bg)', borderRadius: 8, padding: '12px 14px', marginBottom: 6,
      border: '1px solid var(--border)', borderLeft: `3px solid ${PRIORITY[t.priority].color}`,
      cursor: 'pointer',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{TYPE_LABEL[t.task_type]}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: PRIORITY[t.priority].color }}>{PRIORITY[t.priority].label}</span>
      </div>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 10 }}>{t.title}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t.assigned_to_detail && <Av name={t.assigned_to_detail.full_name} url={t.assigned_to_detail.avatar_url} size={20} />}
          {t.subtasks_total > 0 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.subtasks_done}/{t.subtasks_total}</span>}
          {t.comments_count > 0 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>💬 {t.comments_count}</span>}
        </div>
        {t.due_date && (
          <span style={{ fontSize: 11, fontWeight: od ? 700 : 400, color: od ? '#ef4444' : 'var(--text-tertiary)' }}>
            {od ? '! ' : ''}{fmt(t.due_date)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── kanban board ─────────────────────────────────────────────────────────────

function Kanban({ tasks, onOpen }: { tasks: TaskListItem[]; onOpen: (t: TaskListItem) => void }) {
  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 12 }}>
      {KANBAN_COLS.map(col => {
        const { label, dot } = STATUS[col];
        const colTasks = tasks.filter(t => t.status === col);
        return (
          <div key={col} style={{ width: 270, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '0 2px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 99, padding: '1px 7px' }}>{colTasks.length}</span>
            </div>
            {colTasks.map(t => <KCard key={t.id} t={t} onClick={() => onOpen(t)} />)}
            {colTasks.length === 0 && (
              <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>Empty</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── list view ────────────────────────────────────────────────────────────────

function ListV({ tasks, onOpen }: { tasks: TaskListItem[]; onOpen: (t: TaskListItem) => void }) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
            {['', 'Task', 'Status', 'Assignee', 'Due', ''].map((h, i) => (
              <th key={i} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0
            ? <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No tasks found</td></tr>
            : tasks.map((t, i) => {
              const od = isOverdue(t);
              return (
                <tr key={t.id} onClick={() => onOpen(t)}
                  style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 14px', width: 4 }}>
                    <PrioIcon p={t.priority} />
                  </td>
                  <td style={{ padding: '10px 14px', maxWidth: 340 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{TYPE_LABEL[t.task_type]}</p>
                  </td>
                  <td style={{ padding: '10px 14px' }}><StatusPill s={t.status} /></td>
                  <td style={{ padding: '10px 14px' }}>
                    {t.assigned_to_detail
                      ? <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Av name={t.assigned_to_detail.full_name} url={t.assigned_to_detail.avatar_url} size={22} /><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.assigned_to_detail.full_name}</span></div>
                      : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: od ? '#ef4444' : 'var(--text-secondary)', fontWeight: od ? 600 : 400, whiteSpace: 'nowrap' }}>
                    {od ? '! ' : ''}{fmt(t.due_date)}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {t.subtasks_total > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
                        <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 99 }}>
                          <div style={{ height: 3, background: 'var(--accent)', borderRadius: 99, width: `${(t.subtasks_done / t.subtasks_total) * 100}%` }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{t.subtasks_done}/{t.subtasks_total}</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          }
        </tbody>
      </table>
    </div>
  );
}

// ─── my tasks panel ───────────────────────────────────────────────────────────

function MyPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [prio, setPrio] = useState<'high' | 'medium' | 'low'>('medium');

  const { data: items = [] } = useQuery<MyTask[]>({
    queryKey: ['my-tasks'],
    queryFn: () => myTasksApi.getAll(),
  });

  const add = useMutation({
    mutationFn: () => myTasksApi.create({ title: text.trim(), priority: prio }),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['my-tasks'] }); qc.invalidateQueries({ queryKey: ['my-tasks-count'] }); },
  });
  const toggle = useMutation({
    mutationFn: (id: number) => myTasksApi.toggle(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-tasks'] }); qc.invalidateQueries({ queryKey: ['my-tasks-count'] }); },
  });
  const del = useMutation({
    mutationFn: (id: number) => myTasksApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-tasks'] }); qc.invalidateQueries({ queryKey: ['my-tasks-count'] }); },
  });

  const pending = items.filter(t => !t.is_done);
  const done    = items.filter(t => t.is_done);

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 90,
      width: 320, background: 'var(--card-bg)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.07)',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>My To-Do</p>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{pending.length} pending · {done.length} done</p>
        </div>
        <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>

      {/* Add new */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && text.trim()) add.mutate(); }}
          placeholder="Add task, press Enter…"
          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none', marginBottom: 8 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['high', 'medium', 'low'] as const).map(p => (
            <button key={p} onClick={() => setPrio(p)} style={{
              flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${prio === p ? PRIORITY[p].color : 'var(--border)'}`,
              background: prio === p ? PRIORITY[p].color : 'transparent',
              color: prio === p ? '#fff' : 'var(--text-tertiary)',
            }}>{PRIORITY[p].label}</button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 18px' }}>
        {pending.length === 0 && done.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>✓</p>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>All clear!</p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Add a task above</p>
          </div>
        )}

        {pending.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
            <button onClick={() => toggle.mutate(t.id)} style={{
              width: 18, height: 18, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
              border: `1.5px solid ${PRIORITY[t.priority as TaskPriority]?.color || 'var(--border)'}`,
              background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
              {t.due_date && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{fmt(t.due_date)}</p>}
            </div>
            <button onClick={() => del.mutate(t.id)} style={{ fontSize: 14, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.5, flexShrink: 0 }}>×</button>
          </div>
        ))}

        {done.length > 0 && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '16px 0 8px' }}>Completed ({done.length})</p>
            {done.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', opacity: 0.5 }}>
                <button onClick={() => toggle.mutate(t.id)} style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, cursor: 'pointer', border: '1.5px solid #10b981', background: '#10b981', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</button>
                <p style={{ flex: 1, fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                <button onClick={() => del.mutate(t.id)} style={{ fontSize: 14, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>×</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── task detail drawer ───────────────────────────────────────────────────────

function TaskDrawer({ taskId, onClose }: { taskId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab]           = useState<'sub' | 'comments' | 'activity'>('sub');
  const [comment, setComment]   = useState('');
  const [newSub, setNewSub]     = useState('');
  const [reason, setReason]     = useState('');
  const [showRej, setShowRej]   = useState(false);

  const { data: task, isLoading } = useQuery<TaskDetail>({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.getById(taskId),
  });

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['task', taskId] });
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['task-stats'] });
  };

  const act        = useMutation({ mutationFn: (fn: () => Promise<TaskDetail>) => fn(), onSuccess: inv });
  const sendComment = useMutation({ mutationFn: (c: string) => taskCommentsApi.create({ task: taskId, content: c }), onSuccess: () => { setComment(''); inv(); } });
  const addSub     = useMutation({ mutationFn: (t: string) => subTasksApi.create({ task: taskId, title: t }), onSuccess: () => { setNewSub(''); inv(); } });
  const toggleSub  = useMutation({ mutationFn: ({ id, done }: { id: number; done: boolean }) => done ? subTasksApi.complete(id) : subTasksApi.reopen(id), onSuccess: inv });
  const delComment = useMutation({ mutationFn: (id: number) => taskCommentsApi.delete(id), onSuccess: inv });

  if (isLoading || !task) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ width: 640, background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    </div>
  );

  const subDone = task.subtasks.filter(x => x.is_completed).length;
  const subPct  = task.subtasks.length > 0 ? Math.round((subDone / task.subtasks.length) * 100) : 0;

  const AB = ({ label, fn, col }: { label: string; fn: () => Promise<TaskDetail>; col: string }) => (
    <button disabled={act.isPending} onClick={() => act.mutate(fn)} style={{
      padding: '6px 14px', borderRadius: 6, border: `1px solid ${col}30`,
      background: col + '10', color: col, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    }}>{label}</button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 640, background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                <StatusPill s={task.status} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 99, background: 'var(--bg-secondary)', fontSize: 11, color: 'var(--text-secondary)' }}>
                  <PrioIcon p={task.priority} /> {PRIORITY[task.priority].label}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 99, background: 'var(--bg-secondary)', fontSize: 11, color: 'var(--text-tertiary)' }}>{TYPE_LABEL[task.task_type]}</span>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{task.title}</h2>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
          </div>
        </div>

        {/* Actions */}
        {(['assigned','accepted','in_progress','review','submitted','rejected','closed','approved'].some(s => s === task.status)) && (
          <div style={{ padding: '10px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {task.status === 'assigned'                             && <AB label="✓ Accept"  fn={() => tasksApi.accept(task.id)}  col="#8b5cf6" />}
            {['assigned','accepted'].includes(task.status)         && <AB label="▶ Start"   fn={() => tasksApi.start(task.id)}   col="#f59e0b" />}
            {['in_progress','accepted'].includes(task.status)      && <AB label="↑ Submit"  fn={() => tasksApi.submit(task.id)}  col="#3b82f6" />}
            {task.status === 'review'                               && <AB label="✓ Approve" fn={() => tasksApi.approve(task.id)} col="#10b981" />}
            {['rejected','closed','approved'].includes(task.status) && <AB label="↩ Reopen" fn={() => tasksApi.reopen(task.id)}  col="#6b7280" />}
            {['review','submitted'].includes(task.status) && !showRej && (
              <button onClick={() => setShowRej(true)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #fca5a530', background: '#ef444410', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✗ Reject</button>
            )}
          </div>
        )}

        {showRej && (
          <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Rejection reason…"
              style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid #fca5a5', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }} />
            <button onClick={() => { if (reason.trim()) { act.mutate(() => tasksApi.reject(task.id, reason)); setShowRej(false); setReason(''); } }}
              style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Confirm</button>
            <button onClick={() => setShowRej(false)} style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          </div>
        )}

        <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>

          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 16px', paddingBottom: 20, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
            {[
              ['Created by', task.created_by_detail ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Av name={task.created_by_detail.full_name} url={task.created_by_detail.avatar_url} size={20} /><span style={{ fontSize: 12 }}>{task.created_by_detail.full_name}</span></div> : '—'],
              ['Assigned to', task.assigned_to_detail ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Av name={task.assigned_to_detail.full_name} url={task.assigned_to_detail.avatar_url} size={20} /><span style={{ fontSize: 12 }}>{task.assigned_to_detail.full_name}</span></div> : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Unassigned</span>],
              ['Due date', <span style={{ fontSize: 12, color: isOverdue(task) ? '#ef4444' : 'var(--text-primary)', fontWeight: isOverdue(task) ? 600 : 400 }}>{fmt(task.due_date)}</span>],
              ['Started', <span style={{ fontSize: 12 }}>{task.started_at ? fmt(task.started_at, 'dt') : '—'}</span>],
              ['Submitted', <span style={{ fontSize: 12 }}>{task.submitted_at ? fmt(task.submitted_at, 'dt') : '—'}</span>],
              ['Approved by', task.approved_by_detail ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Av name={task.approved_by_detail.full_name} url={task.approved_by_detail.avatar_url} size={20} /><span style={{ fontSize: 12 }}>{task.approved_by_detail.full_name}</span></div> : '—'],
            ].map(([label, val]) => (
              <div key={label as string}>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label as string}</p>
                <div>{val as React.ReactNode}</div>
              </div>
            ))}
          </div>

          {task.description && (
            <div style={{ marginBottom: 20, padding: 14, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{task.description}</p>
            </div>
          )}

          {task.rejection_reason && (
            <div style={{ marginBottom: 20, padding: '12px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Rejection Reason</p>
              <p style={{ fontSize: 13, color: '#b91c1c' }}>{task.rejection_reason}</p>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
            {([['sub', `Sub-tasks (${task.subtasks.length})`], ['comments', `Comments (${task.comments.filter(c => !c.is_system).length})`], ['activity', `Activity (${task.activities.length})`]] as [typeof tab, string][]).map(([v, label]) => (
              <button key={v} onClick={() => setTab(v)} style={{
                padding: '8px 14px', border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 12, fontWeight: tab === v ? 700 : 400,
                color: tab === v ? 'var(--accent)' : 'var(--text-tertiary)',
                borderBottom: tab === v ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1,
              }}>{label}</button>
            ))}
          </div>

          {/* Sub-tasks */}
          {tab === 'sub' && (
            <div>
              {task.subtasks.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 5 }}>
                    <span>{subDone}/{task.subtasks.length} done</span><span>{subPct}%</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--border)', borderRadius: 99 }}>
                    <div style={{ height: 3, background: '#10b981', borderRadius: 99, width: `${subPct}%` }} />
                  </div>
                </div>
              )}
              {task.subtasks.map((s: SubTask) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <button onClick={() => toggleSub.mutate({ id: s.id, done: !s.is_completed })} style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                    border: `1.5px solid ${s.is_completed ? '#10b981' : 'var(--border)'}`,
                    background: s.is_completed ? '#10b981' : 'transparent',
                    color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{s.is_completed ? '✓' : ''}</button>
                  <span style={{ flex: 1, fontSize: 13, color: s.is_completed ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: s.is_completed ? 'line-through' : 'none' }}>{s.title}</span>
                  {s.completed_by_detail && <Av name={s.completed_by_detail.full_name} url={s.completed_by_detail.avatar_url} size={18} />}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input value={newSub} onChange={e => setNewSub(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newSub.trim()) addSub.mutate(newSub.trim()); }}
                  placeholder="Add sub-task…"
                  style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }} />
                <button onClick={() => newSub.trim() && addSub.mutate(newSub.trim())} disabled={!newSub.trim()}
                  style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Add</button>
              </div>
            </div>
          )}

          {/* Comments */}
          {tab === 'comments' && (
            <div>
              {task.comments.filter(c => !c.is_system).map((c: TaskComment) => (
                <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  <Av name={c.author_detail.full_name} url={c.author_detail.avatar_url} size={30} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.author_detail.full_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmt(c.created_at, 'dt')}</span>
                      <button onClick={() => delComment.mutate(c.id)} style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: '0 8px 8px 8px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55, border: '1px solid var(--border)' }}>{c.content}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Write a comment…" rows={2}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }} />
                <button onClick={() => comment.trim() && sendComment.mutate(comment.trim())} disabled={!comment.trim()}
                  style={{ padding: '8px 16px', alignSelf: 'flex-end', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Send</button>
              </div>
            </div>
          )}

          {/* Activity */}
          {tab === 'activity' && (
            <div>
              {task.activities.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', paddingTop: 12 }}>No activity yet.</p>}
              {task.activities.map(a => (
                <div key={a.id} style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
                  <Av name={a.actor_detail.full_name} url={a.actor_detail.avatar_url} size={26} />
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      <strong>{a.actor_detail.full_name}</strong>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{a.action.replace(/_/g, ' ')}</span>
                      {a.details.reason && <span style={{ color: '#ef4444' }}> — {a.details.reason}</span>}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{fmt(a.created_at, 'dt')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Attachments */}
          {task.attachments.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Attachments ({task.attachments.length})</p>
              {task.attachments.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 7, border: '1px solid var(--border)', marginBottom: 6 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>📎</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.file_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmtSize(a.file_size)}</p>
                  </div>
                  {a.file_url && <a href={a.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, flexShrink: 0 }}>Download</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── create drawer ────────────────────────────────────────────────────────────

function CreateDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', task_type: 'task', priority: 'medium', requires_approval: true, due_date: '' });
  const [assignTo, setAssignTo] = useState('');

  const { data: users = [] } = useQuery({
    queryKey: ['users-mini'],
    queryFn: () => usersApi.getAll({ page_size: 200 }).then(r => r.results || []),
  });

  const mut = useMutation({
    mutationFn: () => tasksApi.create({
      title: form.title, description: form.description,
      task_type: form.task_type as TaskType, priority: form.priority as TaskPriority,
      requires_approval: form.requires_approval,
      due_date: form.due_date || undefined,
      assigned_to: assignTo ? Number(assignTo) : undefined,
    } as unknown as Partial<TaskDetail>),
    onSuccess: () => { onCreated(); onClose(); },
  });

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 460, background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>New Task</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
          {[
            ['Title', <input key="t" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="What needs to be done?" style={inp} />],
            ['Description', <textarea key="d" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional details…" rows={3} style={inp} />],
          ].map(([label, node]) => (
            <div key={label as string} style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label as string}</p>
              {node as React.ReactNode}
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {[
              ['Type', <select key="ty" value={form.task_type} onChange={e => setForm(p => ({ ...p, task_type: e.target.value }))} style={inp}><option value="task">Task</option><option value="request">Request</option><option value="issue">Issue</option><option value="followup">Follow-up</option></select>],
              ['Priority', <select key="pr" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={inp}><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>],
            ].map(([label, node]) => (
              <div key={label as string}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label as string}</p>
                {node as React.ReactNode}
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Assign to</p>
            <select value={assignTo} onChange={e => setAssignTo(e.target.value)} style={inp}>
              <option value="">— Unassigned —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Due date</p>
            <input type="datetime-local" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} style={inp} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.requires_approval} onChange={e => setForm(p => ({ ...p, requires_approval: e.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Requires approval before closing</span>
          </label>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button onClick={() => mut.mutate()} disabled={!form.title.trim() || mut.isPending}
            style={{ flex: 1, padding: '10px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !form.title.trim() || mut.isPending ? 0.6 : 1 }}>
            {mut.isPending ? 'Creating…' : 'Create Task'}
          </button>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { v: '',         label: 'All tasks' },
  { v: 'mine',     label: 'Assigned to me' },
  { v: 'created',  label: 'Created by me' },
  { v: 'team',     label: 'My team' },
  { v: 'watching', label: 'Watching' },
];

export default function TasksPage() {
  const qc = useQueryClient();

  const [view,        setView]        = useState<'kanban' | 'list'>('kanban');
  const [scope,       setScope]       = useState('');
  const [statusF,     setStatusF]     = useState('');
  const [priorityF,   setPriorityF]   = useState('');
  const [search,      setSearch]      = useState('');
  const [taskId,      setTaskId]      = useState<number | null>(null);
  const [showNew,     setShowNew]     = useState(false);
  const [showMyTasks, setShowMyTasks] = useState(false);

  const { data: raw, isLoading } = useQuery({
    queryKey: ['tasks', scope, statusF, priorityF, search],
    queryFn: () => tasksApi.getAll({
      scope: scope as 'mine' | 'created' | 'team' | 'watching' | undefined || undefined,
      status: statusF || undefined, priority: priorityF || undefined,
      search: search || undefined, page_size: 300,
    }),
  });
  const { data: stats } = useQuery({ queryKey: ['task-stats'], queryFn: () => tasksApi.stats() });
  const { data: myCount = 0 } = useQuery<number>({
    queryKey: ['my-tasks-count'],
    queryFn: () => myTasksApi.getAll().then(r => r.filter(t => !t.is_done).length),
  });

  const tasks: TaskListItem[] = Array.isArray(raw) ? raw : (raw as { results?: TaskListItem[] })?.results || [];
  const reviewCount  = stats?.pending_review ?? 0;
  const overdueCount = stats?.overdue ?? 0;

  const iS: React.CSSProperties = { padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12, background: 'var(--card-bg)', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' };

  return (
    <MainLayout>
      <div style={{ padding: '24px', minHeight: '100vh', marginRight: showMyTasks ? 320 : 0, transition: 'margin-right 0.2s ease' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Tasks</h1>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {overdueCount > 0 && <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>⚠ {overdueCount} overdue</span>}
              {reviewCount  > 0 && <span style={{ fontSize: 12, color: '#f97316', fontWeight: 600 }}>◉ {reviewCount} pending review</span>}
              {stats && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{stats.my_tasks} assigned to me</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* My To-Do button */}
            <button onClick={() => setShowMyTasks(p => !p)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 14px', borderRadius: 8,
              border: showMyTasks ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: showMyTasks ? 'var(--accent)' + '10' : 'var(--card-bg)',
              color: showMyTasks ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              ☑ My To-Do
              {myCount > 0 && (
                <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700, lineHeight: '18px' }}>{myCount}</span>
              )}
            </button>
            <button onClick={() => setShowNew(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>+ New Task</button>
          </div>
        </div>

        {/* ── Scope tabs ── */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 16, flexWrap: 'wrap' }}>
          {TABS.map(tab => (
            <button key={tab.v} onClick={() => setScope(tab.v)} style={{
              padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13,
              background: scope === tab.v && statusF !== 'review' ? 'var(--accent)' : 'transparent',
              color: scope === tab.v && statusF !== 'review' ? '#fff' : 'var(--text-secondary)',
              fontWeight: scope === tab.v && statusF !== 'review' ? 600 : 400,
            }}>{tab.label}</button>
          ))}
          {reviewCount > 0 && (
            <button onClick={() => { setScope(''); setStatusF(statusF === 'review' ? '' : 'review'); }} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: statusF === 'review' ? '#f97316' : '#fff3e0',
              color: statusF === 'review' ? '#fff' : '#c2410c',
            }}>
              Pending Review
              <span style={{ background: statusF === 'review' ? 'rgba(255,255,255,0.3)' : '#fed7aa', borderRadius: 99, padding: '1px 6px', fontSize: 11 }}>{reviewCount}</span>
            </button>
          )}
        </div>

        {/* ── Toolbar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
          {/* Search */}
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-tertiary)', pointerEvents: 'none' }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"
              style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {/* Filters */}
          <select value={statusF} onChange={e => setStatusF(e.target.value)} style={iS}>
            <option value="">All statuses</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={priorityF} onChange={e => setPriorityF(e.target.value)} style={iS}>
            <option value="">All priorities</option>
            {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden', flexShrink: 0 }}>
            {(['kanban', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: view === v ? 'var(--accent)' : 'transparent',
                color: view === v ? '#fff' : 'var(--text-secondary)',
              }}>{v === 'kanban' ? '⊞ Board' : '☰ List'}</button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 240 }}>
            <div style={{ width: 30, height: 30, border: '2.5px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        ) : view === 'kanban'
          ? <Kanban tasks={tasks} onOpen={t => setTaskId(t.id)} />
          : <ListV tasks={tasks} onOpen={t => setTaskId(t.id)} />
        }
      </div>

      {showMyTasks  && <MyPanel onClose={() => setShowMyTasks(false)} />}
      {taskId !== null && <TaskDrawer taskId={taskId} onClose={() => setTaskId(null)} />}
      {showNew && <CreateDrawer onClose={() => setShowNew(false)} onCreated={() => { qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['task-stats'] }); }} />}
    </MainLayout>
  );
}
