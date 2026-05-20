'use client';

import type { TaskListItem } from '@/types';
import { TaskAvatar } from '../shared/TaskAvatar';
import { StatusBadge } from '../shared/StatusBadge';
import { TYPE_LABEL, PRIORITY_CONFIG, fmtDate, isOverdue } from '../shared/constants';

export type SortField = 'title' | 'status' | 'due_date' | 'priority';
export type SortDir = 'asc' | 'desc';

interface Props {
  tasks: TaskListItem[];
  onRowClick: (id: number) => void;
  sortBy?: SortField;
  sortDir?: SortDir;
  onSort?: (field: SortField) => void;
}

// ─── Priority badge ────────────────────────────────────────────────────────────

function PriorityChip({ priority }: { priority: TaskListItem['priority'] }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 11,
      fontWeight: 600,
      color: cfg.color,
      background: cfg.bg,
      padding: '3px 8px',
      borderRadius: 6,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: cfg.color,
        flexShrink: 0,
      }} />
      {cfg.label}
    </span>
  );
}

// ─── Sort icon ─────────────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" fill="none" style={{ flexShrink: 0, marginLeft: 3 }}>
      <path d="M5 1L8.5 5H1.5L5 1Z" fill={active && dir === 'asc' ? 'var(--brand)' : 'var(--border-default)'} />
      <path d="M5 11L1.5 7H8.5L5 11Z" fill={active && dir === 'desc' ? 'var(--brand)' : 'var(--border-default)'} />
    </svg>
  );
}

// ─── Column definitions ────────────────────────────────────────────────────────

const COLUMNS: { label: string; field?: SortField; width?: string | number }[] = [
  { label: 'Task',      field: 'title',    width: '36%' },
  { label: 'Status',    field: 'status',   width: 130 },
  { label: 'Priority',  field: 'priority', width: 110 },
  { label: 'Assignee',                     width: 160 },
  { label: 'Due Date',  field: 'due_date', width: 110 },
  { label: 'Progress',                     width: 120 },
];

// ─── Main component ────────────────────────────────────────────────────────────

export function TaskListView({ tasks, onRowClick, sortBy, sortDir = 'asc', onSort }: Props) {
  return (
    <div style={{ overflowX: 'auto', minWidth: 0 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          {COLUMNS.map((col) => (
            <col key={col.label} style={{ width: col.width }} />
          ))}
        </colgroup>

        {/* Header */}
        <thead>
          <tr style={{
            background: 'var(--surface-subtle)',
            borderBottom: '2px solid var(--border-subtle)',
          }}>
            {COLUMNS.map((col) => (
              <th
                key={col.label}
                onClick={col.field && onSort ? () => onSort(col.field!) : undefined}
                style={{
                  padding: '10px 14px',
                  textAlign: 'left',
                  fontSize: 10,
                  fontWeight: 700,
                  color: col.field && sortBy === col.field ? 'var(--brand)' : 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
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

        {/* Body */}
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length} style={{
                padding: '60px 20px',
                textAlign: 'center',
                border: 'none',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--border-default)"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ display: 'block', margin: '0 auto 12px' }}>
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                  <rect x="9" y="3" width="6" height="4" rx="1"/>
                </svg>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  No tasks found
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Try adjusting your filters or create a new task
                </p>
              </td>
            </tr>
          ) : (
            tasks.map((t, i) => {
              const od = isOverdue(t);
              const prio = PRIORITY_CONFIG[t.priority];
              const pct = t.subtasks_total > 0
                ? Math.round((t.subtasks_done / t.subtasks_total) * 100)
                : null;

              return (
                <tr
                  key={t.id}
                  onClick={() => onRowClick(t.id)}
                  style={{
                    borderTop: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-subtle)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Task title + type */}
                  <td style={{ padding: '11px 14px', border: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      {/* Priority color stripe */}
                      <span style={{
                        width: 3,
                        height: 32,
                        borderRadius: 99,
                        background: prio.color,
                        flexShrink: 0,
                      }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: 1.4,
                        }}>
                          {t.title}
                        </p>
                        <p style={{
                          fontSize: 11,
                          color: 'var(--text-tertiary)',
                          marginTop: 1,
                          letterSpacing: '0.02em',
                        }}>
                          {TYPE_LABEL[t.task_type]}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '11px 14px', border: 'none' }}>
                    <StatusBadge status={t.status} />
                  </td>

                  {/* Priority */}
                  <td style={{ padding: '11px 14px', border: 'none' }}>
                    <PriorityChip priority={t.priority} />
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
                        <span style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {t.assigned_to_detail.full_name}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                        Unassigned
                      </span>
                    )}
                  </td>

                  {/* Due date */}
                  <td style={{ padding: '11px 14px', border: 'none', whiteSpace: 'nowrap' }}>
                    {t.due_date ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 12,
                        fontWeight: od ? 600 : 400,
                        color: od ? '#EF4444' : 'var(--text-secondary)',
                        background: od ? '#FEF2F2' : 'transparent',
                        padding: od ? '3px 7px' : '0',
                        borderRadius: od ? 6 : 0,
                      }}>
                        {od && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                          </svg>
                        )}
                        {fmtDate(t.due_date)}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>

                  {/* Progress */}
                  <td style={{ padding: '11px 14px', border: 'none' }}>
                    {pct !== null ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                            {t.subtasks_done}/{t.subtasks_total}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: pct === 100 ? '#16A34A' : 'var(--text-tertiary)' }}>
                            {pct}%
                          </span>
                        </div>
                        <div style={{
                          height: 4,
                          background: 'var(--surface-inset)',
                          borderRadius: 99,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: pct === 100 ? '#16A34A' : 'var(--brand)',
                            borderRadius: 99,
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>
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
