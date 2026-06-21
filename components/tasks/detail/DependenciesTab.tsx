'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskDependency, TaskListItem } from '@/types';
import { taskDepsApi, tasksApi } from '@/lib/api/tasks';
import { toast } from '@/lib/hooks/use-toast';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../shared/constants';

interface Props { taskId: number }

export function DependenciesTab({ taskId }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const { data: deps = [], isLoading } = useQuery<TaskDependency[]>({
    queryKey: ['task-deps', taskId],
    queryFn: () => taskDepsApi.list(taskId),
  });

  const { data: searchResults = [] } = useQuery<TaskListItem[]>({
    queryKey: ['tasks-search-dep', search],
    queryFn: async () => {
      if (search.trim().length < 2) return [];
      const res = await tasksApi.getAll({ search: search.trim(), page_size: 10, scope: 'all' as any });
      const list = Array.isArray(res) ? res : (res as any).results ?? [];
      const existingIds = new Set(deps.map(d => d.depends_on));
      existingIds.add(taskId);
      return list.filter((t: TaskListItem) => !existingIds.has(t.id));
    },
    enabled: search.trim().length >= 2,
  });

  const addDep = useMutation({
    mutationFn: (depId: number) => taskDepsApi.create(taskId, depId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-deps', taskId] });
      setSearch(''); setShowPicker(false);
      toast('Dependency added', 'success');
    },
    onError: () => toast('Failed to add dependency', 'error'),
  });

  const delDep = useMutation({
    mutationFn: (id: number) => taskDepsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-deps', taskId] }),
    onError: () => toast('Failed to remove dependency', 'error'),
  });

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 8px' }}>
          This task is <strong>blocked by</strong>:
        </p>

        {isLoading ? (
          <div style={{ height: 40, background: 'var(--surface-subtle)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
        ) : deps.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic', margin: 0 }}>
            No blocking tasks. This task can start freely.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {deps.map(dep => {
              const sc = STATUS_CONFIG[dep.depends_on_detail.status];
              const pc = PRIORITY_CONFIG[dep.depends_on_detail.priority];
              const isBlocking = !['approved', 'closed'].includes(dep.depends_on_detail.status);
              return (
                <div key={dep.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8,
                  background: isBlocking ? '#FEF2F2' : 'var(--surface-subtle)',
                  border: `1px solid ${isBlocking ? '#FCA5A5' : 'var(--border-subtle)'}`,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: isBlocking ? '#EF4444' : '#22C55E', flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      #{dep.depends_on_detail.id} {dep.depends_on_detail.title}
                    </p>
                    <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: sc.bg, color: sc.color, fontWeight: 600 }}>
                        {sc.label}
                      </span>
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: pc.bg, color: pc.color, fontWeight: 600 }}>
                        {pc.label}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => delDep.mutate(dep.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add dependency */}
      <div style={{ marginTop: 14 }}>
        {!showPicker ? (
          <button
            onClick={() => setShowPicker(true)}
            className="task-btn task-btn--secondary"
            style={{ fontSize: 12 }}
          >
            + Add Blocking Task
          </button>
        ) : (
          <div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks by title…"
              className="task-input"
              style={{ width: '100%', marginBottom: 6 }}
              autoFocus
            />
            {search.trim().length >= 2 && (
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                {searchResults.length === 0 ? (
                  <p style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>No tasks found</p>
                ) : (
                  searchResults.map(t => (
                    <button
                      key={t.id}
                      onClick={() => addDep.mutate(t.id)}
                      style={{
                        width: '100%', padding: '8px 14px', textAlign: 'left',
                        background: 'var(--card-bg)', border: 'none', cursor: 'pointer',
                        borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 8, alignItems: 'center',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--card-bg)'; }}
                    >
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>#{t.id}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            <div style={{ marginTop: 6 }}>
              <button onClick={() => { setShowPicker(false); setSearch(''); }} className="task-btn task-btn--secondary" style={{ fontSize: 12 }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
