import apiClient from './client';
import { MunicipalViolation, PaginatedResponse } from '@/types';

export interface ViolationStats {
  total: number;
  new: number;
  notified: number;
  resolved: number;
  fined: number;
  no_project: number;
}

export const violationsApi = {
  getAll: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    status?: string;
    project?: number;
    notified_engineer?: number;
  }): Promise<PaginatedResponse<MunicipalViolation>> => {
    const response = await apiClient.get('/violations/', { params });
    return response.data;
  },

  getStats: async (): Promise<ViolationStats> => {
    const response = await apiClient.get('/violations/stats/');
    return response.data;
  },

  getById: async (id: number): Promise<MunicipalViolation> => {
    const response = await apiClient.get(`/violations/${id}/`);
    return response.data;
  },

  markResolved: async (id: number): Promise<void> => {
    await apiClient.post(`/violations/${id}/mark_resolved/`);
  },

  bulkAction: async (ids: number[], action: 'resolve' | 'delete'): Promise<{ updated?: number; deleted?: number }> => {
    const response = await apiClient.post('/violations/bulk_action/', { ids, action });
    return response.data;
  },

  deleteAll: async (): Promise<{ deleted: number }> => {
    const response = await apiClient.post('/violations/bulk_action/', { ids: [], action: 'delete_all' });
    return response.data;
  },

  getByToken: async (token: string): Promise<{
    id: number; reference_number: string; sector: string; plot: string; area: string;
    violation_description: string; deadline_days: number | null; fine_amount: string | null;
    received_at: string; status: string; project_name: string | null; engineer_name: string | null;
    resolved_at: string | null;
  }> => {
    const response = await apiClient.get(`/violations/resolve/${token}/`);
    return response.data;
  },

  resolveByToken: async (token: string, action: 'received' | 'resolved'): Promise<{ status: string }> => {
    const response = await apiClient.post(`/violations/resolve/${token}/`, { action });
    return response.data;
  },

  linkProject: async (id: number, projectId: number | null, engineerId?: number | null): Promise<{
    status: string; project_name?: string; engineer_name?: string | null;
  }> => {
    const response = await apiClient.post(`/violations/${id}/link_project/`, {
      project_id: projectId,
      engineer_id: engineerId ?? null,
    });
    return response.data;
  },

  simulate: async (message: string): Promise<{
    status: 'ok' | 'ignored';
    reason?: string;
    violation_id?: number;
    project?: string | null;
    engineer?: string | null;
    reference?: string;
    parsed?: { sector?: string; plot?: string; deadline_days?: number | null; fine_amount?: string | null };
  }> => {
    const response = await apiClient.post('/violations/simulate/', { message });
    return response.data;
  },
};
