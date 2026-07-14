import apiClient from './client';
import { PaginatedResponse } from '@/types';

// ── Core notification ─────────────────────────────────────────────────────────

export interface Notification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  related_object_type: string | null;
  related_object_id: number | null;
  created_at: string;
  // Phase 9 additions
  category: 'general' | 'hr' | 'procurement' | 'tasks' | 'system';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channel: 'inapp' | 'email' | 'sms' | 'push';
  status: 'pending' | 'delivered' | 'failed';
  delivered_at: string | null;
  read_at: string | null;
  updated_at: string;
}

export interface NotificationFilters {
  page?: number;
  is_read?: boolean;
  category?: string;
  priority?: string;
  notification_type?: string;
}

// ── Preferences ───────────────────────────────────────────────────────────────

export interface NotificationPreference {
  id: number;
  inapp_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  quiet_hours_start: string | null;  // HH:MM:SS
  quiet_hours_end: string | null;
  quiet_hours_timezone: string;
  muted_types: string[];
  created_at: string;
  updated_at: string;
}

export type NotificationPreferenceUpdate = Partial<
  Omit<NotificationPreference, 'id' | 'created_at' | 'updated_at'>
>;

// ── Tenant channel config ─────────────────────────────────────────────────────

export interface TenantChannelConfig {
  id: number;
  email_enabled: boolean;
  email_from_name: string;
  email_from_address: string;
  sms_enabled: boolean;
  push_enabled: boolean;
  max_notifications_per_hour: number;
  created_at: string;
  updated_at: string;
}

// ── Template ──────────────────────────────────────────────────────────────────

export interface NotificationTemplate {
  id: number;
  ref: string;
  version: string;
  channel: 'inapp' | 'email' | 'sms' | 'push';
  locale: string;
  title_template: string;
  body_template: string;
  subject_template: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Delivery log ──────────────────────────────────────────────────────────────

export interface NotificationDeliveryLog {
  id: number;
  notification: number;
  channel: string;
  attempt_number: number;
  status: 'attempted' | 'delivered' | 'failed';
  provider_response: string;
  error: string;
  attempted_at: string;
  duration_ms: number | null;
}

// ── API client ────────────────────────────────────────────────────────────────

export const notificationsApi = {
  // Notification list / detail
  getAll: async (params?: NotificationFilters): Promise<PaginatedResponse<Notification>> => {
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

  // Preferences
  getPreferences: async (): Promise<NotificationPreference> => {
    const response = await apiClient.get('/notifications/preferences/');
    return response.data;
  },

  updatePreferences: async (data: NotificationPreferenceUpdate): Promise<NotificationPreference> => {
    const response = await apiClient.put('/notifications/preferences/', data);
    return response.data;
  },

  // Tenant channel config (admin only for write)
  getChannelConfig: async (): Promise<TenantChannelConfig> => {
    const response = await apiClient.get('/notifications/channel-config/');
    return response.data;
  },

  updateChannelConfig: async (data: Partial<TenantChannelConfig>): Promise<TenantChannelConfig> => {
    const response = await apiClient.put('/notifications/channel-config/', data);
    return response.data;
  },

  // Templates (admin write)
  getTemplates: async (): Promise<PaginatedResponse<NotificationTemplate>> => {
    const response = await apiClient.get('/notification-templates/');
    return response.data;
  },

  createTemplate: async (data: Omit<NotificationTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<NotificationTemplate> => {
    const response = await apiClient.post('/notification-templates/', data);
    return response.data;
  },

  updateTemplate: async (id: number, data: Partial<NotificationTemplate>): Promise<NotificationTemplate> => {
    const response = await apiClient.patch(`/notification-templates/${id}/`, data);
    return response.data;
  },

  deleteTemplate: async (id: number): Promise<void> => {
    await apiClient.delete(`/notification-templates/${id}/`);
  },

  // Delivery logs
  getDeliveryLogs: async (params?: { channel?: string; status?: string }): Promise<PaginatedResponse<NotificationDeliveryLog>> => {
    const response = await apiClient.get('/notification-delivery-logs/', { params });
    return response.data;
  },
};
