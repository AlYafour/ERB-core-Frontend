'use client';

import MainLayout from '@/components/layout/MainLayout';
import { useQuery } from '@tanstack/react-query';
import type { TaskListItem } from '@/types';
import { tasksApi, myTasksApi } from '@/lib/api/tasks';
import {
  Button,
  PageHeader,
  PageShell,
  WorkspaceSurface,
  SearchInput,
} from '@/components/ui';

// ── New modular components ──────────────────────────────────────────────────
import { useTasksUIStore } from '@/stores/tasks-ui.store';
import { TaskBoard } from '@/components/tasks/board/TaskBoard';
import { TaskListView, type SortField } from '@/components/tasks/list/TaskListView';
import { TaskDetailDrawer } from '@/components/tasks/detail/TaskDetailDrawer';
import { CreateTaskDrawer } from '@/components/tasks/create/CreateTaskDrawer';
import { TodoPanel } from '@/components/tasks/todo/TodoPanel';
import { KanbanSkeleton, ListSkeleton } from '@/components/tasks/shared/Skeletons';
import { BRAND, SCOPE_TABS, STATUS_CONFIG } from '@/components/tasks/shared/constants';

const SEL_STYLE = {
  padding: '6px 10px',
  borderRadius: 7,
  border: '1px solid var(--border-subtle)',
  fontSize: 12,
  background: 'var(--surface-subtle)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  outline: 'none',
  flexShrink: 0 as const,
  fontFamily: 'inherit',
};

export default function TasksPage() {
  // ── UI state from Zustand ──────────────────────────────────────────────
  const {
    view, setView,
    scope, setScope,
    statusFilter, setStatusFilter,
    priorityFilter, setPriorityFilter,
    taskTypeFilter, setTaskTypeFilter,
    search, setSearch,
    sortBy, sortDir, setSort,
    page, setPage,
    selectedTaskId, openTask, closeTask,
    isCreateOpen, openCreate, closeCreate,
    isTodoOpen, toggleTodo, closeTodo,
  } = useTasksUIStore();

  const PAGE_SIZE = 50;

  // Build ordering string for API
  const ordering = sortBy ? (sortDir === 'desc' ? `-${sortBy}` : sortBy) : undefined;

  // ── Server state ───────────────────────────────────────────────────────
  const { data: raw, isLoading } = useQuery({
    queryKey: ['tasks', scope, statusFilter, priorityFilter, taskTypeFilter, search, ordering, page],
    queryFn: () =>
      tasksApi.getAll({
        scope: (scope as 'mine' | 'created' | 'team' | 'watching') || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        task_type: taskTypeFilter || undefined,
        search: search || undefined,
        ordering,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const { data: stats } = useQuery({
    queryKey: ['task-stats'],
    queryFn: () => tasksApi.stats(),
  });

  const { data: myCount = 0 } = useQuery<number>({
    queryKey: ['my-tasks-count'],
    queryFn: () =>
      myTasksApi.getAll().then((r) => {
        const arr = Array.isArray(r) ? r : (r as { results?: typeof r })?.results ?? [];
        return (arr as { is_done?: boolean }[]).filter((t) => !t.is_done).length;
      }),
  });

  const tasks: TaskListItem[] = Array.isArray(raw)
    ? raw
    : (raw as { results?: TaskListItem[] })?.results ?? [];

  const totalPages = !Array.isArray(raw) && (raw as { count?: number })?.count
    ? Math.ceil(((raw as { count: number }).count) / PAGE_SIZE)
    : 1;

  const reviewCount  = stats?.pending_review ?? 0;
  const overdueCount = stats?.overdue ?? 0;
  const totalCount   = stats?.by_status ? Object.values(stats.by_status).reduce((a, b) => a + b, 0) : undefined;

  const hasFilters = Boolean(search || statusFilter || priorityFilter || taskTypeFilter);

  return (
    <MainLayout>
      {/* Shift content when Todo panel is open */}
      <div
        style={{
          marginRight: isTodoOpen ? 340 : 0,
          transition: 'margin-right 0.22s ease',
        }}
      >
        <PageShell>
          {/* ── Page header ─────────────────────────────────────────── */}
          <div>
            <PageHeader
              title="Tasks"
              count={totalCount}
              breadcrumbs={[{ label: 'Tasks' }]}
              actions={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Alert pills */}
                  {overdueCount > 0 && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 10px',
                        borderRadius: 99,
                        background: '#FEF2F2',
                        color: '#EF4444',
                        fontSize: 12,
                        fontWeight: 600,
                        border: '1px solid #FECACA',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {overdueCount} overdue
                    </span>
                  )}
                  {reviewCount > 0 && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 10px',
                        borderRadius: 99,
                        background: '#FFF7ED',
                        color: '#C2410C',
                        fontSize: 12,
                        fontWeight: 600,
                        border: '1px solid #FED7AA',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {reviewCount} in review
                    </span>
                  )}

                  {/* My To-Do toggle */}
                  <button
                    onClick={toggleTodo}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '7px 14px',
                      borderRadius: 8,
                      border: isTodoOpen ? `1.5px solid ${BRAND}` : '1.5px solid var(--border-subtle)',
                      background: isTodoOpen ? '#FFF7ED' : 'var(--card-bg)',
                      color: isTodoOpen ? BRAND : 'var(--text-secondary)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 11l3 3L22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                    My To-Do
                    {(myCount as number) > 0 && (
                      <span
                        style={{
                          background: BRAND,
                          color: '#fff',
                          borderRadius: 99,
                          padding: '0 6px',
                          fontSize: 11,
                          fontWeight: 700,
                          lineHeight: '18px',
                          minWidth: 18,
                          textAlign: 'center',
                        }}
                      >
                        {myCount}
                      </span>
                    )}
                  </button>

                  <Button variant="primary" onClick={openCreate}>+ New Task</Button>
                </div>
              }
            />

            {/* Scope tabs */}
            <div
              style={{
                display: 'flex',
                gap: 0,
                borderBottom: '1px solid var(--border-subtle)',
                marginTop: 4,
                flexWrap: 'wrap',
              }}
            >
              {SCOPE_TABS.map((tab) => {
                const active = scope === tab.value && statusFilter !== 'review';
                return (
                  <button
                    key={tab.value}
                    onClick={() => { setScope(tab.value); }}
                    style={{
                      padding: '8px 14px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: active ? 700 : 400,
                      color: active ? BRAND : 'var(--text-secondary)',
                      borderBottom: active ? `2px solid ${BRAND}` : '2px solid transparent',
                      marginBottom: -1,
                      transition: 'color 0.12s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}

              {/* Pending Review quick tab */}
              {reviewCount > 0 && (
                <button
                  onClick={() => setStatusFilter(statusFilter === 'review' ? '' : 'review')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: statusFilter === 'review' ? 700 : 500,
                    color: statusFilter === 'review' ? BRAND : '#C2410C',
                    background: 'transparent',
                    borderBottom:
                      statusFilter === 'review' ? `2px solid ${BRAND}` : '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  Pending Review
                  <span
                    style={{
                      background: statusFilter === 'review' ? BRAND : '#FED7AA',
                      color: statusFilter === 'review' ? '#fff' : '#C2410C',
                      borderRadius: 99,
                      padding: '0 6px',
                      fontSize: 11,
                      fontWeight: 700,
                      lineHeight: '18px',
                    }}
                  >
                    {reviewCount}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* ── Main workspace ─────────────────────────────────────── */}
          <WorkspaceSurface
            toolbar={
              <>
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search tasks…"
                  width={240}
                />
                <div style={{ flex: 1 }} />

                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={SEL_STYLE}
                >
                  <option value="">All statuses</option>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>

                {/* Priority filter */}
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  style={SEL_STYLE}
                >
                  <option value="">All priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                {/* Task type filter */}
                <select
                  value={taskTypeFilter}
                  onChange={(e) => setTaskTypeFilter(e.target.value)}
                  style={SEL_STYLE}
                >
                  <option value="">All types</option>
                  <option value="task">Task</option>
                  <option value="request">Request</option>
                  <option value="issue">Issue</option>
                  <option value="followup">Follow-up</option>
                </select>

                {/* View toggle */}
                <div
                  style={{
                    display: 'flex',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {(['kanban', 'list'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      style={{
                        padding: '6px 14px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 500,
                        background: view === v ? BRAND : 'transparent',
                        color: view === v ? '#fff' : 'var(--text-secondary)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {v === 'kanban' ? 'Board' : 'List'}
                    </button>
                  ))}
                </div>
              </>
            }
          >
            {/* ── Content ─────────────────────────────────────────── */}
            {isLoading ? (
              view === 'kanban' ? <KanbanSkeleton /> : <ListSkeleton />
            ) : tasks.length === 0 ? (
              <div className="empty-state">
                <svg
                  className="empty-state-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="empty-state-title">No tasks found</p>
                <p className="empty-state-desc">
                  {hasFilters
                    ? 'Try adjusting your filters or search query'
                    : 'Create your first task to get started'}
                </p>
                {!hasFilters && (
                  <button
                    onClick={openCreate}
                    style={{
                      marginTop: 4,
                      padding: '8px 20px',
                      borderRadius: 8,
                      border: 'none',
                      background: BRAND,
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    + New Task
                  </button>
                )}
              </div>
            ) : view === 'kanban' ? (
              <div style={{ padding: '16px 0 20px' }}>
                <TaskBoard tasks={tasks} onCardClick={openTask} />
              </div>
            ) : (
              <>
                <TaskListView
                  tasks={tasks}
                  onRowClick={openTask}
                  sortBy={sortBy as SortField | undefined}
                  sortDir={sortDir}
                  onSort={(field) => setSort(field)}
                />
                {totalPages > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '16px 20px',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                      style={{
                        ...SEL_STYLE,
                        opacity: page <= 1 ? 0.4 : 1,
                        cursor: page <= 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      ← Prev
                    </button>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', userSelect: 'none' }}>
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                      style={{
                        ...SEL_STYLE,
                        opacity: page >= totalPages ? 0.4 : 1,
                        cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </WorkspaceSurface>
        </PageShell>
      </div>

      {/* ── Panels / Drawers ─────────────────────────────────────── */}
      {isTodoOpen && <TodoPanel onClose={closeTodo} onOpenTask={openTask} />}

      {selectedTaskId !== null && (
        <TaskDetailDrawer taskId={selectedTaskId} onClose={closeTask} />
      )}

      {isCreateOpen && <CreateTaskDrawer onClose={closeCreate} />}
    </MainLayout>
  );
}
