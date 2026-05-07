import apiClient from './client';
import { HREmployee, HRDepartment, HRPosition, HRAttendance, HRShift, HRRequest, HRLeaveBalance, HRPayroll, PaginatedResponse } from '@/types';

// ── Employees ──────────────────────────────────────────────────────────────────

export const hrEmployeesApi = {
  getAll: async (params?: { page?: number; search?: string; department?: number; position?: number; is_active?: boolean; employment_type?: string }): Promise<PaginatedResponse<HREmployee>> => {
    const response = await apiClient.get('/hr/employees/', { params });
    return response.data;
  },
  getById: async (id: number): Promise<HREmployee> => {
    const response = await apiClient.get(`/hr/employees/${id}/`);
    return response.data;
  },
  create: async (data: Partial<HREmployee>): Promise<HREmployee> => {
    const response = await apiClient.post('/hr/employees/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<HREmployee>): Promise<HREmployee> => {
    const response = await apiClient.patch(`/hr/employees/${id}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/employees/${id}/`);
  },
  getAttendanceSummary: async (id: number) => {
    const response = await apiClient.get(`/hr/employees/${id}/attendance-summary/`);
    return response.data;
  },
  activate: async (id: number) => {
    const response = await apiClient.post(`/hr/employees/${id}/activate/`);
    return response.data;
  },
  deactivate: async (id: number) => {
    const response = await apiClient.post(`/hr/employees/${id}/deactivate/`);
    return response.data;
  },
};

// ── Departments ────────────────────────────────────────────────────────────────

export const hrDepartmentsApi = {
  getAll: async (params?: { page?: number; search?: string }): Promise<PaginatedResponse<HRDepartment>> => {
    const response = await apiClient.get('/hr/employees/departments/', { params });
    return response.data;
  },
  create: async (data: Partial<HRDepartment>): Promise<HRDepartment> => {
    const response = await apiClient.post('/hr/employees/departments/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<HRDepartment>): Promise<HRDepartment> => {
    const response = await apiClient.patch(`/hr/employees/departments/${id}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/employees/departments/${id}/`);
  },
};

// ── Positions ──────────────────────────────────────────────────────────────────

export const hrPositionsApi = {
  getAll: async (params?: { page?: number; search?: string }): Promise<PaginatedResponse<HRPosition>> => {
    const response = await apiClient.get('/hr/employees/positions/', { params });
    return response.data;
  },
  create: async (data: Partial<HRPosition>): Promise<HRPosition> => {
    const response = await apiClient.post('/hr/employees/positions/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<HRPosition>): Promise<HRPosition> => {
    const response = await apiClient.patch(`/hr/employees/positions/${id}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/employees/positions/${id}/`);
  },
};

// ── Attendance ─────────────────────────────────────────────────────────────────

export const hrAttendanceApi = {
  getAll: async (params?: { page?: number; search?: string; employee?: number; status?: string; date?: string }): Promise<PaginatedResponse<HRAttendance>> => {
    const response = await apiClient.get('/hr/attendance/', { params });
    return response.data;
  },
  getById: async (id: number): Promise<HRAttendance> => {
    const response = await apiClient.get(`/hr/attendance/${id}/`);
    return response.data;
  },
  create: async (data: Partial<HRAttendance>): Promise<HRAttendance> => {
    const response = await apiClient.post('/hr/attendance/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<HRAttendance>): Promise<HRAttendance> => {
    const response = await apiClient.patch(`/hr/attendance/${id}/`, data);
    return response.data;
  },
  checkIn: async (data: { employee: number; latitude?: number; longitude?: number; address?: string }) => {
    const response = await apiClient.post('/hr/attendance/check-in/', data);
    return response.data;
  },
  checkOut: async (data: { employee: number; latitude?: number; longitude?: number }) => {
    const response = await apiClient.post('/hr/attendance/check-out/', data);
    return response.data;
  },
  getShifts: async (): Promise<PaginatedResponse<HRShift>> => {
    const response = await apiClient.get('/hr/attendance/shifts/');
    return response.data;
  },
};

// ── HR Requests ────────────────────────────────────────────────────────────────

export const hrRequestsApi = {
  getAll: async (params?: { page?: number; search?: string; employee?: number; status?: string; request_type?: string }): Promise<PaginatedResponse<HRRequest>> => {
    const response = await apiClient.get('/hr/requests/', { params });
    return response.data;
  },
  getById: async (id: number): Promise<HRRequest> => {
    const response = await apiClient.get(`/hr/requests/${id}/`);
    return response.data;
  },
  create: async (data: Partial<HRRequest>): Promise<HRRequest> => {
    const response = await apiClient.post('/hr/requests/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<HRRequest>): Promise<HRRequest> => {
    const response = await apiClient.patch(`/hr/requests/${id}/`, data);
    return response.data;
  },
  approve: async (id: number, notes?: string): Promise<HRRequest> => {
    const response = await apiClient.post(`/hr/requests/${id}/approve/`, { notes });
    return response.data;
  },
  reject: async (id: number, reject_reason: string): Promise<HRRequest> => {
    const response = await apiClient.post(`/hr/requests/${id}/reject/`, { reject_reason });
    return response.data;
  },
  getLeaveBalances: async (params?: { employee?: number; year?: number }): Promise<PaginatedResponse<HRLeaveBalance>> => {
    const response = await apiClient.get('/hr/requests/leave-balances/', { params });
    return response.data;
  },
};

// ── Payroll ────────────────────────────────────────────────────────────────────

export const hrPayrollApi = {
  getAll: async (params?: { page?: number; search?: string; employee?: number; month?: number; year?: number; status?: string }): Promise<PaginatedResponse<HRPayroll>> => {
    const response = await apiClient.get('/hr/payroll/', { params });
    return response.data;
  },
  getById: async (id: number): Promise<HRPayroll> => {
    const response = await apiClient.get(`/hr/payroll/${id}/`);
    return response.data;
  },
  create: async (data: Partial<HRPayroll>): Promise<HRPayroll> => {
    const response = await apiClient.post('/hr/payroll/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<HRPayroll>): Promise<HRPayroll> => {
    const response = await apiClient.patch(`/hr/payroll/${id}/`, data);
    return response.data;
  },
  markPaid: async (id: number, notes?: string): Promise<HRPayroll> => {
    const response = await apiClient.post(`/hr/payroll/${id}/mark-paid/`, { notes });
    return response.data;
  },
  getSummary: async (month: number, year: number) => {
    const response = await apiClient.get('/hr/payroll/summary/', { params: { month, year } });
    return response.data;
  },
};
