'use client';

import type { SubTask } from '@/types';
import { TaskAvatar } from '../shared/TaskAvatar';
import { BRAND } from '../shared/constants';

interface Props {
  subtasks: SubTask[];
  newSub: string;
  onNewSubChange: (v: string) => void;
  onAddSubtask: () => void;
  onToggle: (id: number, done: boolean) => void;
}

export function ChecklistTab({ subtasks, newSub, onNewSubChange, onAddSubtask, onToggle }: Props) {
  const done = subtasks.filter((s) => s.is_completed).length;
  const pct  = subtasks.length > 0 ? Math.round((done / subtasks.length) * 100) : 0;

  return (
    <div>
      {/* Progress */}
      {subtasks.length > 0 && (
        <div className="checklist-progress">
          <div className="checklist-progress__head">
            <span className="checklist-progress__label">
              {done} of {subtasks.length} completed
            </span>
            <span
              className="checklist-progress__pct"
              style={{ color: pct === 100 ? 'var(--status-success)' : BRAND }}
            >
              {pct}%
            </span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${pct}%`,
                background: pct === 100 ? 'var(--status-success)' : BRAND,
              }}
            />
          </div>
        </div>
      )}

      {/* Items */}
      <div className="checklist-list">
        {subtasks.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '12px 0', textAlign: 'center', margin: 0 }}>
            No checklist items yet. Add one below.
          </p>
        )}
        {subtasks.map((s) => (
          <div
            key={s.id}
            className={`checklist-item${s.is_completed ? ' checklist-item--done' : ''}`}
          >
            <button
              onClick={() => onToggle(s.id, !s.is_completed)}
              className={`checklist-check${s.is_completed ? ' checklist-check--done' : ''}`}
            >
              {s.is_completed && (
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2,6 5,9 10,3" />
                </svg>
              )}
            </button>
            <span className={`checklist-text${s.is_completed ? ' checklist-text--done' : ''}`}>
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
      </div>

      {/* Add */}
      <div className="checklist-add">
        <input
          value={newSub}
          onChange={(e) => onNewSubChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onAddSubtask(); }}
          placeholder="Add a checklist item…"
          className="task-input"
        />
        <button
          onClick={onAddSubtask}
          disabled={!newSub.trim()}
          className="task-btn task-btn--primary"
          style={{ padding: '8px 16px', opacity: newSub.trim() ? 1 : 0.5 }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
