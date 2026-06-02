import apiClient from './client';
import type {
  Team, TeamMember, TaskListItem, TaskDetail, SubTask,
  TaskComment, TaskAttachmentItem, TaskActivity, TaskStats, MyTask,
} from '@/types';

// ── Teams ─────────────────────────────────────────────────────────────────────

export const teamsApi = {
  getAll: () =>
    apiClient.get<{ results?: Team[] } | Team[]>('/tasks/teams/').then(r => {
      const d = r.data as any;
      return (Array.isArray(d) ? d : (d?.results ?? [])) as Team[];
    }),
  getById: (id: number) => apiClient.get<Team>(`/tasks/teams/${id}/`).then(r => r.data),
  create: (data: { name: string; description?: string }) =>
    apiClient.post<Team>('/tasks/teams/', data).then(r => r.data),
  update: (id: number, data: Partial<{ name: string; description: string }>) =>
    apiClient.patch<Team>(`/tasks/teams/${id}/`, data).then(r => r.data),
  delete: (id: number) => apiClient.delete(`/tasks/teams/${id}/`),
  addMember: (id: number, user_id: number, role: string = 'member') =>
    apiClient.post<TeamMember>(`/tasks/teams/${id}/add_member/`, { user_id, role }).then(r => r.data),
  removeMember: (id: number, user_id: number) =>
    apiClient.post(`/tasks/teams/${id}/remove_member/`, { user_id }).then(r => r.data),
  updateMemberRole: (id: number, user_id: number, role: string) =>
    apiClient.post(`/tasks/teams/${id}/add_member/`, { user_id, role }).then(r => r.data),
};

// ── Tasks ─────────────────────────────────────────────────────────────────────

export interface TaskFilters {
  scope?: 'mine' | 'created' | 'team' | 'watching';
  status?: string;
  priority?: string;
  task_type?: string;
  assigned_to?: number;
  assigned_team?: number;
  project?: number;
  department?: number;
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export interface PaginatedTasks {
  count: number;
  next: string | null;
  previous: string | null;
  results: TaskListItem[];
}

export const tasksApi = {
  getAll: (params?: TaskFilters) =>
    apiClient.get<PaginatedTasks | TaskListItem[]>('/tasks/tasks/', { params }).then(r => r.data),
  getById: (id: number) => apiClient.get<TaskDetail>(`/tasks/tasks/${id}/`).then(r => r.data),
  create: (data: Partial<TaskDetail>) =>
    apiClient.post<TaskDetail>('/tasks/tasks/', data).then(r => r.data),
  update: (id: number, data: Partial<TaskDetail>) =>
    apiClient.patch<TaskDetail>(`/tasks/tasks/${id}/`, data).then(r => r.data),
  delete: (id: number) => apiClient.delete(`/tasks/tasks/${id}/`),
  stats: () => apiClient.get<TaskStats>('/tasks/tasks/stats/').then(r => r.data),

  // Status transitions
  accept: (id: number) =>
    apiClient.post<TaskDetail>(`/tasks/tasks/${id}/accept/`).then(r => r.data),
  start: (id: number) =>
    apiClient.post<TaskDetail>(`/tasks/tasks/${id}/start/`).then(r => r.data),
  submit: (id: number, note?: string) =>
    apiClient.post<TaskDetail>(`/tasks/tasks/${id}/submit/`, { note }).then(r => r.data),
  approve: (id: number, note?: string) =>
    apiClient.post<TaskDetail>(`/tasks/tasks/${id}/approve/`, { note }).then(r => r.data),
  reject: (id: number, reason: string) =>
    apiClient.post<TaskDetail>(`/tasks/tasks/${id}/reject/`, { reason }).then(r => r.data),
  reopen: (id: number) =>
    apiClient.post<TaskDetail>(`/tasks/tasks/${id}/reopen/`).then(r => r.data),
  close: (id: number) =>
    apiClient.post<TaskDetail>(`/tasks/tasks/${id}/close/`).then(r => r.data),
  watch: (id: number) =>
    apiClient.post(`/tasks/tasks/${id}/watch/`).then(r => r.data),
  unwatch: (id: number) =>
    apiClient.post(`/tasks/tasks/${id}/unwatch/`).then(r => r.data),
};

// ── SubTasks ──────────────────────────────────────────────────────────────────

export const subTasksApi = {
  create: (data: { task: number; title: string; order?: number }) =>
    apiClient.post<SubTask>('/tasks/subtasks/', data).then(r => r.data),
  update: (id: number, data: Partial<SubTask>) =>
    apiClient.patch<SubTask>(`/tasks/subtasks/${id}/`, data).then(r => r.data),
  delete: (id: number) => apiClient.delete(`/tasks/subtasks/${id}/`),
  complete: (id: number) =>
    apiClient.post<SubTask>(`/tasks/subtasks/${id}/complete/`).then(r => r.data),
  reopen: (id: number) =>
    apiClient.post<SubTask>(`/tasks/subtasks/${id}/reopen/`).then(r => r.data),
};

// ── Comments ──────────────────────────────────────────────────────────────────

export const taskCommentsApi = {
  getByTask: (taskId: number) =>
    apiClient.get<TaskComment[]>('/tasks/comments/', { params: { task: taskId } }).then(r => r.data),
  create: (data: { task: number; content: string }) =>
    apiClient.post<TaskComment>('/tasks/comments/', data).then(r => r.data),
  update: (id: number, content: string) =>
    apiClient.patch<TaskComment>(`/tasks/comments/${id}/`, { content }).then(r => r.data),
  delete: (id: number) => apiClient.delete(`/tasks/comments/${id}/`),
};

// ── Attachments ───────────────────────────────────────────────────────────────

export const taskAttachmentsApi = {
  upload: (taskId: number, file: File, commentId?: number) => {
    const form = new FormData();
    form.append('task', String(taskId));
    form.append('file', file);
    if (commentId) form.append('comment', String(commentId));
    return apiClient.post<TaskAttachmentItem>('/tasks/attachments/', form).then(r => r.data);
  },
  delete: (id: number) => apiClient.delete(`/tasks/attachments/${id}/`),
};

// ── Activities ────────────────────────────────────────────────────────────────

export const taskActivitiesApi = {
  getByTask: (taskId: number) =>
    apiClient.get<TaskActivity[]>('/tasks/activities/', { params: { task: taskId } }).then(r => r.data),
};

// ── My Tasks (personal to-do) ─────────────────────────────────────────────────

export const myTasksApi = {
  getAll: () =>
    apiClient.get<{ results?: MyTask[] } | MyTask[]>('/tasks/my-tasks/').then(r => {
      const d = r.data as any;
      return (Array.isArray(d) ? d : (d?.results ?? [])) as MyTask[];
    }),
  create: (data: { title: string; note?: string; priority?: string; due_date?: string }) =>
    apiClient.post<MyTask>('/tasks/my-tasks/', data).then(r => r.data),
  update: (id: number, data: Partial<MyTask>) =>
    apiClient.patch<MyTask>(`/tasks/my-tasks/${id}/`, data).then(r => r.data),
  delete: (id: number) => apiClient.delete(`/tasks/my-tasks/${id}/`),
  toggle: (id: number) =>
    apiClient.post<MyTask>(`/tasks/my-tasks/${id}/toggle/`).then(r => r.data),
};
