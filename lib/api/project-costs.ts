import apiClient from './client';
import type { PaginatedResponse } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CostCategory {
  id: number;
  tenant: number | null;
  name: string;
  code: string;
  cost_type: 'labor' | 'material' | 'equipment' | 'expense' | 'subcontractor' | 'fuel' | 'transport' | 'custom';
  cost_type_display: string;
  is_active: boolean;
  created_at: string;
}

export interface ProjectCost {
  id: number;
  tenant: number | null;
  project: number;
  project_code: string | null;
  cost_category: number | null;
  cost_category_name: string | null;
  cost_category_code: string | null;
  cost_date: string;
  amount: string;
  description: string;
  source_module: 'labor' | 'procurement' | 'subcontractors' | 'expenses' | 'manual';
  source_module_display: string;
  reference_id: string;
  reference_meta: Record<string, unknown>;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
}

export interface ProjectCostSummary {
  project: number;
  total_amount: number;
  by_category: Array<{ category_id: number | null; category_name: string; cost_type: string; total: number }>;
  by_source_module: Array<{ source_module: string; source_module_display: string; total: number }>;
  period?: { start_date: string | null; end_date: string | null };
}

export interface ProjectMember {
  id: number;
  tenant: number | null;
  project: number;
  employee: number;
  employee_name: string | null;
  employee_id_code: string | null;
  role: string;
  status: 'active' | 'inactive';
  status_display: string;
  is_primary: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMemberPayload {
  employee: number;
  role?: string;
  status?: 'active' | 'inactive';
  is_primary?: boolean;
  start_date?: string | null;
  end_date?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toPage<T>(data: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
  if (Array.isArray(data)) return { results: data, count: data.length, next: null, previous: null };
  return data as PaginatedResponse<T>;
}

// ── Cost Categories ───────────────────────────────────────────────────────────

export const costCategoriesApi = {
  getCostCategories: async (params?: { search?: string; cost_type?: string; is_active?: boolean }): Promise<CostCategory[]> => {
    const response = await apiClient.get('/cost-categories/', { params: { page_size: 200, ...params } });
    return toPage<CostCategory>(response.data).results;
  },

  createCostCategory: async (data: { name: string; code: string; cost_type: string; is_active?: boolean }): Promise<CostCategory> => {
    const response = await apiClient.post('/cost-categories/', data);
    return response.data;
  },

  updateCostCategory: async (id: number, data: Partial<{ name: string; code: string; cost_type: string; is_active: boolean }>): Promise<CostCategory> => {
    const response = await apiClient.patch(`/cost-categories/${id}/`, data);
    return response.data;
  },

  deleteCostCategory: async (id: number): Promise<void> => {
    await apiClient.delete(`/cost-categories/${id}/`);
  },
};

// ── Project Costs ─────────────────────────────────────────────────────────────

export const projectCostsApi = {
  getProjectCosts: async (projectId: number, params?: {
    page?: number;
    page_size?: number;
    start_date?: string;
    end_date?: string;
    category?: number;
  }): Promise<PaginatedResponse<ProjectCost>> => {
    const response = await apiClient.get(`/projects/${projectId}/costs/`, { params });
    return toPage(response.data);
  },

  getProjectCostSummary: async (projectId: number, params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<ProjectCostSummary> => {
    const response = await apiClient.get(`/projects/${projectId}/costs/cost-summary/`, { params });
    return response.data;
  },

  createProjectCost: async (projectId: number, data: {
    cost_category?: number | null;
    cost_date: string;
    amount: number | string;
    description?: string;
    source_module?: string;
    reference_id?: string;
  }): Promise<ProjectCost> => {
    const payload = { source_module: 'manual', ...data };
    const response = await apiClient.post(`/projects/${projectId}/costs/`, payload);
    return response.data;
  },
};

// ── Project Members ───────────────────────────────────────────────────────────

export const projectMembersApi = {
  getProjectMembers: async (projectId: number, params?: { status?: string }): Promise<ProjectMember[]> => {
    const response = await apiClient.get(`/projects/${projectId}/members/`, { params: { page_size: 200, ...params } });
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  addProjectMember: async (projectId: number, payload: ProjectMemberPayload): Promise<ProjectMember> => {
    const response = await apiClient.post(`/projects/${projectId}/members/`, payload);
    return response.data;
  },

  updateProjectMember: async (projectId: number, memberId: number, payload: Partial<ProjectMemberPayload>): Promise<ProjectMember> => {
    const response = await apiClient.patch(`/projects/${projectId}/members/${memberId}/`, payload);
    return response.data;
  },

  removeProjectMember: async (projectId: number, memberId: number): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/members/${memberId}/`);
  },
};
