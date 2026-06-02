import apiClient from './client';
import { PurchaseQuotation, PurchaseQuotationItem, PaginatedResponse } from '@/types';

export const purchaseQuotationsApi = {
  getAll: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    // Text filters
    quotation_number?: string;
    notes?: string;
    payment_terms?: string;
    delivery_terms?: string;
    // Foreign key filters
    supplier?: number;
    quotation_request?: number;
    created_by?: number;
    // Range filters
    total_min?: number;
    total_max?: number;
    subtotal_min?: number;
    subtotal_max?: number;
    // Date filters
    quotation_date_after?: string;
    quotation_date_before?: string;
    valid_until_after?: string;
    valid_until_before?: string;
    created_at_after?: string;
    created_at_before?: string;
  }): Promise<PaginatedResponse<PurchaseQuotation>> => {
    const response = await apiClient.get('/purchase-quotations/', { params });
    return response.data;
  },

  getById: async (id: number): Promise<PurchaseQuotation> => {
    const response = await apiClient.get(`/purchase-quotations/${id}/`);
    return response.data;
  },

  create: async (data: {
    quotation_request_id?: number | null;
    purchase_request_id?: number | null;
    supplier_id: number;
    quotation_number: string;
    quotation_date: string;
    valid_until?: string;
    payment_terms?: string;
    delivery_terms?: string;
    notes?: string;
    tax_rate?: number;
    discount?: number;
    items: Omit<PurchaseQuotationItem, 'product' | 'total' | 'created_at'>[];
  }): Promise<PurchaseQuotation> => {
    const response = await apiClient.post('/purchase-quotations/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<PurchaseQuotation>): Promise<PurchaseQuotation> => {
    const response = await apiClient.patch(`/purchase-quotations/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/purchase-quotations/${id}/`);
  },

  award: async (id: number): Promise<PurchaseQuotation> => {
    const response = await apiClient.post(`/purchase-quotations/${id}/award/`);
    return response.data;
  },

  reject: async (id: number): Promise<PurchaseQuotation> => {
    const response = await apiClient.post(`/purchase-quotations/${id}/reject/`);
    return response.data;
  },
};

