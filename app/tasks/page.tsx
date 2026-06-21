'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskListItem } from '@/types';
import { tasksApi, myTasksApi } from '@/lib/api/tasks';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useTableState } from '@/lib/hooks/use-table-state';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { Button, type Column } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import { ProcListPage } from '@/components/procurement/list/ProcListPage';
import { type FilterField } from '@/components/ui/FilterPanel';
import { TaskDetailDrawer } from '@/components/tasks/detail/TaskDetailDrawer';
import { CreateTaskDrawer } from '@/components/tasks/create/CreateTaskDrawer';
import { TodoPanel } from '@/components/tasks/todo/TodoPanel';
import { TaskAvatar } from '@/components/tasks/shared/TaskAvatar';
import { StatusBadge } from '@/components/tasks/shared/StatusBadge';
import { TYPE_LABEL, PRIORITY_CONFIG, fmtDate, isOverdue } from '@/components/tasks/shared/constants';

const PAGE_SIZE = 50;

export default function TasksPage() {
  const tableState = useTableState();
  const { page, search, filters, selectedItems, clearSelection } = tableState;

  const { user } = useAuth();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const { isAdmin } = usePermissions();
  const isPrivileged = isTenantAdmin || isPlatformAdmin;
  const qc = useQueryClient();

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen]     = useState(false);
  const [isTodoOpen, setIsTodoOpen]         = useState(false);

  const { data: myCount = 0 } = useQuery<number>({
    queryKey: ['my-tasks-count'],
    queryFn:  () => myTasksApi.getAll().then(r => r.filter(t => !t.is_done).length),
  });

  const effectiveScope = (filters.scope as string) || (isAdmin ? 'all' : undefined);

  const { data: raw, isLoading, error } = useQuery({
    queryKey: ['tasks', page, search, filters],
    queryFn:  () => tasksApi.getAll({
      scope:     effectiveScope as any,
      status:    (filters.status    as string) || undefined,
      priority:  (filters.priority  as string) || undefined,
      task_type: (filters.task_type as string) || undefined,
      search:    search || undefined,
      page,
      page_size: PAGE_SIZE,
    }),
  });

  const { data: stats } = useQuery({
    queryKey: ['task-stats'],
    queryFn:  () => tasksApi.stats(),
  });

  const tasks: TaskListItem[] = Array.isArray(raw) ? raw : (raw as any)?.results ?? [];
  const totalCount = Array.isArray(raw) ? tasks.length : ((raw as any)?.count ?? 0);
  const byStatus   = (stats as any)?.by_status ?? {};
  const totalStat  = Object.values(byStatus).reduce((a: number, b) => a + (b as number), 0) || undefined;

  /* ── Delete ──────────────────────────────────────────────────────────── */

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tasksApi.deleteTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-stats'] });
      toast('Task deleted', 'success');
    },
    onError: () => toast('Failed to delete task', 'error'),
  });

  const handleDelete = useCallback(async (id: number) => {
    if (await confirm('Delete this task? This cannot be undone.')) deleteMutation.mutate(id);
  }, [deleteMutation]);

  const handleBulkDelete = async () => {
    if (!selectedItems.size) return;
    if (!await confirm(`Delete ${selectedItems.size} task${selectedItems.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    for (const id of Array.from(selectedItems)) {
      try { await tasksApi.deleteTask(id); } catch {}
    }
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['task-stats'] });
    clearSelection();
    toast('Tasks deleted', 'success');
  };

  /* ── Filter fields ────────────────────────────────────────────────────── */

  const filterFields: FilterField[] = [
    {
      name: 'scope', label: 'Scope', type: 'select', group: 'View',
      options: [
        { value: 'mine',     label: 'Assigned to Me' },
        { value: 'created',  label: 'Created by Me' },
        { value: 'team',     label: 'My Team' },
        { value: 'watching', label: 'Watching' },
      ],
    },
    {
      name: 'priority', label: 'Priority', type: 'select', group: 'Task Info',
      options: [
        { value: 'critical', label: 'Critical' },
        { value: 'high',     label: 'High' },
        { value: 'medium',   label: 'Medium' },
        { value: 'low',      label: 'Low' },
      ],
    },
    {
      name: 'task_type', label: 'Type', type: 'select', group: 'Task Info',
      options: [
        { value: 'task',     label: 'Task' },
        { value: 'request',  label: 'Request' },
        { value: 'issue',    label: 'Issue' },
        { value: 'followup', label: 'Follow-up' },
      ],
    },
  ];

  /* ── Columns ─────────────────────────────────────────────────────────── */

  const columns = useMemo((): Column<TaskListItem>[] => [
    {
      key: 'title', header: 'Task',
      render: t => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{
            width: 3, height: 32, borderRadius: 99,
            background: PRIORITY_CONFIG[t.priority].color, flexShrink: 0,
          }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4, margin: 0 }}>
              {t.title}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1, margin: 0 }}>
              {TYPE_LABEL[t.task_type]}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: t => <StatusBadge status={t.status} />,
    },
    {
      key: 'priority', header: 'Priority',
      render: t => {
        const cfg = PRIORITY_CONFIG[t.priority];
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: 'assignee', header: 'Assignee',
      render: t => t.assigned_to_detail ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <TaskAvatar name={t.assigned_to_detail.full_name} url={t.assigned_to_detail.avatar_url} size={24} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.assigned_to_detail.full_name}
          </span>
        </div>
      ) : <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Unassigned</span>,
    },
    {
      key: 'due_date', header: 'Due Date',
      render: t => {
        const od = isOverdue(t);
        return t.due_date ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: od ? 600 : 400, color: od ? '#EF4444' : 'var(--text-secondary)', background: od ? '#FEF2F2' : 'transparent', padding: od ? '3px 7px' : '0', borderRadius: od ? 6 : 0, whiteSpace: 'nowrap' }}>
            {od && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            {fmtDate(t.due_date)}
          </span>
        ) : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>;
      },
    },
    {
      key: 'progress', header: 'Progress',
      render: t => {
        const pct = t.subtasks_total > 0 ? Math.round((t.subtasks_done / t.subtasks_total) * 100) : null;
        return pct !== null ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{t.subtasks_done}/{t.subtasks_total}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: pct === 100 ? '#16A34A' : 'var(--text-tertiary)' }}>{pct}%</span>
            </div>
            <div style={{ height: 4, background: 'var(--surface-inset)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#16A34A' : 'var(--brand)', borderRadius: 99 }} />
            </div>
          </div>
        ) : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>;
      },
    },
    {
      key: 'actions', header: '',
      render: t => {
        const canDel = isPrivileged || t.created_by === (user as any)?.id;
        if (!canDel) return null;
        return (
          <RowActions actions={[
            { label: 'Delete', onClick: () => handleDelete(t.id), variant: 'danger' },
          ]} />
        );
      },
    },
  ], [isPrivileged, user, handleDelete]);

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <ProcListPage
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Tasks' }]}
      title="Tasks"
      description="Track and manage team tasks."
      totalCount={totalCount}
      createAction={
        <Button variant="primary" onClick={() => setIsCreateOpen(true)}>+ New Task</Button>
      }
      statusItems={[
        { value: '',            label: 'All',          count: totalStat },
        { value: 'assigned',    label: 'Assigned',     count: byStatus.assigned },
        { value: 'in_progress', label: 'In Progress',  count: byStatus.in_progress },
        { value: 'review',      label: 'Under Review', count: byStatus.review },
        { value: 'accepted',    label: 'Accepted',     count: byStatus.accepted },
        { value: 'approved',    label: 'Approved',     count: byStatus.approved },
        { value: 'closed',      label: 'Closed',       count: byStatus.closed },
      ]}
      searchPlaceholder="Search tasks…"
      extraActions={
        <button
          className={`proc-cmd-btn${isTodoOpen ? ' proc-cmd-btn--active' : ''}`}
          onClick={() => setIsTodoOpen(v => !v)}
        >
          My To-Do{Number(myCount) > 0 ? ` (${myCount})` : ''}
        </button>
      }
      filterFields={filterFields}
      advFilterTitle="Task Filters"
      advFilterDesc="Filter by scope, priority, or task type."
      columns={columns}
      data={tasks}
      isLoading={isLoading}
      error={error}
      onRowClick={t => setSelectedTaskId(t.id)}
      selectable={isPrivileged}
      tableState={tableState}
      paginatedData={raw as any}
      pageSize={PAGE_SIZE}
      emptyTitle="No tasks found"
      emptyAction={<Button variant="primary" onClick={() => setIsCreateOpen(true)}>Create First Task</Button>}
      bulkActions={
        isPrivileged && selectedItems.size > 0 ? (
          <Button variant="destructive" onClick={handleBulkDelete}>
            Delete {selectedItems.size}
          </Button>
        ) : undefined
      }
    >
      {isTodoOpen      && <TodoPanel onClose={() => setIsTodoOpen(false)} onOpenTask={setSelectedTaskId} />}
      {selectedTaskId !== null && <TaskDetailDrawer taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />}
      {isCreateOpen    && <CreateTaskDrawer onClose={() => setIsCreateOpen(false)} />}
    </ProcListPage>
  );
}
