'use client';

import { useQueryClient, useMutation } from '@tanstack/react-query';
import type { TaskListItem, TaskStatus } from '@/types';
import { tasksApi } from '@/lib/api/tasks';
import { KANBAN_COLS } from '../shared/constants';
import { BoardColumn } from './BoardColumn';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';

interface Props {
  tasks: TaskListItem[];
  onCardClick: (id: number) => void;
  onAddClick?: () => void;
}

// Map every status to the column it appears in
const STATUS_TO_COL: Record<TaskStatus, TaskStatus> = {
  draft:       'assigned',
  assigned:    'assigned',
  rejected:    'assigned',
  accepted:    'in_progress',
  in_progress: 'in_progress',
  submitted:   'review',
  review:      'review',
  approved:    'approved',
  closed:      'approved',
};

// Return the API call to make when dragging FROM fromStatus TO targetCol
function getTransition(fromStatus: TaskStatus, targetCol: TaskStatus): ((id: number) => Promise<unknown>) | null {
  switch (targetCol) {
    case 'in_progress':
      if (['assigned', 'accepted', 'rejected', 'draft'].includes(fromStatus))
        return (id) => tasksApi.start(id);
      break;
    case 'review':
      if (['in_progress', 'accepted'].includes(fromStatus))
        return (id) => tasksApi.submit(id);
      break;
    case 'approved':
      if (['review', 'submitted'].includes(fromStatus))
        return (id) => tasksApi.approve(id);
      break;
    case 'assigned':
      if (['approved', 'rejected', 'closed', 'in_progress', 'review', 'submitted'].includes(fromStatus))
        return (id) => tasksApi.reopen(id);
      break;
  }
  return null;
}

export function TaskBoard({ tasks, onCardClick, onAddClick }: Props) {
  const qc = useQueryClient();

  const move = useMutation({
    mutationFn: async ({
      taskId,
      targetCol,
      fromStatus,
    }: {
      taskId: number;
      targetCol: TaskStatus;
      fromStatus: TaskStatus;
    }) => {
      const fn = getTransition(fromStatus, targetCol);
      if (!fn) throw new Error(`Cannot move from "${fromStatus}" to "${targetCol}"`);
      return fn(taskId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-stats'] });
    },
    onError: (err: unknown) => {
      toast(getApiError(err, 'Could not move task — this transition is not allowed'), 'error');
    },
  });

  function handleDrop(taskId: number, targetCol: TaskStatus, fromStatus: TaskStatus) {
    move.mutate({ taskId, targetCol, fromStatus });
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        minHeight: 200,
      }}
    >
      {KANBAN_COLS.map((col) => (
        <BoardColumn
          key={col}
          status={col}
          tasks={tasks.filter((t) => STATUS_TO_COL[t.status] === col)}
          onCardClick={onCardClick}
          onDrop={handleDrop}
          onAddClick={onAddClick}
        />
      ))}
    </div>
  );
}
