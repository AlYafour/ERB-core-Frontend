import apiClient from './client';
import { WorkLog, PaginatedResponse } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkLogType {
  id: number;
  tenant: number | null;
  attendance: number | null;
  employee: number;
  employee_name: string | null;
  employee_id_code: string | null;
  project: number | null;
  project_code: string | null;
  project_name: string | null;
  work_team: number | null;
  work_team_name: string | null;
  location: number | null;
  location_name: string | null;
  date: string;
  hours: string;
  overtime_hours: string;
  cost_rate_snapshot: Record<string, unknown>;
  cost_amount: string;
  is_auto: boolean;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  status_display: string;
  notes: string;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkLogCreatePayload {
  employee: number;
  attendance?: number | null;
  project?: number | null;
  work_team?: number | null;
  location?: number | null;
  date: string;
  hours: number | string;
  overtime_hours?: number | string;
  notes?: string;
}

// ── Legacy payload alias (backwards compat) ───────────────────────────────────

export interface CreateWorkLogPayload extends WorkLogCreatePayload {
  attendance: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toPage<T>(data: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
  if (Array.isArray(data)) return { results: data, count: data.length, next: null, previous: null };
  return data as PaginatedResponse<T>;
}

// ── Stand-alone functions (existing exports preserved) ────────────────────────

export const getAttendanceWorklogs = async (attendanceId: number): Promise<WorkLog[]> => {
  const response = await apiClient.get(`/hr/attendance/${attendanceId}/worklogs/`);
  const data = response.data;
  return Array.isArray(data) ? data : (data.results ?? []);
};

export const createWorklog = async (payload: CreateWorkLogPayload): Promise<WorkLog> => {
  const response = await apiClient.post('/hr/attendance/worklogs/', payload);
  return response.data;
};

export const submitWorklog = async (id: number): Promise<WorkLog> => {
  const response = await apiClient.post(`/hr/attendance/worklogs/${id}/submit/`);
  return response.data;
};

export const approveWorklog = async (id: number): Promise<WorkLog> => {
  const response = await apiClient.post(`/hr/attendance/worklogs/${id}/approve/`);
  return response.data;
};

export const rejectWorklog = async (id: number, reason: string): Promise<WorkLog> => {
  const response = await apiClient.post(`/hr/attendance/worklogs/${id}/reject/`, { reason });
  return response.data;
};

// ── Grouped API object ────────────────────────────────────────────────────────

export const worklogsApi = {
  // List / CRUD
  getWorklogs: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    employee_id?: number;
    project_id?: number;
    work_team_id?: number;
    status?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<PaginatedResponse<WorkLog>> => {
    const response = await apiClient.get('/hr/attendance/worklogs/', { params });
    return toPage(response.data);
  },

  getById: async (id: number): Promise<WorkLog> => {
    const response = await apiClient.get(`/hr/attendance/worklogs/${id}/`);
    return response.data;
  },

  createWorklog: async (data: WorkLogCreatePayload): Promise<WorkLog> => {
    const response = await apiClient.post('/hr/attendance/worklogs/', data);
    return response.data;
  },

  updateWorklog: async (id: number, data: Partial<WorkLogCreatePayload>): Promise<WorkLog> => {
    const response = await apiClient.patch(`/hr/attendance/worklogs/${id}/`, data);
    return response.data;
  },

  deleteWorklog: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/attendance/worklogs/${id}/`);
  },

  // Workflow actions
  submitWorklog,
  approveWorklog,
  rejectWorklog,

  // Nested endpoint
  getAttendanceWorklogs,
};
