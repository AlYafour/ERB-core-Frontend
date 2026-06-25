import apiClient from './client';
import { HREmployee, HRDepartment, HRPosition, HRTenantRole, HRLocation, HRLocationType, HRAttendance, HRShift, HRRequest, HRLeaveBalance, HRPayroll, OfficeLocation, PaginatedResponse, EmployeeGroup, ApprovalPolicy, ApprovalStep, PenaltyRule, PenaltyTier, EmployeeLoan, LeavePolicy, LeaveEncashment } from '@/types';

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

export interface EmployeeMinimal {
  id: number;
  employee_id: string;
  full_name: string;
  user_id: number;
}

export interface EmployeeDocument {
  id: number;
  employee: number;
  title: string;
  document_type: string;
  file: string | null;
  file_url: string | null;
  expiry_date: string | null;
  notes: string;
  is_expired: boolean;
  expires_soon: boolean;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
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
  getDocuments: async (empId: number): Promise<EmployeeDocument[]> => {
    const response = await apiClient.get(`/hr/employees/${empId}/documents/`);
    return response.data;
  },
  uploadDocument: async (empId: number, data: FormData): Promise<EmployeeDocument> => {
    const response = await apiClient.post(`/hr/employees/${empId}/documents/`, data);
    return response.data;
  },
  deleteDocument: async (empId: number, docId: number): Promise<void> => {
    await apiClient.delete(`/hr/employees/${empId}/documents/${docId}/`);
  },
  getUpcomingBirthdays: async (days = 30): Promise<UpcomingBirthday[]> => {
    const response = await apiClient.get('/hr/employees/upcoming-birthdays/', { params: { days } });
    return response.data;
  },
  getMinimal: async (search?: string): Promise<EmployeeMinimal[]> => {
    const response = await apiClient.get('/hr/employees/minimal/', { params: search ? { search } : undefined });
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

// ── Tenant Roles ───────────────────────────────────────────────────────────────

export const hrRolesApi = {
  getAll: async (params?: { page?: number; search?: string; is_active?: boolean }): Promise<PaginatedResponse<HRTenantRole>> => {
    const response = await apiClient.get('/hr/employees/roles/', { params: { page_size: 100, ...params } });
    return response.data;
  },
  create: async (data: Partial<HRTenantRole>): Promise<HRTenantRole> => {
    const response = await apiClient.post('/hr/employees/roles/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<HRTenantRole>): Promise<HRTenantRole> => {
    const response = await apiClient.patch(`/hr/employees/roles/${id}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/employees/roles/${id}/`);
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
  cancel: async (id: number): Promise<void> => {
    await apiClient.post(`/hr/requests/${id}/cancel/`);
  },
  getPendingMyApproval: async (): Promise<HRRequest[]> => {
    const response = await apiClient.get('/hr/requests/pending-my-approval/');
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },
};

// ── Approvals (request types) ──────────────────────────────────────────────────

export interface HRRequestType {
  id:          number;
  code:        string;
  name:        string;
  name_ar:     string;
  description: string;
  is_active:   boolean;
}

export const hrApprovalsApi = {
  getRequestTypes: async (): Promise<HRRequestType[]> => {
    const response = await apiClient.get('/hr/approvals/request-types/');
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  // ── Policies ────────────────────────────────────────────────────────────────
  getPolicies: async (): Promise<ApprovalPolicy[]> => {
    const response = await apiClient.get('/hr/approvals/policies/', { params: { page_size: 200 } });
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },
  createPolicy: async (data: Partial<ApprovalPolicy>): Promise<ApprovalPolicy> => {
    const response = await apiClient.post('/hr/approvals/policies/', data);
    return response.data;
  },
  updatePolicy: async (id: number, data: Partial<ApprovalPolicy>): Promise<ApprovalPolicy> => {
    const response = await apiClient.patch(`/hr/approvals/policies/${id}/`, data);
    return response.data;
  },
  deletePolicy: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/approvals/policies/${id}/`);
  },

  // ── Steps ───────────────────────────────────────────────────────────────────
  getSteps: async (policyId: number): Promise<ApprovalStep[]> => {
    const response = await apiClient.get('/hr/approvals/steps/', { params: { policy: policyId, page_size: 50 } });
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },
  createStep: async (data: Partial<ApprovalStep>): Promise<ApprovalStep> => {
    const response = await apiClient.post('/hr/approvals/steps/', data);
    return response.data;
  },
  updateStep: async (id: number, data: Partial<ApprovalStep>): Promise<ApprovalStep> => {
    const response = await apiClient.patch(`/hr/approvals/steps/${id}/`, data);
    return response.data;
  },
  deleteStep: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/approvals/steps/${id}/`);
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
  autoCalculate: async (data: { employee_id: number; month: number; year: number; working_days?: number }): Promise<HRPayroll> => {
    const response = await apiClient.post('/hr/payroll/auto-calculate/', data);
    return response.data;
  },
  wpsExport: async (month: number, year: number): Promise<Blob> => {
    const response = await apiClient.get('/hr/payroll/wps-export/', {
      params: { month, year },
      responseType: 'blob',
    });
    return response.data;
  },
  salaryCertificateUrl: (id: number): string => {
    const base = (apiClient.defaults.baseURL ?? '').replace(/\/$/, '');
    return `${base}/hr/payroll/${id}/salary-certificate/`;
  },
};

// ── Penalty Applications (preview for payroll generation) ─────────────────────

export interface PenaltyApplicationPreview {
  id: number;
  attendance_date: string;
  penalty_amount: string;
  status: string;
  rule_name: string | null;
  tier_label: string | null;
  rule_type: string;
  minutes_evaluated: number;
  was_compensated: boolean;
}

export const hrPenaltyApplicationsApi = {
  getAll: async (params?: { employee?: number; year?: number; month?: number; status?: string; page?: number }): Promise<PaginatedResponse<PenaltyApplicationPreview>> => {
    const response = await apiClient.get('/hr/attendance/penalty-applications/', { params });
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
  break_start: string | null;
  break_end: string | null;
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

// ── Shifts CRUD ───────────────────────────────────────────────────────────────

export const hrShiftsApi = {
  getAll: async (): Promise<PaginatedResponse<HRShift>> => {
    const response = await apiClient.get('/hr/attendance/shifts/', { params: { page_size: 200 } });
    const data = response.data;
    if (Array.isArray(data)) return { results: data, count: data.length, next: null, previous: null };
    return data;
  },
  create: async (data: Partial<HRShift>): Promise<HRShift> => {
    const response = await apiClient.post('/hr/attendance/shifts/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<HRShift>): Promise<HRShift> => {
    const response = await apiClient.patch(`/hr/attendance/shifts/${id}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/attendance/shifts/${id}/`);
  },
};

// ── Employee Groups ────────────────────────────────────────────────────────────

export const hrEmployeeGroupsApi = {
  getAll: async (): Promise<PaginatedResponse<EmployeeGroup>> => {
    const response = await apiClient.get('/hr/employees/groups/', { params: { page_size: 200 } });
    const data = response.data;
    if (Array.isArray(data)) return { results: data, count: data.length, next: null, previous: null };
    return data;
  },
  create: async (data: Partial<EmployeeGroup>): Promise<EmployeeGroup> => {
    const response = await apiClient.post('/hr/employees/groups/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<EmployeeGroup>): Promise<EmployeeGroup> => {
    const response = await apiClient.patch(`/hr/employees/groups/${id}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/employees/groups/${id}/`);
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
  breakOut: async (): Promise<AttendanceRecord> => {
    const response = await apiClient.post('/hr/attendance/self-break-out/', {});
    return response.data;
  },
  breakIn: async (): Promise<AttendanceRecord> => {
    const response = await apiClient.post('/hr/attendance/self-break-in/', {});
    return response.data;
  },
};

// ── Employee Loans / Advances ──────────────────────────────────────────────────

export const hrLoansApi = {
  getAll: async (params?: { page?: number; search?: string; employee?: number; status?: string; page_size?: number }): Promise<PaginatedResponse<EmployeeLoan>> => {
    const response = await apiClient.get('/hr/payroll/loans/', { params });
    return response.data;
  },
  getById: async (id: number): Promise<EmployeeLoan> => {
    const response = await apiClient.get(`/hr/payroll/loans/${id}/`);
    return response.data;
  },
  create: async (data: Partial<EmployeeLoan>): Promise<EmployeeLoan> => {
    const response = await apiClient.post('/hr/payroll/loans/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<EmployeeLoan>): Promise<EmployeeLoan> => {
    const response = await apiClient.patch(`/hr/payroll/loans/${id}/`, data);
    return response.data;
  },
  cancel: async (id: number): Promise<EmployeeLoan> => {
    const response = await apiClient.post(`/hr/payroll/loans/${id}/cancel/`);
    return response.data;
  },
  pause: async (id: number): Promise<EmployeeLoan> => {
    const response = await apiClient.post(`/hr/payroll/loans/${id}/pause/`);
    return response.data;
  },
  resume: async (id: number): Promise<EmployeeLoan> => {
    const response = await apiClient.post(`/hr/payroll/loans/${id}/resume/`);
    return response.data;
  },
};

// ── Penalty Rules (P2) ────────────────────────────────────────────────────────

// ── Leave Policies ─────────────────────────────────────────────────────────────

export interface AccrualResult {
  year:                 number;
  month:                number;
  dry_run:              boolean;
  accrued:              number;
  skipped_no_policy:    number;
  skipped_already_run:  number;
  details: Array<{
    employee_id:   string;
    leave_type:    string;
    status:        'accrued' | 'would_accrue' | 'no_policy' | 'already_run';
    days_added:    string | null;
    balance_after: string | null;
  }>;
}

export const hrLeavePoliciesApi = {
  getAll: async (params?: { leave_type?: string; is_active?: boolean; employee_group?: number | null }): Promise<PaginatedResponse<LeavePolicy>> => {
    const response = await apiClient.get('/hr/requests/leave-policies/', { params: { page_size: 200, ...params } });
    const data = response.data;
    if (Array.isArray(data)) return { results: data, count: data.length, next: null, previous: null };
    return data;
  },
  create: async (data: Partial<LeavePolicy>): Promise<LeavePolicy> => {
    const response = await apiClient.post('/hr/requests/leave-policies/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<LeavePolicy>): Promise<LeavePolicy> => {
    const response = await apiClient.patch(`/hr/requests/leave-policies/${id}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/requests/leave-policies/${id}/`);
  },
  accrueLeave: async (params: { month: number; year: number; dry_run?: boolean }): Promise<AccrualResult> => {
    const response = await apiClient.post('/hr/requests/accrue-leave/', params);
    return response.data;
  },
};

// ── Leave Encashments ──────────────────────────────────────────────────────────

export const hrLeaveEncashmentsApi = {
  getAll: async (params?: { page?: number; employee?: number; status?: string; month?: number; year?: number; leave_type?: string; page_size?: number }): Promise<PaginatedResponse<LeaveEncashment>> => {
    const response = await apiClient.get('/hr/requests/leave-encashments/', { params });
    return response.data;
  },
  create: async (data: Partial<LeaveEncashment>): Promise<LeaveEncashment> => {
    const response = await apiClient.post('/hr/requests/leave-encashments/', data);
    return response.data;
  },
  approve: async (id: number): Promise<LeaveEncashment> => {
    const response = await apiClient.post(`/hr/requests/leave-encashments/${id}/approve/`);
    return response.data;
  },
  reject: async (id: number): Promise<LeaveEncashment> => {
    const response = await apiClient.post(`/hr/requests/leave-encashments/${id}/reject/`);
    return response.data;
  },
  cancel: async (id: number): Promise<LeaveEncashment> => {
    const response = await apiClient.post(`/hr/requests/leave-encashments/${id}/cancel/`);
    return response.data;
  },
};

// ── Penalty Rules (P2) ────────────────────────────────────────────────────────

export const hrPenaltyRulesApi = {
  getAll: async (): Promise<PenaltyRule[]> => {
    const response = await apiClient.get('/hr/attendance/penalty-rules/', { params: { page_size: 200 } });
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },
  create: async (data: Partial<PenaltyRule>): Promise<PenaltyRule> => {
    const response = await apiClient.post('/hr/attendance/penalty-rules/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<PenaltyRule>): Promise<PenaltyRule> => {
    const response = await apiClient.patch(`/hr/attendance/penalty-rules/${id}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/attendance/penalty-rules/${id}/`);
  },
  getTiers: async (ruleId: number): Promise<PenaltyTier[]> => {
    const response = await apiClient.get('/hr/attendance/penalty-tiers/', { params: { rule: ruleId, page_size: 100 } });
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },
  createTier: async (data: Partial<PenaltyTier>): Promise<PenaltyTier> => {
    const response = await apiClient.post('/hr/attendance/penalty-tiers/', data);
    return response.data;
  },
  updateTier: async (id: number, data: Partial<PenaltyTier>): Promise<PenaltyTier> => {
    const response = await apiClient.patch(`/hr/attendance/penalty-tiers/${id}/`, data);
    return response.data;
  },
  deleteTier: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/attendance/penalty-tiers/${id}/`);
  },
};
