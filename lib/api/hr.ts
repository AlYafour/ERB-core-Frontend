import apiClient from './client';
import { HREmployee, HRDepartment, HRPosition, HRLocation, HRLocationType, HRLegalEntity, HRAttendance, HRShift, HRRequest, HRLeaveBalance, HRPayroll, OfficeLocation, PaginatedResponse, EmployeeGroup, WorkTeam, ApprovalPolicy, ApprovalStep, PenaltyRule, PenaltyTier, EmployeeLoan, LeavePolicy, LeaveEncashment, EmployeeBankAccount, HRCompanySettings, PayrollRun, EOSCalculation, EOSPreview, SalaryHistory } from '@/types';

function toPage<T>(data: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
  if (Array.isArray(data)) return { results: data, count: data.length, next: null, previous: null };
  return data as PaginatedResponse<T>;
}

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

// ── Legal Entities ─────────────────────────────────────────────────────────────

export const hrLegalEntitiesApi = {
  getAll: async (params?: { page?: number; search?: string }): Promise<PaginatedResponse<HRLegalEntity>> => {
    const response = await apiClient.get('/hr/employees/legal-entities/', { params });
    return response.data;
  },
  create: async (data: Partial<HRLegalEntity>): Promise<HRLegalEntity> => {
    const response = await apiClient.post('/hr/employees/legal-entities/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<HRLegalEntity>): Promise<HRLegalEntity> => {
    const response = await apiClient.patch(`/hr/employees/legal-entities/${id}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/employees/legal-entities/${id}/`);
  },
};

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
  getAll: async (params?: { page?: number; search?: string; department?: number; position?: number; is_active?: boolean; employment_type?: string; user?: number; is_manager?: boolean; page_size?: number }): Promise<PaginatedResponse<HREmployee>> => {
    const response = await apiClient.get('/hr/employees/', { params });
    return toPage(response.data);
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
  getBankAccounts: async (empId: number): Promise<EmployeeBankAccount[]> => {
    const response = await apiClient.get(`/hr/employees/${empId}/bank-accounts/`);
    return response.data;
  },
  addBankAccount: async (empId: number, data: Partial<EmployeeBankAccount>): Promise<EmployeeBankAccount> => {
    const response = await apiClient.post(`/hr/employees/${empId}/bank-accounts/`, data);
    return response.data;
  },
  updateBankAccount: async (empId: number, accId: number, data: Partial<EmployeeBankAccount>): Promise<EmployeeBankAccount> => {
    const response = await apiClient.patch(`/hr/employees/${empId}/bank-accounts/${accId}/`, data);
    return response.data;
  },
  deleteBankAccount: async (empId: number, accId: number): Promise<void> => {
    await apiClient.delete(`/hr/employees/${empId}/bank-accounts/${accId}/`);
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
  getAll: async (params?: { page?: number; search?: string; page_size?: number }): Promise<PaginatedResponse<HRPosition>> => {
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
  recalculate: async (id: number): Promise<HRAttendance> => {
    const response = await apiClient.post(`/hr/attendance/${id}/recalculate/`);
    return response.data;
  },
  bulkRecalculate: async (): Promise<{ updated: number; skipped_no_shift: number }> => {
    const response = await apiClient.post('/hr/attendance/bulk-recalculate/');
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
  payslipUrl: (id: number): string => {
    const base = (apiClient.defaults.baseURL ?? '').replace(/\/$/, '');
    return `${base}/hr/payroll/${id}/payslip/`;
  },
};

// ── Penalty Applications (preview for payroll generation) ─────────────────────

export interface PenaltyApplicationPreview {
  id: number;
  attendance: number;
  attendance_date: string;
  employee_name: string;
  employee_id_code: string;
  penalty_amount: string;
  status: 'pending_review' | 'confirmed' | 'waived';
  rule_name: string | null;
  tier_label: string | null;
  tier_order: number | null;
  rule_type: string;
  minutes_evaluated: number;
  was_compensated: boolean;
  created_at: string;
}

export const hrPenaltyApplicationsApi = {
  getAll: async (params?: { employee?: number; year?: number; month?: number; status?: string; page?: number; page_size?: number }): Promise<PaginatedResponse<PenaltyApplicationPreview>> => {
    const response = await apiClient.get('/hr/attendance/penalty-applications/', { params });
    return response.data;
  },
  confirm: async (id: number): Promise<PenaltyApplicationPreview> => {
    const response = await apiClient.post(`/hr/attendance/penalty-applications/${id}/confirm/`);
    return response.data;
  },
  waive: async (id: number): Promise<PenaltyApplicationPreview> => {
    const response = await apiClient.post(`/hr/attendance/penalty-applications/${id}/waive/`);
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
    return toPage(response.data);
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
    return toPage(response.data);
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

// ── Work Teams ────────────────────────────────────────────────────────────────

export const hrWorkTeamsApi = {
  getAll: async (params?: Record<string, unknown>): Promise<PaginatedResponse<WorkTeam>> => {
    const response = await apiClient.get('/hr/employees/work-teams/', { params: { page_size: 200, ...params } });
    return toPage(response.data);
  },
  getMembers: async (id: number): Promise<HREmployee[]> => {
    const response = await apiClient.get(`/hr/employees/work-teams/${id}/members/`);
    return Array.isArray(response.data) ? response.data : response.data?.results ?? [];
  },
  create: async (data: Partial<WorkTeam>): Promise<WorkTeam> => {
    const response = await apiClient.post('/hr/employees/work-teams/', data);
    return response.data;
  },
  update: async (id: number, data: Partial<WorkTeam>): Promise<WorkTeam> => {
    const response = await apiClient.patch(`/hr/employees/work-teams/${id}/`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/hr/employees/work-teams/${id}/`);
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
  payCash: async (id: number, data: { month: number; year: number; amount?: number }): Promise<EmployeeLoan> => {
    const response = await apiClient.post(`/hr/payroll/loans/${id}/pay-cash/`, data);
    return response.data;
  },
  skip: async (id: number, data: { month: number; year: number }): Promise<EmployeeLoan> => {
    const response = await apiClient.post(`/hr/payroll/loans/${id}/skip/`, data);
    return response.data;
  },
  reschedule: async (id: number, data: { installment_amount: number }): Promise<EmployeeLoan> => {
    const response = await apiClient.post(`/hr/payroll/loans/${id}/reschedule/`, data);
    return response.data;
  },
};

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
    return toPage(response.data);
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
  seedUaeRules: async (): Promise<{ created_rules: number; created_tiers: number; skipped_existing: number }> => {
    const response = await apiClient.post('/hr/attendance/penalty-rules/seed-uae-rules/');
    return response.data;
  },
};

// ── Company Settings ──────────────────────────────────────────────────────────

export const hrCompanySettingsApi = {
  get: async (): Promise<HRCompanySettings> => {
    const response = await apiClient.get('/hr/settings/company/');
    return response.data;
  },
  update: async (data: Partial<HRCompanySettings>): Promise<HRCompanySettings> => {
    const response = await apiClient.patch('/hr/settings/company/', data);
    return response.data;
  },
};

// ── Payroll Runs ──────────────────────────────────────────────────────────────
export const hrPayrollRunsApi = {
  getAll: async (params?: { page?: number; status?: string; month?: number; year?: number }): Promise<PaginatedResponse<PayrollRun>> => {
    const response = await apiClient.get('/hr/payroll/runs/', { params });
    return response.data;
  },
  getById: async (id: number): Promise<PayrollRun> => {
    const response = await apiClient.get(`/hr/payroll/runs/${id}/`);
    return response.data;
  },
  create: async (data: { month: number; year: number; notes?: string }): Promise<PayrollRun> => {
    const response = await apiClient.post('/hr/payroll/runs/', data);
    return response.data;
  },
  generate: async (id: number): Promise<{ detail: string; total: number; run: PayrollRun }> => {
    const response = await apiClient.post(`/hr/payroll/runs/${id}/generate/`);
    return response.data;
  },
  processAll: async (id: number): Promise<{ processed: number; errors: any[]; run: PayrollRun }> => {
    const response = await apiClient.post(`/hr/payroll/runs/${id}/process-all/`);
    return response.data;
  },
  markPaidAll: async (id: number): Promise<{ paid: number; run: PayrollRun }> => {
    const response = await apiClient.post(`/hr/payroll/runs/${id}/mark-paid-all/`);
    return response.data;
  },
  cancel: async (id: number): Promise<PayrollRun> => {
    const response = await apiClient.post(`/hr/payroll/runs/${id}/cancel/`);
    return response.data;
  },
  wpsExportByRun: async (id: number): Promise<Blob> => {
    const response = await apiClient.get(`/hr/payroll/runs/${id}/wps-export/`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

// ── End of Service ─────────────────────────────────────────────────────────────
export const hrEosApi = {
  getAll: async (params?: { page?: number; status?: string; termination_reason?: string; search?: string }): Promise<PaginatedResponse<EOSCalculation>> => {
    const response = await apiClient.get('/hr/eos/', { params });
    return response.data;
  },
  getById: async (id: number): Promise<EOSCalculation> => {
    const response = await apiClient.get(`/hr/eos/${id}/`);
    return response.data;
  },
  preview: async (data: { employee_id: number; termination_date: string; termination_reason: string; leave_balance_days?: number; other_deductions?: number; other_additions?: number }): Promise<EOSPreview> => {
    const response = await apiClient.post('/hr/eos/preview/', data);
    return response.data;
  },
  create: async (data: { employee: number; hire_date: string; termination_date: string; termination_reason: string; leave_balance_days?: string; other_deductions?: string; other_additions?: string; notes?: string }): Promise<EOSCalculation> => {
    const response = await apiClient.post('/hr/eos/', data);
    return response.data;
  },
  approve: async (id: number): Promise<EOSCalculation> => {
    const response = await apiClient.post(`/hr/eos/${id}/approve/`);
    return response.data;
  },
  markPaid: async (id: number): Promise<EOSCalculation> => {
    const response = await apiClient.post(`/hr/eos/${id}/mark-paid/`);
    return response.data;
  },
  cancel: async (id: number): Promise<EOSCalculation> => {
    const response = await apiClient.post(`/hr/eos/${id}/cancel/`);
    return response.data;
  },
  settlementLetterUrl: (id: number): string => {
    const base = (apiClient.defaults.baseURL ?? '').replace(/\/$/, '');
    return `${base}/hr/eos/${id}/settlement-letter/`;
  },
};

// ── EOS Final Settlements ─────────────────────────────────────────────────────
export interface FinalSettlement {
  id: number;
  eos_calculation: number;
  eos_status: string;
  employee: number;
  employee_name: string;
  employee_id_code: string;
  payment_method: string;
  payment_method_display: string;
  bank_account: number | null;
  total_amount: string;
  settlement_date: string;
  receipt_reference: string;
  status: 'pending' | 'paid' | 'voided';
  status_display: string;
  paid_at: string | null;
  paid_by: number | null;
  paid_by_name: string | null;
  notes: string;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export const hrFinalSettlementsApi = {
  getAll: async (params?: { page?: number; status?: string; search?: string }): Promise<PaginatedResponse<FinalSettlement>> => {
    const response = await apiClient.get('/hr/eos/settlements/', { params });
    return response.data;
  },
  getById: async (id: number): Promise<FinalSettlement> => {
    const response = await apiClient.get(`/hr/eos/settlements/${id}/`);
    return response.data;
  },
  create: async (data: {
    eos_calculation: number;
    payment_method: string;
    bank_account?: number | null;
    settlement_date: string;
    receipt_reference?: string;
    notes?: string;
  }): Promise<FinalSettlement> => {
    const response = await apiClient.post('/hr/eos/settlements/', data);
    return response.data;
  },
  markPaid: async (id: number, receipt_reference?: string): Promise<FinalSettlement> => {
    const response = await apiClient.post(`/hr/eos/settlements/${id}/mark-paid/`, { receipt_reference });
    return response.data;
  },
  void: async (id: number): Promise<FinalSettlement> => {
    const response = await apiClient.post(`/hr/eos/settlements/${id}/void/`);
    return response.data;
  },
};

// ── Salary History ─────────────────────────────────────────────────────────────
export const hrSalaryHistoryApi = {
  getAll: async (params?: { page?: number; employee?: number; change_reason?: string }): Promise<PaginatedResponse<SalaryHistory>> => {
    const response = await apiClient.get('/hr/employees/salary-history/', { params });
    return response.data;
  },
  getByEmployee: async (employeeId: number): Promise<SalaryHistory[]> => {
    const response = await apiClient.get('/hr/employees/salary-history/', { params: { employee: employeeId, page_size: 50 } });
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },
};

// ─────────────────────── Policy Engine v2 (PolicySet-based) ──────────────────

export interface PolicyRule {
  id: number
  rule_key: string
  label: string
  description: string
  source_reference: string
  conditions: Array<{ field: string; op: string; operand: unknown }>
  formula: string
  value: unknown
  output_type: string
  output_type_display: string
  priority: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PolicySet {
  id: number
  module: string
  module_display: string
  name: string
  country_code: string
  description: string
  version: number
  status: 'draft' | 'active' | 'archived'
  status_display: string
  is_locked: boolean
  calculation_strategy: string
  strategy_display: string
  output_type: string
  output_type_display: string
  effective_from: string
  effective_to: string | null
  cloned_from: number | null
  rules: PolicyRule[]
  rules_count: number
  created_at: string
}

export interface PolicyPreset {
  id: number
  code: string
  name: string
  country_code: string
  description: string
  sets: unknown[]
  sets_count: number
  is_active: boolean
}

export interface PolicyAuditLog {
  id: number
  entity_type: string
  entity_id: number | null
  rule_type: string
  action: string
  action_display: string
  old_state: unknown
  new_state: unknown
  changed_by: number | null
  changed_by_name: string | null
  changed_at: string
  change_reason: string
}

export interface PolicyPreviewResult {
  final_output: number | null
  output_type: string
  calculation_strategy: string
  rule_evaluations: Array<{
    step: number
    rule_key: string
    label: string
    conditions_met: boolean
    condition_detail: Array<{ field: string; op: string; operand: unknown; actual: unknown; passed: boolean; reason: string | null }>
    formula: string
    formula_result: number | null
    output_type: string
    applied: boolean
    skipped_reason: string | null
  }>
  matched_rules_count: number
  skipped_rules_count: number
}

export const hrPolicySetsApi = {
  getAll: (params?: Record<string, string>) => apiClient.get<PolicySet[]>('/hr/policy/sets/', { params }),
  getById: (id: number) => apiClient.get<PolicySet>(`/hr/policy/sets/${id}/`),
  create: (data: Partial<PolicySet>) => apiClient.post<PolicySet>('/hr/policy/sets/', data),
  update: (id: number, data: Partial<PolicySet>) => apiClient.patch<PolicySet>(`/hr/policy/sets/${id}/`, data),
  clone: (id: number) => apiClient.post<PolicySet>(`/hr/policy/sets/${id}/clone/`),
  activate: (id: number) => apiClient.post<PolicySet>(`/hr/policy/sets/${id}/activate/`),
  archive: (id: number) => apiClient.post(`/hr/policy/sets/${id}/archive/`),
  addRule: (id: number, rule: Partial<PolicyRule>) => apiClient.post<PolicyRule>(`/hr/policy/sets/${id}/add-rule/`, rule),
  preview: (id: number, context: Record<string, unknown>) => apiClient.post<PolicyPreviewResult>(`/hr/policy/sets/${id}/preview/`, { context }),
}

export const hrPolicyPresetsApi = {
  getAll: () => apiClient.get<PolicyPreset[]>('/hr/policy/presets/'),
  getById: (id: number) => apiClient.get<PolicyPreset>(`/hr/policy/presets/${id}/`),
  apply: (id: number, effective_from?: string) => apiClient.post(`/hr/policy/presets/${id}/apply/`, { effective_from }),
}

export const hrPolicyAuditApi = {
  getAll: (params?: Record<string, string>) => apiClient.get<PolicyAuditLog[]>('/hr/policy/audit-log/', { params }),
}

export interface CalculationSnapshot {
  id: number;
  source_type: string;
  source_type_display: string;
  source_id: number;
  employee: number | null;
  employee_name: string | null;
  rules_snapshot: Record<string, { value: unknown; value_type: string; version: number; effective_from: string; rule_id: number } | null>;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  calculated_at: string;
  calculated_by: number | null;
}

export const hrPolicySnapshotsApi = {
  getAll: async (params?: Record<string, string>): Promise<CalculationSnapshot[]> => {
    const response = await apiClient.get('/hr/policy/snapshots/', { params });
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },
};

// ─────────────────────── Phase 2: HR Documents ───────────────────────────────

export interface DocumentTemplate {
  id: number
  name: string
  template_type: string
  template_type_display: string
  html_content: string
  variables: string[]
  variables_count: number
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GeneratedDocument {
  id: number
  employee: number
  employee_name: string | null
  template: number | null
  template_type: string
  template_type_display: string
  reference_number: string
  status: 'draft' | 'final' | 'sent' | 'voided'
  status_display: string
  generated_data: Record<string, unknown>
  pdf_url: string | null
  hr_request: number | null
  notes: string
  generated_at: string
  generated_by: number | null
  voided_at: string | null
}

export interface EmployeeContract {
  id: number
  employee: number
  employee_name: string | null
  contract_type: string
  contract_type_display: string
  status: 'draft' | 'active' | 'expired' | 'terminated'
  status_display: string
  start_date: string
  end_date: string | null
  notice_period_days: number
  probation_end_date: string | null
  job_title_snapshot: string
  basic_salary_snapshot: string
  document_url: string | null
  signed_at: string | null
  termination_date: string | null
  termination_reason: string
  notes: string
  is_expiring_soon: boolean
  created_at: string
  updated_at: string
}

// ─────────────────────── Phase 2: HR Lifecycle ───────────────────────────────

export interface OnboardingTemplateTask {
  id: number
  title: string
  description: string
  assignee_role: string
  assignee_role_display: string
  due_days_after: number
  is_required: boolean
  order: number
}

export interface OnboardingTemplate {
  id: number
  name: string
  description: string
  is_default: boolean
  is_active: boolean
  tasks: OnboardingTemplateTask[]
  tasks_count: number
  created_at: string
}

export interface OnboardingTaskInstance {
  id: number
  title: string
  description: string
  assignee_role: string
  assigned_to: number | null
  assignee_name: string | null
  due_date: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  status_display: string
  completed_at: string | null
  notes: string
  order: number
}

export interface OnboardingProcess {
  id: number
  employee: number
  employee_name: string | null
  template: number | null
  status: 'active' | 'completed' | 'cancelled'
  status_display: string
  start_date: string
  target_completion_date: string | null
  completion_pct: number
  task_instances: OnboardingTaskInstance[]
  notes: string
  created_at: string
}

export interface OffboardingProcess {
  id: number
  employee: number
  employee_name: string | null
  status: 'active' | 'completed' | 'cancelled'
  status_display: string
  last_working_day: string
  exit_interview_done: boolean
  exit_interview_notes: string
  eos_calculation: number | null
  asset_clearance_done: boolean
  system_access_revoked: boolean
  documents_collected: boolean
  clearance_pct: number
  notes: string
  created_at: string
  updated_at: string
}

export const hrDocumentTemplatesApi = {
  getAll: (params?: Record<string, string>) => apiClient.get<DocumentTemplate[]>('/hr/documents/templates/', { params }),
  getById: (id: number) => apiClient.get<DocumentTemplate>(`/hr/documents/templates/${id}/`),
  create: (data: Partial<DocumentTemplate>) => apiClient.post<DocumentTemplate>('/hr/documents/templates/', data),
  update: (id: number, data: Partial<DocumentTemplate>) => apiClient.patch<DocumentTemplate>(`/hr/documents/templates/${id}/`, data),
  delete: (id: number) => apiClient.delete(`/hr/documents/templates/${id}/`),
  preview: (id: number, context: Record<string, unknown>) => apiClient.post<{ html: string }>(`/hr/documents/templates/${id}/preview/`, { context }),
  setDefault: (id: number) => apiClient.post(`/hr/documents/templates/${id}/set-default/`),
}

export const hrGeneratedDocsApi = {
  getAll: (params?: Record<string, string>) => apiClient.get<GeneratedDocument[]>('/hr/documents/generated/', { params }),
  getById: (id: number) => apiClient.get<GeneratedDocument>(`/hr/documents/generated/${id}/`),
  generate: (data: { employee_id: number; template_id: number; extra_context?: Record<string, unknown>; hr_request_id?: number }) =>
    apiClient.post<GeneratedDocument>('/hr/documents/generated/generate/', data),
  void: (id: number) => apiClient.post(`/hr/documents/generated/${id}/void/`),
}

export const hrContractsApi = {
  getAll: (params?: Record<string, string>) => apiClient.get<EmployeeContract[]>('/hr/contracts/', { params }),
  getById: (id: number) => apiClient.get<EmployeeContract>(`/hr/contracts/${id}/`),
  create: (data: FormData | Partial<EmployeeContract>) => apiClient.post<EmployeeContract>('/hr/contracts/', data),
  update: (id: number, data: Partial<EmployeeContract>) => apiClient.patch<EmployeeContract>(`/hr/contracts/${id}/`, data),
  terminate: (id: number, data: { termination_date: string; termination_reason?: string }) =>
    apiClient.post<EmployeeContract>(`/hr/contracts/${id}/terminate/`, data),
  expiringSoon: (days?: number) => apiClient.get<EmployeeContract[]>('/hr/contracts/expiring-soon/', { params: days ? { days: String(days) } : undefined }),
}

export const hrOnboardingApi = {
  getTemplates: () => apiClient.get<OnboardingTemplate[]>('/hr/onboarding/templates/'),
  createTemplate: (data: Partial<OnboardingTemplate>) => apiClient.post<OnboardingTemplate>('/hr/onboarding/templates/', data),
  addTask: (templateId: number, task: Partial<OnboardingTemplateTask>) =>
    apiClient.post<OnboardingTemplateTask>(`/hr/onboarding/templates/${templateId}/add-task/`, task),
  getProcesses: (params?: Record<string, string>) => apiClient.get<OnboardingProcess[]>('/hr/onboarding/processes/', { params }),
  getProcess: (id: number) => apiClient.get<OnboardingProcess>(`/hr/onboarding/processes/${id}/`),
  createProcess: (data: Partial<OnboardingProcess>) => apiClient.post<OnboardingProcess>('/hr/onboarding/processes/', data),
  completeTask: (processId: number, taskId: number, data?: { notes?: string; skip?: boolean }) =>
    apiClient.post<OnboardingTaskInstance>(`/hr/onboarding/processes/${processId}/complete-task/`, { task_id: taskId, ...data }),
}

export const hrOffboardingApi = {
  getAll: (params?: Record<string, string>) => apiClient.get<OffboardingProcess[]>('/hr/offboarding/', { params }),
  getById: (id: number) => apiClient.get<OffboardingProcess>(`/hr/offboarding/${id}/`),
  create: (data: Partial<OffboardingProcess>) => apiClient.post<OffboardingProcess>('/hr/offboarding/', data),
  update: (id: number, data: Partial<OffboardingProcess>) => apiClient.patch<OffboardingProcess>(`/hr/offboarding/${id}/`, data),
  complete: (id: number) => apiClient.post<OffboardingProcess>(`/hr/offboarding/${id}/complete/`),
}

// ─────────────────────── Phase 3: HR Analytics ───────────────────────────────

export interface HeadcountData {
  total: number
  group_by: string
  rows: Array<{ label: string; count: number }>
}

export interface HeadcountTrendItem {
  label: string
  count: number
}

export interface PayrollCostItem {
  label: string
  month: number
  year: number
  gross: number
  net: number
  deductions: number
  employees: number
}

export interface AttendanceStats {
  period: { from: string; to: string }
  total_records: number
  present: number
  absent: number
  late: number
  attendance_rate: number
  absence_rate: number
  late_rate: number
  by_group?: Array<{ label: string; total: number; present: number; absent: number; rate: number }>
}

export interface OvertimeStats {
  period: { from: string; to: string }
  total_overtime_hours: number
  records_with_overtime: number
  by_department?: Array<{ label: string; hours: number; employees: number }>
}

export interface LeaveLiabilityData {
  total_liability: number
  employee_count: number
  rows: Array<{ employee_id: string; employee_name: string; department: string | null; balance_days: number; daily_rate: number; liability: number }>
}

export interface TurnoverData {
  year: number
  annual_turnover_rate: number
  total_departed: number
  monthly: Array<{ month: number; label: string; joined: number; departed: number; turnover_rate: number; avg_headcount: number }>
}

export const hrAnalyticsApi = {
  headcount: (groupBy?: string) => apiClient.get<HeadcountData>('/hr/analytics/headcount/', { params: groupBy ? { group_by: groupBy } : {} }),
  headcountTrend: (months?: number) => apiClient.get<HeadcountTrendItem[]>('/hr/analytics/headcount/trend/', { params: months ? { months } : {} }),
  payrollCost: (months?: number) => apiClient.get<PayrollCostItem[]>('/hr/analytics/payroll-cost/', { params: months ? { months } : {} }),
  payrollCostByDept: (month?: number, year?: number) => apiClient.get<Array<{ label: string; gross: number; net: number; employees: number }>>('/hr/analytics/payroll-cost/by-department/', { params: { month, year } }),
  attendance: (params?: Record<string, string>) => apiClient.get<AttendanceStats>('/hr/analytics/attendance/', { params }),
  overtime: (params?: Record<string, string>) => apiClient.get<OvertimeStats>('/hr/analytics/overtime/', { params }),
  leaveLiability: () => apiClient.get<LeaveLiabilityData>('/hr/analytics/leave-liability/'),
  turnover: (year?: number) => apiClient.get<TurnoverData>('/hr/analytics/turnover/', { params: year ? { year } : {} }),
  export: (report: string, format: string, params?: Record<string, unknown>) =>
    apiClient.post('/hr/analytics/export/', { report, format: format, params }, { responseType: 'blob' }),
  invalidateCache: () => apiClient.post('/hr/analytics/invalidate-cache/'),
}

// ─────────────────────── Phase 4: HR Performance ────────────────────────────

export interface PerformanceCycle {
  id: number
  name: string
  cycle_type: string
  cycle_type_display: string
  status: 'draft' | 'active' | 'review' | 'closed'
  status_display: string
  start_date: string
  end_date: string
  self_eval_deadline: string
  manager_eval_deadline: string
  description: string
  scope_all: boolean
  reviews_count: number
  completion_pct: number
  created_at: string
}

export interface PerformanceReview {
  id: number
  cycle: number
  employee: number
  employee_name: string | null
  manager: number | null
  manager_name: string | null
  status: string
  status_display: string
  self_rating: number | null
  self_rating_display: string | null
  self_comments: string
  self_submitted_at: string | null
  manager_rating: number | null
  manager_rating_display: string | null
  manager_comments: string
  manager_strengths: string
  manager_improvements: string
  manager_submitted_at: string | null
  final_rating: number | null
  final_rating_display: string | null
  hr_notes: string
  promotion_recommended: boolean
  salary_increase_pct: string | null
  acknowledged_at: string | null
}

export interface EmployeeGoal {
  id: number
  cycle: number | null
  employee: number
  employee_name: string | null
  title: string
  description: string
  target_value: string | null
  actual_value: string | null
  unit: string
  weight: string
  due_date: string | null
  status: 'active' | 'completed' | 'cancelled'
  status_display: string
  progress_pct: number
}

export interface Skill {
  id: number
  name: string
  category: number | null
  category_name: string | null
  description: string
  is_active: boolean
}

export interface EmployeeSkill {
  id: number
  employee: number
  skill: number
  skill_name: string
  category_name: string | null
  level: number
  level_display: string
  verified_by: number | null
  verified_by_name: string | null
  verified_at: string | null
  notes: string
}

export interface TrainingRecord {
  id: number
  employee: number
  employee_name: string | null
  course_name: string
  provider: string
  start_date: string
  end_date: string | null
  cost: string | null
  currency: string
  certificate_url: string | null
  skills: number[]
  skills_list: Skill[]
  notes: string
  created_at: string
}

export const hrPerformanceApi = {
  getCycles: (params?: Record<string, string>) => apiClient.get<PerformanceCycle[]>('/hr/performance/cycles/', { params }),
  createCycle: (data: Partial<PerformanceCycle>) => apiClient.post<PerformanceCycle>('/hr/performance/cycles/', data),
  updateCycle: (id: number, data: Partial<PerformanceCycle>) => apiClient.patch<PerformanceCycle>(`/hr/performance/cycles/${id}/`, data),
  activateCycle: (id: number) => apiClient.post<PerformanceCycle>(`/hr/performance/cycles/${id}/activate/`),
  closeCycle: (id: number) => apiClient.post(`/hr/performance/cycles/${id}/close/`),
  generateReviews: (id: number) => apiClient.post(`/hr/performance/cycles/${id}/generate-reviews/`),
  getReviews: (params?: Record<string, string>) => apiClient.get<PerformanceReview[]>('/hr/performance/reviews/', { params }),
  submitSelf: (id: number, data: { self_rating: number; self_comments?: string }) =>
    apiClient.post<PerformanceReview>(`/hr/performance/reviews/${id}/submit-self/`, data),
  submitManager: (id: number, data: { manager_rating: number; manager_comments?: string; manager_strengths?: string; manager_improvements?: string }) =>
    apiClient.post<PerformanceReview>(`/hr/performance/reviews/${id}/submit-manager/`, data),
  calibrate: (id: number, data: { final_rating: number; hr_notes?: string; promotion_recommended?: boolean; salary_increase_pct?: number }) =>
    apiClient.post<PerformanceReview>(`/hr/performance/reviews/${id}/calibrate/`, data),
  acknowledge: (id: number) => apiClient.post<PerformanceReview>(`/hr/performance/reviews/${id}/acknowledge/`),
  getGoals: (params?: Record<string, string>) => apiClient.get<EmployeeGoal[]>('/hr/performance/goals/', { params }),
  createGoal: (data: Partial<EmployeeGoal>) => apiClient.post<EmployeeGoal>('/hr/performance/goals/', data),
  updateGoal: (id: number, data: Partial<EmployeeGoal>) => apiClient.patch<EmployeeGoal>(`/hr/performance/goals/${id}/`, data),
}

export const hrSkillsApi = {
  getAll: (params?: Record<string, string>) => apiClient.get<Skill[]>('/hr/skills/', { params }),
  create: (data: Partial<Skill>) => apiClient.post<Skill>('/hr/skills/', data),
  getEmployeeSkills: (employeeId?: number) =>
    apiClient.get<EmployeeSkill[]>('/hr/skills/employee-skills/', { params: employeeId ? { employee: String(employeeId) } : {} }),
  addEmployeeSkill: (data: { employee: number; skill: number; level: number; notes?: string }) =>
    apiClient.post<EmployeeSkill>('/hr/skills/employee-skills/', data),
  removeEmployeeSkill: (id: number) => apiClient.delete(`/hr/skills/employee-skills/${id}/`),
}

export const hrTrainingApi = {
  getAll: (params?: Record<string, string>) => apiClient.get<TrainingRecord[]>('/hr/training/', { params }),
  create: (data: FormData | Partial<TrainingRecord>) => apiClient.post<TrainingRecord>('/hr/training/', data),
  update: (id: number, data: Partial<TrainingRecord>) => apiClient.patch<TrainingRecord>(`/hr/training/${id}/`, data),
  delete: (id: number) => apiClient.delete(`/hr/training/${id}/`),
}

// ─────────────────────── Phase 5: HR Recruitment ────────────────────────────

export interface JobRequisition {
  id: number
  title: string
  department: number | null
  department_name: string | null
  location: string
  contract_type: string
  contract_type_display: string
  headcount: number
  status: 'draft' | 'open' | 'on_hold' | 'filled' | 'cancelled'
  status_display: string
  description: string
  requirements: string
  salary_min: string | null
  salary_max: string | null
  currency: string
  target_date: string | null
  candidates_count: number
  active_candidates_count: number
  created_at: string
}

export interface Candidate {
  id: number
  requisition: number
  first_name: string
  last_name: string
  full_name: string
  email: string
  phone: string
  nationality: string
  current_company: string
  current_title: string
  expected_salary: string | null
  notice_period_days: number | null
  cv_file: string | null
  source: string
  status: string
  status_display: string
  rejection_reason: string
  notes: string
  applied_at: string
  interviews_count: number
  latest_interview: { type: string; scheduled_at: string; result: string } | null
}

export interface Interview {
  id: number
  candidate: number
  candidate_name: string
  interview_type: string
  interview_type_display: string
  scheduled_at: string
  duration_minutes: number
  location: string
  interviewers: number[]
  result: 'pending' | 'passed' | 'failed' | 'no_show'
  result_display: string
  score: number | null
  feedback: string
  strengths: string
  concerns: string
  recommend_hire: boolean | null
  created_at: string
}

export interface JobOffer {
  id: number
  candidate: number
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired'
  status_display: string
  job_title: string
  basic_salary: string
  housing_allowance: string
  transport_allowance: string
  other_allowances: string
  total_package: number
  currency: string
  contract_type: string
  joining_date: string | null
  probation_months: number
  expiry_date: string | null
  sent_at: string | null
  responded_at: string | null
}

export interface RequisitionPipeline {
  requisition_id: number
  title: string
  pipeline: Record<string, { label: string; count: number; candidates: Array<{ id: number; name: string; email: string; applied_at: string; source: string }> }>
}

export const hrRecruitmentApi = {
  getRequisitions: (params?: Record<string, string>) => apiClient.get<JobRequisition[]>('/hr/recruitment/requisitions/', { params }),
  createRequisition: (data: Partial<JobRequisition>) => apiClient.post<JobRequisition>('/hr/recruitment/requisitions/', data),
  updateRequisition: (id: number, data: Partial<JobRequisition>) => apiClient.patch<JobRequisition>(`/hr/recruitment/requisitions/${id}/`, data),
  openRequisition: (id: number) => apiClient.post<JobRequisition>(`/hr/recruitment/requisitions/${id}/open/`),
  closeRequisition: (id: number, action: 'filled' | 'cancel') => apiClient.post(`/hr/recruitment/requisitions/${id}/close/`, { action }),
  getPipeline: (id: number) => apiClient.get<RequisitionPipeline>(`/hr/recruitment/requisitions/${id}/pipeline/`),
  getCandidates: (params?: Record<string, string>) => apiClient.get<Candidate[]>('/hr/recruitment/candidates/', { params }),
  createCandidate: (data: FormData | Partial<Candidate>) => apiClient.post<Candidate>('/hr/recruitment/candidates/', data),
  advanceCandidate: (id: number) => apiClient.post<Candidate>(`/hr/recruitment/candidates/${id}/advance/`),
  rejectCandidate: (id: number, reason?: string) => apiClient.post(`/hr/recruitment/candidates/${id}/reject/`, { reason }),
  hireCandidate: (id: number) => apiClient.post<Candidate>(`/hr/recruitment/candidates/${id}/hire/`),
  createInterview: (data: Partial<Interview>) => apiClient.post<Interview>('/hr/recruitment/interviews/', data),
  updateInterview: (id: number, data: Partial<Interview>) => apiClient.patch<Interview>(`/hr/recruitment/interviews/${id}/`, data),
  createOffer: (data: Partial<JobOffer>) => apiClient.post<JobOffer>('/hr/recruitment/offers/', data),
  sendOffer: (id: number) => apiClient.post<JobOffer>(`/hr/recruitment/offers/${id}/send/`),
  respondOffer: (id: number, accepted: boolean) => apiClient.post<JobOffer>(`/hr/recruitment/offers/${id}/respond/`, { accepted }),
}
