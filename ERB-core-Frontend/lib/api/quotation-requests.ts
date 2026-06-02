import apiClient from './client';
import { QuotationRequest, QuotationRequestItem, PaginatedResponse } from '@/types';

export const quotationRequestsApi = {
  getAll: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    // Foreign key filters
    supplier?: number;
    purchase_request?: number;
    created_by?: number;
    // Text filters
    notes?: string;
    // Status filter
    status?: string;
    // Date filters
    created_at_after?: string;
    created_at_before?: string;
  }): Promise<PaginatedResponse<QuotationRequest>> => {
    const response = await apiClient.get('/quotation-requests/', { params });
    return response.data;
  },

  getById: async (id: number): Promise<QuotationRequest> => {
    const response = await apiClient.get(`/quotation-requests/${id}/`);
    return response.data;
  },

  create: async (data: {
    purchase_request_id: number;
    supplier_id: number;
    notes?: string;
    items: Omit<QuotationRequestItem, 'product' | 'created_at'>[];
  }): Promise<QuotationRequest> => {
    const response = await apiClient.post('/quotation-requests/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<QuotationRequest>): Promise<QuotationRequest> => {
    const response = await apiClient.patch(`/quotation-requests/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/quotation-requests/${id}/`);
  },
};

