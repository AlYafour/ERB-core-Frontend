import apiClient from './client';
import { PurchaseRequest, PurchaseRequestItem, PurchaseRequestCharge, PaginatedResponse } from '@/types';

export const purchaseRequestsApi = {
  getAll: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    // Text filters
    code?: string;
    title?: string;
    notes?: string;
    // Choice filters
    status?: string;
    // Foreign key filters
    created_by?: number;
    approved_by?: number;
    project?: number;
    project_code?: string;
    // Date filters
    request_date_after?: string;
    request_date_before?: string;
    required_by_after?: string;
    required_by_before?: string;
    created_at_after?: string;
    created_at_before?: string;
  }): Promise<PaginatedResponse<PurchaseRequest>> => {
    const response = await apiClient.get('/purchase-requests/', { params });
    return response.data;
  },

  getById: async (id: number): Promise<PurchaseRequest> => {
    const response = await apiClient.get(`/purchase-requests/${id}/`);
    return response.data;
  },

  create: async (data: {
    project_id?: number | null;
    title: string;
    request_date: string;
    required_by: string;
    notes?: string;
    items: Omit<PurchaseRequestItem, 'product' | 'created_at'>[];
    charges?: Omit<PurchaseRequestCharge, 'id' | 'purchase_request_id' | 'total'>[];
  }): Promise<PurchaseRequest> => {
    const response = await apiClient.post('/purchase-requests/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<PurchaseRequest>): Promise<PurchaseRequest> => {
    const response = await apiClient.patch(`/purchase-requests/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/purchase-requests/${id}/`);
  },

  approve: async (id: number): Promise<PurchaseRequest> => {
    const response = await apiClient.post(`/purchase-requests/${id}/approve/`);
    return response.data;
  },

  reject: async (id: number, rejection_reason: string): Promise<PurchaseRequest> => {
    const response = await apiClient.post(`/purchase-requests/${id}/reject/`, {
      rejection_reason,
    });
    return response.data;
  },

  updateItem: async (itemId: number, data: { product_id?: number; quantity?: number; unit?: string; reason?: string; notes?: string }): Promise<PurchaseRequestItem> => {
    const response = await apiClient.patch(`/purchase-requests/items/${itemId}/`, data);
    return response.data;
  },

  addItem: async (data: { purchase_request_id: number; product_id: number; quantity: number; unit?: string; reason?: string; notes?: string }): Promise<PurchaseRequestItem> => {
    const response = await apiClient.post(`/purchase-requests/items/`, data);
    return response.data;
  },

  deleteItem: async (itemId: number): Promise<void> => {
    await apiClient.delete(`/purchase-requests/items/${itemId}/`);
  },

  addCharge: async (data: { purchase_request_id: number; description: string; charge_type: 'lump_sum' | 'per_unit'; rate: number; quantity?: number }): Promise<PurchaseRequestCharge> => {
    const response = await apiClient.post('/purchase-requests/charges/', data);
    return response.data;
  },

  updateCharge: async (chargeId: number, data: Partial<PurchaseRequestCharge>): Promise<PurchaseRequestCharge> => {
    const response = await apiClient.patch(`/purchase-requests/charges/${chargeId}/`, data);
    return response.data;
  },

  deleteCharge: async (chargeId: number): Promise<void> => {
    await apiClient.delete(`/purchase-requests/charges/${chargeId}/`);
  },

  undoApproval: async (id: number): Promise<PurchaseRequest> => {
    const response = await apiClient.post(`/purchase-requests/${id}/undo_approval/`);
    return response.data;
  },

  allowAdditionalOrder: async (id: number): Promise<PurchaseRequest> => {
    const response = await apiClient.post(`/purchase-requests/${id}/allow_additional_order/`);
    return response.data;
  },

  getTrackingTimeline: async (id: number): Promise<{
    purchase_request: {
      id: number;
      code: string;
      title: string;
      status: string;
    };
    timeline: Array<{
      stage: string;
      stage_name: string;
      status: 'completed' | 'in_progress' | 'pending' | 'rejected';
      user: string | null;
      user_role: string | null;
      timestamp: string | null;
      duration: string | null;
      notes: string | null;
      documents: Array<{
        type: string;
        url: string;
        name: string;
      }>;
      related_id: number;
      related_type: string;
    }>;
    current_stage: string;
    total_duration: string | null;
  }> => {
    const response = await apiClient.get(`/purchase-requests/${id}/tracking_timeline/`);
    return response.data;
  },
};

