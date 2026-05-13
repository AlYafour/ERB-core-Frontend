'use client';

import { useQueryClient, useMutation } from '@tanstack/react-query';
import type { TaskListItem, TaskStatus } from '@/types';
import { tasksApi } from '@/lib/api/tasks';
import { KANBAN_COLS } from '../shared/constants';
import { BoardColumn } from './BoardColumn';

interface Props {
  tasks: TaskListItem[];
  onCardClick: (id: number) => void;
}

const TRANSITION_MAP: Partial<Record<TaskStatus, (id: number) => Promise<unknown>>> = {
  in_progress: (id) => tasksApi.start(id),
  review:      (id) => tasksApi.submit(id),
  approved:    (id) => tasksApi.approve(id),
  assigned:    (id) => tasksApi.reopen(id),
};

export function TaskBoard({ tasks, onCardClick }: Props) {
  const qc = useQueryClient();

  const move = useMutation({
    mutationFn: async ({ taskId, targetStatus }: { taskId: number; targetStatus: TaskStatus }) => {
      const fn = TRANSITION_MAP[targetStatus];
      if (!fn) throw new Error(`No transition to ${targetStatus}`);
      return fn(taskId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-stats'] });
    },
  });

  function handleDrop(taskId: number, targetStatus: TaskStatus) {
    move.mutate({ taskId, targetStatus });
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: '0 16px 20px',
        overflowX: 'auto',
        alignItems: 'flex-start',
        minHeight: 200,
      }}
    >
      {KANBAN_COLS.map((col) => (
        <BoardColumn
          key={col}
          status={col}
          tasks={tasks.filter((t) => t.status === col)}
          onCardClick={onCardClick}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
}
