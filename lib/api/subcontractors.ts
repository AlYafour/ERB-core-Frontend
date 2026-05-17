import apiClient from './client';

const BASE = '/subcontractors';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TradeType {
  id: number;
  name: string;
  name_ar: string;
  is_active: boolean;
}

export interface Subcontractor {
  id: number;
  company_name: string;
  trade_type: number | null;
  trade_type_name: string;
  contact_person: string;
  mobile: string;
  email: string;
  address: string;
  commercial_license: string;
  vat_number: string;
  notes: string;
  status: 'active' | 'inactive';
  active_contracts_count: number;
  total_contract_value: string;
  created_at: string;
  updated_at: string;
}

export interface SubcontractorContract {
  id: number;
  contract_no: string;
  subcontractor: number;
  subcontractor_name: string;
  contract_title: string;
  start_date: string | null;
  end_date: string | null;
  contract_value: string;
  scope_of_work: string;
  payment_terms: string;
  // Retention
  retention_enabled: boolean;
  retention_percentage: string;
  // Advance
  advance_payment_enabled: boolean;
  advance_payment_amount: string;
  advance_recovery_method: 'percentage' | 'fixed_amount' | 'full_first';
  advance_recovery_percentage: string;
  // Workflow
  contract_status: 'draft' | 'under_review' | 'approved' | 'active' | 'on_hold' | 'completed' | 'closed' | 'terminated';
  created_by_name: string;
  reviewed_by_name: string;
  approved_by_name: string;
  review_date: string | null;
  approval_date: string | null;
  review_notes: string;
  rejection_reason: string;
  // Computed
  boq_total: string;
  total_approved_to_date: string;
  total_paid_to_date: string;
  retention_balance: string;
  advance_recovered_to_date: string;
  remaining_balance: string;
  project_ids: number[];
  created_at: string;
  updated_at: string;
}

export interface ContractBOQItem {
  id: number;
  contract: number;
  item_code: string;
  item_name: string;
  description: string;
  unit: string;
  contract_quantity: string;
  unit_rate: string;
  total_amount: string;
  order: number;
  notes: string;
  approved_quantity_to_date: string;
  remaining_quantity: string;
}

export interface ProgressCertificate {
  id: number;
  certificate_no: string;
  contract: number;
  contract_no: string;
  subcontractor: number;
  subcontractor_name: string;
  project: number | null;
  project_name: string;
  certificate_date: string;
  period_from: string | null;
  period_to: string | null;
  // Financials
  gross_claimed_amount: string;
  gross_approved_amount: string;
  previous_approved_amount: string;
  retention_amount: string;
  advance_deduction: string;
  other_deductions: string;
  other_deductions_notes: string;
  net_payable_amount: string;
  // Workflow
  status: 'draft' | 'submitted' | 'under_review' | 'reviewed' | 'approved' | 'rejected' | 'paid' | 'cancelled';
  submitted_by_name: string;
  reviewed_by_name: string;
  approved_by_name: string;
  review_date: string | null;
  approval_date: string | null;
  review_notes: string;
  rejection_reason: string;
  notes: string;
  items_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProgressCertificateItem {
  id: number;
  certificate: number;
  boq_item: number;
  item_name: string;
  unit: string;
  contract_quantity: string;
  unit_rate: string;
  previous_approved_quantity: string;
  contractor_claimed_quantity: string;
  engineer_approved_quantity: string;
  total_approved_quantity: string;
  remaining_quantity: string;
  current_approved_amount: string;
  previous_approved_amount: string;
  total_approved_amount: string;
  notes: string;
  rejection_reason: string;
}

export interface SubcontractorPayment {
  id: number;
  payment_no: string;
  certificate: number | null;
  certificate_no: string;
  contract: number;
  contract_no: string;
  subcontractor: number;
  subcontractor_name: string;
  project: number | null;
  project_name: string;
  payment_date: string;
  gross_amount: string;
  retention_amount: string;
  advance_deduction: string;
  other_deductions: string;
  net_paid_amount: string;
  payment_method: 'bank_transfer' | 'cheque' | 'cash' | '';
  reference_number: string;
  is_retention_release: boolean;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  created_by_name: string;
  approved_by_name: string;
  approval_date: string | null;
  notes: string;
  created_at: string;
}

export interface ContractAttachment {
  id: number;
  file: string;
  file_url: string | null;
  file_name: string;
  file_size: number;
  document_type: string;
  description: string;
  uploaded_by_name: string;
  created_at: string;
}

export interface BOQTemplateItem {
  id: number;
  section_code: string;
  section_name: string;
  item_code: string;
  item_name: string;
  description: string;
  default_unit: string;
  order: number;
  is_active: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  entity_type: string;
  entity_id: number;
  actor_name: string;
  action: string;
  description: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface SubcontractorDashboard {
  total_subcontractors: number;
  active_subcontractors: number;
  total_contracts: number;
  active_contracts: number;
  total_contract_value: string;
  total_approved_to_date: string;
  total_paid_to_date: string;
  total_retention_balance: string;
  pending_certificates: number;
  pending_payments: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ── API ───────────────────────────────────────────────────────────────────────

export const subcontractorsApi = {

  // Trade Types
  tradeTypes: {
    getAll: async (): Promise<TradeType[]> => {
      const res = await apiClient.get(`${BASE}/trade-types/`, { params: { page_size: 200 } });
      return res.data.results ?? res.data;
    },
  },

  // Subcontractors
  list: async (params?: Record<string, unknown>): Promise<PaginatedResponse<Subcontractor>> => {
    const res = await apiClient.get(`${BASE}/subcontractors/`, { params });
    return res.data;
  },

  getOne: async (id: number): Promise<Subcontractor> => {
    const res = await apiClient.get(`${BASE}/subcontractors/${id}/`);
    return res.data;
  },

  create: async (data: Partial<Subcontractor>): Promise<Subcontractor> => {
    const res = await apiClient.post(`${BASE}/subcontractors/`, data);
    return res.data;
  },

  update: async (id: number, data: Partial<Subcontractor>): Promise<Subcontractor> => {
    const res = await apiClient.patch(`${BASE}/subcontractors/${id}/`, data);
    return res.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${BASE}/subcontractors/${id}/`);
  },

  // Contracts
  contracts: {
    list: async (params?: Record<string, unknown>): Promise<PaginatedResponse<SubcontractorContract>> => {
      const res = await apiClient.get(`${BASE}/contracts/`, { params });
      return res.data;
    },

    getOne: async (id: number): Promise<SubcontractorContract> => {
      const res = await apiClient.get(`${BASE}/contracts/${id}/`);
      return res.data;
    },

    create: async (data: Partial<SubcontractorContract>): Promise<SubcontractorContract> => {
      const res = await apiClient.post(`${BASE}/contracts/`, data);
      return res.data;
    },

    update: async (id: number, data: Partial<SubcontractorContract>): Promise<SubcontractorContract> => {
      const res = await apiClient.patch(`${BASE}/contracts/${id}/`, data);
      return res.data;
    },

    delete: async (id: number): Promise<void> => {
      await apiClient.delete(`${BASE}/contracts/${id}/`);
    },

    submit: async (id: number): Promise<SubcontractorContract> => {
      const res = await apiClient.post(`${BASE}/contracts/${id}/review/`);
      return res.data;
    },

    review: async (id: number, data: { notes?: string }): Promise<SubcontractorContract> => {
      const res = await apiClient.post(`${BASE}/contracts/${id}/review/`, data);
      return res.data;
    },

    approve: async (id: number, data: { notes?: string }): Promise<SubcontractorContract> => {
      const res = await apiClient.post(`${BASE}/contracts/${id}/approve/`, data);
      return res.data;
    },

    reject: async (id: number, data: { reason: string }): Promise<SubcontractorContract> => {
      const res = await apiClient.post(`${BASE}/contracts/${id}/reject/`, data);
      return res.data;
    },

    activate: async (id: number): Promise<SubcontractorContract> => {
      const res = await apiClient.post(`${BASE}/contracts/${id}/activate/`);
      return res.data;
    },

    close: async (id: number): Promise<SubcontractorContract> => {
      const res = await apiClient.post(`${BASE}/contracts/${id}/close/`);
      return res.data;
    },
  },

  // BOQ Items
  boqItems: {
    list: async (contractId: number): Promise<ContractBOQItem[]> => {
      const res = await apiClient.get(`${BASE}/boq-items/`, { params: { contract: contractId, page_size: 200 } });
      return res.data.results ?? res.data;
    },

    create: async (data: Partial<ContractBOQItem>): Promise<ContractBOQItem> => {
      const res = await apiClient.post(`${BASE}/boq-items/`, data);
      return res.data;
    },

    update: async (id: number, data: Partial<ContractBOQItem>): Promise<ContractBOQItem> => {
      const res = await apiClient.patch(`${BASE}/boq-items/${id}/`, data);
      return res.data;
    },

    delete: async (id: number): Promise<void> => {
      await apiClient.delete(`${BASE}/boq-items/${id}/`);
    },

    bulkCreate: async (contractId: number, items: Partial<ContractBOQItem>[]): Promise<ContractBOQItem[]> => {
      const res = await apiClient.post(`${BASE}/boq-items/bulk_create/`, { contract: contractId, items });
      return res.data;
    },
  },

  // Certificates
  certificates: {
    list: async (params?: Record<string, unknown>): Promise<PaginatedResponse<ProgressCertificate>> => {
      const res = await apiClient.get(`${BASE}/certificates/`, { params });
      return res.data;
    },

    getOne: async (id: number): Promise<ProgressCertificate> => {
      const res = await apiClient.get(`${BASE}/certificates/${id}/`);
      return res.data;
    },

    create: async (data: Partial<ProgressCertificate>): Promise<ProgressCertificate> => {
      const res = await apiClient.post(`${BASE}/certificates/`, data);
      return res.data;
    },

    update: async (id: number, data: Partial<ProgressCertificate>): Promise<ProgressCertificate> => {
      const res = await apiClient.patch(`${BASE}/certificates/${id}/`, data);
      return res.data;
    },

    delete: async (id: number): Promise<void> => {
      await apiClient.delete(`${BASE}/certificates/${id}/`);
    },

    submit: async (id: number): Promise<ProgressCertificate> => {
      const res = await apiClient.post(`${BASE}/certificates/${id}/submit/`);
      return res.data;
    },

    review: async (id: number, data: { notes?: string }): Promise<ProgressCertificate> => {
      const res = await apiClient.post(`${BASE}/certificates/${id}/review/`, data);
      return res.data;
    },

    approve: async (id: number, data: { notes?: string }): Promise<ProgressCertificate> => {
      const res = await apiClient.post(`${BASE}/certificates/${id}/approve/`, data);
      return res.data;
    },

    reject: async (id: number, data: { reason: string }): Promise<ProgressCertificate> => {
      const res = await apiClient.post(`${BASE}/certificates/${id}/reject/`, data);
      return res.data;
    },

    recalculate: async (id: number): Promise<ProgressCertificate> => {
      const res = await apiClient.post(`${BASE}/certificates/${id}/recalculate/`);
      return res.data;
    },

    getItems: async (certificateId: number): Promise<ProgressCertificateItem[]> => {
      const res = await apiClient.get(`${BASE}/certificate-items/`, {
        params: { certificate: certificateId, page_size: 200 },
      });
      return res.data.results ?? res.data;
    },

    saveItems: async (certificateId: number, items: Partial<ProgressCertificateItem>[]): Promise<ProgressCertificateItem[]> => {
      const res = await apiClient.post(`${BASE}/certificate-items/bulk_save/`, {
        certificate: certificateId,
        items,
      });
      return res.data;
    },
  },

  // Payments
  payments: {
    list: async (params?: Record<string, unknown>): Promise<PaginatedResponse<SubcontractorPayment>> => {
      const res = await apiClient.get(`${BASE}/payments/`, { params });
      return res.data;
    },

    getOne: async (id: number): Promise<SubcontractorPayment> => {
      const res = await apiClient.get(`${BASE}/payments/${id}/`);
      return res.data;
    },

    create: async (data: Partial<SubcontractorPayment>): Promise<SubcontractorPayment> => {
      const res = await apiClient.post(`${BASE}/payments/`, data);
      return res.data;
    },

    update: async (id: number, data: Partial<SubcontractorPayment>): Promise<SubcontractorPayment> => {
      const res = await apiClient.patch(`${BASE}/payments/${id}/`, data);
      return res.data;
    },

    approve: async (id: number): Promise<SubcontractorPayment> => {
      const res = await apiClient.post(`${BASE}/payments/${id}/approve/`);
      return res.data;
    },

    markPaid: async (id: number, data: { reference_number?: string; payment_method?: string }): Promise<SubcontractorPayment> => {
      const res = await apiClient.post(`${BASE}/payments/${id}/mark_paid/`, data);
      return res.data;
    },

    cancel: async (id: number): Promise<SubcontractorPayment> => {
      const res = await apiClient.post(`${BASE}/payments/${id}/cancel/`);
      return res.data;
    },
  },

  // Attachments
  attachments: {
    upload: async (formData: FormData): Promise<ContractAttachment> => {
      const res = await apiClient.post(`${BASE}/attachments/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },

    delete: async (id: number): Promise<void> => {
      await apiClient.delete(`${BASE}/attachments/${id}/`);
    },

    listForContract: async (contractId: number): Promise<ContractAttachment[]> => {
      const res = await apiClient.get(`${BASE}/attachments/`, { params: { contract: contractId } });
      return res.data.results ?? res.data;
    },

    listForCertificate: async (certificateId: number): Promise<ContractAttachment[]> => {
      const res = await apiClient.get(`${BASE}/attachments/`, { params: { certificate: certificateId } });
      return res.data.results ?? res.data;
    },
  },

  // Activity Logs
  activityLogs: {
    list: async (params: { entity_type?: string; entity_id?: number; page?: number }): Promise<PaginatedResponse<ActivityLog>> => {
      const res = await apiClient.get(`${BASE}/activity-logs/`, { params });
      return res.data;
    },
  },

  // BOQ Template Library
  boqTemplates: {
    list: async (params?: Record<string, unknown>): Promise<PaginatedResponse<BOQTemplateItem>> => {
      const res = await apiClient.get(`${BASE}/boq-templates/`, { params });
      return res.data;
    },

    listAll: async (): Promise<BOQTemplateItem[]> => {
      const res = await apiClient.get(`${BASE}/boq-templates/`, { params: { page_size: 500, active: 'true' } });
      return res.data.results ?? res.data;
    },

    sections: async (): Promise<string[]> => {
      const res = await apiClient.get(`${BASE}/boq-templates/`, { params: { page_size: 500, active: 'true' } });
      const items: BOQTemplateItem[] = res.data.results ?? res.data;
      const seen = new Set<string>();
      return items.filter(i => { if (seen.has(i.section_code)) return false; seen.add(i.section_code); return true; })
                  .map(i => i.section_code);
    },

    create: async (data: Omit<BOQTemplateItem, 'id' | 'created_at'>): Promise<BOQTemplateItem> => {
      const res = await apiClient.post(`${BASE}/boq-templates/`, data);
      return res.data;
    },

    update: async (id: number, data: Partial<Omit<BOQTemplateItem, 'id' | 'created_at'>>): Promise<BOQTemplateItem> => {
      const res = await apiClient.patch(`${BASE}/boq-templates/${id}/`, data);
      return res.data;
    },

    delete: async (id: number): Promise<void> => {
      await apiClient.delete(`${BASE}/boq-templates/${id}/`);
    },
  },

  // Dashboard
  getDashboard: async (): Promise<SubcontractorDashboard> => {
    const res = await apiClient.get(`${BASE}/dashboard/`);
    return res.data;
  },
};
