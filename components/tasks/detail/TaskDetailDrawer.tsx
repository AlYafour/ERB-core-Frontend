'use client';

import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskStatus } from '@/types';
import { tasksApi } from '@/lib/api/tasks';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { TYPE_LABEL, PRIORITY_CONFIG, STATUS_CONFIG, fmtDate, isOverdue } from '../shared/constants';
import { DrawerSkeleton } from '../shared/Skeletons';
import { useTaskDetail } from './hooks/useTaskDetail';
import { UserRow } from './_shared';
import { WorkflowBar } from './WorkflowBar';
import { TabBar } from './TabBar';
import type { Tab } from './TabBar';
import { ChecklistTab } from './ChecklistTab';
import { CommentsTab } from './CommentsTab';
import { ActivityTab } from './ActivityTab';
import { AttachmentsTab } from './AttachmentsTab';
import { TimeTab } from './TimeTab';
import { DependenciesTab } from './DependenciesTab';

interface Props {
  taskId: number;
  onClose: () => void;
}

export function TaskDetailDrawer({ taskId, onClose }: Props) {
  const { user } = useAuth();
  const { isTenantAdmin } = useMyPermissions();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab]                             = useState<Tab>('checklist');
  const [comment, setComment]                     = useState('');
  const [newSub, setNewSub]                       = useState('');
  const [rejectionReason, setRejectionReason]     = useState('');
  const [showRejectBox, setShowRejectBox]         = useState(false);
  const [editingCommentId, setEditingCommentId]   = useState<number | null>(null);
  const [editCommentText, setEditCommentText]     = useState('');

  const {
    task, isLoading,
    doTransition, updateStatus, updatePriority,
    sendComment, editComment, removeComment,
    addSubtask, toggleSubtask,
    uploadFile, removeAttachment,
    busy, changingMeta, sendingComment, savingEdit, uploadingFile,
  } = useTaskDetail(taskId);

  const isCreator = task ? task.created_by?.id === (user as { id?: number } | null)?.id : false;
  const canManage = isCreator || isTenantAdmin;

  const deleteTask = useMutation({
    mutationFn: () => tasksApi.deleteTask(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-stats'] });
      onClose();
      toast('Task deleted', 'success');
    },
    onError: () => toast('Failed to delete task', 'error'),
  });

  /* ── keyboard close ─── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="task-drawer-overlay" onKeyDown={handleKeyDown} tabIndex={-1}>
      <div className="task-drawer-panel">

        {/* ══ TOP NAV BAR ══════════════════════════════════════════════ */}
        <div className="task-drawer-header">
          {/* back arrow */}
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'background .12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-inset)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Tasks
          </button>

          {/* breadcrumb */}
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>·</span>
          {task && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>
              {task.title}
            </span>
          )}

          <div style={{ flex: 1 }} />

          {/* actions */}
          {canManage && task && (
            <button
              type="button"
              disabled={deleteTask.isPending}
              onClick={async () => {
                if (await confirm('Delete this task? This cannot be undone.')) deleteTask.mutate();
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 6,
                border: '1px solid #fecaca', background: 'transparent',
                color: '#dc2626', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'background .12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
              {deleteTask.isPending ? 'Deleting…' : 'Delete'}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="task-close-btn"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* ══ CONTENT AREA ═════════════════════════════════════════════ */}
        {isLoading || !task ? (
          <div style={{ flex: 1, padding: '32px 40px' }}><DrawerSkeleton /></div>
        ) : (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

            {/* ── LEFT: main content ──────────────────────────────────── */}
            <div className="task-drawer-body">

              {/* Task title block */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span className="task-type-badge">{TYPE_LABEL[task.task_type]}</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 700,
                    color: PRIORITY_CONFIG[task.priority].color,
                    background: PRIORITY_CONFIG[task.priority].bg,
                    padding: '3px 9px', borderRadius: 6,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_CONFIG[task.priority].color }} />
                    {PRIORITY_CONFIG[task.priority].label}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>#{task.id}</span>
                </div>

                <h1 style={{
                  fontSize: 24, fontWeight: 700,
                  color: 'var(--text-primary)',
                  lineHeight: 1.3, margin: 0,
                }}>
                  {task.title}
                </h1>
              </div>

              {/* Workflow actions */}
              <WorkflowBar
                task={task}
                busy={busy}
                currentUserId={user?.id}
                showRejectBox={showRejectBox}
                rejectionReason={rejectionReason}
                onRejectionChange={setRejectionReason}
                onToggleReject={() => setShowRejectBox(p => !p)}
                onAct={doTransition}
                onReject={() => {
                  if (rejectionReason.trim()) {
                    doTransition(() => tasksApi.reject(task.id, rejectionReason));
                    setShowRejectBox(false);
                    setRejectionReason('');
                  }
                }}
                onCancelReject={() => { setShowRejectBox(false); setRejectionReason(''); }}
              />

              {/* Description */}
              {task.description && (
                <div className="task-info-card" style={{ marginTop: 20 }}>
                  <p className="task-info-card__label">Description</p>
                  <p className="task-info-card__text">{task.description}</p>
                </div>
              )}

              {/* Rejection reason */}
              {task.rejection_reason && (
                <div className="task-info-card task-rejection-card">
                  <p className="task-info-card__label">Rejection Reason</p>
                  <p className="task-info-card__text">{task.rejection_reason}</p>
                </div>
              )}

              {/* Tabs */}
              <TabBar
                tab={tab}
                setTab={setTab}
                counts={{
                  checklist:   task.subtasks.length,
                  comments:    task.comments.filter(c => !c.is_system).length,
                  activity:    task.activities.length,
                  attachments: task.attachments.length,
                }}
              />

              {tab === 'checklist' && (
                <ChecklistTab
                  subtasks={task.subtasks}
                  newSub={newSub}
                  onNewSubChange={setNewSub}
                  onAddSubtask={() => { if (newSub.trim()) { addSubtask(newSub.trim()); setNewSub(''); } }}
                  onToggle={toggleSubtask}
                />
              )}
              {tab === 'comments' && (
                <CommentsTab
                  comments={task.comments.filter(c => !c.is_system)}
                  comment={comment}
                  onCommentChange={setComment}
                  onSend={() => { if (comment.trim()) { sendComment(comment.trim()); setComment(''); } }}
                  onDelete={removeComment}
                  sending={sendingComment}
                  editingCommentId={editingCommentId}
                  editCommentText={editCommentText}
                  onEditStart={(id, content) => { setEditingCommentId(id); setEditCommentText(content); }}
                  onEditChange={setEditCommentText}
                  onEditSave={() => {
                    if (editingCommentId && editCommentText.trim()) {
                      editComment(editingCommentId, editCommentText.trim());
                      setEditingCommentId(null);
                      setEditCommentText('');
                    }
                  }}
                  onEditCancel={() => { setEditingCommentId(null); setEditCommentText(''); }}
                  savingEdit={savingEdit}
                  currentUserId={(user as any)?.id}
                />
              )}
              {tab === 'activity'    && <ActivityTab activities={task.activities} />}
              {tab === 'attachments' && (
                <AttachmentsTab
                  attachments={task.attachments}
                  onUpload={uploadFile}
                  onDelete={removeAttachment}
                  uploading={uploadingFile}
                  fileInputRef={fileInputRef}
                />
              )}
              {tab === 'time'         && <TimeTab taskId={task.id} />}
              {tab === 'dependencies' && <DependenciesTab taskId={task.id} />}
            </div>

            {/* ── RIGHT: meta sidebar ─────────────────────────────────── */}
            <aside className="task-meta-sidebar">

              {/* Status */}
              <div className="task-meta-section">
                <p className="meta-label">Status</p>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  border: `1.5px solid ${STATUS_CONFIG[task.status].border}`,
                  background: STATUS_CONFIG[task.status].bg,
                  color: STATUS_CONFIG[task.status].color,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_CONFIG[task.status].color }} />
                  {STATUS_CONFIG[task.status].label}
                </span>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '6px 0 0', fontStyle: 'italic' }}>
                  Changes via workflow actions
                </p>
              </div>

              {/* Priority */}
              <div className="task-meta-section">
                <p className="meta-label">Priority</p>
                <div style={{ display: 'flex', gap: 5 }}>
                  {(['critical', 'high', 'medium', 'low'] as const).map(p => {
                    const pc = PRIORITY_CONFIG[p];
                    const active = task.priority === p;
                    return (
                      <button
                        key={p}
                        onClick={() => updatePriority(p)}
                        disabled={changingMeta}
                        style={{
                          flex: 1, padding: '6px 0', fontSize: 10, fontWeight: 700,
                          borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
                          border: `1.5px solid ${active ? pc.color : 'var(--border-subtle)'}`,
                          background: active ? pc.bg : 'transparent',
                          color: active ? pc.color : 'var(--text-tertiary)',
                          transition: 'all .12s',
                        }}
                      >
                        {p === 'critical' ? 'Crit' : p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assignee */}
              <div className="task-meta-section">
                <p className="meta-label">Assignee</p>
                {task.assigned_to_detail ? (
                  <UserRow name={task.assigned_to_detail.full_name} url={task.assigned_to_detail.avatar_url} />
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic', margin: 0 }}>Unassigned</p>
                )}
              </div>

              {/* Type + Approval */}
              <div className="task-meta-section">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <p className="meta-label">Type</p>
                    <span className="task-type-badge" style={{ fontSize: 12 }}>{TYPE_LABEL[task.task_type]}</span>
                  </div>
                  <div>
                    <p className="meta-label">Approval</p>
                    {task.requires_approval ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: 'var(--task-assigned-bg)',
                        border: '1px solid var(--task-assigned-border)',
                        color: 'var(--task-assigned)',
                      }}>
                        Required
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Not required</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Due date */}
              <div className="task-meta-section">
                <p className="meta-label">Due Date</p>
                {task.due_date ? (() => {
                  const od = isOverdue(task);
                  return (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 13, fontWeight: od ? 700 : 500,
                      color: od ? 'var(--status-error)' : 'var(--text-primary)',
                      background: od ? 'var(--status-error-bg)' : 'transparent',
                      padding: od ? '5px 10px' : '0', borderRadius: od ? 7 : 0,
                    }}>
                      {od && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
                      {fmtDate(task.due_date, 'dt')}
                    </span>
                  );
                })() : (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic', margin: 0 }}>No due date</p>
                )}
              </div>

              {/* Created by */}
              <div className="task-meta-section">
                <p className="meta-label">Created by</p>
                {task.created_by_detail ? (
                  <UserRow
                    name={task.created_by_detail.full_name}
                    url={task.created_by_detail.avatar_url}
                    sub={fmtDate(task.created_at, 'dt')}
                  />
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>—</span>
                )}
              </div>

              {/* Timeline — only when data exists */}
              {(task.started_at || task.submitted_at || task.approved_by_detail) && (
                <div className="task-meta-section">
                  <p className="meta-label">Timeline</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {task.started_at && (
                      <div>
                        <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>Started</p>
                        <p style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, margin: 0 }}>{fmtDate(task.started_at, 'dt')}</p>
                      </div>
                    )}
                    {task.submitted_at && (
                      <div>
                        <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>Submitted</p>
                        <p style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, margin: 0 }}>{fmtDate(task.submitted_at, 'dt')}</p>
                      </div>
                    )}
                    {task.approved_by_detail && (
                      <div>
                        <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>Approved by</p>
                        <UserRow name={task.approved_by_detail.full_name} url={task.approved_by_detail.avatar_url} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </aside>

          </div>
        )}
      </div>
    </div>
  );
}
