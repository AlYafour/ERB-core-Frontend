'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskDetail, SubTask, TaskComment, TaskStatus } from '@/types';
import { tasksApi, subTasksApi, taskCommentsApi, taskAttachmentsApi } from '@/lib/api/tasks';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { TaskAvatar } from '../shared/TaskAvatar';
import { DrawerSkeleton } from '../shared/Skeletons';
import {
  BRAND, BRAND_HEX, PRIORITY_CONFIG, STATUS_CONFIG, TYPE_LABEL,
  fmtDate, isOverdue, fmtFileSize,
} from '../shared/constants';

interface Props {
  taskId: number;
  onClose: () => void;
}

type Tab = 'checklist' | 'comments' | 'activity' | 'attachments';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
      textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
    }}>
      {children}
    </p>
  );
}

function UserRow({ name, url, sub }: { name: string; url?: string | null; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <TaskAvatar name={name} url={url} size={24} />
      <div>
        <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>{name}</p>
        {sub && <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Sidebar metadata panel ────────────────────────────────────────────────────

function MetaSidebar({
  task,
  onStatusChange,
  onPriorityChange,
  changingMeta,
}: {
  task: TaskDetail;
  onStatusChange: (s: TaskStatus) => void;
  onPriorityChange: (p: TaskDetail['priority']) => void;
  changingMeta: boolean;
}) {
  const od = isOverdue(task);
  const statusCfg = STATUS_CONFIG[task.status];
  const prioCfg = PRIORITY_CONFIG[task.priority];

  return (
    <div style={{
      width: 240,
      flexShrink: 0,
      borderLeft: '1px solid var(--border-subtle)',
      padding: '20px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      overflowY: 'auto',
      background: 'var(--surface-subtle)',
    }}>
      {/* Status */}
      <div>
        <Label>Status</Label>
        <select
          value={task.status}
          onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
          disabled={changingMeta}
          style={{
            width: '100%',
            padding: '7px 10px',
            borderRadius: 8,
            border: `1.5px solid ${statusCfg.border}`,
            background: statusCfg.bg,
            color: statusCfg.color,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        >
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Priority */}
      <div>
        <Label>Priority</Label>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['critical', 'high', 'medium', 'low'] as const).map((p) => {
            const pc = PRIORITY_CONFIG[p];
            const active = task.priority === p;
            return (
              <button
                key={p}
                onClick={() => onPriorityChange(p)}
                disabled={changingMeta}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  borderRadius: 6,
                  fontSize: 9,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  border: `1.5px solid ${active ? pc.color : 'var(--border-subtle)'}`,
                  background: active ? pc.bg : 'transparent',
                  color: active ? pc.color : 'var(--text-tertiary)',
                  transition: 'all 0.12s',
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
        <Label>Assignee</Label>
        {task.assigned_to_detail ? (
          <UserRow name={task.assigned_to_detail.full_name} url={task.assigned_to_detail.avatar_url} />
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Unassigned</p>
        )}
      </div>

      {/* Type */}
      <div>
        <Label>Type</Label>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 10px',
          borderRadius: 6,
          background: 'var(--card-bg)',
          border: '1px solid var(--border-subtle)',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-secondary)',
        }}>
          {TYPE_LABEL[task.task_type]}
        </span>
      </div>

      {/* Due date */}
      <div>
        <Label>Due Date</Label>
        {task.due_date ? (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: od ? 700 : 500,
            color: od ? '#EF4444' : 'var(--text-primary)',
            background: od ? '#FEF2F2' : 'transparent',
            padding: od ? '4px 8px' : '0',
            borderRadius: od ? 6 : 0,
          }}>
            {od && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            )}
            {fmtDate(task.due_date, 'dt')}
          </span>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No due date</p>
        )}
      </div>

      {/* Requires approval */}
      {task.requires_approval && (
        <div>
          <Label>Approval</Label>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 6,
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            fontSize: 11,
            fontWeight: 600,
            color: '#3B82F6',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Required
          </span>
        </div>
      )}

      {/* Created by */}
      <div>
        <Label>Created by</Label>
        {task.created_by_detail ? (
          <UserRow
            name={task.created_by_detail.full_name}
            url={task.created_by_detail.avatar_url}
            sub={fmtDate(task.created_at, 'dt')}
          />
        ) : '—'}
      </div>

      {/* Timeline */}
      {(task.started_at || task.submitted_at || task.approved_by_detail) && (
        <div>
          <Label>Timeline</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {task.started_at && (
              <div>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Started</p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {fmtDate(task.started_at, 'dt')}
                </p>
              </div>
            )}
            {task.submitted_at && (
              <div>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Submitted</p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {fmtDate(task.submitted_at, 'dt')}
                </p>
              </div>
            )}
            {task.approved_by_detail && (
              <div>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Approved by</p>
                <UserRow
                  name={task.approved_by_detail.full_name}
                  url={task.approved_by_detail.avatar_url}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Workflow actions bar ──────────────────────────────────────────────────────

function WorkflowBar({
  task, busy, showRejectBox, rejectionReason,
  onRejectionChange, onToggleReject, onAct, onReject, onCancelReject,
}: {
  task: TaskDetail;
  busy: boolean;
  showRejectBox: boolean;
  rejectionReason: string;
  onRejectionChange: (v: string) => void;
  onToggleReject: () => void;
  onAct: (fn: () => Promise<TaskDetail>) => void;
  onReject: () => void;
  onCancelReject: () => void;
}) {
  const s = task.status as TaskStatus;
  const buttons: Array<{ label: string; color: string; bg: string; border: string; fn: () => void }> = [];

  if (s === 'assigned') buttons.push({ label: 'Accept Task', color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE', fn: () => onAct(() => tasksApi.accept(task.id)) });
  if (['assigned', 'accepted'].includes(s)) buttons.push({ label: 'Start Working', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', fn: () => onAct(() => tasksApi.start(task.id)) });
  if (['in_progress', 'accepted'].includes(s)) buttons.push({ label: 'Submit for Review', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', fn: () => onAct(() => tasksApi.submit(task.id)) });
  if (s === 'review') buttons.push({ label: '✓ Approve', color: '#16A34A', bg: '#DCFCE7', border: '#86EFAC', fn: () => onAct(() => tasksApi.approve(task.id)) });
  if (['rejected', 'closed', 'approved'].includes(s)) buttons.push({ label: 'Reopen', color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1', fn: () => onAct(() => tasksApi.reopen(task.id)) });

  if (buttons.length === 0 && !['review', 'submitted'].includes(s)) return null;

  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{
        padding: '10px 24px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 7,
        alignItems: 'center',
        background: 'var(--surface-subtle)',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 4 }}>
          Actions
        </span>
        {buttons.map((b) => (
          <button
            key={b.label}
            disabled={busy}
            onClick={b.fn}
            style={{
              padding: '6px 14px',
              borderRadius: 7,
              border: `1.5px solid ${b.border}`,
              background: b.bg,
              color: b.color,
              fontSize: 12,
              fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
              transition: 'opacity 0.15s, transform 0.1s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { if (!busy) e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
          >
            {b.label}
          </button>
        ))}
        {['review', 'submitted'].includes(s) && !showRejectBox && (
          <button
            onClick={onToggleReject}
            style={{
              padding: '6px 14px',
              borderRadius: 7,
              border: '1.5px solid #FECACA',
              background: '#FEF2F2',
              color: '#EF4444',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✕ Reject
          </button>
        )}
      </div>
      {showRejectBox && (
        <div style={{
          padding: '10px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: 8,
          background: '#FFF5F5',
        }}>
          <input
            value={rejectionReason}
            onChange={(e) => onRejectionChange(e.target.value)}
            placeholder="State the rejection reason…"
            autoFocus
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 7,
              border: '1.5px solid #FCA5A5', fontSize: 13,
              background: '#fff', color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={onReject}
            disabled={!rejectionReason.trim()}
            style={{
              padding: '8px 16px', borderRadius: 7, border: 'none',
              background: '#EF4444', color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: rejectionReason.trim() ? 'pointer' : 'not-allowed',
              opacity: rejectionReason.trim() ? 1 : 0.5,
            }}
          >
            Confirm
          </button>
          <button
            onClick={onCancelReject}
            style={{
              padding: '8px 14px', borderRadius: 7,
              border: '1px solid var(--border-subtle)',
              background: 'transparent', color: 'var(--text-secondary)',
              fontSize: 12, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ tab, setTab, counts }: { tab: Tab; setTab: (t: Tab) => void; counts: Record<Tab, number> }) {
  const tabs: [Tab, string][] = [
    ['checklist', `Checklist${counts.checklist > 0 ? ` (${counts.checklist})` : ''}`],
    ['comments',  `Comments${counts.comments > 0 ? ` (${counts.comments})` : ''}`],
    ['activity',  `Activity${counts.activity > 0 ? ` (${counts.activity})` : ''}`],
    ['attachments', `Files${counts.attachments > 0 ? ` (${counts.attachments})` : ''}`],
  ];
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: 18, flexShrink: 0 }}>
      {tabs.map(([v, label]) => (
        <button
          key={v}
          onClick={() => setTab(v)}
          style={{
            padding: '9px 16px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: tab === v ? 700 : 500,
            color: tab === v ? BRAND : 'var(--text-tertiary)',
            borderBottom: tab === v ? `2px solid ${BRAND}` : '2px solid transparent',
            marginBottom: -1,
            transition: 'color 0.12s',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Checklist tab ─────────────────────────────────────────────────────────────

function ChecklistTab({
  subtasks, newSub, onNewSubChange, onAddSubtask, onToggle,
}: {
  subtasks: SubTask[];
  newSub: string;
  onNewSubChange: (v: string) => void;
  onAddSubtask: () => void;
  onToggle: (id: number, done: boolean) => void;
}) {
  const done = subtasks.filter((s) => s.is_completed).length;
  const pct = subtasks.length > 0 ? Math.round((done / subtasks.length) * 100) : 0;

  return (
    <div>
      {/* Progress bar */}
      {subtasks.length > 0 && (
        <div style={{
          marginBottom: 16,
          padding: '12px 14px',
          background: 'var(--surface-subtle)',
          borderRadius: 10,
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              {done} of {subtasks.length} completed
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#16A34A' : BRAND }}>
              {pct}%
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--surface-inset)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: pct === 100 ? '#16A34A' : BRAND,
              borderRadius: 99,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 14 }}>
        {subtasks.map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '9px 10px',
              borderRadius: 8,
              transition: 'background 0.1s',
              background: s.is_completed ? 'var(--surface-subtle)' : 'transparent',
            }}
            onMouseEnter={(e) => { if (!s.is_completed) e.currentTarget.style.background = 'var(--surface-subtle)'; }}
            onMouseLeave={(e) => { if (!s.is_completed) e.currentTarget.style.background = 'transparent'; }}
          >
            <button
              onClick={() => onToggle(s.id, !s.is_completed)}
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                flexShrink: 0,
                cursor: 'pointer',
                border: `2px solid ${s.is_completed ? '#16A34A' : 'var(--border-default)'}`,
                background: s.is_completed ? '#16A34A' : 'transparent',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              {s.is_completed && (
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2,6 5,9 10,3"/>
                </svg>
              )}
            </button>
            <span style={{
              flex: 1, fontSize: 13,
              color: s.is_completed ? 'var(--text-tertiary)' : 'var(--text-primary)',
              textDecoration: s.is_completed ? 'line-through' : 'none',
              transition: 'all 0.15s',
            }}>
              {s.title}
            </span>
            {s.completed_by_detail && (
              <TaskAvatar name={s.completed_by_detail.full_name} url={s.completed_by_detail.avatar_url} size={18} />
            )}
          </div>
        ))}
        {subtasks.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '12px 0', textAlign: 'center' }}>
            No checklist items yet. Add one below.
          </p>
        )}
      </div>

      {/* Add item */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={newSub}
          onChange={(e) => onNewSubChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onAddSubtask(); }}
          placeholder="Add a checklist item…"
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border-subtle)', fontSize: 13,
            background: 'var(--surface-subtle)', color: 'var(--text-primary)',
            outline: 'none', fontFamily: 'inherit',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = BRAND)}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
        />
        <button
          onClick={onAddSubtask}
          disabled={!newSub.trim()}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: BRAND, color: '#fff', fontSize: 12, fontWeight: 700,
            cursor: newSub.trim() ? 'pointer' : 'not-allowed',
            opacity: newSub.trim() ? 1 : 0.5,
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Comments tab ──────────────────────────────────────────────────────────────

function CommentsTab({
  comments, comment, onCommentChange, onSend, onDelete, sending,
  editingCommentId, editCommentText, onEditStart, onEditChange,
  onEditSave, onEditCancel, savingEdit,
}: {
  comments: TaskComment[];
  comment: string;
  onCommentChange: (v: string) => void;
  onSend: () => void;
  onDelete: (id: number) => void;
  sending: boolean;
  editingCommentId: number | null;
  editCommentText: string;
  onEditStart: (id: number, content: string) => void;
  onEditChange: (v: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  savingEdit: boolean;
}) {
  return (
    <div>
      {/* Compose */}
      <div style={{
        marginBottom: 24,
        padding: '14px',
        background: 'var(--surface-subtle)',
        borderRadius: 10,
        border: '1px solid var(--border-subtle)',
      }}>
        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Write a comment…"
          rows={3}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSend(); }}
          style={{
            width: '100%',
            padding: '0',
            fontSize: 13,
            background: 'transparent',
            color: 'var(--text-primary)',
            resize: 'none',
            fontFamily: 'inherit',
            outline: 'none',
            lineHeight: 1.6,
            border: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Ctrl + Enter to send</span>
          <button
            onClick={onSend}
            disabled={!comment.trim() || sending}
            style={{
              padding: '7px 18px',
              borderRadius: 7,
              border: 'none',
              background: BRAND,
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: comment.trim() && !sending ? 'pointer' : 'not-allowed',
              opacity: comment.trim() && !sending ? 1 : 0.5,
            }}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>

      {/* Comments list */}
      {comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--border-default)"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ display: 'block', margin: '0 auto 10px' }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No comments yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {comments.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 11 }}>
              <TaskAvatar name={c.author_detail.full_name} url={c.author_detail.avatar_url} size={32} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {c.author_detail.full_name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {fmtDate(c.created_at, 'dt')}
                    {c.updated_at !== c.created_at && (
                      <span style={{ marginLeft: 4, fontStyle: 'italic' }}>(edited)</span>
                    )}
                  </span>
                  {editingCommentId !== c.id && (
                    <>
                      <button
                        onClick={() => onEditStart(c.id, c.content)}
                        style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = BRAND)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(c.id)}
                        style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
                {editingCommentId === c.id ? (
                  <div>
                    <textarea
                      value={editCommentText}
                      onChange={(e) => onEditChange(e.target.value)}
                      rows={3}
                      autoFocus
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 8,
                        border: `1.5px solid ${BRAND}`, fontSize: 13,
                        background: 'var(--surface-subtle)', color: 'var(--text-primary)',
                        resize: 'none', fontFamily: 'inherit', outline: 'none',
                        lineHeight: 1.5, boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button
                        onClick={onEditSave}
                        disabled={!editCommentText.trim() || savingEdit}
                        style={{
                          padding: '5px 14px', borderRadius: 6, border: 'none',
                          background: BRAND, color: '#fff', fontSize: 12, fontWeight: 700,
                          cursor: editCommentText.trim() && !savingEdit ? 'pointer' : 'not-allowed',
                          opacity: editCommentText.trim() && !savingEdit ? 1 : 0.5,
                        }}
                      >
                        {savingEdit ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={onEditCancel}
                        style={{
                          padding: '5px 12px', borderRadius: 6,
                          border: '1px solid var(--border-subtle)',
                          background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: '11px 14px',
                    background: 'var(--surface-subtle)',
                    borderRadius: '0 10px 10px 10px',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    lineHeight: 1.65,
                    border: '1px solid var(--border-subtle)',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {c.content}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Activity tab ──────────────────────────────────────────────────────────────

function ActivityTab({ activities }: { activities: TaskDetail['activities'] }) {
  if (activities.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-tertiary)', paddingTop: 12 }}>No activity yet.</p>;
  }
  return (
    <div>
      {activities.map((a, i) => (
        <div key={a.id} style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-start', position: 'relative' }}>
          {i < activities.length - 1 && (
            <div style={{ position: 'absolute', left: 13, top: 30, bottom: -8, width: 1, background: 'var(--border-subtle)' }} />
          )}
          <TaskAvatar name={a.actor_detail.full_name} url={a.actor_detail.avatar_url} size={28} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              <strong>{a.actor_detail.full_name}</strong>{' '}
              <span style={{ color: 'var(--text-secondary)' }}>{a.action.replace(/_/g, ' ')}</span>
              {a.details?.reason && <span style={{ color: '#EF4444' }}> — {a.details.reason}</span>}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{fmtDate(a.created_at, 'dt')}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Attachments tab ───────────────────────────────────────────────────────────

function AttachmentsTab({
  attachments, onUpload, onDelete, uploading, fileInputRef,
}: {
  attachments: TaskDetail['attachments'];
  onUpload: (file: File) => void;
  onDelete: (id: number) => void;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { onUpload(file); e.target.value = ''; }
        }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
          borderRadius: 9, border: `1.5px dashed var(--border-subtle)`,
          background: 'var(--surface-subtle)', color: 'var(--text-secondary)',
          fontSize: 13, fontWeight: 500, cursor: uploading ? 'not-allowed' : 'pointer',
          width: '100%', justifyContent: 'center', marginBottom: 16,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.color = BRAND; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        {uploading ? 'Uploading…' : 'Upload File'}
      </button>

      {attachments.length === 0 ? (
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', padding: '20px 0' }}>
          No attachments yet
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {attachments.map((a) => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              background: 'var(--surface-subtle)', borderRadius: 10, border: '1px solid var(--border-subtle)',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: `${BRAND_HEX}15`, border: `1px solid ${BRAND_HEX}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.file_name}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                  {fmtFileSize(a.file_size)}{a.uploaded_by_detail && ` · ${a.uploaded_by_detail.full_name}`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {a.file_url && (
                  <a
                    href={a.file_url} target="_blank" rel="noopener noreferrer"
                    style={{
                      fontSize: 12, color: BRAND, textDecoration: 'none', fontWeight: 600,
                      padding: '5px 11px', borderRadius: 6, border: `1px solid ${BRAND_HEX}30`,
                      background: `${BRAND_HEX}0a`,
                    }}
                  >
                    Download
                  </a>
                )}
                <button
                  onClick={() => onDelete(a.id)}
                  style={{
                    width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-subtle)',
                    background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.borderColor = '#FECACA'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

export function TaskDetailDrawer({ taskId, onClose }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>('checklist');
  const [comment, setComment] = useState('');
  const [newSub, setNewSub] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  const { data: task, isLoading } = useQuery<TaskDetail>({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.getById(taskId),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['task', taskId] });
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['task-stats'] });
  }

  const transition = useMutation({
    mutationFn: (fn: () => Promise<TaskDetail>) => fn(),
    onSuccess: invalidate,
    onError: (err: unknown) => toast(getApiError(err, 'Action failed'), 'error'),
  });

  const updateMeta = useMutation({
    mutationFn: (data: Partial<TaskDetail>) => tasksApi.update(taskId, data),
    onSuccess: invalidate,
    onError: (err: unknown) => toast(getApiError(err, 'Failed to update'), 'error'),
  });

  const addComment = useMutation({
    mutationFn: (content: string) => taskCommentsApi.create({ task: taskId, content }),
    onSuccess: () => { setComment(''); invalidate(); },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to add comment'), 'error'),
  });

  const updateComment = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) => taskCommentsApi.update(id, content),
    onSuccess: () => { setEditingCommentId(null); setEditCommentText(''); invalidate(); },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to update comment'), 'error'),
  });

  const deleteComment = useMutation({
    mutationFn: (id: number) => taskCommentsApi.delete(id),
    onSuccess: invalidate,
    onError: (err: unknown) => toast(getApiError(err, 'Failed to delete comment'), 'error'),
  });

  const addSubtask = useMutation({
    mutationFn: (title: string) => subTasksApi.create({ task: taskId, title }),
    onSuccess: () => { setNewSub(''); invalidate(); },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to add item'), 'error'),
  });

  const toggleSubtask = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      done ? subTasksApi.complete(id) : subTasksApi.reopen(id),
    onSuccess: invalidate,
    onError: (err: unknown) => toast(getApiError(err, 'Failed to update item'), 'error'),
  });

  const uploadFile = useMutation({
    mutationFn: (file: File) => taskAttachmentsApi.upload(taskId, file),
    onSuccess: invalidate,
    onError: (err: unknown) => toast(getApiError(err, 'Failed to upload file'), 'error'),
  });

  const deleteAttachment = useMutation({
    mutationFn: (id: number) => taskAttachmentsApi.delete(id),
    onSuccess: invalidate,
    onError: (err: unknown) => toast(getApiError(err, 'Failed to delete attachment'), 'error'),
  });

  const busy = transition.isPending;
  const changingMeta = updateMeta.isPending;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.45)', display: 'flex', justifyContent: 'flex-end' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%',
        maxWidth: 780,
        background: 'var(--card-bg)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-6px 0 48px rgba(0,0,0,0.18)',
        animation: 'slideInRight 0.2s var(--ease-spring)',
      }}>
        {isLoading || !task ? (
          <>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
              <CloseButton onClick={onClose} />
            </div>
            <DrawerSkeleton />
          </>
        ) : (
          <>
            {/* ── Header ─────────────────────────────────────────── */}
            <div style={{
              padding: '16px 20px 14px',
              borderBottom: '1px solid var(--border-subtle)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Type + ID row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                    background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
                    padding: '2px 8px', borderRadius: 5,
                  }}>
                    {TYPE_LABEL[task.task_type]}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>#{task.id}</span>
                </div>
                {/* Title */}
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, margin: 0 }}>
                  {task.title}
                </h2>
              </div>
              <CloseButton onClick={onClose} />
            </div>

            {/* ── Workflow bar ────────────────────────────────────── */}
            <WorkflowBar
              task={task}
              busy={busy}
              showRejectBox={showRejectBox}
              rejectionReason={rejectionReason}
              onRejectionChange={setRejectionReason}
              onToggleReject={() => setShowRejectBox((p) => !p)}
              onAct={(fn) => transition.mutate(fn)}
              onReject={() => {
                if (rejectionReason.trim()) {
                  transition.mutate(() => tasksApi.reject(task.id, rejectionReason));
                  setShowRejectBox(false);
                  setRejectionReason('');
                }
              }}
              onCancelReject={() => { setShowRejectBox(false); setRejectionReason(''); }}
            />

            {/* ── Two-pane body ───────────────────────────────────── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
              {/* Main content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
                {/* Description */}
                {task.description && (
                  <div style={{
                    marginBottom: 20,
                    padding: '14px 16px',
                    background: 'var(--surface-subtle)',
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                      Description
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
                      {task.description}
                    </p>
                  </div>
                )}

                {/* Rejection banner */}
                {task.rejection_reason && (
                  <div style={{
                    marginBottom: 20,
                    padding: '12px 16px',
                    background: '#FEF2F2',
                    borderRadius: 10,
                    border: '1px solid #FECACA',
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      Rejection Reason
                    </p>
                    <p style={{ fontSize: 13, color: '#B91C1C', lineHeight: 1.5, margin: 0 }}>
                      {task.rejection_reason}
                    </p>
                  </div>
                )}

                {/* Tabs */}
                <TabBar
                  tab={tab}
                  setTab={setTab}
                  counts={{
                    checklist: task.subtasks.length,
                    comments: task.comments.filter((c) => !c.is_system).length,
                    activity: task.activities.length,
                    attachments: task.attachments.length,
                  }}
                />

                {/* Tab panels */}
                {tab === 'checklist' && (
                  <ChecklistTab
                    subtasks={task.subtasks}
                    newSub={newSub}
                    onNewSubChange={setNewSub}
                    onAddSubtask={() => newSub.trim() && addSubtask.mutate(newSub.trim())}
                    onToggle={(id, done) => toggleSubtask.mutate({ id, done })}
                  />
                )}
                {tab === 'comments' && (
                  <CommentsTab
                    comments={task.comments.filter((c) => !c.is_system)}
                    comment={comment}
                    onCommentChange={setComment}
                    onSend={() => comment.trim() && addComment.mutate(comment.trim())}
                    onDelete={(id) => deleteComment.mutate(id)}
                    sending={addComment.isPending}
                    editingCommentId={editingCommentId}
                    editCommentText={editCommentText}
                    onEditStart={(id, content) => { setEditingCommentId(id); setEditCommentText(content); }}
                    onEditChange={setEditCommentText}
                    onEditSave={() => {
                      if (editingCommentId && editCommentText.trim())
                        updateComment.mutate({ id: editingCommentId, content: editCommentText.trim() });
                    }}
                    onEditCancel={() => { setEditingCommentId(null); setEditCommentText(''); }}
                    savingEdit={updateComment.isPending}
                  />
                )}
                {tab === 'activity' && <ActivityTab activities={task.activities} />}
                {tab === 'attachments' && (
                  <AttachmentsTab
                    attachments={task.attachments}
                    onUpload={(file) => uploadFile.mutate(file)}
                    onDelete={(id) => deleteAttachment.mutate(id)}
                    uploading={uploadFile.isPending}
                    fileInputRef={fileInputRef}
                  />
                )}
              </div>

              {/* Sidebar */}
              <MetaSidebar
                task={task}
                onStatusChange={(s) => updateMeta.mutate({ status: s } as unknown as Partial<TaskDetail>)}
                onPriorityChange={(p) => updateMeta.mutate({ priority: p })}
                changingMeta={changingMeta}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Close button ──────────────────────────────────────────────────────────────

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 32, height: 32, borderRadius: 8,
        border: '1px solid var(--border-subtle)',
        background: 'var(--surface-subtle)',
        cursor: 'pointer', fontSize: 18,
        color: 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.borderColor = '#FECACA'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
    >
      ×
    </button>
  );
}
