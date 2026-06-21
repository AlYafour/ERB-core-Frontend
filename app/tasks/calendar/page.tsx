'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TaskListItem } from '@/types';
import { tasksApi } from '@/lib/api/tasks';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/components/tasks/shared/constants';
import { TaskDetailDrawer } from '@/components/tasks/detail/TaskDetailDrawer';
import Link from 'next/link';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function TaskCalendarPage() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedTask, setSelectedTask] = useState<number | null>(null);

  const { data: raw } = useQuery({
    queryKey: ['tasks-calendar', year, month],
    queryFn: () => tasksApi.getAll({ page_size: 200, scope: 'all' as any }),
  });

  const tasks: TaskListItem[] = Array.isArray(raw) ? raw : (raw as any)?.results ?? [];

  // Group tasks by day (only tasks with due_date in this month)
  const tasksByDay: Record<number, TaskListItem[]> = {};
  tasks.forEach(t => {
    if (!t.due_date) return;
    const d = new Date(t.due_date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!tasksByDay[day]) tasksByDay[day] = [];
      tasksByDay[day].push(t);
    }
  });

  const daysInMonth  = getDaysInMonth(year, month);
  const firstDayOfMonth = getFirstDayOfMonth(year, month);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const today = now.getDate();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ marginBottom: 6 }}>
            <Link href="/tasks" style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}>← Tasks</Link>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Task Calendar</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={prevMonth} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', minWidth: 160, textAlign: 'center' }}>{MONTHS[month]} {year}</span>
          <button onClick={nextMonth} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--card-bg)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
          {DAYS.map(d => (
            <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 480 }}>
          {/* Leading empty cells */}
          {[...Array(firstDayOfMonth)].map((_, i) => (
            <div key={`empty-${i}`} style={{ borderRight: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', minHeight: 100, background: 'var(--surface-subtle)', opacity: 0.5 }} />
          ))}

          {/* Day cells */}
          {[...Array(daysInMonth)].map((_, idx) => {
            const day = idx + 1;
            const isToday = isCurrentMonth && day === today;
            const dayTasks = tasksByDay[day] ?? [];
            return (
              <div
                key={day}
                style={{
                  borderRight: '1px solid var(--border-subtle)',
                  borderBottom: '1px solid var(--border-subtle)',
                  minHeight: 100,
                  padding: '6px 8px',
                  background: isToday ? 'var(--brand-5, #f8f0f1)' : 'var(--card-bg)',
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isToday ? 'var(--brand)' : 'transparent',
                  color: isToday ? '#fff' : 'var(--text-tertiary)',
                  fontSize: 12, fontWeight: isToday ? 700 : 400,
                  marginBottom: 4,
                }}>
                  {day}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {dayTasks.slice(0, 3).map(t => {
                    const pc = PRIORITY_CONFIG[t.priority];
                    const sc = STATUS_CONFIG[t.status];
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTask(t.id)}
                        title={t.title}
                        style={{
                          width: '100%', padding: '3px 6px', borderRadius: 4,
                          background: pc.bg, border: `1px solid ${pc.color}30`,
                          color: pc.color, fontSize: 10, fontWeight: 600,
                          textAlign: 'left', cursor: 'pointer',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.color, flexShrink: 0 }} />
                        {t.title}
                      </button>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', paddingLeft: 6 }}>+{dayTasks.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
        {(['critical','high','medium','low'] as const).map(p => {
          const cfg = PRIORITY_CONFIG[p];
          return (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: cfg.bg, border: `1.5px solid ${cfg.color}` }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{cfg.label} priority</span>
            </div>
          );
        })}
      </div>

      {selectedTask !== null && (
        <TaskDetailDrawer taskId={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
