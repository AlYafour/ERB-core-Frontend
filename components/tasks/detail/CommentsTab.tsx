'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TaskComment } from '@/types';
import { usersApi } from '@/lib/api/users';
import { TaskAvatar } from '../shared/TaskAvatar';
import { BRAND, fmtDate } from '../shared/constants';

/* Render @mention as highlighted span */
function renderWithMentions(text: string) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) =>
    /^@\w+$/.test(part)
      ? <span key={i} style={{ color: 'var(--brand)', fontWeight: 600 }}>{part}</span>
      : part
  );
}

interface MentionUser { id: number; username: string; full_name: string; avatar_url?: string | null }

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
  currentUserId?: number;
}

export function CommentsTab({
  comments, comment, onCommentChange, onSend, onDelete, sending,
  editingCommentId, editCommentText, onEditStart, onEditChange,
  onEditSave, onEditCancel, savingEdit, currentUserId,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionStart, setMentionStart]   = useState(-1);
  const [showMentions, setShowMentions]   = useState(false);

  const { data: allUsers = [] } = useQuery<MentionUser[]>({
    queryKey: ['users-mention'],
    queryFn: () => usersApi.getAll().then((r: any) => {
      const list = Array.isArray(r) ? r : (r?.results ?? []);
      return list.map((u: any) => ({
        id: u.id,
        username: u.username,
        full_name: u.full_name || u.username,
        avatar_url: u.avatar_url,
      }));
    }),
    staleTime: 5 * 60 * 1000,
  });

  const mentionCandidates = mentionSearch
    ? allUsers.filter(u =>
        u.username.toLowerCase().includes(mentionSearch.toLowerCase()) ||
        u.full_name.toLowerCase().includes(mentionSearch.toLowerCase())
      ).slice(0, 6)
    : [];

  const handleTextChange = useCallback((value: string) => {
    onCommentChange(value);
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const textBefore = value.slice(0, cursor);
    const match = textBefore.match(/@(\w*)$/);
    if (match) {
      setMentionSearch(match[1]);
      setMentionStart(cursor - match[0].length);
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionSearch('');
    }
  }, [onCommentChange]);

  const insertMention = useCallback((user: MentionUser) => {
    const ta = textareaRef.current;
    if (!ta || mentionStart < 0) return;
    const before = comment.slice(0, mentionStart);
    const after   = comment.slice(ta.selectionStart);
    const newText = `${before}@${user.username} ${after}`;
    onCommentChange(newText);
    setShowMentions(false);
    setMentionSearch('');
    // Restore focus
    setTimeout(() => {
      ta.focus();
      const pos = mentionStart + user.username.length + 2;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }, [comment, mentionStart, onCommentChange]);

  return (
    <div>
      {/* Compose */}
      <div className="compose-box" style={{ position: 'relative' }}>
        <textarea
          ref={textareaRef}
          value={comment}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Write a comment… Use @username to mention someone"
          rows={3}
          onKeyDown={(e) => {
            if (showMentions && (e.key === 'Escape')) { setShowMentions(false); return; }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSend();
          }}
          className="compose-box__textarea"
        />

        {/* Mention autocomplete dropdown */}
        {showMentions && mentionCandidates.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% - 60px)', left: 0,
            width: 240, maxHeight: 220, overflowY: 'auto',
            background: 'var(--card-bg)', border: '1px solid var(--border-subtle)',
            borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 100,
          }}>
            {mentionCandidates.map(u => (
              <button
                key={u.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); insertMention(u); }}
                style={{
                  width: '100%', padding: '8px 12px', textAlign: 'left',
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  borderBottom: '1px solid var(--border-subtle)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
              >
                <TaskAvatar name={u.full_name} url={u.avatar_url} size={24} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{u.full_name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>@{u.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="compose-box__footer">
          <span className="compose-box__hint">Ctrl + Enter to send · @mention users</span>
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
          {comments.map((c) => {
            const isOwn = c.author === currentUserId || (c as any).author_detail?.id === currentUserId;
            return (
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
                    {isOwn && editingCommentId !== c.id && (
                      <>
                        <button onClick={() => onEditStart(c.id, c.content)} className="task-btn--ghost" style={{ marginLeft: 'auto' }}>
                          Edit
                        </button>
                        <button onClick={() => onDelete(c.id)} className="task-btn--danger-ghost">
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
                        <button onClick={onEditCancel} className="task-btn task-btn--secondary" style={{ padding: '5px 12px' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="comment-bubble">{renderWithMentions(c.content)}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
