'use client';

import { useState, useRef } from 'react';
import type { TaskStatus } from '@/types';
import { tasksApi } from '@/lib/api/tasks';
import { useAuth } from '@/lib/hooks/use-auth';
import { TYPE_LABEL } from '../shared/constants';
import { DrawerSkeleton } from '../shared/Skeletons';
import { useTaskDetail } from './hooks/useTaskDetail';
import { CloseButton } from './_shared';
import { MetaSidebar } from './MetaSidebar';
import { WorkflowBar } from './WorkflowBar';
import { TabBar } from './TabBar';
import type { Tab } from './TabBar';
import { ChecklistTab } from './ChecklistTab';
import { CommentsTab } from './CommentsTab';
import { ActivityTab } from './ActivityTab';
import { AttachmentsTab } from './AttachmentsTab';

interface Props {
  taskId: number;
  onClose: () => void;
}

export function TaskDetailDrawer({ taskId, onClose }: Props) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab]                       = useState<Tab>('checklist');
  const [comment, setComment]               = useState('');
  const [newSub, setNewSub]                 = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectBox, setShowRejectBox]   = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentText, setEditCommentText]   = useState('');

  const {
    task, isLoading,
    doTransition, updateStatus, updatePriority,
    sendComment, editComment, removeComment,
    addSubtask, toggleSubtask,
    uploadFile, removeAttachment,
    busy, changingMeta, sendingComment, savingEdit, uploadingFile,
  } = useTaskDetail(taskId);

  return (
    <div
      className="task-drawer-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="task-drawer-panel task-drawer-panel--lg">
        {isLoading || !task ? (
          <>
            <div className="task-drawer-header" style={{ justifyContent: 'flex-end' }}>
              <CloseButton onClick={onClose} />
            </div>
            <DrawerSkeleton />
          </>
        ) : (
          <>
            {/* Header */}
            <div className="task-drawer-header">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className="task-type-badge">{TYPE_LABEL[task.task_type]}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>#{task.id}</span>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, margin: 0 }}>
                  {task.title}
                </h2>
              </div>
              <CloseButton onClick={onClose} />
            </div>

            {/* Workflow */}
            <WorkflowBar
              task={task}
              busy={busy}
              currentUserId={user?.id}
              showRejectBox={showRejectBox}
              rejectionReason={rejectionReason}
              onRejectionChange={setRejectionReason}
              onToggleReject={() => setShowRejectBox((p) => !p)}
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

            {/* Two-pane body */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
              {/* Main */}
              <div className="task-drawer-body">
                {task.description && (
                  <div className="task-info-card">
                    <p className="task-info-card__label">Description</p>
                    <p className="task-info-card__text">{task.description}</p>
                  </div>
                )}

                {task.rejection_reason && (
                  <div className="task-info-card task-rejection-card">
                    <p className="task-info-card__label">Rejection Reason</p>
                    <p className="task-info-card__text">{task.rejection_reason}</p>
                  </div>
                )}

                <TabBar
                  tab={tab}
                  setTab={setTab}
                  counts={{
                    checklist:   task.subtasks.length,
                    comments:    task.comments.filter((c) => !c.is_system).length,
                    activity:    task.activities.length,
                    attachments: task.attachments.length,
                  }}
                />

                {tab === 'checklist' && (
                  <ChecklistTab
                    subtasks={task.subtasks}
                    newSub={newSub}
                    onNewSubChange={setNewSub}
                    onAddSubtask={() => {
                      if (newSub.trim()) { addSubtask(newSub.trim()); setNewSub(''); }
                    }}
                    onToggle={toggleSubtask}
                  />
                )}
                {tab === 'comments' && (
                  <CommentsTab
                    comments={task.comments.filter((c) => !c.is_system)}
                    comment={comment}
                    onCommentChange={setComment}
                    onSend={() => {
                      if (comment.trim()) { sendComment(comment.trim()); setComment(''); }
                    }}
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
                  />
                )}
                {tab === 'activity' && <ActivityTab activities={task.activities} />}
                {tab === 'attachments' && (
                  <AttachmentsTab
                    attachments={task.attachments}
                    onUpload={uploadFile}
                    onDelete={removeAttachment}
                    uploading={uploadingFile}
                    fileInputRef={fileInputRef}
                  />
                )}
              </div>

              {/* Sidebar */}
              <MetaSidebar
                task={task}
                onStatusChange={updateStatus}
                onPriorityChange={updatePriority}
                changingMeta={changingMeta}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
