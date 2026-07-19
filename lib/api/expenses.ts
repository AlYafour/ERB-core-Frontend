import apiClient from './client';
import { PaginatedResponse } from '@/types';

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
  accountingApprove: (id: string): Promise<Expense> =>
    apiClient.post(`${BASE}/${id}/accounting-approve/`).then(r => r.data),
  approve: (id: string): Promise<Expense> =>
    apiClient.post(`${BASE}/${id}/approve/`).then(r => r.data),
  reject: (id: string, reason: string): Promise<Expense> =>
    apiClient.post(`${BASE}/${id}/reject/`, { reason }).then(r => r.data),
  preview: (id: string): Promise<{ lines: Array<{ account: string; debit: string; credit: string; source: string }> }> =>
    apiClient.get(`${BASE}/${id}/preview/`).then(r => r.data),

  listCashBoxes: (): Promise<Array<{ id: string; name: string; kind: string; custodian?: number | null; custodian_name?: string | null; cash_in?: string; spent?: string; balance?: string }>> =>
    apiClient.get(`${BASE}/cash-boxes/`).then(r => r.data),
  createCashBox: (payload: { name: string; custodian?: number | null }): Promise<{ id: string; name: string; kind: string; custodian_name?: string | null }> =>
    apiClient.post(`${BASE}/cash-boxes/`, payload).then(r => r.data),

  updateCashBox: (id: string, patch: { name?: string; custodian?: number | null; is_active?: boolean }): Promise<any> =>
    apiClient.patch(`${BASE}/cash-boxes/${id}/`, patch).then(r => r.data),

  listCostTypes: (): Promise<Array<{ id: string; name: string; is_direct: boolean }>> =>
    apiClient.get(`${BASE}/cost-types/`).then(r => r.data),
  createCostType: (name: string, is_direct = true): Promise<{ id: string; name: string; is_direct: boolean }> =>
    apiClient.post(`${BASE}/cost-types/`, { name, is_direct }).then(r => r.data),

  listOverheadCategories: (): Promise<Array<{ id: string; name: string }>> =>
    apiClient.get(`${BASE}/overhead-categories/`).then(r => r.data),
  createOverheadCategory: (name: string): Promise<{ id: string; name: string }> =>
    apiClient.post(`${BASE}/overhead-categories/`, { name }).then(r => r.data),

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
