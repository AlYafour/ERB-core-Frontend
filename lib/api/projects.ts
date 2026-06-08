import apiClient from './client';
import { Project, PaginatedResponse } from '@/types';

export const projectsApi = {
  getAll: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    code?: string;
    name?: string;
    location?: string;
    contact_person?: string;
    mobile_number?: string;
    sector?: string;
    plot?: string;
    consultant?: string;
    project_status?: string;
    is_active?: boolean;
    responsible_engineer?: number;
    created_at_after?: string;
    created_at_before?: string;
  }): Promise<PaginatedResponse<Project>> => {
    const response = await apiClient.get('/projects/', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Project> => {
    const response = await apiClient.get(`/projects/${id}/`);
    return response.data;
  },

  create: async (data: Partial<Project>): Promise<Project> => {
    const response = await apiClient.post('/projects/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Project>): Promise<Project> => {
    const response = await apiClient.patch(`/projects/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/projects/${id}/`);
  },

  importExcel: async (file: File): Promise<{ created: number; updated: number; skipped: number; errors: string[]; total_in_db: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/projects/import_excel/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

