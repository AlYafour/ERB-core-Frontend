import apiClient from './client';

export interface ApprovalAction {
  id: number;
  step_order: number;
  actor: number;
  actor_username: string;
  action: 'APPROVE' | 'REJECT' | 'ESCALATE' | 'COMMENT';
  comment: string;
  acted_at: string;
}

export interface ApprovalStatus {
  instance_id: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  current_step: number;
  total_steps: number;
  current_approver_id: number | null;
  policy_name: string;
  actions: ApprovalAction[];
}

export interface RequestType {
  id: number;
  code: string;
  name: string;
  name_ar: string;
  is_active: boolean;
}

export interface ApprovalStep {
  id?: number;
  policy?: number;
  order: number;
  approver_strategy: 'DIRECT_MANAGER' | 'INDIRECT_MANAGER' | 'ROLE' | 'SPECIFIC_USER';
  role: number | null;
  role_display: string | null;
  sod_fallback_role: number | null;
  sod_role_display: string | null;
  sod_fallback_strategy: 'DIRECT_MANAGER' | 'INDIRECT_MANAGER' | 'ROLE' | 'SPECIFIC_USER' | null;
  sod_fallback_user: number | null;
  specific_user: number | null;
  escalation_after_hours: number | null;
}

export interface ApprovalPolicy {
  id: number;
  name: string;
  is_active: boolean;
  priority: number;
  request_types: number[];
  request_type_names: string[];
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  steps: ApprovalStep[];
  created_at: string;
  updated_at: string;
}

export const approvalsApi = {
  // ─── Request Types ───────────────────────────────────────────
  getRequestTypes: async (): Promise<RequestType[]> => {
    const res = await apiClient.get('/approvals/request-types/?page_size=100');
    return res.data?.results ?? res.data;
  },

  // ─── Policies ────────────────────────────────────────────────
  getPolicies: async (params?: Record<string, unknown>): Promise<ApprovalPolicy[]> => {
    const res = await apiClient.get('/approvals/policies/', { params: { page_size: 100, ...params } });
    return res.data?.results ?? res.data;
  },

  createPolicy: async (data: Partial<ApprovalPolicy>): Promise<ApprovalPolicy> => {
    const res = await apiClient.post('/approvals/policies/', data);
    return res.data;
  },

  updatePolicy: async (id: number, data: Partial<ApprovalPolicy>): Promise<ApprovalPolicy> => {
    const res = await apiClient.patch(`/approvals/policies/${id}/`, data);
    return res.data;
  },

  deletePolicy: async (id: number): Promise<void> => {
    await apiClient.delete(`/approvals/policies/${id}/`);
  },

  // ─── Steps ───────────────────────────────────────────────────
  createStep: async (data: Omit<ApprovalStep, 'id'>): Promise<ApprovalStep> => {
    const res = await apiClient.post('/approvals/steps/', data);
    return res.data;
  },

  updateStep: async (id: number, data: Partial<ApprovalStep>): Promise<ApprovalStep> => {
    const res = await apiClient.patch(`/approvals/steps/${id}/`, data);
    return res.data;
  },

  deleteStep: async (id: number): Promise<void> => {
    await apiClient.delete(`/approvals/steps/${id}/`);
  },

  // ─── Instances (approve / reject) ────────────────────────────
  approve: async (instanceId: number, comment = ''): Promise<void> => {
    await apiClient.post(`/approvals/instances/${instanceId}/approve/`, { comment });
  },

  reject: async (instanceId: number, comment: string): Promise<void> => {
    await apiClient.post(`/approvals/instances/${instanceId}/reject/`, { comment });
  },

  getInstance: async (instanceId: number) => {
    const res = await apiClient.get(`/approvals/instances/${instanceId}/`);
    return res.data;
  },

  getMyPending: async () => {
    const res = await apiClient.get('/approvals/instances/', { params: { status: 'pending' } });
    return res.data?.results ?? res.data;
  },
};
