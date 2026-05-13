import apiClient from './client';
import { PurchaseOrder, PurchaseOrderItem, PaginatedResponse } from '@/types';

export const purchaseOrdersApi = {
  getAll: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    // Text filters
    order_number?: string;
    notes?: string;
    payment_terms?: string;
    delivery_terms?: string;
    // Foreign key filters
    supplier?: number;
    purchase_request?: number;
    purchase_quotation?: number;
    created_by?: number;
    // Status filter
    status?: string;
    // Range filters
    total_min?: number;
    total_max?: number;
    subtotal_min?: number;
    subtotal_max?: number;
    // Date filters
    order_date_after?: string;
    order_date_before?: string;
    delivery_date_after?: string;
    delivery_date_before?: string;
    created_at_after?: string;
    created_at_before?: string;
  }): Promise<PaginatedResponse<PurchaseOrder>> => {
    const response = await apiClient.get('/purchase-orders/', { params });
    return response.data;
  },

  getById: async (id: number): Promise<PurchaseOrder> => {
    const response = await apiClient.get(`/purchase-orders/${id}/`);
    return response.data;
  },

  create: async (data: {
    purchase_request_id?: number | null;
    purchase_quotation_id?: number | null;
    supplier_id: number;
    cost_code_id?: number | null;
    order_date: string;
    delivery_date?: string;
    payment_terms?: string;
    delivery_method?: string;
    delivery_terms?: string;
    notes?: string;
    terms_and_conditions?: string;
    tax_rate?: number;
    discount?: number;
    status?: string;
    items: Omit<PurchaseOrderItem, 'product' | 'total' | 'created_at'>[];
  }): Promise<PurchaseOrder> => {
    const response = await apiClient.post('/purchase-orders/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<PurchaseOrder>): Promise<PurchaseOrder> => {
    const response = await apiClient.patch(`/purchase-orders/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/purchase-orders/${id}/`);
  },

  approve: async (id: number): Promise<PurchaseOrder> => {
    const response = await apiClient.post(`/purchase-orders/${id}/approve/`);
    return response.data;
  },

  reject: async (id: number, rejection_reason: string): Promise<PurchaseOrder> => {
    const response = await apiClient.post(`/purchase-orders/${id}/reject/`, { rejection_reason });
    return response.data;
  },

  cancel: async (id: number, cancel_reason: string): Promise<PurchaseOrder> => {
    const response = await apiClient.post(`/purchase-orders/${id}/cancel/`, { cancel_reason });
    return response.data;
  },
};

