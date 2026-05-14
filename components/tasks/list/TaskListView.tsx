'use client';

import type { TaskListItem } from '@/types';
import { TaskAvatar } from '../shared/TaskAvatar';
import { StatusBadge } from '../shared/StatusBadge';
import { PriorityBar } from '../shared/PriorityBar';
import { TYPE_LABEL, fmtDate, isOverdue } from '../shared/constants';

export type SortField = 'title' | 'status' | 'due_date' | 'priority';
export type SortDir = 'asc' | 'desc';

interface Props {
  tasks: TaskListItem[];
  onRowClick: (id: number) => void;
  sortBy?: SortField;
  sortDir?: SortDir;
  onSort?: (field: SortField) => void;
}

const COLUMNS: { label: string; field?: SortField }[] = [
  { label: '' },
  { label: 'Task',     field: 'title' },
  { label: 'Status',   field: 'status' },
  { label: 'Assignee' },
  { label: 'Due Date', field: 'due_date' },
  { label: 'Progress' },
];

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  const color = active ? 'var(--brand)' : 'var(--border-subtle)';
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      style={{ flexShrink: 0, marginLeft: 4 }}
    >
      <path
        d="M5 2L8 6H2L5 2Z"
        fill={active && dir === 'asc' ? color : 'var(--border-subtle)'}
      />
      <path
        d="M5 8L2 4H8L5 8Z"
        fill={active && dir === 'desc' ? color : 'var(--border-subtle)'}
      />
    </svg>
  );
}

export function TaskListView({ tasks, onRowClick, sortBy, sortDir = 'asc', onSort }: Props) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr
            style={{
              background: 'var(--surface-subtle)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            {COLUMNS.map((col) => (
              <th
                key={col.label}
                onClick={col.field && onSort ? () => onSort(col.field!) : undefined}
                style={{
                  padding: '10px 14px',
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 700,
                  color: col.field && sortBy === col.field ? 'var(--brand)' : 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  border: 'none',
                  whiteSpace: 'nowrap',
                  cursor: col.field && onSort ? 'pointer' : 'default',
                  userSelect: 'none',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {col.label}
                  {col.field && onSort && (
                    <SortIcon active={sortBy === col.field} dir={sortDir} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                style={{
                  padding: '52px',
                  textAlign: 'center',
                  color: 'var(--text-tertiary)',
                  fontSize: 13,
                  border: 'none',
                }}
              >
                No tasks found
              </td>
            </tr>
          ) : (
            tasks.map((t, i) => {
              const od = isOverdue(t);
              return (
                <tr
                  key={t.id}
                  onClick={() => onRowClick(t.id)}
                  style={{
                    borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-subtle)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Priority */}
                  <td style={{ padding: '11px 14px', width: 32, border: 'none' }}>
                    <PriorityBar priority={t.priority} />
                  </td>

                  {/* Task title + type */}
                  <td style={{ padding: '11px 14px', maxWidth: 340, border: 'none' }}>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        margin: 0,
                      }}
                    >
                      {t.title}
                    </p>
                    <p
                      style={{
                        fontSize: 11,
                        color: 'var(--text-tertiary)',
                        marginTop: 2,
                        marginBottom: 0,
                      }}
                    >
                      {TYPE_LABEL[t.task_type]}
                    </p>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '11px 14px', border: 'none' }}>
                    <StatusBadge status={t.status} />
                  </td>

                  {/* Assignee */}
                  <td style={{ padding: '11px 14px', border: 'none' }}>
                    {t.assigned_to_detail ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <TaskAvatar
                          name={t.assigned_to_detail.full_name}
                          url={t.assigned_to_detail.avatar_url}
                          size={24}
                        />
                        <span
                          style={{
                            fontSize: 12,
                            color: 'var(--text-secondary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 140,
                          }}
                        >
                          {t.assigned_to_detail.full_name}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>

                  {/* Due date */}
                  <td
                    style={{
                      padding: '11px 14px',
                      fontSize: 12,
                      color: od ? '#EF4444' : 'var(--text-secondary)',
                      fontWeight: od ? 600 : 400,
                      whiteSpace: 'nowrap',
                      border: 'none',
                    }}
                  >
                    {t.due_date ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {od && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                        )}
                        {fmtDate(t.due_date)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>

                  {/* Progress */}
                  <td style={{ padding: '11px 14px', minWidth: 120, border: 'none' }}>
                    {t.subtasks_total > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            flex: 1,
                            height: 4,
                            background: 'var(--surface-subtle)',
                            borderRadius: 99,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: 4,
                              background: '#16A34A',
                              borderRadius: 99,
                              width: `${Math.round((t.subtasks_done / t.subtasks_total) * 100)}%`,
                            }}
                          />
                        </div>
                        <span
                          style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}
                        >
                          {t.subtasks_done}/{t.subtasks_total}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
