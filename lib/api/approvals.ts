import apiClient from './client';

export interface ApprovalAction {
  step_order: number;
  actor__username: string;
  actor__first_name: string;
  actor__last_name: string;
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

export const approvalsApi = {
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
    return res.data;
  },
};
