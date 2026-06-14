import apiClient from './client';
import { HREmployee, HRDepartment, HRPosition, HRLocation, HRLocationType, HRAttendance, HRShift, HRRequest, HRLeaveBalance, HRPayroll, OfficeLocation, PaginatedResponse } from '@/types';

export interface WhosOffEntry {
  employee_name: string;
  employee_id:   string;
  leave_type:    string;
  start_date:    string;
  end_date:      string;
}

export interface UpcomingBirthday {
  employee_id:   string;
  full_name:     string;
  date_of_birth: string;
  days_until:    number;
  birthday_date: string;
}

// ── Location Types ─────────────────────────────────────────────────────────────

export const hrLocationTypesApi = {
  getAll: async (): Promise<PaginatedResponse<HRLocationType>> => {
    const response = await apiClient.get('/hr/employees/location-types/', { params: { page_size: 100 } });
    return response.data;
  },
  create: async (data: Partial<HRLocationType>): Promise<HRLocationType> => {
    const response = await apiClient.post('/hr/employees/location-types/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<HRLocationType>): Promise<HRLocationType> => {
    const response = await apiClient.patch(`/hr/employees/location-types/${id}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/employees/location-types/${id}/`);
  },
};

// ── Locations ──────────────────────────────────────────────────────────────────

export const hrLocationsApi = {
  getAll: async (params?: { page?: number; search?: string; location_type?: string; parent?: number | null; is_active?: boolean }): Promise<PaginatedResponse<HRLocation>> => {
    const response = await apiClient.get('/hr/employees/locations/', { params });
    return response.data;
  },
  getById: async (id: number): Promise<HRLocation> => {
    const response = await apiClient.get(`/hr/employees/locations/${id}/`);
    return response.data;
  },
  create: async (data: Partial<HRLocation>): Promise<HRLocation> => {
    const response = await apiClient.post('/hr/employees/locations/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<HRLocation>): Promise<HRLocation> => {
    const response = await apiClient.patch(`/hr/employees/locations/${id}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/employees/locations/${id}/`);
  },
};

// ── Employees ──────────────────────────────────────────────────────────────────

export const hrEmployeesApi = {
  getAll: async (params?: { page?: number; search?: string; department?: number; position?: number; is_active?: boolean; employment_type?: string; user?: number }): Promise<PaginatedResponse<HREmployee>> => {
    const response = await apiClient.get('/hr/employees/', { params });
    const data = response.data;
    // EmployeeViewSet sets pagination_class=None → returns a bare array instead of {results,[]}
    if (Array.isArray(data)) {
      return { results: data, count: data.length, next: null, previous: null };
    }
    return data;
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
  updateEmergencyContact: async (empId: number, data: { name: string; relationship: string; phone: string }) => {
    const response = await apiClient.patch(`/hr/employees/${empId}/emergency-contact/`, data);
    return response.data;
  },
  getUpcomingBirthdays: async (days = 30): Promise<UpcomingBirthday[]> => {
    const response = await apiClient.get('/hr/employees/upcoming-birthdays/', { params: { days } });
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
  getWhosOffToday: async (): Promise<WhosOffEntry[]> => {
    const response = await apiClient.get('/hr/requests/whos-off-today/');
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

// ── Office Locations (Geofence check-in points) ────────────────────────────────

export const hrOfficeLocationsApi = {
  getAll: async (params?: { search?: string; is_active?: boolean }): Promise<PaginatedResponse<OfficeLocation>> => {
    const response = await apiClient.get('/hr/office-locations/', { params: { page_size: 200, ...params } });
    return response.data;
  },
  create: async (data: Partial<OfficeLocation>): Promise<OfficeLocation> => {
    const response = await apiClient.post('/hr/office-locations/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<OfficeLocation>): Promise<OfficeLocation> => {
    const response = await apiClient.patch(`/hr/office-locations/${id}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/office-locations/${id}/`);
  },
};

// ── Employee ↔ OfficeLocation assignments (GPS check-in) ──────────────────────
// Nested under /hr/attendance/employees/{employeePk}/locations/

export interface EmployeeLocationAssignment {
  id: number;
  office_location: number;
  office_location_name: string;
  office_location_latitude: number;
  office_location_longitude: number;
  office_location_radius_m: number;
  assigned_by: number | null;
  assigned_by_name: string | null;
  assigned_at: string;
}

export const hrEmployeeLocationsApi = {
  getAll: async (employeePk: number): Promise<EmployeeLocationAssignment[]> => {
    const response = await apiClient.get(`/hr/attendance/employees/${employeePk}/locations/`);
    // Handle both paginated { results: [...] } and plain array responses
    return Array.isArray(response.data) ? response.data : (response.data.results ?? []);
  },
  assign: async (employeePk: number, officeLocationId: number): Promise<EmployeeLocationAssignment> => {
    const response = await apiClient.post(`/hr/attendance/employees/${employeePk}/locations/`, {
      office_location: officeLocationId,
    });
    return response.data;
  },
  remove: async (employeePk: number, assignmentId: number): Promise<void> => {
    await apiClient.delete(`/hr/attendance/employees/${employeePk}/locations/${assignmentId}/`);
  },
};

// ── Self Check-in / Check-out (employee self-service) ──────────────────────────

export interface AttendanceRecord {
  id: number;
  employee: number;
  employee_name: string;
  employee_id_code: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_in_address: string;
  matched_location: number | null;
  matched_location_name: string | null;
  is_out_of_range: boolean;
  status: string;
  work_hours: number | null;
  duration_hours: number | null;
  notes: string;
}

export interface EmployeeAssignmentFlat {
  id: number;
  employee_pk: number;
  employee_name: string;
  employee_id_code: string;
  office_location: number;
  office_location_name: string;
  assigned_at: string;
}

export const hrAllAssignmentsApi = {
  getAll: async (): Promise<EmployeeAssignmentFlat[]> => {
    const response = await apiClient.get('/hr/attendance/assignments/');
    return response.data;
  },
};

// ── Shift Assignments ──────────────────────────────────────────────────────────

export interface ShiftAssignment {
  id: number;
  employee: number;
  employee_name: string;
  shift: number;
  shift_name: string;
  start_date: string;
  end_date: string | null;
}

export const hrShiftAssignmentsApi = {
  getAll: async (params?: { employee?: number; shift?: number }): Promise<PaginatedResponse<ShiftAssignment>> => {
    const response = await apiClient.get('/hr/attendance/shift-assignments/', { params });
    return response.data;
  },
};

export const hrSelfAttendanceApi = {
  getToday: async (employeeId: number): Promise<AttendanceRecord | null> => {
    const today = new Date().toISOString().slice(0, 10);
    const response = await apiClient.get('/hr/attendance/', {
      params: { date: today, employee: employeeId, page_size: 1 },
    });
    const results: AttendanceRecord[] = response.data?.results ?? [];
    return results[0] ?? null;
  },
  checkIn: async (data: { latitude: number; longitude: number; address?: string }): Promise<AttendanceRecord> => {
    const response = await apiClient.post('/hr/attendance/self-check-in/', data);
    return response.data;
  },
  checkOut: async (data?: { latitude?: number; longitude?: number }): Promise<AttendanceRecord> => {
    const response = await apiClient.post('/hr/attendance/self-check-out/', data ?? {});
    return response.data;
  },
};
