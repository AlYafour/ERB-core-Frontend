'use client';

import type { TaskComment } from '@/types';
import { TaskAvatar } from '../shared/TaskAvatar';
import { BRAND, fmtDate } from '../shared/constants';

interface Props {
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
}

export function CommentsTab({
  comments, comment, onCommentChange, onSend, onDelete, sending,
  editingCommentId, editCommentText, onEditStart, onEditChange,
  onEditSave, onEditCancel, savingEdit,
}: Props) {
  return (
    <div>
      {/* Compose */}
      <div className="compose-box">
        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Write a comment…"
          rows={3}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSend(); }}
          className="compose-box__textarea"
        />
        <div className="compose-box__footer">
          <span className="compose-box__hint">Ctrl + Enter to send</span>
          <button
            onClick={onSend}
            disabled={!comment.trim() || sending}
            className="task-btn task-btn--primary"
            style={{ opacity: comment.trim() && !sending ? 1 : 0.5 }}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>

      {/* List */}
      {comments.length === 0 ? (
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', padding: '28px 0', margin: 0 }}>
          No comments yet. Be the first.
        </p>
      ) : (
        <div className="comment-list">
          {comments.map((c) => (
            <div key={c.id} className="comment-row">
              <TaskAvatar name={c.author_detail.full_name} url={c.author_detail.avatar_url} size={32} />
              <div style={{ flex: 1 }}>
                <div className="comment-meta">
                  <p className="comment-author">{c.author_detail.full_name}</p>
                  <span className="comment-time">
                    {fmtDate(c.created_at, 'dt')}
                    {c.updated_at !== c.created_at && (
                      <span style={{ marginLeft: 4, fontStyle: 'italic' }}>(edited)</span>
                    )}
                  </span>
                  {editingCommentId !== c.id && (
                    <>
                      <button
                        onClick={() => onEditStart(c.id, c.content)}
                        className="task-btn--ghost"
                        style={{ marginLeft: 'auto' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(c.id)}
                        className="task-btn--danger-ghost"
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
                      className="task-input task-input--textarea"
                      style={{ border: `1.5px solid ${BRAND}` }}
                    />
                    <div className="comment-edit-actions">
                      <button
                        onClick={onEditSave}
                        disabled={!editCommentText.trim() || savingEdit}
                        className="task-btn task-btn--primary"
                        style={{ padding: '5px 14px', opacity: editCommentText.trim() && !savingEdit ? 1 : 0.5 }}
                      >
                        {savingEdit ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={onEditCancel}
                        className="task-btn task-btn--secondary"
                        style={{ padding: '5px 12px' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="comment-bubble">{c.content}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
