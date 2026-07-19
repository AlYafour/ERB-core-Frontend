import apiClient from './client';
import { PaginatedResponse } from '@/types';

export type ExpenseStatus =
  | 'draft' | 'submitted' | 'accounting_approved' | 'approved' | 'posted' | 'rejected' | 'cancelled';

export type CostType = 'direct' | 'indirect' | 'office';

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
  cost_type: CostType;
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
  cost_type: CostType;
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

  uploadAttachment: (id: string, file: File): Promise<ExpenseAttachment> => {
    const fd = new FormData();
    fd.append('file', file);
    return apiClient.post(`${BASE}/${id}/attachments/`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
  deleteAttachment: (id: string, attId: string): Promise<void> =>
    apiClient.delete(`${BASE}/${id}/attachments/${attId}/`).then(() => undefined),
};
