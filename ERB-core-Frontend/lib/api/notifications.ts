import apiClient from './client';
import { PaginatedResponse } from '@/types';

export interface Notification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  related_object_type: string | null;
  related_object_id: number | null;
  created_at: string;
}

export const notificationsApi = {
  getAll: async (params?: {
    page?: number;
    is_read?: boolean;
  }): Promise<PaginatedResponse<Notification>> => {
    const response = await apiClient.get('/notifications/', { params });
    return response.data;
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    const response = await apiClient.get('/notifications/unread_count/');
    return response.data;
  },

  markAsRead: async (id: number): Promise<void> => {
    await apiClient.patch(`/notifications/${id}/mark_read/`);
  },

  markAllAsRead: async (): Promise<void> => {
    await apiClient.post('/notifications/mark_all_read/');
  },

  clearAll: async (): Promise<void> => {
    await apiClient.delete('/notifications/clear_all/');
  },
};

