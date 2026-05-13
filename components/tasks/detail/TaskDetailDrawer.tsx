'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskDetail, SubTask, TaskComment, TaskStatus } from '@/types';
import { tasksApi, subTasksApi, taskCommentsApi, taskAttachmentsApi } from '@/lib/api/tasks';
import { TaskAvatar } from '../shared/TaskAvatar';
import { StatusBadge } from '../shared/StatusBadge';
import { PriorityBar } from '../shared/PriorityBar';
import { DrawerSkeleton } from '../shared/Skeletons';
import {
  BRAND,
  BRAND_HEX,
  PRIORITY_CONFIG,
  TYPE_LABEL,
  fmtDate,
  isOverdue,
  fmtFileSize,
} from '../shared/constants';

interface Props {
  taskId: number;
  onClose: () => void;
}

type Tab = 'checklist' | 'comments' | 'activity' | 'attachments';

// ─── Workflow action button ────────────────────────────────────────────────────

function ActionBtn({
  label,
  color,
  bg,
  border,
  loading,
  onClick,
}: {
  label: string;
  color: string;
  bg: string;
  border: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={loading}
      onClick={onClick}
      style={{
        padding: '6px 16px',
        borderRadius: 7,
        border: `1px solid ${border}`,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

// ─── Section title ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        marginBottom: 10,
      }}
    >
      {children}
    </p>
  );
}

// ─── Meta grid item ───────────────────────────────────────────────────────────

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        style={{
          fontSize: 10,
          color: 'var(--text-tertiary)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 5,
        }}
      >
        {label}
      </p>
      <div>{children}</div>
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
  });

  const addComment = useMutation({
    mutationFn: (content: string) => taskCommentsApi.create({ task: taskId, content }),
    onSuccess: () => { setComment(''); invalidate(); },
  });

  const deleteComment = useMutation({
    mutationFn: (id: number) => taskCommentsApi.delete(id),
    onSuccess: invalidate,
  });

  const addSubtask = useMutation({
    mutationFn: (title: string) => subTasksApi.create({ task: taskId, title }),
    onSuccess: () => { setNewSub(''); invalidate(); },
  });

  const toggleSubtask = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      done ? subTasksApi.complete(id) : subTasksApi.reopen(id),
    onSuccess: invalidate,
  });

  const uploadFile = useMutation({
    mutationFn: (file: File) => taskAttachmentsApi.upload(taskId, file),
    onSuccess: invalidate,
  });

  const deleteAttachment = useMutation({
    mutationFn: (id: number) => taskAttachmentsApi.delete(id),
    onSuccess: invalidate,
  });

  const busy = transition.isPending;

  const act = (fn: () => Promise<TaskDetail>) => transition.mutate(fn);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 660,
          background: 'var(--card-bg)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 48px rgba(0,0,0,0.16)',
          animation: 'slideInRight 0.2s ease',
        }}
      >
        {isLoading || !task ? (
          <>
            {/* Close button even during load */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <CloseBtn onClick={onClose} />
            </div>
            <DrawerSkeleton />
          </>
        ) : (
          <>
            {/* ── Header ──────────────────────────────────────────── */}
            <div
              style={{
                padding: '20px 24px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  {/* Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    <StatusBadge status={task.status} />
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 9px',
                        borderRadius: 99,
                        background: PRIORITY_CONFIG[task.priority].bg,
                        fontSize: 11,
                        color: PRIORITY_CONFIG[task.priority].color,
                        fontWeight: 600,
                        border: `1px solid ${PRIORITY_CONFIG[task.priority].color}30`,
                      }}
                    >
                      <PriorityBar priority={task.priority} />
                      {PRIORITY_CONFIG[task.priority].label}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 9px',
                        borderRadius: 99,
                        background: 'var(--surface-subtle)',
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {TYPE_LABEL[task.task_type]}
                    </span>
                    {task.requires_approval && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 9px',
                          borderRadius: 99,
                          background: '#EFF6FF',
                          fontSize: 11,
                          color: '#3B82F6',
                          border: '1px solid #BFDBFE',
                        }}
                      >
                        Requires Approval
                      </span>
                    )}
                  </div>
                  {/* Title */}
                  <h2
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      lineHeight: 1.3,
                    }}
                  >
                    {task.title}
                  </h2>
                </div>
                <CloseBtn onClick={onClose} />
              </div>
            </div>

            {/* ── Workflow Actions ─────────────────────────────────── */}
            <WorkflowActions
              task={task}
              busy={busy}
              showRejectBox={showRejectBox}
              rejectionReason={rejectionReason}
              onRejectionReasonChange={setRejectionReason}
              onToggleRejectBox={() => setShowRejectBox((p) => !p)}
              onAct={act}
              onReject={() => {
                if (rejectionReason.trim()) {
                  act(() => tasksApi.reject(task.id, rejectionReason));
                  setShowRejectBox(false);
                  setRejectionReason('');
                }
              }}
              onCancelReject={() => {
                setShowRejectBox(false);
                setRejectionReason('');
              }}
            />

            {/* ── Body ────────────────────────────────────────────── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

              {/* Meta grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '16px 20px',
                  paddingBottom: 20,
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: 20,
                }}
              >
                <MetaItem label="Created by">
                  {task.created_by_detail ? (
                    <UserCell name={task.created_by_detail.full_name} url={task.created_by_detail.avatar_url} />
                  ) : '—'}
                </MetaItem>
                <MetaItem label="Assigned to">
                  {task.assigned_to_detail ? (
                    <UserCell name={task.assigned_to_detail.full_name} url={task.assigned_to_detail.avatar_url} />
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Unassigned</span>
                  )}
                </MetaItem>
                <MetaItem label="Due date">
                  <span
                    style={{
                      fontSize: 12,
                      color: isOverdue(task) ? '#EF4444' : 'var(--text-primary)',
                      fontWeight: isOverdue(task) ? 600 : 400,
                    }}
                  >
                    {fmtDate(task.due_date)}
                  </span>
                </MetaItem>
                <MetaItem label="Started">
                  <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                    {task.started_at ? fmtDate(task.started_at, 'dt') : '—'}
                  </span>
                </MetaItem>
                <MetaItem label="Submitted">
                  <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                    {task.submitted_at ? fmtDate(task.submitted_at, 'dt') : '—'}
                  </span>
                </MetaItem>
                <MetaItem label="Approved by">
                  {task.approved_by_detail ? (
                    <UserCell name={task.approved_by_detail.full_name} url={task.approved_by_detail.avatar_url} />
                  ) : '—'}
                </MetaItem>
              </div>

              {/* Description */}
              {task.description && (
                <div
                  style={{
                    marginBottom: 20,
                    padding: '14px 16px',
                    background: 'var(--surface-subtle)',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <p
                    style={{
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {task.description}
                  </p>
                </div>
              )}

              {/* Rejection reason */}
              {task.rejection_reason && (
                <div
                  style={{
                    marginBottom: 20,
                    padding: '12px 16px',
                    background: '#FEF2F2',
                    borderRadius: 8,
                    border: '1px solid #FECACA',
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#991B1B',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 4,
                    }}
                  >
                    Rejection Reason
                  </p>
                  <p style={{ fontSize: 13, color: '#B91C1C', lineHeight: 1.5 }}>
                    {task.rejection_reason}
                  </p>
                </div>
              )}

              {/* Tabs */}
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: 18,
                  gap: 0,
                }}
              >
                {(
                  [
                    ['checklist', `Checklist (${task.subtasks.length})`],
                    ['comments', `Comments (${task.comments.filter((c) => !c.is_system).length})`],
                    ['activity', `Activity (${task.activities.length})`],
                    ['attachments', `Files (${task.attachments.length})`],
                  ] as [Tab, string][]
                ).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setTab(v)}
                    style={{
                      padding: '9px 16px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: tab === v ? 700 : 400,
                      color: tab === v ? BRAND : 'var(--text-tertiary)',
                      borderBottom: tab === v ? `2px solid ${BRAND}` : '2px solid transparent',
                      marginBottom: -1,
                      transition: 'color 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
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
                />
              )}

              {tab === 'activity' && (
                <ActivityTab activities={task.activities} />
              )}

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
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: '1px solid var(--border-subtle)',
        background: 'var(--surface-subtle)',
        cursor: 'pointer',
        fontSize: 18,
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#FEF2F2';
        e.currentTarget.style.color = '#EF4444';
        e.currentTarget.style.borderColor = '#FECACA';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--surface-subtle)';
        e.currentTarget.style.color = 'var(--text-secondary)';
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
      }}
    >
      ×
    </button>
  );
}

function UserCell({ name, url }: { name: string; url?: string | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <TaskAvatar name={name} url={url} size={22} />
      <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{name}</span>
    </div>
  );
}

function WorkflowActions({
  task,
  busy,
  showRejectBox,
  rejectionReason,
  onRejectionReasonChange,
  onToggleRejectBox,
  onAct,
  onReject,
  onCancelReject,
}: {
  task: TaskDetail;
  busy: boolean;
  showRejectBox: boolean;
  rejectionReason: string;
  onRejectionReasonChange: (v: string) => void;
  onToggleRejectBox: () => void;
  onAct: (fn: () => Promise<TaskDetail>) => void;
  onReject: () => void;
  onCancelReject: () => void;
}) {
  const s = task.status as TaskStatus;
  const hasActions =
    ['assigned', 'accepted', 'in_progress', 'submitted', 'review', 'rejected', 'closed', 'approved'].includes(s);

  if (!hasActions) return null;

  return (
    <>
      <div
        style={{
          padding: '10px 24px',
          background: 'var(--surface-subtle)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginRight: 4 }}>
          Actions:
        </span>
        {s === 'assigned' && (
          <ActionBtn label="Accept" color="#8B5CF6" bg="#F5F3FF" border="#DDD6FE" loading={busy}
            onClick={() => onAct(() => tasksApi.accept(task.id))} />
        )}
        {['assigned', 'accepted'].includes(s) && (
          <ActionBtn label="Start Working" color="#F59E0B" bg="#FFFBEB" border="#FDE68A" loading={busy}
            onClick={() => onAct(() => tasksApi.start(task.id))} />
        )}
        {['in_progress', 'accepted'].includes(s) && (
          <ActionBtn label="Submit for Review" color="#3B82F6" bg="#EFF6FF" border="#BFDBFE" loading={busy}
            onClick={() => onAct(() => tasksApi.submit(task.id))} />
        )}
        {s === 'review' && (
          <ActionBtn label="Approve" color="#16A34A" bg="#DCFCE7" border="#86EFAC" loading={busy}
            onClick={() => onAct(() => tasksApi.approve(task.id))} />
        )}
        {['rejected', 'closed', 'approved'].includes(s) && (
          <ActionBtn label="Reopen" color="#64748B" bg="#F1F5F9" border="#CBD5E1" loading={busy}
            onClick={() => onAct(() => tasksApi.reopen(task.id))} />
        )}
        {['review', 'submitted'].includes(s) && !showRejectBox && (
          <button
            onClick={onToggleRejectBox}
            style={{
              padding: '6px 16px',
              borderRadius: 7,
              border: '1px solid #FECACA',
              background: '#FEF2F2',
              color: '#EF4444',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reject
          </button>
        )}
      </div>

      {showRejectBox && (
        <div
          style={{
            padding: '10px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <input
            value={rejectionReason}
            onChange={(e) => onRejectionReasonChange(e.target.value)}
            placeholder="State the rejection reason…"
            autoFocus
            style={{
              flex: 1,
              padding: '8px 11px',
              borderRadius: 6,
              border: '1px solid #FCA5A5',
              fontSize: 13,
              background: 'var(--surface-subtle)',
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={onReject}
            disabled={!rejectionReason.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#EF4444',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: rejectionReason.trim() ? 'pointer' : 'not-allowed',
              opacity: rejectionReason.trim() ? 1 : 0.5,
            }}
          >
            Confirm
          </button>
          <button
            onClick={onCancelReject}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
}

function ChecklistTab({
  subtasks,
  newSub,
  onNewSubChange,
  onAddSubtask,
  onToggle,
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
      {subtasks.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: 'var(--text-tertiary)',
              marginBottom: 6,
            }}
          >
            <span>{done} of {subtasks.length} completed</span>
            <span>{pct}%</span>
          </div>
          <div
            style={{
              height: 5,
              background: 'var(--surface-subtle)',
              borderRadius: 99,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: 5,
                background: pct === 100 ? '#16A34A' : BRAND,
                borderRadius: 99,
                width: `${pct}%`,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      )}

      {subtasks.map((s) => (
        <div
          key={s.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '9px 0',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <button
            onClick={() => onToggle(s.id, !s.is_completed)}
            style={{
              width: 19,
              height: 19,
              borderRadius: 5,
              flexShrink: 0,
              cursor: 'pointer',
              border: `2px solid ${s.is_completed ? '#16A34A' : 'var(--border-subtle)'}`,
              background: s.is_completed ? '#16A34A' : 'transparent',
              color: '#fff',
              fontSize: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            {s.is_completed && (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2,6 5,9 10,3" />
              </svg>
            )}
          </button>
          <span
            style={{
              flex: 1,
              fontSize: 13,
              color: s.is_completed ? 'var(--text-tertiary)' : 'var(--text-primary)',
              textDecoration: s.is_completed ? 'line-through' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {s.title}
          </span>
          {s.completed_by_detail && (
            <TaskAvatar
              name={s.completed_by_detail.full_name}
              url={s.completed_by_detail.avatar_url}
              size={18}
            />
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <input
          value={newSub}
          onChange={(e) => onNewSubChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onAddSubtask(); }}
          placeholder="Add a checklist item…"
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 7,
            border: '1px solid var(--border-subtle)',
            fontSize: 13,
            background: 'var(--surface-subtle)',
            color: 'var(--text-primary)',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={onAddSubtask}
          disabled={!newSub.trim()}
          style={{
            padding: '8px 18px',
            borderRadius: 7,
            border: 'none',
            background: BRAND,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
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

function CommentsTab({
  comments,
  comment,
  onCommentChange,
  onSend,
  onDelete,
  sending,
}: {
  comments: TaskComment[];
  comment: string;
  onCommentChange: (v: string) => void;
  onSend: () => void;
  onDelete: (id: number) => void;
  sending: boolean;
}) {
  return (
    <div>
      {comments.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '28px',
            color: 'var(--text-tertiary)',
            fontSize: 13,
          }}
        >
          No comments yet. Be the first to add one.
        </div>
      )}

      {comments.map((c) => (
        <div
          key={c.id}
          style={{
            display: 'flex',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <TaskAvatar name={c.author_detail.full_name} url={c.author_detail.avatar_url} size={34} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {c.author_detail.full_name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {fmtDate(c.created_at, 'dt')}
              </span>
              <button
                onClick={() => onDelete(c.id)}
                title="Delete comment"
                style={{
                  marginLeft: 'auto',
                  fontSize: 13,
                  color: 'var(--text-tertiary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0 2px',
                  transition: 'color 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                padding: '11px 14px',
                background: 'var(--surface-subtle)',
                borderRadius: '0 8px 8px 8px',
                fontSize: 13,
                color: 'var(--text-primary)',
                lineHeight: 1.6,
                border: '1px solid var(--border-subtle)',
              }}
            >
              {c.content}
            </div>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Write a comment…"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSend();
          }}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: 8,
            border: '1px solid var(--border-subtle)',
            fontSize: 13,
            background: 'var(--surface-subtle)',
            color: 'var(--text-primary)',
            resize: 'none',
            fontFamily: 'inherit',
            outline: 'none',
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={onSend}
          disabled={!comment.trim() || sending}
          style={{
            padding: '9px 18px',
            alignSelf: 'flex-end',
            borderRadius: 8,
            border: 'none',
            background: BRAND,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: comment.trim() && !sending ? 'pointer' : 'not-allowed',
            opacity: comment.trim() && !sending ? 1 : 0.5,
            transition: 'opacity 0.15s',
          }}
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
        Ctrl + Enter to send
      </p>
    </div>
  );
}

function ActivityTab({ activities }: { activities: TaskDetail['activities'] }) {
  return (
    <div>
      {activities.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', paddingTop: 12 }}>
          No activity yet.
        </p>
      )}
      {activities.map((a, i) => (
        <div
          key={a.id}
          style={{
            display: 'flex',
            gap: 12,
            marginBottom: 16,
            alignItems: 'flex-start',
            position: 'relative',
          }}
        >
          {/* Timeline line */}
          {i < activities.length - 1 && (
            <div
              style={{
                position: 'absolute',
                left: 13,
                top: 28,
                bottom: -8,
                width: 1,
                background: 'var(--border-subtle)',
              }}
            />
          )}
          <TaskAvatar
            name={a.actor_detail.full_name}
            url={a.actor_detail.avatar_url}
            size={28}
          />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              <strong>{a.actor_detail.full_name}</strong>{' '}
              <span style={{ color: 'var(--text-secondary)' }}>
                {a.action.replace(/_/g, ' ')}
              </span>
              {a.details?.reason && (
                <span style={{ color: '#EF4444' }}> — {a.details.reason}</span>
              )}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
              {fmtDate(a.created_at, 'dt')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AttachmentsTab({
  attachments,
  onUpload,
  onDelete,
  uploading,
  fileInputRef,
}: {
  attachments: TaskDetail['attachments'];
  onUpload: (file: File) => void;
  onDelete: (id: number) => void;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div>
      {/* Upload button */}
      <div style={{ marginBottom: 16 }}>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onUpload(file);
              e.target.value = '';
            }
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '8px 16px',
            borderRadius: 8,
            border: `1.5px dashed var(--border-subtle)`,
            background: 'var(--surface-subtle)',
            color: 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: 500,
            cursor: uploading ? 'not-allowed' : 'pointer',
            width: '100%',
            justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = BRAND;
            e.currentTarget.style.color = BRAND;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {uploading ? 'Uploading…' : 'Upload File'}
        </button>
      </div>

      {attachments.length === 0 ? (
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', padding: '20px 0' }}>
          No attachments yet
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {attachments.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: 'var(--surface-subtle)',
                borderRadius: 9,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: 20, flexShrink: 0 }}>📎</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.file_name}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                  {fmtFileSize(a.file_size)}
                  {a.uploaded_by_detail && ` · ${a.uploaded_by_detail.full_name}`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {a.file_url && (
                  <a
                    href={a.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 12,
                      color: BRAND,
                      textDecoration: 'none',
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: `1px solid ${BRAND_HEX}30`,
                      background: `${BRAND_HEX}0a`,
                    }}
                  >
                    Download
                  </a>
                )}
                <button
                  onClick={() => onDelete(a.id)}
                  title="Remove"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: '1px solid var(--border-subtle)',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#FEF2F2';
                    e.currentTarget.style.color = '#EF4444';
                    e.currentTarget.style.borderColor = '#FECACA';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-tertiary)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  }}
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
