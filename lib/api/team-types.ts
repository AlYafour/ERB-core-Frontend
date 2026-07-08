import apiClient from './client';
import type { PaginatedResponse } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TeamType {
  id: number;
  tenant: number | null;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toPage<T>(data: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
  if (Array.isArray(data)) return { results: data, count: data.length, next: null, previous: null };
  return data as PaginatedResponse<T>;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const teamTypesApi = {
  getTeamTypes: async (params?: { search?: string; is_active?: boolean }): Promise<PaginatedResponse<TeamType>> => {
    const response = await apiClient.get('/hr/employees/team-types/', { params: { page_size: 200, ...params } });
    return toPage(response.data);
  },

  createTeamType: async (data: { name: string; code: string; is_active?: boolean }): Promise<TeamType> => {
    const response = await apiClient.post('/hr/employees/team-types/', data);
    return response.data;
  },

  updateTeamType: async (id: number, data: Partial<{ name: string; code: string; is_active: boolean }>): Promise<TeamType> => {
    const response = await apiClient.patch(`/hr/employees/team-types/${id}/`, data);
    return response.data;
  },

  deleteTeamType: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/employees/team-types/${id}/`);
  },
};
