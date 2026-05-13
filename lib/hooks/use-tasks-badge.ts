import { useQuery } from '@tanstack/react-query';
import { tasksApi, myTasksApi } from '@/lib/api/tasks';

export interface TasksBadge {
  myTasks: number;
  overdue: number;
  pendingReview: number;
  myTodo: number;
  /** Sum of actionable items shown in sidebar */
  total: number;
}

const ZERO: TasksBadge = {
  myTasks: 0,
  overdue: 0,
  pendingReview: 0,
  myTodo: 0,
  total: 0,
};

export function useTasksBadge(): TasksBadge {
  const { data: stats } = useQuery({
    queryKey: ['task-stats'],
    queryFn: () => tasksApi.stats(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: myTodo = 0 } = useQuery<number>({
    queryKey: ['my-tasks-count'],
    queryFn: () => myTasksApi.getAll().then((r) => r.filter((t) => !t.is_done).length),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (!stats) return ZERO;

  const myTasks      = stats.my_tasks ?? 0;
  const overdue       = stats.overdue ?? 0;
  const pendingReview = stats.pending_review ?? 0;

  // Total = tasks needing user action
  const total = myTasks + overdue + pendingReview;

  return { myTasks, overdue, pendingReview, myTodo, total };
}
