import { useQuery } from '@tanstack/react-query';
import { tasksApi, myTasksApi } from '@/lib/api/tasks';
import { useAuthStore } from '@/lib/store/auth-store';

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
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: stats } = useQuery({
    queryKey: ['task-stats'],
    queryFn: () => tasksApi.stats(),
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchInterval: isAuthenticated ? 60_000 : false,
  });

  const { data: myTodo = 0 } = useQuery<number>({
    queryKey: ['my-tasks-count'],
    queryFn: () => myTasksApi.getAll().then((r) => (Array.isArray(r) ? r : []).filter((t) => !t.is_done).length),
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchInterval: isAuthenticated ? 60_000 : false,
  });

  if (!stats) return ZERO;

  const myTasks      = stats.my_tasks ?? 0;
  const overdue       = stats.overdue ?? 0;
  const pendingReview = stats.pending_review ?? 0;

  // Total = tasks needing user action
  const total = myTasks + overdue + pendingReview;

  return { myTasks, overdue, pendingReview, myTodo, total };
}
