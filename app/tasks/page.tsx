'use client';

import MainLayout from '@/components/layout/MainLayout';
import { useQuery } from '@tanstack/react-query';
import type { TaskListItem } from '@/types';
import { tasksApi, myTasksApi } from '@/lib/api/tasks';
import { SearchInput } from '@/components/ui';

import { useTasksUIStore } from '@/stores/tasks-ui.store';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { TaskBoard } from '@/components/tasks/board/TaskBoard';
import { TaskListView, type SortField } from '@/components/tasks/list/TaskListView';
import { TaskDetailDrawer } from '@/components/tasks/detail/TaskDetailDrawer';
import { CreateTaskDrawer } from '@/components/tasks/create/CreateTaskDrawer';
import { TodoPanel } from '@/components/tasks/todo/TodoPanel';
import { KanbanSkeleton, ListSkeleton } from '@/components/tasks/shared/Skeletons';
import { BRAND, BRAND_HEX, SCOPE_TABS, STATUS_CONFIG } from '@/components/tasks/shared/constants';

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, color, bg, border,
  onClick, active,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: '1 1 130px',
        minWidth: 0,
        padding: '13px 16px',
        borderRadius: 12,
        border: `1.5px solid ${active ? color : border}`,
        background: active ? bg : 'var(--card-bg)',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
        transition: 'all 0.15s',
        boxShadow: active ? `0 0 0 3px ${color}18` : 'var(--shadow-xs)',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = color;
          e.currentTarget.style.boxShadow = `0 2px 12px ${color}20`;
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = active ? color : border;
          e.currentTarget.style.boxShadow = active ? `0 0 0 3px ${color}18` : 'var(--shadow-xs)';
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: bg,
          border: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </span>
        <div>
          <p style={{ fontSize: 20, fontWeight: 700, color: active ? color : 'var(--text-primary)', lineHeight: 1.2 }}>
            {value ?? '—'}
          </p>
          <p style={{ fontSize: 11, color: active ? color : 'var(--text-tertiary)', fontWeight: 500, marginTop: 2 }}>
            {label}
          </p>
        </div>
      </div>
    </button>
  );
}

// ─── Filter pill ───────────────────────────────────────────────────────────────

const SEL: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  fontSize: 12,
  background: 'var(--card-bg)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
  flexShrink: 0,
  transition: 'border-color 0.15s',
};

// ─── View toggle ───────────────────────────────────────────────────────────────

function ViewToggle({ view, setView }: { view: 'kanban' | 'list'; setView: (v: 'kanban' | 'list') => void }) {
  return (
    <div style={{ display: 'flex', background: 'var(--surface-subtle)', borderRadius: 9, padding: 2, flexShrink: 0 }}>
      {(['kanban', 'list'] as const).map((v) => (
        <button
          key={v}
          onClick={() => setView(v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 12px',
            borderRadius: 7,
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            background: view === v ? 'var(--card-bg)' : 'transparent',
            color: view === v ? 'var(--text-primary)' : 'var(--text-tertiary)',
            boxShadow: view === v ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          {v === 'kanban' ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/>
              </svg>
              Board
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              List
            </>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function TasksPage() {
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
    clearFilters,
  } = useTasksUIStore();

  const { isAdmin } = usePermissions();
  const ordering = sortBy ? (sortDir === 'desc' ? `-${sortBy}` : sortBy) : undefined;
  const hasFilters = Boolean(search || statusFilter || priorityFilter || taskTypeFilter);
  // Admin on "All Tasks" tab → send scope='all' to see every tenant task
  const effectiveScope = scope
    ? (scope as 'mine' | 'created' | 'team' | 'watching')
    : isAdmin ? 'all' : undefined;

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: raw, isLoading } = useQuery({
    queryKey: ['tasks', effectiveScope, statusFilter, priorityFilter, taskTypeFilter, search, ordering, page],
    queryFn: () =>
      tasksApi.getAll({
        scope: effectiveScope,
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
    queryFn: () => myTasksApi.getAll().then((r) => r.filter((t) => !t.is_done).length),
  });

  const tasks: TaskListItem[] = Array.isArray(raw)
    ? raw
    : (raw as { results?: TaskListItem[] })?.results ?? [];

  const totalCount = !Array.isArray(raw) && (raw as { count?: number })?.count;
  const totalPages = totalCount ? Math.ceil(totalCount / PAGE_SIZE) : 1;

  const overdueCount = stats?.overdue ?? 0;
  const reviewCount = stats?.pending_review ?? 0;
  const completedCount = stats?.completed_this_month ?? 0;
  const totalStat = stats?.by_status
    ? Object.values(stats.by_status).reduce((a, b) => a + b, 0)
    : undefined;

  return (
    <MainLayout>
      <div style={{ marginRight: isTodoOpen ? 340 : 0, transition: 'margin-right 0.22s ease', display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── Page header ──────────────────────────────────────── */}
        <div style={{
          padding: '20px 28px 0',
          background: 'var(--card-bg)',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Tasks
              </h1>
              {(totalCount || tasks.length > 0) && (
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {totalCount !== false && totalCount != null ? totalCount : tasks.length} tasks
                </p>
              )}
            </div>

            <div style={{ flex: 1 }} />

            {/* My To-Do button */}
            <button
              onClick={toggleTodo}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 9,
                border: `1.5px solid ${isTodoOpen ? BRAND : 'var(--border-subtle)'}`,
                background: isTodoOpen ? `${BRAND_HEX}10` : 'var(--card-bg)',
                color: isTodoOpen ? BRAND : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              My To-Do
              {(myCount as number) > 0 && (
                <span style={{
                  background: BRAND, color: '#fff', borderRadius: 99,
                  padding: '0 6px', fontSize: 11, fontWeight: 700, lineHeight: '18px',
                  minWidth: 18, textAlign: 'center',
                }}>
                  {myCount}
                </span>
              )}
            </button>

            {/* New Task button */}
            <button
              onClick={openCreate}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 18px',
                borderRadius: 9,
                border: 'none',
                background: BRAND,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: `0 4px 14px ${BRAND_HEX}35`,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Task
            </button>
          </div>

          {/* Stats bar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <StatCard
              label="All Tasks" value={totalStat}
              color="var(--brand)" bg={`${BRAND_HEX}10`} border={`${BRAND_HEX}25`}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>}
              onClick={() => { setScope(''); setStatusFilter(''); clearFilters(); }}
              active={!scope && !statusFilter && !hasFilters}
            />
            <StatCard
              label="My Tasks" value={stats?.my_tasks}
              color="#3B82F6" bg="#EFF6FF" border="#BFDBFE"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
              onClick={() => setScope('mine')}
              active={scope === 'mine'}
            />
            <StatCard
              label="In Review" value={reviewCount}
              color="#F97316" bg="#FFF7ED" border="#FED7AA"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
              onClick={() => setStatusFilter(statusFilter === 'review' ? '' : 'review')}
              active={statusFilter === 'review'}
            />
            <StatCard
              label="Overdue" value={overdueCount}
              color="#EF4444" bg="#FEF2F2" border="#FECACA"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            />
            <StatCard
              label="Done This Month" value={completedCount}
              color="#16A34A" bg="#DCFCE7" border="#86EFAC"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
            />
          </div>

          {/* Scope tabs */}
          <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
            {SCOPE_TABS.map((tab) => {
              const active = scope === tab.value && !statusFilter;
              return (
                <button
                  key={tab.value}
                  onClick={() => { setScope(tab.value); setStatusFilter(''); }}
                  style={{
                    padding: '9px 16px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? BRAND : 'var(--text-secondary)',
                    borderBottom: active ? `2px solid ${BRAND}` : '2px solid transparent',
                    marginBottom: -1,
                    transition: 'color 0.12s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Toolbar ───────────────────────────────────────────── */}
        <div style={{
          padding: '10px 28px',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexShrink: 0,
          background: 'var(--card-bg)',
          borderBottom: '1px solid var(--border-subtle)',
          flexWrap: 'wrap',
        }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search tasks…" width={220} />

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={SEL}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={SEL}>
              <option value="">All priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select value={taskTypeFilter} onChange={(e) => setTaskTypeFilter(e.target.value)} style={SEL}>
              <option value="">All types</option>
              <option value="task">Task</option>
              <option value="request">Request</option>
              <option value="issue">Issue</option>
              <option value="followup">Follow-up</option>
            </select>

            {hasFilters && (
              <button
                onClick={clearFilters}
                style={{
                  ...SEL,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  color: '#EF4444',
                  border: '1px solid #FECACA',
                  background: '#FEF2F2',
                  fontWeight: 600,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Clear
              </button>
            )}
          </div>

          <ViewToggle view={view} setView={setView} />
        </div>

        {/* ── Main content ──────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {isLoading ? (
            <div style={{ padding: '20px 28px' }}>
              {view === 'kanban' ? <KanbanSkeleton /> : <ListSkeleton />}
            </div>
          ) : tasks.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 40,
              textAlign: 'center',
            }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 18,
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--border-default)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                  <rect x="9" y="3" width="6" height="4" rx="1"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                {hasFilters ? 'No matching tasks' : 'No tasks yet'}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 340, lineHeight: 1.6, marginBottom: 20 }}>
                {hasFilters
                  ? 'Try adjusting your filters or clearing the search query.'
                  : 'Create your first task to start managing your team\'s work.'}
              </p>
              {hasFilters ? (
                <button
                  onClick={clearFilters}
                  style={{
                    padding: '9px 22px', borderRadius: 9,
                    border: '1.5px solid var(--border-default)',
                    background: 'transparent', color: 'var(--text-secondary)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  onClick={openCreate}
                  style={{
                    padding: '10px 24px', borderRadius: 9, border: 'none',
                    background: BRAND, color: '#fff',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    boxShadow: `0 4px 14px ${BRAND_HEX}35`,
                  }}
                >
                  + Create First Task
                </button>
              )}
            </div>
          ) : view === 'kanban' ? (
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', padding: '20px 20px 28px' }}>
              <TaskBoard tasks={tasks} onCardClick={openTask} />
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <TaskListView
                tasks={tasks}
                onRowClick={openTask}
                sortBy={sortBy as SortField | undefined}
                sortDir={sortDir}
                onSort={(field) => setSort(field)}
              />
              {totalPages > 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '16px 20px', borderTop: '1px solid var(--border-subtle)',
                }}>
                  <button
                    onClick={() => setPage(page - 1)} disabled={page <= 1}
                    style={{ ...SEL, opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
                  >
                    ← Prev
                  </button>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)} disabled={page >= totalPages}
                    style={{ ...SEL, opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Side panels ──────────────────────────────────────────── */}
      {isTodoOpen && <TodoPanel onClose={closeTodo} onOpenTask={openTask} />}
      {selectedTaskId !== null && <TaskDetailDrawer taskId={selectedTaskId} onClose={closeTask} />}
      {isCreateOpen && <CreateTaskDrawer onClose={closeCreate} />}
    </MainLayout>
  );
}
