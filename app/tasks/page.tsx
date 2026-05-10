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

const ORANGE = '#F97316';

const STATUS: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  draft:       { label: 'Draft',         color: '#64748B', bg: '#F1F5F9' },
  assigned:    { label: 'Assigned',      color: '#3B82F6', bg: '#EFF6FF' },
  accepted:    { label: 'Accepted',      color: '#8B5CF6', bg: '#F5F3FF' },
  in_progress: { label: 'In Progress',   color: '#F59E0B', bg: '#FFFBEB' },
  submitted:   { label: 'Submitted',     color: '#10B981', bg: '#ECFDF5' },
  review:      { label: 'Under Review',  color: '#F97316', bg: '#FFF7ED' },
  approved:    { label: 'Approved',      color: '#16A34A', bg: '#DCFCE7' },
  rejected:    { label: 'Rejected',      color: '#EF4444', bg: '#FEF2F2' },
  closed:      { label: 'Closed',        color: '#94A3B8', bg: '#F8FAFC' },
};

const PRIORITY: Record<TaskPriority, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#EF4444' },
  high:     { label: 'High',     color: '#F97316' },
  medium:   { label: 'Medium',   color: '#EAB308' },
  low:      { label: 'Low',      color: '#94A3B8' },
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

function Av({ name, url, size = 28 }: { name: string; url?: string | null; size?: number }) {
  const i = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return url
    ? <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: ORANGE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, flexShrink: 0 }}>{i}</div>;
}

function StatusPill({ s }: { s: TaskStatus }) {
  const { label, color, bg } = STATUS[s];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 99, background: bg, fontSize: 11, fontWeight: 600, color, whiteSpace: 'nowrap', border: `1px solid ${color}30` }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
      {label}
    </span>
  );
}

function PrioBar({ p }: { p: TaskPriority }) {
  const { color, label } = PRIORITY[p];
  const levels = { critical: 4, high: 3, medium: 2, low: 1 };
  return (
    <span title={label} style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 14, flexShrink: 0 }}>
      {[1, 2, 3, 4].map(l => (
        <span key={l} style={{ width: 3, borderRadius: 2, background: l <= levels[p] ? color : 'var(--border-primary)', height: l === 1 ? 5 : l === 2 ? 7 : l === 3 ? 10 : 13 }} />
      ))}
    </span>
  );
}

// ─── kanban card ──────────────────────────────────────────────────────────────

function KCard({ t, onClick }: { t: TaskListItem; onClick: () => void }) {
  const od = isOverdue(t);
  return (
    <div onClick={onClick} style={{
      background: 'var(--card-bg)',
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 6,
      border: '1px solid var(--border-primary)',
      borderLeft: `3px solid ${PRIORITY[t.priority].color}`,
      cursor: 'pointer',
      transition: 'box-shadow 0.15s, transform 0.1s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>{TYPE_LABEL[t.task_type]}</span>
        <PrioBar p={t.priority} />
      </div>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.45, marginBottom: 10 }}>{t.title}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t.assigned_to_detail && <Av name={t.assigned_to_detail.full_name} url={t.assigned_to_detail.avatar_url} size={20} />}
          {t.subtasks_total > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 13 }}>◫</span> {t.subtasks_done}/{t.subtasks_total}
            </span>
          )}
          {t.comments_count > 0 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {t.comments_count} comments</span>}
        </div>
        {t.due_date && (
          <span style={{ fontSize: 11, fontWeight: od ? 700 : 400, color: od ? '#EF4444' : 'var(--text-tertiary)', background: od ? '#FEF2F2' : 'transparent', padding: od ? '1px 5px' : '0', borderRadius: 4 }}>
            {od ? '⚠ ' : ''}{fmt(t.due_date)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── kanban board ─────────────────────────────────────────────────────────────

function Kanban({ tasks, onOpen }: { tasks: TaskListItem[]; onOpen: (t: TaskListItem) => void }) {
  return (
    <div style={{ display: 'flex', gap: 14, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 16 }}>
      {KANBAN_COLS.map(col => {
        const { label, color } = STATUS[col];
        const colTasks = tasks.filter(t => t.status === col);
        return (
          <div key={col} style={{ width: 285, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px', background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--border-primary)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>{label}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 99, padding: '0 7px', lineHeight: '18px' }}>{colTasks.length}</span>
            </div>
            {colTasks.map(t => <KCard key={t.id} t={t} onClick={() => onOpen(t)} />)}
            {colTasks.length === 0 && (
              <div style={{ border: '1.5px dashed var(--border-primary)', borderRadius: 8, padding: '28px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>No tasks</div>
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
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-primary)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'transparent' }}>
        <thead>
          <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
            {['P', 'Task', 'Status', 'Assignee', 'Due', 'Progress'].map((h, i) => (
              <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', border: 'none' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0
            ? <tr><td colSpan={6} style={{ padding: '52px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, border: 'none' }}>No tasks found</td></tr>
            : tasks.map((t, i) => {
              const od = isOverdue(t);
              return (
                <tr key={t.id} onClick={() => onOpen(t)}
                  style={{ borderTop: i > 0 ? '1px solid var(--border-primary)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '11px 14px', width: 24, border: 'none' }}><PrioBar p={t.priority} /></td>
                  <td style={{ padding: '11px 14px', maxWidth: 340, border: 'none' }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{TYPE_LABEL[t.task_type]}</p>
                  </td>
                  <td style={{ padding: '11px 14px', border: 'none' }}><StatusPill s={t.status} /></td>
                  <td style={{ padding: '11px 14px', border: 'none' }}>
                    {t.assigned_to_detail
                      ? <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Av name={t.assigned_to_detail.full_name} url={t.assigned_to_detail.avatar_url} size={24} /><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.assigned_to_detail.full_name}</span></div>
                      : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Unassigned</span>}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: od ? '#EF4444' : 'var(--text-secondary)', fontWeight: od ? 600 : 400, whiteSpace: 'nowrap', border: 'none' }}>
                    {od ? '⚠ ' : ''}{fmt(t.due_date)}
                  </td>
                  <td style={{ padding: '11px 14px', minWidth: 100, border: 'none' }}>
                    {t.subtasks_total > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 4, background: 'var(--bg-secondary)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: 4, background: ORANGE, borderRadius: 99, width: `${(t.subtasks_done / t.subtasks_total) * 100}%` }} />
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

  const add    = useMutation({ mutationFn: () => myTasksApi.create({ title: text.trim(), priority: prio }), onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['my-tasks'] }); qc.invalidateQueries({ queryKey: ['my-tasks-count'] }); } });
  const toggle = useMutation({ mutationFn: (id: number) => myTasksApi.toggle(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-tasks'] }); qc.invalidateQueries({ queryKey: ['my-tasks-count'] }); } });
  const del    = useMutation({ mutationFn: (id: number) => myTasksApi.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-tasks'] }); qc.invalidateQueries({ queryKey: ['my-tasks-count'] }); } });

  const pending = items.filter(t => !t.is_done);
  const done    = items.filter(t => t.is_done);

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 90, width: 320, background: 'var(--card-bg)', borderLeft: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.08)' }}>
      <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>My To-Do</p>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{pending.length} pending · {done.length} done</p>
        </div>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border-primary)', background: 'transparent', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>

      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-primary)' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && text.trim()) add.mutate(); }}
          placeholder="Add task, press Enter…"
          style={{ width: '100%', padding: '8px 11px', borderRadius: 7, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none', marginBottom: 10, fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['high', 'medium', 'low'] as const).map(p => (
            <button key={p} onClick={() => setPrio(p)} style={{
              flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${prio === p ? PRIORITY[p].color : 'var(--border-primary)'}`,
              background: prio === p ? PRIORITY[p].color + '15' : 'transparent',
              color: prio === p ? PRIORITY[p].color : 'var(--text-tertiary)',
            }}>{PRIORITY[p].label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
        {pending.length === 0 && done.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 52 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 22 }}>✓</div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>All clear!</p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Add a task above to get started</p>
          </div>
        )}

        {pending.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border-primary)' }}>
            <button onClick={() => toggle.mutate(t.id)} style={{
              width: 18, height: 18, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
              border: `2px solid ${PRIORITY[t.priority as TaskPriority]?.color || 'var(--border-primary)'}`,
              background: 'transparent',
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
              {t.due_date && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{fmt(t.due_date)}</p>}
            </div>
            <button onClick={() => del.mutate(t.id)} style={{ fontSize: 15, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', flexShrink: 0, lineHeight: 1 }}>×</button>
          </div>
        ))}

        {done.length > 0 && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '18px 0 8px' }}>Completed ({done.length})</p>
            {done.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-primary)', opacity: 0.5 }}>
                <button onClick={() => toggle.mutate(t.id)} style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, cursor: 'pointer', border: '2px solid #16A34A', background: '#16A34A', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</button>
                <p style={{ flex: 1, fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                <button onClick={() => del.mutate(t.id)} style={{ fontSize: 15, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', flexShrink: 0, lineHeight: 1 }}>×</button>
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
  const [tab, setTab]         = useState<'sub' | 'comments' | 'activity'>('sub');
  const [comment, setComment] = useState('');
  const [newSub, setNewSub]   = useState('');
  const [reason, setReason]   = useState('');
  const [showRej, setShowRej] = useState(false);

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
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ width: 640, background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="animate-spin" style={{ width: 28, height: 28, border: '3px solid var(--border-primary)', borderTopColor: ORANGE, borderRadius: '50%' }} />
      </div>
    </div>
  );

  const subDone = task.subtasks.filter(x => x.is_completed).length;
  const subPct  = task.subtasks.length > 0 ? Math.round((subDone / task.subtasks.length) * 100) : 0;

  const Btn = ({ label, fn, color, bg }: { label: string; fn: () => Promise<TaskDetail>; color: string; bg: string }) => (
    <button disabled={act.isPending} onClick={() => act.mutate(fn)} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${color}40`, background: bg, color, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s', opacity: act.isPending ? 0.6 : 1 }}>{label}</button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 640, background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: '-4px 0 40px rgba(0,0,0,0.15)' }}>

        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                <StatusPill s={task.status} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 99, background: 'var(--bg-secondary)', fontSize: 11, color: PRIORITY[task.priority].color, fontWeight: 600, border: '1px solid var(--border-primary)' }}>
                  <PrioBar p={task.priority} /> {PRIORITY[task.priority].label}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 99, background: 'var(--bg-secondary)', fontSize: 11, color: 'var(--text-secondary)', border: '1px solid var(--border-primary)' }}>{TYPE_LABEL[task.task_type]}</span>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{task.title}</h2>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
          </div>
        </div>

        {(['assigned','accepted','in_progress','review','submitted','rejected','closed','approved'].some(s => s === task.status)) && (
          <div style={{ padding: '10px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {task.status === 'assigned'                              && <Btn label="Accept"  fn={() => tasksApi.accept(task.id)}  color="#8B5CF6" bg="#F5F3FF" />}
            {['assigned','accepted'].includes(task.status)          && <Btn label="Start"   fn={() => tasksApi.start(task.id)}   color="#F59E0B" bg="#FFFBEB" />}
            {['in_progress','accepted'].includes(task.status)       && <Btn label="Submit"  fn={() => tasksApi.submit(task.id)}  color="#3B82F6" bg="#EFF6FF" />}
            {task.status === 'review'                                && <Btn label="Approve" fn={() => tasksApi.approve(task.id)} color="#16A34A" bg="#DCFCE7" />}
            {['rejected','closed','approved'].includes(task.status) && <Btn label="Reopen"  fn={() => tasksApi.reopen(task.id)}  color="#64748B" bg="#F1F5F9" />}
            {['review','submitted'].includes(task.status) && !showRej && (
              <button onClick={() => setShowRej(true)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #FCA5A540', background: '#FEF2F2', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Reject</button>
            )}
          </div>
        )}

        {showRej && (
          <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border-primary)', display: 'flex', gap: 8 }}>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Rejection reason…"
              style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid #FCA5A5', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={() => { if (reason.trim()) { act.mutate(() => tasksApi.reject(task.id, reason)); setShowRej(false); setReason(''); } }}
              style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#EF4444', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Confirm</button>
            <button onClick={() => setShowRej(false)} style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border-primary)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          </div>
        )}

        <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px 20px', paddingBottom: 20, borderBottom: '1px solid var(--border-primary)', marginBottom: 20 }}>
            {[
              ['Created by', task.created_by_detail ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Av name={task.created_by_detail.full_name} url={task.created_by_detail.avatar_url} size={20} /><span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{task.created_by_detail.full_name}</span></div> : '—'],
              ['Assigned to', task.assigned_to_detail ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Av name={task.assigned_to_detail.full_name} url={task.assigned_to_detail.avatar_url} size={20} /><span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{task.assigned_to_detail.full_name}</span></div> : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Unassigned</span>],
              ['Due date',   <span key="due" style={{ fontSize: 12, color: isOverdue(task) ? '#EF4444' : 'var(--text-primary)', fontWeight: isOverdue(task) ? 600 : 400 }}>{fmt(task.due_date)}</span>],
              ['Started',    <span key="st" style={{ fontSize: 12, color: 'var(--text-primary)' }}>{task.started_at ? fmt(task.started_at, 'dt') : '—'}</span>],
              ['Submitted',  <span key="su" style={{ fontSize: 12, color: 'var(--text-primary)' }}>{task.submitted_at ? fmt(task.submitted_at, 'dt') : '—'}</span>],
              ['Approved by', task.approved_by_detail ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Av name={task.approved_by_detail.full_name} url={task.approved_by_detail.avatar_url} size={20} /><span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{task.approved_by_detail.full_name}</span></div> : '—'],
            ].map(([label, val]) => (
              <div key={label as string}>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label as string}</p>
                <div>{val as React.ReactNode}</div>
              </div>
            ))}
          </div>

          {task.description && (
            <div style={{ marginBottom: 20, padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-primary)' }}>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{task.description}</p>
            </div>
          )}

          {task.rejection_reason && (
            <div style={{ marginBottom: 20, padding: '12px 16px', background: '#FEF2F2', borderRadius: 8, border: '1px solid #FECACA' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Rejection Reason</p>
              <p style={{ fontSize: 13, color: '#B91C1C', lineHeight: 1.5 }}>{task.rejection_reason}</p>
            </div>
          )}

          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', marginBottom: 18 }}>
            {([['sub', `Sub-tasks (${task.subtasks.length})`], ['comments', `Comments (${task.comments.filter(c => !c.is_system).length})`], ['activity', `Activity (${task.activities.length})`]] as [typeof tab, string][]).map(([v, label]) => (
              <button key={v} onClick={() => setTab(v)} style={{
                padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13,
                fontWeight: tab === v ? 700 : 400,
                color: tab === v ? ORANGE : 'var(--text-tertiary)',
                borderBottom: tab === v ? `2px solid ${ORANGE}` : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.15s',
              }}>{label}</button>
            ))}
          </div>

          {tab === 'sub' && (
            <div>
              {task.subtasks.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                    <span>{subDone}/{task.subtasks.length} done</span><span>{subPct}%</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg-secondary)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: 4, background: '#16A34A', borderRadius: 99, width: `${subPct}%`, transition: 'width 0.3s' }} />
                  </div>
                </div>
              )}
              {task.subtasks.map((s: SubTask) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border-primary)' }}>
                  <button onClick={() => toggleSub.mutate({ id: s.id, done: !s.is_completed })} style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                    border: `2px solid ${s.is_completed ? '#16A34A' : 'var(--border-primary)'}`,
                    background: s.is_completed ? '#16A34A' : 'transparent',
                    color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{s.is_completed ? '✓' : ''}</button>
                  <span style={{ flex: 1, fontSize: 13, color: s.is_completed ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: s.is_completed ? 'line-through' : 'none' }}>{s.title}</span>
                  {s.completed_by_detail && <Av name={s.completed_by_detail.full_name} url={s.completed_by_detail.avatar_url} size={18} />}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input value={newSub} onChange={e => setNewSub(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newSub.trim()) addSub.mutate(newSub.trim()); }}
                  placeholder="Add sub-task…"
                  style={{ flex: 1, padding: '8px 11px', borderRadius: 7, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={() => newSub.trim() && addSub.mutate(newSub.trim())} disabled={!newSub.trim()}
                  style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: ORANGE, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !newSub.trim() ? 0.5 : 1 }}>Add</button>
              </div>
            </div>
          )}

          {tab === 'comments' && (
            <div>
              {task.comments.filter(c => !c.is_system).map((c: TaskComment) => (
                <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                  <Av name={c.author_detail.full_name} url={c.author_detail.avatar_url} size={32} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.author_detail.full_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmt(c.created_at, 'dt')}</span>
                      <button onClick={() => delComment.mutate(c.id)} style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>✕</button>
                    </div>
                    <div style={{ padding: '10px 13px', background: 'var(--bg-secondary)', borderRadius: '0 8px 8px 8px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, border: '1px solid var(--border-primary)' }}>{c.content}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Write a comment…" rows={2}
                  style={{ flex: 1, padding: '9px 11px', borderRadius: 7, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }} />
                <button onClick={() => comment.trim() && sendComment.mutate(comment.trim())} disabled={!comment.trim()}
                  style={{ padding: '9px 18px', alignSelf: 'flex-end', borderRadius: 7, border: 'none', background: ORANGE, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !comment.trim() ? 0.5 : 1 }}>Send</button>
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div>
              {task.activities.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', paddingTop: 12 }}>No activity yet.</p>}
              {task.activities.map(a => (
                <div key={a.id} style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-start' }}>
                  <Av name={a.actor_detail.full_name} url={a.actor_detail.avatar_url} size={28} />
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.45 }}>
                      <strong>{a.actor_detail.full_name}</strong>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{a.action.replace(/_/g, ' ')}</span>
                      {a.details.reason && <span style={{ color: '#EF4444' }}> — {a.details.reason}</span>}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{fmt(a.created_at, 'dt')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {task.attachments.length > 0 && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-primary)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Attachments ({task.attachments.length})</p>
              {task.attachments.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-primary)', marginBottom: 6 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>📎</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.file_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmtSize(a.file_size)}</p>
                  </div>
                  {a.file_url && <a href={a.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: ORANGE, textDecoration: 'none', fontWeight: 600, flexShrink: 0 }}>Download</a>}
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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '100%', maxWidth: 460, background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 40px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>New Task</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border-primary)', background: 'transparent', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Title</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="What needs to be done?" style={{ width: '100%', padding: '8px 11px', borderRadius: 7, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional details…" rows={3} style={{ width: '100%', padding: '8px 11px', borderRadius: 7, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Type</label>
              <select value={form.task_type} onChange={e => setForm(p => ({ ...p, task_type: e.target.value }))} style={{ width: '100%', padding: '8px 11px', borderRadius: 7, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="task">Task</option><option value="request">Request</option><option value="issue">Issue</option><option value="followup">Follow-up</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Priority</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={{ width: '100%', padding: '8px 11px', borderRadius: 7, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Assign to</label>
            <select value={assignTo} onChange={e => setAssignTo(e.target.value)} style={{ width: '100%', padding: '8px 11px', borderRadius: 7, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}>
              <option value="">— Unassigned —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Due date</label>
            <input type="datetime-local" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} style={{ width: '100%', padding: '8px 11px', borderRadius: 7, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-primary)' }}>
            <input type="checkbox" checked={form.requires_approval} onChange={e => setForm(p => ({ ...p, requires_approval: e.target.checked }))} style={{ width: 16, height: 16, accentColor: ORANGE, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Requires approval before closing</span>
          </label>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-primary)', display: 'flex', gap: 10 }}>
          <button onClick={() => mut.mutate()} disabled={!form.title.trim() || mut.isPending}
            style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: ORANGE, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: !form.title.trim() || mut.isPending ? 0.6 : 1 }}>
            {mut.isPending ? 'Creating…' : 'Create Task'}
          </button>
          <button onClick={onClose} style={{ padding: '10px 22px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { v: '',         label: 'All Tasks' },
  { v: 'mine',     label: 'Assigned to Me' },
  { v: 'created',  label: 'Created by Me' },
  { v: 'team',     label: 'My Team' },
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

  return (
    <MainLayout>
      <div style={{ padding: '28px 28px 40px', minHeight: '100vh', marginRight: showMyTasks ? 320 : 0, transition: 'margin-right 0.2s ease' }}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 8 }}>Tasks</h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {overdueCount > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: '#FEF2F2', color: '#EF4444', fontSize: 12, fontWeight: 600, border: '1px solid #FECACA' }}>
                  ⚠ {overdueCount} overdue
                </span>
              )}
              {reviewCount > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: '#FFF7ED', color: ORANGE, fontSize: 12, fontWeight: 600, border: '1px solid #FED7AA' }}>
                  ◉ {reviewCount} pending review
                </span>
              )}
              {stats && (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{stats.my_tasks} assigned to me</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setShowMyTasks(p => !p)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8,
              border: showMyTasks ? `1.5px solid ${ORANGE}` : '1.5px solid var(--border-primary)',
              background: showMyTasks ? '#FFF7ED' : 'var(--card-bg)',
              color: showMyTasks ? ORANGE : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              My To-Do
              {(myCount as number) > 0 && (
                <span style={{ background: ORANGE, color: '#fff', borderRadius: 99, padding: '0 7px', fontSize: 11, fontWeight: 700, lineHeight: '18px', minWidth: 18, textAlign: 'center' }}>{myCount}</span>
              )}
            </button>
            <button onClick={() => setShowNew(true)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 8,
              border: 'none', background: ORANGE, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(249,115,22,0.3)', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#EA580C'; }}
              onMouseLeave={e => { e.currentTarget.style.background = ORANGE; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Task
            </button>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 18, borderBottom: '1px solid var(--border-primary)', flexWrap: 'wrap' }}>
          {TABS.map(tab => {
            const active = scope === tab.v && statusF !== 'review';
            return (
              <button key={tab.v} onClick={() => { setScope(tab.v); setStatusF(''); }} style={{
                padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 13, fontWeight: active ? 700 : 400,
                color: active ? ORANGE : 'var(--text-secondary)',
                borderBottom: active ? `2px solid ${ORANGE}` : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.15s',
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >{tab.label}</button>
            );
          })}
          {reviewCount > 0 && (
            <button onClick={() => { setScope(''); setStatusF(statusF === 'review' ? '' : 'review'); }} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: statusF === 'review' ? 700 : 500,
              color: statusF === 'review' ? ORANGE : '#C2410C',
              background: 'transparent',
              borderBottom: statusF === 'review' ? `2px solid ${ORANGE}` : '2px solid transparent',
              marginBottom: -1,
            }}>
              Pending Review
              <span style={{ background: statusF === 'review' ? ORANGE : '#FED7AA', color: statusF === 'review' ? '#fff' : '#C2410C', borderRadius: 99, padding: '0 6px', fontSize: 11, fontWeight: 700, lineHeight: '18px' }}>{reviewCount}</span>
            </button>
          )}
        </div>

        {/* ── Toolbar ───────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '10px 14px', background: 'var(--card-bg)', border: '1px solid var(--border-primary)', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"
              style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: 7, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          <select value={statusF} onChange={e => { setStatusF(e.target.value); setScope(''); }} style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--card-bg)', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <option value="">All statuses</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={priorityF} onChange={e => setPriorityF(e.target.value)} style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--card-bg)', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <option value="">All priorities</option>
            {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <div style={{ display: 'flex', border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            {(['kanban', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: view === v ? ORANGE : 'transparent',
                color: view === v ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}>
                {v === 'kanban' ? 'Board' : 'List'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ───────────────────────────────────────── */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 260 }}>
            <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-primary)', borderTopColor: ORANGE, borderRadius: '50%' }} />
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
