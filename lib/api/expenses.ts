import apiClient from './client';
import { PaginatedResponse } from '@/types';
import type { ApprovalStatus } from './approvals';

export type ExpenseStatus =
  | 'draft' | 'submitted' | 'accounting_approved' | 'approved' | 'posted' | 'rejected' | 'cancelled';

export interface ExpenseAttachment {
  id: string;
  name: string;
  size: number;
  url: string | null;
  uploaded_by_name?: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  number: string;
  voucher_number: string;
  cash_box: string | null;
  cash_box_name?: string | null;
  expense_date: string;
  cost_type: string | null;
  cost_type_label?: string | null;
  project: number | null;
  project_name?: string | null;
  cost_code: number | null;
  cost_code_code?: string | null;
  cost_code_desc?: string | null;
  expense_account: number | null;
  supplier: number | null;
  supplier_name?: string | null;
  vehicle: number | null;
  vehicle_label?: string | null;
  payee_name: string;
  invoice_no: string;
  description: string;
  amount: string;
  vat_liable: boolean;
  vat_amount: string;
  net_amount?: string;
  status: ExpenseStatus;
  accounting_approved_at?: string | null;
  approved_at?: string | null;
  rejection_reason?: string;
  notes?: string;
  attachments?: ExpenseAttachment[];
  journal_entry?: { id: string; number: string | null; status: string } | null;
  approval_status?: ApprovalStatus | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpensePayload {
  voucher_number?: string;
  cash_box?: string | null;
  expense_date: string;
  cost_type: string | null;
  project?: number | null;
  cost_code?: number | null;
  expense_account?: number | null;
  supplier?: number | null;
  vehicle?: number | null;
  payee_name?: string;
  invoice_no?: string;
  description?: string;
  amount: string | number;
  vat_liable: boolean;
  vat_amount?: string | number;
  notes?: string;
}

export interface CashIn {
  id: string;
  number: string;
  cash_box: string;
  cash_box_name?: string | null;
  source_account?: string | null;
  amount: string;
  date: string;
  transfer_type?: string;
  bank_reference?: string;
  transfer_from?: string;
  description?: string;
  status: 'draft' | 'approved' | 'posted' | 'cancelled';
  created_by_name?: string | null;
  created_at: string;
}
export interface CashInPayload {
  cash_box: string;
  source_account?: string | null;
  amount: string | number;
  date: string;
  transfer_from?: string;
  bank_reference?: string;
  description?: string;
}

export interface CashBox {
  id: string;
  name: string;
  kind: string;
  custodian?: number | null;
  custodian_name?: string | null;
  cash_in?: string;
  spent?: string;
  balance?: string;
  is_active?: boolean;
}

export interface CostTypeOption {
  id: string;
  name: string;
  name_ar?: string;
  is_direct: boolean;
  is_active?: boolean;
  display_order?: number;
}

export interface OverheadCategory {
  id: string;
  name: string;
  name_ar?: string;
  is_active?: boolean;
  display_order?: number;
}

const BASE = '/expenses';

export const expensesApi = {
  getAll: (params?: Record<string, unknown>): Promise<PaginatedResponse<Expense>> =>
    apiClient.get(`${BASE}/`, { params }).then(r => r.data),
  getById: (id: string): Promise<Expense> =>
    apiClient.get(`${BASE}/${id}/`).then(r => r.data),
  create: (payload: ExpensePayload): Promise<Expense> =>
    apiClient.post(`${BASE}/`, payload).then(r => r.data),
  update: (id: string, payload: Partial<ExpensePayload>): Promise<Expense> =>
    apiClient.patch(`${BASE}/${id}/`, payload).then(r => r.data),
  remove: (id: string): Promise<void> =>
    apiClient.delete(`${BASE}/${id}/`).then(() => undefined),

  submit: (id: string): Promise<Expense> =>
    apiClient.post(`${BASE}/${id}/submit/`).then(r => r.data),
  approve: (id: string): Promise<Expense> =>
    apiClient.post(`${BASE}/${id}/approve/`).then(r => r.data),
  reject: (id: string, reason: string): Promise<Expense> =>
    apiClient.post(`${BASE}/${id}/reject/`, { reason }).then(r => r.data),
  preview: (id: string): Promise<{ lines: Array<{ account: string; debit: string; credit: string; source: string }> }> =>
    apiClient.get(`${BASE}/${id}/preview/`).then(r => r.data),

  listCashBoxes: (): Promise<CashBox[]> =>
    apiClient.get(`${BASE}/cash-boxes/`).then(r => r.data),
  createCashBox: (payload: { name: string; custodian?: number | null }): Promise<CashBox> =>
    apiClient.post(`${BASE}/cash-boxes/`, payload).then(r => r.data),
  updateCashBox: (id: string, patch: { name?: string; custodian?: number | null; is_active?: boolean }): Promise<CashBox> =>
    apiClient.patch(`${BASE}/cash-boxes/${id}/`, patch).then(r => r.data),
  deactivateCashBox: (id: string): Promise<CashBox> =>
    apiClient.patch(`${BASE}/cash-boxes/${id}/`, { is_active: false }).then(r => r.data),

  // Select-only list of the tenant's registered vehicles (managed in HR → Assets).
  listVehicles: (): Promise<Array<{ id: number; label: string; plate: string; name: string }>> =>
    apiClient.get(`${BASE}/vehicles/`).then(r => r.data),

  listCostTypes: (includeInactive = false): Promise<CostTypeOption[]> =>
    apiClient.get(`${BASE}/cost-types/`, { params: includeInactive ? { include_inactive: 1 } : undefined }).then(r => r.data),
  createCostType: (name: string, is_direct = true, name_ar = ''): Promise<CostTypeOption> =>
    apiClient.post(`${BASE}/cost-types/`, { name, is_direct, name_ar }).then(r => r.data),
  updateCostType: (id: string, patch: Partial<Pick<CostTypeOption, 'name' | 'name_ar' | 'is_direct' | 'is_active' | 'display_order'>>): Promise<CostTypeOption> =>
    apiClient.patch(`${BASE}/cost-types/${id}/`, patch).then(r => r.data),
  deleteCostType: (id: string): Promise<void> =>
    apiClient.delete(`${BASE}/cost-types/${id}/`).then(() => undefined),

  listOverheadCategories: (includeInactive = false): Promise<OverheadCategory[]> =>
    apiClient.get(`${BASE}/overhead-categories/`, { params: includeInactive ? { include_inactive: 1 } : undefined }).then(r => r.data),
  createOverheadCategory: (name: string, name_ar = ''): Promise<OverheadCategory> =>
    apiClient.post(`${BASE}/overhead-categories/`, { name, name_ar }).then(r => r.data),
  updateOverheadCategory: (id: string, patch: Partial<Pick<OverheadCategory, 'name' | 'name_ar' | 'is_active' | 'display_order'>>): Promise<OverheadCategory> =>
    apiClient.patch(`${BASE}/overhead-categories/${id}/`, patch).then(r => r.data),
  deleteOverheadCategory: (id: string): Promise<void> =>
    apiClient.delete(`${BASE}/overhead-categories/${id}/`).then(() => undefined),

  // Cash-In (box top-up)
  listCashIns: (params?: Record<string, unknown>): Promise<PaginatedResponse<CashIn>> =>
    apiClient.get('/cash-ins/', { params }).then(r => r.data),
  createCashIn: (payload: CashInPayload): Promise<CashIn> =>
    apiClient.post('/cash-ins/', payload).then(r => r.data),
  approveCashIn: (id: string): Promise<CashIn> =>
    apiClient.post(`/cash-ins/${id}/approve/`).then(r => r.data),

  uploadAttachment: (id: string, file: File): Promise<ExpenseAttachment> => {
    const fd = new FormData();
    fd.append('file', file);
    return apiClient.post(`${BASE}/${id}/attachments/`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
  deleteAttachment: (id: string, attId: string): Promise<void> =>
    apiClient.delete(`${BASE}/${id}/attachments/${attId}/`).then(() => undefined),
};
