'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskDetail } from '@/types';
import { tasksApi, subTasksApi, taskCommentsApi, taskAttachmentsApi } from '@/lib/api/tasks';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';

export function useTaskDetail(taskId: number) {
  const qc = useQueryClient();

  const { data: task, isLoading } = useQuery<TaskDetail>({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.getById(taskId),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['task', taskId] });
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['task-stats'] });
  }

  const transition = useMutation({
    mutationFn: (fn: () => Promise<TaskDetail>) => fn(),
    onSuccess: invalidate,
    onError: (err: unknown) => toast(getApiError(err, 'Action failed'), 'error'),
  });

  const updateMeta = useMutation({
    mutationFn: (data: Partial<TaskDetail>) => tasksApi.update(taskId, data),
    onSuccess: invalidate,
    onError: (err: unknown) => toast(getApiError(err, 'Failed to update'), 'error'),
  });

  const addComment = useMutation({
    mutationFn: (content: string) => taskCommentsApi.create({ task: taskId, content }),
    onSuccess: invalidate,
    onError: (err: unknown) => toast(getApiError(err, 'Failed to add comment'), 'error'),
  });

  const updateComment = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      taskCommentsApi.update(id, content),
    onSuccess: invalidate,
    onError: (err: unknown) => toast(getApiError(err, 'Failed to update comment'), 'error'),
  });

  const deleteComment = useMutation({
    mutationFn: (id: number) => taskCommentsApi.delete(id),
    onSuccess: invalidate,
    onError: (err: unknown) => toast(getApiError(err, 'Failed to delete comment'), 'error'),
  });

  const addSubtask = useMutation({
    mutationFn: (title: string) => subTasksApi.create({ task: taskId, title }),
    onSuccess: invalidate,
    onError: (err: unknown) => toast(getApiError(err, 'Failed to add item'), 'error'),
  });

  const toggleSubtask = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      done ? subTasksApi.complete(id) : subTasksApi.reopen(id),
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: ['task', taskId] });
      const prev = qc.getQueryData<TaskDetail>(['task', taskId]);
      qc.setQueryData<TaskDetail>(['task', taskId], (old) =>
        old
          ? { ...old, subtasks: old.subtasks.map((s) => s.id === id ? { ...s, is_completed: done } : s) }
          : old
      );
      return { prev };
    },
    onError: (err: unknown, _, ctx) => {
      if (ctx?.prev) qc.setQueryData(['task', taskId], ctx.prev);
      toast(getApiError(err, 'Failed to update item'), 'error');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['task', taskId] }),
  });

  const uploadFile = useMutation({
    mutationFn: (file: File) => taskAttachmentsApi.upload(taskId, file),
    onSuccess: invalidate,
    onError: (err: unknown) => toast(getApiError(err, 'Failed to upload file'), 'error'),
  });

  const deleteAttachment = useMutation({
    mutationFn: (id: number) => taskAttachmentsApi.delete(id),
    onSuccess: invalidate,
    onError: (err: unknown) => toast(getApiError(err, 'Failed to delete attachment'), 'error'),
  });

  return {
    task,
    isLoading,
    doTransition:     (fn: () => Promise<TaskDetail>) => transition.mutate(fn),
    updateStatus:     (s: TaskDetail['status'])   => updateMeta.mutate({ status: s } as Partial<TaskDetail>),
    updatePriority:   (p: TaskDetail['priority']) => updateMeta.mutate({ priority: p }),
    sendComment:      (content: string)           => addComment.mutate(content),
    editComment:      (id: number, content: string) => updateComment.mutate({ id, content }),
    removeComment:    (id: number)                => deleteComment.mutate(id),
    addSubtask:       (title: string)             => addSubtask.mutate(title),
    toggleSubtask:    (id: number, done: boolean) => toggleSubtask.mutate({ id, done }),
    uploadFile:       (file: File)                => uploadFile.mutate(file),
    removeAttachment: (id: number)                => deleteAttachment.mutate(id),
    busy:           transition.isPending,
    changingMeta:   updateMeta.isPending,
    sendingComment: addComment.isPending,
    savingEdit:     updateComment.isPending,
    uploadingFile:  uploadFile.isPending,
  };
}
